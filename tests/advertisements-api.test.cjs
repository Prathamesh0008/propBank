const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),sharp=require('sharp');
const {isolated,users,request,route,context}=require('./fixtures/native-server.cjs');
const COLLECTION='advertisements',PRIVATE='propbank-private-test';
const fresh=()=>{const app=isolated({users:structuredClone(users)});app.env.TEST_STRICT_TRANSACTIONS='1';return app;};
const png=()=>sharp({create:{width:32,height:16,channels:3,background:'#c89432'}}).png().toBuffer();
function form(bytes,{active=true,destination='https://example.invalid/promotion',version,type='image/png'}={}){const body=new FormData();body.set('active',String(active));body.set('destinationUrl',destination);if(version!==undefined)body.set('version',String(version));if(bytes)body.set('image',new File([bytes],'advertisement.png',{type}));return body;}
function upload(app,bytes,options={},id=crypto.randomUUID(),uid='admin'){const req=request('/admin/advertisements',uid,'POST',form(bytes,options));req.headers.set('Idempotency-Key',id);return route(app,'admin/advertisements').POST(req);}
async function created(app,options={}){const response=await upload(app,await png(),options);assert.equal(response.status,200,await response.clone().text());return (await response.json()).advertisement;}
const update=(app,ad,bytes,options={})=>route(app,'admin/advertisements/[id]').PUT(request('/admin/advertisements/'+ad.id,'admin','PUT',form(bytes,{version:ad.version,...options})),context(ad.id));
const remove=(app,ad)=>route(app,'admin/advertisements/[id]').DELETE(request('/admin/advertisements/'+ad.id,'admin','DELETE',{version:ad.version}),context(ad.id));
const recover=(app,id)=>route(app,'admin/advertisements/[id]/cleanup').POST(request('/admin/advertisements/'+id+'/cleanup','admin','POST'),context(id));
const list=app=>route(app,'advertisements').GET(request('/advertisements'));
const image=(app,id,uid)=>route(app,'advertisements/[id]/image').GET(request('/advertisements/'+id+'/image',uid),context(id));

test('admin creates dedicated R2 images; public response is allowlisted, bounded and active-only',async()=>{
 const app=fresh(),ad=await created(app),stored=app.state[COLLECTION][ad.id];
 assert.equal(ad.active,true);assert.equal(ad.version,1);assert.equal(stored.image.bucket,PRIVATE);assert.match(stored.image.key,new RegExp('^advertisements/'+ad.id+'/'));assert.ok(stored.createdAt instanceof Date);assert.ok(stored.updatedAt instanceof Date);
 const response=await list(app),body=await response.json();assert.equal(body.items.length,1);assert.deepEqual(Object.keys(body.items[0]).sort(),['destinationUrl','height','id','imageUrl','width']);assert.equal(body.items[0].imageUrl,ad.imageUrl);assert.ok(!JSON.stringify(body).includes(PRIVATE));assert.ok(app.reads.some(read=>read.collection===COLLECTION&&read.returnedDocuments===1));
 const media=await image(app,ad.id);assert.equal(media.status,200);assert.equal(media.headers.get('Content-Type'),'image/webp');assert.equal(media.headers.get('Cache-Control'),'private, no-cache, must-revalidate');assert.ok(media.headers.get('ETag'));const metadata=await sharp(Buffer.from(await media.arrayBuffer())).metadata();assert.equal(metadata.width,32);assert.equal(metadata.height,16);assert.equal(metadata.exif,undefined);
 const listing=await route(app,'admin/advertisements').GET(request('/admin/advertisements','admin'));assert.equal((await listing.json()).items.length,1);assert.equal(Object.keys(app.state.properties||{}).length,0);
});
test('all admin writes and listing reject anonymous, owner and tenant callers before storage',async()=>{
 const app=fresh(),bytes=await png(),id=crypto.randomUUID();for(const uid of [undefined,'owner','tenant']){
  assert.ok([401,403].includes((await upload(app,bytes,{},id,uid===undefined?'':uid)).status));
  assert.ok([401,403].includes((await route(app,'admin/advertisements').GET(request('/admin/advertisements',uid))).status));
  for(const method of ['PUT','DELETE']){const response=await route(app,'admin/advertisements/[id]')[method](request('/admin/advertisements/'+id,uid,method,method==='PUT'?form(bytes,{version:1}):{version:1}),context(id));assert.ok([401,403].includes(response.status));}
  assert.ok([401,403].includes((await route(app,'admin/advertisements/[id]/cleanup').POST(request('/cleanup',uid,'POST'),context(id))).status));
 }assert.equal(app.objects.length,0);assert.equal(Object.keys(app.state[COLLECTION]||{}).length,0);
});
test('content, MIME, size and HTTPS validation reject invalid input without writes',async()=>{
 const app=fresh(),bytes=await png();for(const [data,options]of [[Buffer.from('<svg/>'),{}],[bytes,{type:'image/jpeg'}],[bytes,{type:'image/svg+xml'}],[Buffer.alloc(0),{}],[Buffer.alloc(4*1024*1024+1),{}]]){const response=await upload(app,data,options);assert.equal(response.status,400,await response.clone().text());}
 for(const destination of ['http://example.invalid','javascript:alert(1)','//example.invalid','https://user:secret@example.invalid','https://example.invalid\n'])assert.equal((await upload(app,bytes,{destination})).status,400);
 assert.equal(app.objects.length,0);assert.equal(Object.keys(app.state[COLLECTION]||{}).length,0);
});
test('re-encoding strips EXIF and respects orientation without cropping',async()=>{
 const app=fresh(),bytes=await sharp({create:{width:40,height:20,channels:3,background:'white'}}).jpeg().withMetadata({orientation:6}).toBuffer();const result=await upload(app,bytes,{type:'image/jpeg'});assert.equal(result.status,200);const ad=(await result.json()).advertisement;assert.equal(ad.width,20);assert.equal(ad.height,40);const res=await image(app,ad.id);const metadata=await sharp(Buffer.from(await res.arrayBuffer())).metadata();assert.equal(metadata.exif,undefined);assert.equal(metadata.orientation,undefined);
});
test('same create request is idempotent; concurrent requests do not upload twice',async()=>{
 const app=fresh(),id=crypto.randomUUID(),bytes=await png();const results=await Promise.all([upload(app,bytes,{},id),upload(app,bytes,{},id)]);assert.ok(results.every(r=>[200,409].includes(r.status)));assert.ok(results.some(r=>r.status===200));const retry=await upload(app,bytes,{},id);assert.equal(retry.status,200);assert.equal((await retry.json()).advertisement.id,id);assert.equal(app.state[COLLECTION].__inventory.ids.length,1);assert.equal(app.objects.filter(o=>o.operation==='PutObjectCommand').length,1);
 assert.equal((await upload(app,bytes,{destination:'https://different.invalid'},id)).status,409);
});
test('metadata and image replacement use versions; cleanup cannot remove another advertisement',async()=>{
 const app=fresh(),one=await created(app),two=await created(app),oldKey=app.state[COLLECTION][one.id].image.key,otherKey=app.state[COLLECTION][two.id].image.key;
 let response=await update(app,one,undefined,{active:false,destination:''});assert.equal(response.status,200);const inactive=(await response.json()).advertisement;assert.equal(inactive.active,false);assert.equal(inactive.destinationUrl,'');assert.equal(app.state[COLLECTION][one.id].image.key,oldKey);
 assert.equal((await update(app,one,undefined)).status,409);assert.equal((await image(app,one.id)).status,404);assert.equal((await image(app,one.id,'owner')).status,404);assert.equal((await image(app,one.id,'admin')).status,200);
 response=await update(app,inactive,await png(),{active:true});assert.equal(response.status,200);const replaced=(await response.json()).advertisement;const newKey=app.state[COLLECTION][one.id].image.key;assert.notEqual(newKey,oldKey);assert.equal(app.storage.has(PRIVATE+'/'+oldKey),false);assert.equal(app.storage.has(PRIVATE+'/'+otherKey),true);
 assert.equal((await remove(app,replaced)).status,200);assert.equal((await image(app,one.id,'admin')).status,404);assert.equal(app.storage.has(PRIVATE+'/'+newKey),false);assert.equal(app.storage.has(PRIVATE+'/'+otherKey),true);assert.deepEqual((await (await list(app)).json()).items.map(row=>row.id),[two.id]);
 assert.equal((await remove(app,replaced)).status,200);
});
test('replacement races accept one writer and reject stale versions',async()=>{
 const app=fresh(),ad=await created(app),bytes=await png();const responses=await Promise.all([update(app,ad,bytes),update(app,ad,bytes)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(app.state[COLLECTION][ad.id].version,2);assert.equal(app.state[COLLECTION][ad.id].pending,null);
});
test('deletion failure removes public access first and exposes recoverable file cleanup',async()=>{
 const app=fresh(),ad=await created(app),key=app.state[COLLECTION][ad.id].image.key;app.env.TEST_R2_DELETE_FAIL='1';const response=await remove(app,ad);assert.equal(response.status,200);assert.equal((await response.json()).advertisement.needsCleanup,true);assert.equal((await (await list(app)).json()).items.length,0);assert.equal((await image(app,ad.id)).status,404);assert.equal(app.storage.has(PRIVATE+'/'+key),true);
 delete app.env.TEST_R2_DELETE_FAIL;assert.equal((await recover(app,ad.id)).status,200);assert.equal(app.storage.has(PRIVATE+'/'+key),false);assert.equal(app.state[COLLECTION].__inventory.ids.length,0);
});
test('upload failures retain durable recovery metadata; no active advertisement leaks',async()=>{
 const app=fresh(),id=crypto.randomUUID();app.r2Outage();const response=await upload(app,await png(),{},id);assert.equal(response.status,502);const row=app.state[COLLECTION][id];assert.equal(row.active,false);assert.equal(row.deleted,true);assert.equal(row.garbage.length,1);assert.equal((await (await list(app)).json()).items.length,0);
 app.r2Restore();row.garbage[0].after=0;assert.equal((await recover(app,id)).status,200);assert.equal(app.state[COLLECTION].__inventory.ids.length,0);
});
test('DB failure before staging performs no R2 write; failure after upload remains recoverable',async()=>{
 let app=fresh();app.env.TEST_DB_WRITE_COLLECTION=COLLECTION;assert.equal((await upload(app,await png())).status,500);assert.equal(app.objects.length,0);
 app=fresh();const client=app.load('@/lib/server/r2').getR2Client(),send=client.send.bind(client);client.send=async command=>{const result=await send(command);if(command.constructor.name==='PutObjectCommand')app.env.TEST_DB_WRITE_COLLECTION=COLLECTION;return result;};const id=crypto.randomUUID();assert.equal((await upload(app,await png(),{},id)).status,502);assert.ok(app.state[COLLECTION][id].pending);assert.equal((await (await list(app)).json()).items.length,0);delete app.env.TEST_DB_WRITE_COLLECTION;app.state[COLLECTION][id].pending.expiresAt=0;assert.equal((await recover(app,id)).status,200);assert.equal(app.state[COLLECTION].__inventory.ids.length,0);
});
test('active and inventory limits are enforced without composite indexes or scans',async()=>{
 const app=fresh(),bytes=await png(),ads=[];for(let i=0;i<8;i++)ads.push(await created(app));assert.equal((await upload(app,bytes)).status,409);const inactive=await created(app,{active:false});assert.equal((await update(app,inactive,undefined,{active:true})).status,409);assert.equal((await update(app,ads[0],undefined,{active:false})).status,200);assert.equal((await update(app,inactive,undefined,{active:true})).status,200);
 const response=await list(app);assert.equal((await response.json()).items.length,8);assert.ok(app.reads.filter(r=>r.collection===COLLECTION&&r.returnedDocuments!==undefined).every(r=>r.returnedDocuments<=8));
 const full=fresh();full.state[COLLECTION]={__inventory:{ids:Array.from({length:40},()=>crypto.randomUUID()),activeIds:[]}};assert.equal((await upload(full,bytes,{active:false})).status,409);assert.equal(full.objects.length,0);
});
test('public image rejects cross-namespace storage references and image request is read-only',async()=>{
 const app=fresh(),ad=await created(app);app.state[COLLECTION][ad.id].image.key='properties/secret';const before=app.objects.length;assert.equal((await image(app,ad.id)).status,409);assert.equal(app.objects.length,before);assert.equal((await image(app,'__inventory')).status,400);
});
