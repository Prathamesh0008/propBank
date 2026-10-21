const assert=require('node:assert/strict');const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');const {execFileSync}=require('node:child_process');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');
const json=response=>response.json();const image='data:image/png;base64,AQID';
const names=['upload','upload/image','upload/document','upload/property-images','upload/service-request-image','files/[...path]','files','visits','visits/[id]','tenants','tenants/[id]','documents','documents/property/[propertyId]','documents/property','documents/[id]','agreements/renew','agreements/terminate','agreements/request-renewal','agreements/request-termination','admin/notifications','admin/notifications/[id]','admin/notifications/[id]/read','admin/notifications/[id]/remarks'];
test('enabled Group 2 reproduces Go root response on all nine unused trailing-slash paths without any fallback or mutation',async()=>{
 const app=isolated({users,properties});
 for(const name of names.filter(v=>v==='upload'||v.startsWith('upload/')||v.startsWith('agreements/'))) {
  const r=route(app,name);
  for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']) {
   const response=await r[method](request('/'+name+'/?contract=unchanged',null,method));
   assert.equal(response.status,200,name+' '+method);
   assert.equal(response.headers.get('access-control-allow-origin'),'*');
   assert.equal(await response.text(),['HEAD','OPTIONS'].includes(method)?'':'{"message": "ShoPROP Backend API is running! (v2)", "status": "success"}');
   assert.equal(response.headers.get('content-type'),method==='OPTIONS'?null:'application/json');
  }
 }
 assert.equal(app.writes.length,0);assert.equal(app.objects.length,0);assert.equal(app.verified.length,0);
});
test('all 23 permanently native routes own methods and support preflight',async()=>{
 const app=isolated({users,properties});
 for(const name of names){const r=route(app,name),url='/'+name.replace('[...path]','arbitrary/path').replace('[id]','I').replace('[propertyId]','P')+(['files','documents/property'].includes(name)?'/':'');for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'])assert.equal(typeof r[method],'function',`${name} ${method}`);assert.equal((await r.OPTIONS(request(url,null,'OPTIONS'))).status,200);assert.equal((await r.HEAD(request(url,null,'HEAD'))).status,405);}
 assert.equal(app.writes.length,0);assert.equal(app.objects.length,0);
});
test('upload dispatches require identity, use private managed objects and report failed batches',async()=>{
 const app=isolated({users,properties}),r=route(app,'upload/image');
 assert.equal((await r.POST(request('/upload/image',null,'POST',{image}))).status,401);assert.equal((await r.POST(request('/upload/image','expired-token','POST',{image}))).status,401);
 assert.equal((await r.POST(request('/upload/image','other','POST',{image,folder:'properties/P'}))).status,403);assert.equal((await r.POST(request('/upload/image','owner','POST',{}))).status,400);
 const result=await r.POST(request('/upload/image','owner','POST',{image,folder:'properties/P',identifier:'Same Name'}));assert.equal(result.status,200);assert.match((await json(result)).url,/^\/api\/media\/[a-f0-9-]{36}$/);
 assert.equal(app.objects[0].Bucket,'propbank-private-test');assert.equal(app.objects[0].ContentType,'image/png');assert.deepEqual([...app.objects[0].Body],[1,2,3]);
 const multi=await json(await route(app,'upload/property-images').POST(request('/upload/property-images','owner','POST',{propertyId:'P',images:[image,image]})));assert.equal(multi.message,'Successfully uploaded 2 images');assert.ok(multi.urls.every(url=>/^\/api\/media\/[a-f0-9-]{36}$/.test(url)));
 const empty=await route(app,'upload/property-images').POST(request('/upload/property-images','owner','POST',{propertyId:'P',images:['bad']}));assert.equal(empty.status,502);assert.equal((await json(empty)).success,false);
 const service=route(app,'upload/service-request-image');assert.equal((await service.POST(request('/upload/service-request-image','tenant','POST',{image:'http://old/file'}))).status,400);
 assert.match((await json(await service.POST(request('/upload/service-request-image','tenant','POST',{image})))).url,/^\/api\/media\/[a-f0-9-]{36}$/);
 assert.ok(app.verified.every(v=>v.revoked===true));assert.ok(app.writes.every(w=>w.collection==='storage_objects'));
});

test('multipart uploads preserve filename metadata, MIME, bytes and the existing 20MiB limit',async()=>{
 const app=isolated({users,properties});const form=new FormData();form.append('image',new File([Buffer.from([0,255,128])],'Existing File.PNG',{type:'image/png'}));form.append('folder','properties/P');
 const uploaded=await route(app,'upload').POST(request('/upload','owner','POST',form));assert.equal(uploaded.status,200);assert.match((await json(uploaded)).url,/^\/api\/media\/[a-f0-9-]{36}$/);assert.deepEqual([...app.objects[0].Body],[0,255,128]);assert.equal(Object.values(app.state.storage_objects)[0].filename,'Existing File.PNG');
 const document=new FormData();document.append('document',new File(['pdf'],'Lease Original.PDF',{type:'application/pdf'}));document.append('propertyId','P');document.append('docType','agreement');
 const saved=await route(app,'upload/document').POST(request('/upload/document','tenant','POST',document));assert.equal(saved.status,200);assert.match((await json(saved)).url,/^\/api\/media\/[a-f0-9-]{36}#file\.pdf$/);assert.equal(app.objects[1].ContentType,'application/pdf');
 const invalid=new FormData();invalid.append('image',new File(['x'],'a.txt',{type:'text/plain'}));assert.deepEqual(await json(await route(app,'upload').POST(request('/upload','owner','POST',invalid))),{success:false,message:'Invalid file type. Only images are allowed.'});
 const large=new FormData();large.append('image',new File([Buffer.alloc(10*1024*1024+1)],'large.webp',{type:'image/webp'}));assert.equal((await route(app,'upload').POST(request('/upload','owner','POST',large))).status,200);assert.equal(app.objects.at(-1).Body.length,10*1024*1024+1);
});

test('file deletion uses a managed ID, verifies uploader and never mutates legacy object URLs',async()=>{
 const app=isolated({users,properties}),api=route(app,'files/[...path]');
 const create=async()=>{const result=await route(app,'upload/image').POST(request('/upload/image','owner','POST',{image}));return(await json(result)).url;};
 const url=await create();assert.equal((await api.DELETE(request('/files/unrelated/suffix','other','DELETE',{url}))).status,403);
 assert.equal((await api.DELETE(request('/files/unrelated','owner','DELETE',{url}))).status,200);assert.equal(app.objects[1].operation,'DeleteObjectCommand');assert.equal(app.objects[1].Key,app.objects[0].Key);assert.equal(app.objects[1].Bucket,'propbank-private-test');
 for(const legacy of ['https://existing-r2.test.evil/properties/P/a.png','https://existing-r2.test/properties/P/original.png','https://propbank.r2.dev/uploads/a.pdf'])assert.equal((await api.DELETE(request('/files/path','admin','DELETE',{url:legacy}))).status,409);
 const retry=await create();app.r2Outage();assert.equal((await api.DELETE(request('/files/path','owner','DELETE',{url:retry}))).status,502);assert.equal(app.state.storage_objects[retry.split('/').at(-1)].status,'cleanup_pending');
});

test('visit CRUD validates partial changes and never upserts a missing visit',async()=>{
 const app=isolated({users,properties}),root=route(app,'visits'),detail=route(app,'visits/[id]');
 assert.equal((await root.POST(request('/visits','owner','POST',{title:'Visit',visitDate:'2025-02-30T00:00:00Z',reminderType:'email'}))).status,400);
 const result=await root.POST(request('/visits','owner','POST',{title:'Visit',description:'Keep',propertyId:'P',visitDate:'2099-01-01T00:00:00Z',reminderType:'email',reminderTime:30}));assert.equal(result.status,201);const {visit}=await json(result);
 assert.equal((await detail.GET(request('/visits/'+visit.id,'other'),context(visit.id))).status,403);
 assert.equal((await detail.PUT(request('/visits/'+visit.id,'owner','PUT',{isCompleted:true}),context(visit.id))).status,200);
 assert.equal((await detail.PUT(request('/visits/'+visit.id,'owner','PUT',{visitDate:'bad'}),context(visit.id))).status,400);
 const updated=await json(await detail.PUT(request('/visits/'+visit.id,'owner','PUT',{title:'Renamed',reminderTime:0}),context(visit.id)));assert.equal(updated.visit.isCompleted,true);assert.equal(updated.visit.description,'Keep');assert.equal(updated.visit.reminderTime,0);
 for(const uid of ['owner','admin'])assert.equal((await detail.PUT(request('/visits/missing',uid,'PUT',{}),context('missing'))).status,404);
 assert.equal((await root.GET(request('/visits?userId=owner','other'))).status,403);
 assert.equal((await detail.DELETE(request('/visits/'+visit.id,'owner','DELETE'),context(visit.id))).status,200);
 await app.flush();assert.ok(app.emails.some(mail=>/Visit Scheduled/.test(mail.subject)));assert.ok(app.emails.some(mail=>/Property visit updated/.test(mail.subject)));
});

test('visit status queries require recorded completion, perform no writes and retain omission of empty visits',async()=>{
 const app=isolated({users,visits:{past:{...defaults,id:'past',userId:'owner',visitDate:new Date('2020-01-01'),isCompleted:false,status:'scheduled'},future:{...defaults,id:'future',userId:'owner',visitDate:new Date('2099-01-01'),isCompleted:false},manual:{...defaults,id:'manual',userId:'owner',visitDate:new Date('2098-01-01'),isCompleted:true}}});
 const r=route(app,'visits');const active=await json(await r.GET(request('/visits?userId=owner&status=active','owner')));assert.deepEqual(active.visits.map(v=>v.id),['past','future']);assert.equal(app.state.visits.past.status,'scheduled');assert.equal(app.writes.length,0);
 const completed=await json(await r.GET(request('/visits?userId=owner&status=completed','owner')));assert.deepEqual(completed.visits.map(v=>v.id),['manual']);
 assert.deepEqual(await json(await r.GET(request('/visits?userId=tenant&status=active','tenant'))),{success:true,message:'Visits retrieved successfully'});
 const all=await json(await r.GET(request('/visits?userId=owner','owner')));assert.deepEqual(all.visits.map(v=>v.id),['past','manual','future']);assert.equal(app.reads.at(-1).order[0],'visitDate');
});
test('tenant creation preserves detailed and embedded schemas, historical fields, supplied UID and rental links',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,tenants:[]}}}),r=route(app,'tenants');const input={propertyId:'P',ownerUID:'owner',tenants:[{firstName:'First',lastName:'Last',email:'tenant@test.invalid',phone:'456',userUID:'tenant',monthlyRent:'1000',noticePeriod:'1 Month',isMarried:true,spouse:{firstName:'Spouse'},leaseStartDate:'2025-01-01'}]};
 assert.equal((await r.POST(request('/tenants','other','POST',input))).status,403);assert.equal((await r.POST(request('/tenants','owner','POST',{...input,ownerUID:'other'}))).status,403);
 const created=await r.POST(request('/tenants','owner','POST',input));assert.equal(created.status,200);const data=await json(created),id=data.tenants[0].id;assert.equal(data.message,'1 tenant(s) added successfully');assert.equal('propertyId' in data.tenants[0],false);assert.equal(app.state.tenants[id].propertyId,'P');assert.equal(app.state.tenants[id].ownerUID,'owner');assert.equal(app.state.properties.P.tenants.length,1);assert.equal(app.state.properties.P.historicalField,'keep');assert.equal(app.state.properties.P.noticePeriod,'1 Month');assert.equal(app.state.users.tenant.rentedPropertyOwnerId,'owner');assert.ok(app.state.tenants[id].createdAt instanceof Date);
 await app.flush();assert.equal(app.emails.length,2);assert.match(app.emails[0].html,/Existing Address/);
 const listed=await json(await r.GET(request('/tenants?propertyId=P','tenant')));assert.equal(listed.tenants.length,1);assert.equal((await r.GET(request('/tenants','owner'))).status,400);
});
test('tenant update and soft delete synchronize embedded data while preserving user metadata',async()=>{
 const app=isolated({users,properties,tenants:{T:{...defaults,id:'T',propertyId:'P',ownerUID:'owner',userUID:'tenant',firstName:'Tenant',isActive:true}}}),r=route(app,'tenants/[id]');
 assert.equal((await r.GET(request('/tenants/T','tenant'),context('T'))).status,200);assert.equal((await r.PUT(request('/tenants/T','tenant','PUT',{firstName:'X'}),context('T'))).status,403);
 assert.equal((await r.PUT(request('/tenants/T','owner','PUT',{userUID:'other'}),context('T'))).status,403);
 assert.equal((await r.PUT(request('/tenants/T','owner','PUT',{id:'overwrite',createdAt:'overwrite',firstName:'Changed'}),context('T'))).status,200);assert.equal(app.state.tenants.T.id,'T');assert.equal(app.state.properties.P.tenants[0].firstName,'Changed');
 assert.equal((await r.DELETE(request('/tenants/T','owner','DELETE'),context('T'))).status,200);assert.equal(app.state.tenants.T.isActive,false);assert.equal(app.state.properties.P.tenants[0].isActive,false);assert.equal((await json(await route(app,'tenants').GET(request('/tenants?propertyId=P','owner')))).tenants,null);
});
test('invalid tenant batches perform no partial relationship writes or emails',async()=>{
 const app=isolated({users,properties});const result=await route(app,'tenants').POST(request('/tenants','owner','POST',{propertyId:'P',ownerUID:'owner',tenants:[{firstName:'First',lastName:'Last',email:'tenant@test.invalid',phone:'456'},{}]}));assert.equal(result.status,400);assert.equal(Object.keys(app.state.tenants||{}).length,0);assert.equal(app.state.properties.P.tenants.length,1);await app.flush();assert.equal(app.emails.length,0);
});
test('documents retain metadata and managed files; failed storage deletion remains visible and retryable',async()=>{
 const app=isolated({users,properties}),root=route(app,'documents'),detail=route(app,'documents/[id]'),list=route(app,'documents/property/[propertyId]');
 assert.equal((await root.POST(request('/documents','other','POST',{propertyId:'P',documentName:'Lease',documentType:'agreement',fileUrl:image}))).status,403);
 for(const input of [{},{propertyId:'P'},{propertyId:'P',documentName:'Lease'},{propertyId:'P',documentName:'Lease',documentType:'agreement'}])assert.equal((await root.POST(request('/documents','tenant','POST',input))).status,400);
 assert.equal((await json(await list.GET(request('/documents/property/P','owner'),context('P','propertyId')))).documents,null);
 const result=await root.POST(request('/documents','tenant','POST',{propertyId:'P',documentName:'Lease Original Copy',documentType:'agreement',fileUrl:'data:application/pdf;base64,AQID',description:'Keep metadata'}));assert.equal(result.status,201);const {document}=await json(result);assert.match(document.fileUrl,/^\/api\/media\/[a-f0-9-]{36}#file\.pdf$/);assert.equal(document.userId,'tenant');assert.equal(document.userName,'Tenant');assert.equal(document.propertyTitle,'Existing Home');assert.equal(app.objects[0].ContentType,'application/pdf');assert.equal(app.state.documents[document.id].description,'Keep metadata');
 const external=await root.POST(request('/documents','owner','POST',{propertyId:'P',documentName:'Old',documentType:'id',fileUrl:'http://historical/exact'}));assert.equal(external.status,400);assert.equal(app.objects.length,1);
 assert.equal((await detail.GET(request('/documents/'+document.id,'owner'),context(document.id))).status,200);assert.equal((await detail.GET(request('/documents/missing','owner'),context('missing'))).status,404);
 assert.equal((await detail.DELETE(request('/documents/'+document.id,'other','DELETE'),context(document.id))).status,403);
 app.r2Outage();assert.equal((await detail.DELETE(request('/documents/'+document.id,'tenant','DELETE'),context(document.id))).status,502);assert.equal(app.state.documents[document.id].deletionStatus,'pending');assert.equal(app.objects[1].Key,app.objects[0].Key);
 app.r2Restore();assert.equal((await detail.DELETE(request('/documents/'+document.id,'tenant','DELETE'),context(document.id))).status,200);assert.equal(app.state.documents[document.id],undefined);
});
test('document payloads enforce 20 MiB limit before storage writes',async()=>{
 const app=isolated({users,properties}),r=route(app,'documents');const response=await r.POST(request('/documents','owner','POST',{propertyId:'P',documentName:'Large',documentType:'id',fileUrl:'x'.repeat(20*1024*1024)}));assert.equal(response.status,400);assert.match((await json(response)).message,/Invalid request body/);assert.equal(app.objects.length,0);assert.equal(app.writes.length,0);
});
test('owner agreement requests and termination preserve terms in history',async()=>{
 const app=isolated({users,properties}),renew=route(app,'agreements/renew'),terminate=route(app,'agreements/terminate');
 assert.equal((await renew.POST(request('/agreements/renew','tenant','POST',{propertyId:'P'}))).status,403);
 const response=await renew.POST(request('/agreements/renew','owner','POST',{propertyId:'P'}));assert.equal(response.status,200);assert.equal(app.state.properties.P.agreementStatus,'renewal_requested');
 assert.equal((await terminate.POST(request('/agreements/terminate','owner','POST',{propertyId:'P',noticePeriod:'1 Month',noticeStartDate:'2030-01-01',terminationDate:'2030-02-01'}))).status,200);
 assert.equal(app.state.properties.P.anticipatedTerminationDate,'2030-02-01T00:00:00.000Z');
 assert.equal((await terminate.POST(request('/agreements/terminate','owner','POST',{propertyId:'P'}))).status,200);
 assert.equal(app.state.properties.P.tenants[0].isActive,false);assert.equal(app.state.properties.P.tenantEmail,'');assert.equal(app.state.properties.P.agreementHistory.length,3);assert.equal(app.state.properties.P.historicalField,'keep');
});

test('tenant requests persist pending status without changing owner-approved terms',async()=>{
 const app=isolated({users,properties}),renew=route(app,'agreements/request-renewal'),terminate=route(app,'agreements/request-termination');
 assert.equal((await renew.POST(request('/agreements/request-renewal','other','POST',{propertyId:'P'}))).status,403);
 assert.equal((await renew.POST(request('/agreements/request-renewal','tenant','POST',{propertyId:'P',terms:{monthlyRent:'50000'}}))).status,200);
 assert.equal(app.state.properties.P.monthlyRent,properties.P.monthlyRent);assert.equal(app.state.properties.P.agreementRequest.status,'pending');
 assert.equal((await terminate.POST(request('/agreements/request-termination','tenant','POST',{propertyId:'P'}))).status,409);
 const notification=Object.values(app.state.admin_notifications)[0];assert.equal(notification.title,'Renewal Requested by Tenant');assert.equal(notification.ownerId,'owner');await app.flush();assert.equal(app.emails.length,2);
});

test('notifications retain anonymous inquiry, enrichment, property query precedence, admin permissions and array response',async()=>{
 const app=isolated({users,properties}),r=route(app,'admin/notifications');
 const inquiry=await r.POST(request('/admin/notifications',null,'POST',{type:'general_inquiry',userName:'Guest',userEmail:'guest@test.invalid',inquiryType:'buy',propertyType:'residential',userPhone:'1234567890',requestVisit:true,visitDate:'2030-01-01',visitTime:'09:00 AM',message:'Keep'}));assert.equal(inquiry.status,201);assert.equal((await json(inquiry)).notification.priority,'medium');
 assert.equal((await r.POST(request('/admin/notifications',null,'POST',{type:'property_enquiry',userId:'owner'}))).status,401);
 assert.equal((await r.POST(request('/admin/notifications','tenant','POST',{type:'property_enquiry',userId:'owner'}))).status,403);
 const created=await json(await r.POST(request('/admin/notifications','tenant','POST',{type:'property_enquiry',propertyId:'P',propertyTitle:'Fake title',userId:'tenant',timestamp:'invalid',isRead:true})));assert.equal(created.notification.propertyTitle,'Existing Home');assert.equal(created.notification.ownerPhone,'');assert.equal(created.notification.userPhone,'456');
 assert.equal((await r.GET(request('/admin/notifications','owner'))).status,403);assert.equal((await r.GET(request('/admin/notifications?propertyId=P','other'))).status,403);
 const property=await json(await r.GET(request('/admin/notifications?propertyId=P&unread=true','owner')));assert.equal(property.length,1);assert.equal(property[0].isRead,false);
 const unread=await json(await r.GET(request('/admin/notifications?unread=true','admin')));assert.equal(unread.length,2);await app.flush();assert.equal(app.emails.length,1);assert.match(app.emails[0].html,/Buying/);assert.match(app.emails[0].html,/Requested on 2030-01-01 at 09:00 AM/);
});
test('notifications archive/unarchive retain resolvedAt/history, remarks retain existing image, delete is idempotent',async()=>{
 const app=isolated({users,admin_notifications:{N:{...defaults,id:'wrong',type:'general_inquiry',timestamp:new Date(),isRead:false,adminImage:'https://old/image',archiveHistory:[]}}});const read=route(app,'admin/notifications/[id]/read'),remarks=route(app,'admin/notifications/[id]/remarks'),del=route(app,'admin/notifications/[id]');
 assert.equal((await read.PUT(request('/admin/notifications/N/read','owner','PUT',{}),context('N'))).status,403);
 const archived=await json(await read.PUT(request('/admin/notifications/N/read','admin','PUT',{}),context('N')));assert.equal(archived.action,'archived');const resolved=app.state.admin_notifications.N.resolvedAt;
 const unarchived=await json(await read.PUT(request('/admin/notifications/N/read','admin','PUT',{action:'unarchive'}),context('N')));assert.equal(unarchived.action,'unarchived');assert.equal(app.state.admin_notifications.N.isRead,false);assert.deepEqual(app.state.admin_notifications.N.resolvedAt,resolved);assert.equal(app.state.admin_notifications.N.archiveHistory.length,2);
 const updated=await json(await remarks.PUT(request('/admin/notifications/N/remarks','admin','PUT',{remarks:'',adminImage:''}),context('N')));assert.equal(updated.adminImage,'');assert.equal(app.state.admin_notifications.N.adminImage,'https://old/image');assert.equal(app.state.admin_notifications.N.adminRemarks,'');
 const listed=await json(await route(app,'admin/notifications').GET(request('/admin/notifications','admin')));assert.equal(listed[0].id,'N');
 assert.equal((await del.DELETE(request('/admin/notifications/N','admin','DELETE'),context('N'))).status,200);assert.equal((await del.DELETE(request('/admin/notifications/N','admin','DELETE'),context('N'))).status,200);assert.equal(app.objects.length,0);
});
test('Firebase and storage outages never replay native mutations through Go or expose credentials',async()=>{
 const app=isolated({users,properties});app.outage();assert.equal((await route(app,'documents').POST(request('/documents','owner','POST',{}))).status,500);assert.equal(app.writes.length,0);assert.equal(app.objects.length,0);
 const storage=isolated({users});storage.r2Outage();const result=await route(storage,'upload/image').POST(request('/upload/image','owner','POST',{image}));assert.equal(result.status,502);assert.deepEqual(await json(result),{success:false,message:'File upload failed; no business record was saved. Please retry'});
});
let binary;
function goReference(kind,data,store=false){if(!binary){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'propbank-group2-'));binary=path.join(dir,process.platform==='win32'?'reference.exe':'reference');execFileSync('go',['build','-o',binary,'.'],{cwd:path.resolve('tests/go-reference'),stdio:'pipe'});process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));}return JSON.parse(execFileSync(binary,[],{input:JSON.stringify({Kind:kind,Data:data,Store:store}),encoding:'utf8'}));}
test('all Group 2 request and response models match compiled original Go models',{skip:fs.existsSync(path.resolve('tests/go-reference'))?false:'Original Go reference source is unavailable'},()=>{
 const contracts=isolated().load('@/lib/server/services/contracts');
 const cases={Visit:[{},{id:'V',userId:'owner',visitDate:'2025-01-01T00:00:00.123456789Z'}],CreateVisitRequest:[{},{title:'V',reminderTime:15},{title:'first',TITLE:'last'}],UpdateVisitRequest:[{},{isCompleted:true}],Tenant:[{},{id:'T',isMarried:true,spouse:{firstName:'S'},userUID:'tenant'}],CreateTenantRequest:[{},{propertyId:'P',ownerUID:'owner',tenants:[{email:'T'}]}],Document:[{},{id:'D',fileUrl:'http://old/file',description:'keep'}],CreateDocumentRequest:[{},{propertyId:'P',documentType:'agreement'}],AdminNotification:[{},{type:'general_inquiry',requestVisit:true,archiveHistory:[{action:'archived',timestamp:'2025-01-01T00:00:00Z'}]}],CreateAdminNotificationRequest:[{},{type:'property_enquiry',ownerId:'owner'}]};
 for(const [kind,inputs] of Object.entries(cases))for(const input of inputs)assert.deepEqual(JSON.parse(JSON.stringify(contracts.wireModel(kind,contracts.model(kind,input,true)))),goReference(kind,input),kind);
});
test('R2 MIME parsing, extensions, filename and public URL rules match extracted original Go functions',{skip:fs.existsSync(path.resolve('tests/go-reference'))?false:'Original Go reference source is unavailable'},()=>{
 const app=isolated(),r2=app.load('@/lib/server/services/r2-storage');
 for(const value of [image,'data:application/pdf;base64,AQID','data:image/svg+xml;base64,AQID','data:image/webp;base64,AQID','data:image/gif;base64,AQID','anything,AQID\r\n','data:image/png;base64,']){const parsed=r2.parseBase64(value),go=goReference('r2',value);assert.equal(parsed.contentType,go.contentType);assert.equal(parsed.extension,go.extension);assert.equal(parsed.bytes.toString('base64'),go.bytes);}
 for(const filename of ['Original Name.PDF','a.tar.gz','.hidden','trailing.','no extension'])assert.equal(r2.originalFilename(filename,'documents/P',123),goReference('filename',{name:filename,folder:'documents/P',seconds:123}));
 for(const value of ['bad','x,AQ','x,AQID,extra','x,A QID','x,AQ=','x,AQ=A','x,AQ==garbage','x,AQ\n','x,😀']){let message;try{r2.parseBase64(value);}catch(error){message=error.message;}assert.equal(message,'failed to parse base64 image: '+goReference('r2',value).error);}
});
test('visit and notification RFC3339 nanoseconds survive persistence and retrieval',async()=>{
 const app=isolated({users}),r=route(app,'visits');const date='2099-01-01T00:00:00.123456789+05:30';
 const {visit}=await json(await r.POST(request('/visits','owner','POST',{title:'Precise',visitDate:date,reminderType:'email'})));assert.equal(visit.visitDate,date);assert.equal(app.state.visits[visit.id].visitDate.nanoseconds,123456789);
 const fetched=await json(await route(app,'visits/[id]').GET(request('/visits/'+visit.id,'owner'),context(visit.id)));assert.equal(fetched.visit.visitDate,'2098-12-31T18:30:00.123456789Z');
 const {notification}=await json(await route(app,'admin/notifications').POST(request('/admin/notifications','owner','POST',{type:'general_inquiry',inquiryType:'rent',propertyType:'residential',timestamp:date})));assert.notEqual(notification.timestamp,date);assert.ok(app.state.admin_notifications[notification.id].timestamp instanceof Date);
});
test('Firestore field tags, omitted zero times and nested documents match Go SDK empty-value rules',{skip:fs.existsSync(path.resolve('tests/go-reference'))?false:'Original Go reference source is unavailable'},()=>{
 const c=isolated().load('@/lib/server/services/contracts');
 for(const kind of ['Visit','Tenant','Document','AdminNotification','Property','User'])for(const data of [{},{id:'existing',createdAt:'2025-01-01T00:00:00.123Z',tenants:[],spouse:{firstName:'Spouse'},archiveHistory:[{action:'archived',timestamp:'2025-01-01T00:00:00Z'}]}])assert.deepEqual(JSON.parse(JSON.stringify(c.wireValue(c.storeModel(kind,c.model(kind,data))))),goReference(kind,data,true),kind);
 const visit=c.model('Visit',{});assert.equal(c.wireModel('Visit',visit).notifiedAt,'0001-01-01T00:00:00Z');assert.equal('notifiedAt' in c.storeModel('Visit',visit),false);
});
test('visit updates reject unknown fields and preserve omitted completion state',async()=>{
 const app=isolated({users,visits:{V:{...defaults,id:'V',userId:'owner',title:'Keep',visitDate:new Date('2099-01-01'),isCompleted:true}}});const r=route(app,'visits/[id]');
 assert.equal((await r.PUT(request('/visits/V','owner','PUT',{nested:{}}),context('V'))).status,400);
 assert.equal((await r.PUT(request('/visits/V','owner','PUT',{title:'Changed'}),context('V'))).status,200);assert.equal(app.state.visits.V.isCompleted,true);
});
