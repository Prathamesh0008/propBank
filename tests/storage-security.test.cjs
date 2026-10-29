const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const image='data:image/png;base64,AQID',pdf='data:application/pdf;base64,JVBERi0xLjQK';
const setup=()=>isolated({users,properties:{P:properties.P,Q:{...properties.P,id:'Q',ownerUID:'other',tenants:[]}}});
async function upload(app,uid='owner',extra={}){const response=await route(app,'upload/image').POST(request('/upload/image',uid,'POST',{image,...extra}));assert.equal(response.status,200,await response.clone().text());return (await response.json()).url;}
async function document(app,uid='tenant',fileUrl=pdf,propertyId='P') {const response=await route(app,'documents').POST(request('/documents',uid,'POST',{propertyId,documentName:'Private evidence',documentType:'Agreement',fileUrl}));assert.equal(response.status,201,await response.clone().text());return (await response.json()).document;}
const get=(app,url,uid)=>route(app,'media/[id]').GET(request(url.replace('/api',''),uid),context(url.split('/').at(-1).split('#')[0]));

test('new documents use private bucket, never return a public object key or permanent URL',async()=>{
 const app=setup(),doc=await document(app);assert.match(doc.fileUrl,/^\/api\/media\/[a-f0-9-]{36}(?:#file\.pdf)?$/);assert.ok(!JSON.stringify(doc).includes('existing-r2.test'));const put=app.objects.find(o=>o.operation==='PutObjectCommand');assert.equal(put.Bucket,'propbank-private-test');assert.match(put.Key,/^managed\//);assert.equal(put.CacheControl,'private, no-store');assert.equal(app.state.documents[doc.id].fileUrl,doc.fileUrl);
});
test('private downloads reject anonymous, unrelated and expired users before storage reads',async()=>{
 const app=setup(),doc=await document(app),before=app.objects.length;
 for(const [uid,status]of [[null,401],['other',403],['expired-token',401]])assert.equal((await get(app,doc.fileUrl,uid)).status,status);
 assert.equal(app.objects.length,before);
 for(const uid of ['owner','tenant','admin']){const response=await get(app,doc.fileUrl,uid);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.ok((await response.arrayBuffer()).byteLength>0);}
});
test('current tenancy is rechecked and knowing an object key never grants access',async()=>{
 const app=setup(),doc=await document(app);app.state.properties.P.tenants[0].isActive=false;app.state.properties.P.rentalStatus='available';assert.equal((await get(app,doc.fileUrl,'tenant')).status,403);
 assert.equal((await route(app,'media/[id]').GET(request('/media/managed/key','owner'),context('managed/key'))).status,404);
});
test('another user upload and wrong-property attachment fail without creating documents',async()=>{
 const app=setup(),url=await upload(app,'owner',{folder:'documents/P'});
 const api=route(app,'documents'),payload={propertyId:'Q',documentName:'Cross property',documentType:'Agreement',fileUrl:url};
 assert.equal((await api.POST(request('/documents','other','POST',payload))).status,403);
 assert.equal((await api.POST(request('/documents','admin','POST',payload))).status,403);assert.equal(Object.keys(app.state.documents||{}).length,0);
});
test('session cookies are HttpOnly, scoped and revocation/profile changes take effect on download',async()=>{
 const app=setup(),doc=await document(app),session=route(app,'media/session');
 const response=await session.POST(request('/media/session','tenant','POST'));assert.equal(response.status,204);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Path=\/api\/media/);assert.match(cookie,/SameSite=Strict/);
 const download=()=>route(app,'media/[id]').GET(new Request('http://local'+doc.fileUrl,{headers:{cookie}}),context(doc.fileUrl.split('/').at(-1).split('#')[0]));
 assert.equal((await download()).status,200);app.claims.tenant={revoked:true};assert.equal((await download()).status,401);assert.ok(app.verified.some(v=>v.cookie&&v.revoked));
 const logout=await session.DELETE(request('/media/session',null,'DELETE'));assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
test('only published listing cover files become public; private-only assets cannot be promoted',async()=>{
 const app=setup();app.state.properties.P.rentalStatus='available';app.state.properties.P.tenants=[];
 const cover=await upload(app,'owner',{folder:'properties',identifier:'building'}),privateImage=await upload(app,'owner',{folder:'properties',identifier:'internal'});
 const api=route(app,'properties/[id]');assert.equal((await api.PUT(request('/properties/P','owner','PUT',{images:[cover],internalImages:[privateImage]}),context('P'))).status,200);
 assert.equal((await get(app,cover,null)).status,401);
 assert.equal((await api.PATCH(request('/properties/P','admin','PATCH',{moderationAction:'approve',expectedRevision:app.state.properties.P.moderationRevision}),context('P'))).status,200);
 assert.equal((await get(app,cover,null)).status,200);assert.equal((await get(app,privateImage,null)).status,401);
 app.state.properties.P.isActive=false;assert.equal((await get(app,cover,null)).status,401);app.state.properties.P.isActive=true;
 assert.equal((await api.PUT(request('/properties/P','owner','PUT',{images:[privateImage],internalImages:[]}),context('P'))).status,200);assert.equal((await api.PATCH(request('/properties/P','admin','PATCH',{moderationAction:'approve',expectedRevision:app.state.properties.P.moderationRevision}),context('P'))).status,200);assert.equal((await get(app,privateImage,null)).status,401);
});
test('tenant-submitted photography remains private even when active and superficially available',async()=>{
 const app=setup(),url=await upload(app,'owner',{folder:'properties',identifier:'building'});app.state.properties.P.createdAs='tenant';app.state.properties.P.rentalStatus='available';
 assert.equal((await route(app,'properties/[id]').PUT(request('/properties/P','owner','PUT',{images:[url]}),context('P'))).status,200);assert.equal((await get(app,url,null)).status,401);
});
test('all failed and mixed batch uploads fail visibly and cannot return successful partial URLs',async()=>{
 const app=setup(),api=route(app,'upload/property-images');
 for(const images of [['bad'],['bad',image]]){const response=await api.POST(request('/upload/property-images','owner','POST',{propertyId:'P',images}));assert.equal(response.status,502);const body=await response.json();assert.equal(body.success,false);assert.equal(body.urls.length,0);assert.ok(body.failedIndices.length);}
 assert.ok(Object.values(app.state.storage_objects).every(v=>v.status==='deleted'));
});
test('missing/same public bucket configuration fails closed before object writes',async()=>{
 for(const value of ['', 'propbank']){const app=setup();app.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME=value;const response=await route(app,'documents').POST(request('/documents','tenant','POST',{propertyId:'P',documentName:'No bucket',documentType:'Agreement',fileUrl:pdf}));assert.equal(response.status,503);assert.equal(app.objects.length,0);assert.equal(Object.keys(app.state.documents||{}).length,0);}
});
test('failed document and service image uploads never create misleading business records',async()=>{
 const app=setup();app.r2Outage();assert.equal((await route(app,'documents').POST(request('/documents','tenant','POST',{propertyId:'P',documentName:'Failed',documentType:'Agreement',fileUrl:pdf}))).status,502);
 assert.equal((await route(app,'service-requests').POST(request('/service-requests','tenant','POST',{propertyId:'P',userUID:'tenant',serviceId:'plumbing',message:'Leak',image}))).status,502);
 assert.equal(Object.keys(app.state.documents||{}).length,0);assert.equal(Object.keys(app.state.service_requests||{}).length,0);assert.ok(Object.values(app.state.storage_objects).every(v=>v.status==='cleanup_pending'));
});
test('property base64 upload failure aborts the property instead of silently skipping photos',async()=>{
 const app=setup();const response=await route(app,'properties').POST(request('/properties','owner','POST',{ownerUID:'owner',propertyTitle:'No silent loss',propertyType:'residential',listingType:'rent',monthlyRent:'70000',location:'Test',images:[image,'bad']}));assert.equal(response.status,502);assert.equal(Object.keys(app.state.properties).length,2);assert.ok(!app.writes.some(w=>w.kind==='storage'));
});
test('document deletion failure remains visible/retryable; pending files cannot be downloaded',async()=>{
 const app=setup(),doc=await document(app),api=route(app,'documents/[id]');app.env.TEST_R2_DELETE_FAIL='1';
 const failure=await api.DELETE(request('/documents/'+doc.id,'tenant','DELETE'),context(doc.id));assert.equal(failure.status,502);assert.equal(app.state.documents[doc.id].deletionStatus,'pending');assert.equal((await get(app,doc.fileUrl,'owner')).status,404);
 delete app.env.TEST_R2_DELETE_FAIL;assert.equal((await api.DELETE(request('/documents/'+doc.id,'tenant','DELETE'),context(doc.id))).status,200);assert.equal(app.state.documents[doc.id],undefined);assert.equal((await get(app,doc.fileUrl,'owner')).status,404);assert.equal(app.storage.size,0);
});
test('unattached deletion enforces uploader and refuses files still attached to live records',async()=>{
 const app=setup(),url=await upload(app),api=route(app,'files/[...path]');assert.equal((await api.DELETE(request('/files/delete','other','DELETE',{url}))).status,403);
 await document(app,'owner',url);assert.equal((await api.DELETE(request('/files/delete','owner','DELETE',{url}))).status,409);
 const spare=await upload(app);assert.equal((await api.DELETE(request('/files/delete','owner','DELETE',{url:spare}))).status,200);
 assert.equal((await api.DELETE(request('/files/delete','admin','DELETE',{url:'https://existing-r2.test/documents/P/legacy.pdf'}))).status,409);
});
test('reconciliation is admin-only, paginated/dry-run, honors grace period and rechecks references',async()=>{
 const app=setup(),url=await upload(app),id=url.split('/').at(-1).split('#')[0],api=route(app,'admin/storage-reconciliation');assert.equal((await api.GET(request('/admin/storage-reconciliation','owner'))).status,403);
 const before=app.objects.length;assert.equal((await api.GET(request('/admin/storage-reconciliation','admin'))).status,200);assert.equal(app.objects.length,before);
 const early=await(await api.POST(request('/admin/storage-reconciliation','admin','POST',{ids:[id]}))).json();assert.equal(early.results[0].status,'retained');
 app.state.storage_objects[id].updatedAt=new Date(Date.now()-2*86400000);assert.equal((await(await api.POST(request('/admin/storage-reconciliation','admin','POST',{ids:[id]}))).json()).results[0].status,'deleted');
 const doc=await document(app),did=doc.fileUrl.split('/').at(-1).split('#')[0];app.state.storage_objects[did].status='cleanup_pending';const kept=await(await api.POST(request('/admin/storage-reconciliation','admin','POST',{ids:[did]}))).json();assert.equal(kept.results[0].status,'retained');assert.ok(app.state.documents[doc.id]);
});
test('legacy API output masks confidential URLs and guarded reads reject key/host/property substitution',async()=>{
 const app=setup();app.state.documents={D:{id:'D',propertyId:'P',userId:'tenant',documentName:'Legacy',fileUrl:'https://existing-r2.test/documents/P/old.pdf'}};
 app.storage.set('propbank/documents/P/old.pdf',{bytes:Buffer.from('%PDF-old'),type:'application/pdf'});
 const data=await(await route(app,'documents/[id]').GET(request('/documents/D','tenant'),context('D'))).json();assert.ok(!JSON.stringify(data).includes('existing-r2.test'));assert.match(data.document.fileUrl,/^\/api\/media\/legacy\?/);
 const legacy=route(app,'media/legacy');assert.equal((await legacy.GET(request(data.document.fileUrl.replace('/api','')))).status,401);assert.equal((await legacy.GET(request(data.document.fileUrl.replace('/api',''),'other'))).status,403);assert.equal((await legacy.GET(request(data.document.fileUrl.replace('/api',''),'tenant'))).status,200);
 app.state.documents.D.fileUrl='https://existing-r2.test/documents/Q/private.pdf';assert.equal((await legacy.GET(request(data.document.fileUrl.replace('/api',''),'tenant'))).status,403);
 app.state.documents.D.fileUrl='http://169.254.169.254/secret';assert.equal((await legacy.GET(request(data.document.fileUrl.replace('/api',''),'tenant'))).status,409);
});
test('new private external links are rejected; legacy metadata deletion queues approval without touching objects',async()=>{
 const app=setup();assert.equal((await route(app,'documents').POST(request('/documents','tenant','POST',{propertyId:'P',documentName:'External',documentType:'Agreement',fileUrl:'https://existing-r2.test/documents/P/old.pdf'}))).status,400);
 app.state.documents={D:{id:'D',propertyId:'P',userId:'tenant',fileUrl:'https://existing-r2.test/documents/P/old.pdf'}};
 assert.equal((await route(app,'documents/[id]').DELETE(request('/documents/D','tenant','DELETE'),context('D'))).status,200);assert.equal(app.state.legacy_storage_cleanup.D.status,'approval_required');assert.equal(app.objects.length,0);
});
const inquiry={type:'general_inquiry',inquiryType:'rent',propertyType:'residential',userName:'Audit Guest',userEmail:'guest@test.invalid',userPhone:'9999999999',message:'Test enquiry'};
test('concurrent identical enquiries create one notification and queue one email',async()=>{
 const app=setup(),api=route(app,'admin/notifications');const responses=await Promise.all([api.POST(request('/admin/notifications',null,'POST',inquiry)),api.POST(request('/admin/notifications',null,'POST',inquiry))]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,201]);assert.equal(Object.keys(app.state.admin_notifications).length,1);await app.flush();assert.equal(app.emails.length,1);
});
test('public enquiries are transactionally throttled and cannot bypass limits using untrusted IP headers',async()=>{
 const app=setup(),api=route(app,'admin/notifications');for(let i=0;i<5;i++){const req=request('/admin/notifications',null,'POST',{...inquiry,message:'Request '+i});req.headers.set('x-forwarded-for','fake-'+i);assert.equal((await api.POST(req)).status,201);}
 const response=await api.POST(request('/admin/notifications',null,'POST',{...inquiry,message:'Sixth'}));assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');assert.equal(Object.keys(app.state.admin_notifications).length,5);
});
test('an explicit enquiry idempotency key cannot be reused with changed content',async()=>{
 const app=setup(),api=route(app,'admin/notifications');const submit=async body=>{const req=request('/admin/notifications',null,'POST',body);req.headers.set('Idempotency-Key','test-key-1234567890');return api.POST(req);};assert.equal((await submit(inquiry)).status,201);assert.equal((await submit(inquiry)).status,200);assert.equal((await submit({...inquiry,message:'Different'})).status,409);assert.equal(Object.keys(app.state.admin_notifications).length,1);
});


test('legacy GCS reads use configured bucket and current authorization without making objects public',async()=>{
 const app=setup();app.env.FIREBASE_DATA_STORAGE_BUCKET='existing-bucket';app.state.documents={D:{id:'D',propertyId:'P',fileUrl:'https://storage.googleapis.com/existing-bucket/documents/P/old.pdf'}};app.gcsStorage.set('documents/P/old.pdf',{bytes:Buffer.from('%PDF-old'),type:'application/pdf'});
 const url='/media/legacy?resource=documents&id=D&field=fileUrl',api=route(app,'media/legacy');assert.equal((await api.GET(request(url,'other'))).status,403);assert.equal((await api.GET(request(url,'tenant'))).status,200);assert.ok(!app.writes.some(w=>w.kind==='storage'));
 app.state.documents.D.fileUrl='https://storage.googleapis.com/unconfigured-bucket/documents/P/old.pdf';assert.equal((await api.GET(request(url,'tenant'))).status,409);
});

test('concurrent deletion never resurrects a deleted object as cleanup_pending',async()=>{
 const app=setup(),url=await upload(app),api=route(app,'files/[...path]');const responses=await Promise.all([api.DELETE(request('/files/delete','owner','DELETE',{url})),api.DELETE(request('/files/delete','owner','DELETE',{url}))]);assert.ok(responses.some(r=>r.status===200));assert.ok(responses.every(r=>[200,409].includes(r.status)));assert.equal(app.state.storage_objects[url.split('/').at(-1).split('#')[0]].status,'deleted');assert.equal(app.objects.filter(o=>o.operation==='DeleteObjectCommand').length,1);
});


test('business database failure after upload leaves only a private, reconcilable pending object',async()=>{
 const app=setup();app.env.TEST_DB_WRITE_COLLECTION='documents';const response=await route(app,'documents').POST(request('/documents','tenant','POST',{propertyId:'P',documentName:'DB failure',documentType:'Agreement',fileUrl:pdf}));assert.equal(response.status,500);assert.equal(Object.keys(app.state.documents||{}).length,0);const asset=Object.values(app.state.storage_objects)[0];assert.equal(asset.status,'pending');assert.equal(asset.bindings.length,0);assert.equal(app.storage.size,1);
 delete app.env.TEST_DB_WRITE_COLLECTION;asset.updatedAt=new Date(Date.now()-2*86400000);const result=await(await route(app,'admin/storage-reconciliation').POST(request('/admin/storage-reconciliation','admin','POST',{ids:[asset.id]}))).json();assert.equal(result.results[0].status,'deleted');assert.equal(app.storage.size,0);
});

test('legacy galleries can be reordered without losing their guarded references',async()=>{
 const app=setup();app.state.properties.P.images=['https://existing-r2.test/properties/P/one.png','https://existing-r2.test/properties/P/two.png'];const api=route(app,'properties/[id]');const before=await(await api.GET(request('/properties/P','owner'),context('P'))).json();assert.match(before.property.images[1],/^\/api\/media\/legacy\?/);
 assert.equal((await api.PUT(request('/properties/P','owner','PUT',{images:[before.property.images[1]]}),context('P'))).status,200);assert.equal(app.state.properties.P.images[0],'https://existing-r2.test/properties/P/two.png');
});

test('new-user media session does not grant access before active profile registration',async()=>{
 const app=setup(),doc=await document(app),session=await route(app,'media/session').POST(request('/media/session','new-user','POST'));assert.equal(session.status,403);assert.equal((await session.json()).code,'ACCOUNT_PROFILE_REQUIRED');assert.equal(app.sessions.size,0);const response=await route(app,'media/[id]').GET(new Request('http://local'+doc.fileUrl,{headers:{Authorization:'Bearer new-user'}}),context(doc.fileUrl.split('/').at(-1).split('#')[0]));assert.equal(response.status,403);
});

test('enquiry counters expire by window and replay protection expires without permanent deduplication',async()=>{
 const app=setup(),service=app.load('@/lib/server/services/enquiry-protection'),now=Date.now(),req=request('/admin/notifications',null,'POST',inquiry);
 const base={...inquiry,id:'first'};assert.equal((await service.persistInquiry(req,base,now)).duplicate,false);assert.equal((await service.persistInquiry(req,{...base,id:'second'},now+61000)).duplicate,true);assert.equal((await service.persistInquiry(req,{...base,id:'third'},now+11*60000)).duplicate,false);assert.equal(Object.keys(app.state.admin_notifications).length,2);
});


test('removing an old file reference cannot resurrect a cleanup lease or tombstone',async()=>{
 const app=setup(),url=await upload(app,'owner',{folder:'properties'}),id=url.split('/').at(-1);const api=route(app,'properties/[id]');assert.equal((await api.PUT(request('/properties/P','owner','PUT',{images:[url]}),context('P'))).status,200);
 app.state.storage_objects[id].status='deleting';app.state.storage_objects[id].cleanupLease='lease';assert.equal((await api.PUT(request('/properties/P','owner','PUT',{images:[]}),context('P'))).status,200);assert.equal(app.state.storage_objects[id].status,'deleting');assert.equal(app.state.storage_objects[id].cleanupLease,'lease');
});
