const assert=require('node:assert/strict'),{test}=require('node:test');
const {createHmac}=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');
test('login issues Go-compatible signed HS256 claims only for the verified Firebase UID',async()=>{
 const app=isolated({users});app.env.JWT_SECRET='isolated-test-secret';const r=route(app,'auth/login');
 assert.equal((await r.POST(request('/auth/login',null,'POST',{uid:'owner'}))).status,401);
 assert.equal((await r.POST(request('/auth/login','other','POST',{uid:'owner'}))).status,403);
 assert.equal((await r.POST(request('/auth/login','owner','POST',{}))).status,400);
 const result=await r.POST(request('/auth/login','owner','POST',{uid:'owner'}));assert.equal(result.status,200);
 const body=await result.json(),[header,payload,signature]=body.token.split('.');
 assert.equal(signature,createHmac('sha256',app.env.JWT_SECRET).update(`${header}.${payload}`).digest('base64url'));
 const claims=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(claims.uid,'owner');assert.equal(claims.role,'individual');assert.equal(claims.exp-claims.iat,48*3600);assert.equal(body.user.uid,'owner');
 delete app.env.JWT_SECRET;const native=await r.POST(request('/auth/login','owner','POST',{uid:'owner'}));assert.equal(native.status,200);assert.equal((await native.json()).token,'owner');
 assert.equal(app.writes.length,0);
});
test('services and service requests retain collections, omission, R2 URLs and admin/self access',async()=>{
 const app=isolated({users,properties,services:{S:{...defaults,id:'S',name:'Legal',isActive:true},off:{...defaults,id:'off',isActive:false}}});
 const service=await (await route(app,'services').GET(request('/services',null))).json();assert.equal(service.data.length,1);assert.equal(service.data[0].id,'S');
 const r=route(app,'service-requests');
 assert.equal((await r.POST(request('/service-requests','other','POST',{userUID:'owner',serviceId:'S'}))).status,403);
 assert.equal((await r.POST(request('/service-requests','owner','POST',{userUID:'owner',serviceId:'missing'}))).status,404);
 const result=await r.POST(request('/service-requests','owner','POST',{userUID:'owner',serviceId:'S',propertyId:'P',message:'Keep this text',image:'data:image/png;base64,AQID'}));assert.equal(result.status,201);
 const {serviceRequest:value}=await result.json();assert.equal(value.status,'pending');assert.equal(value.userName,'Owner');assert.equal(value.serviceName,'Legal');assert.match(value.image,/service-requests\/[^/]+\/image_\d+\.png$/);assert.equal(app.state.service_requests[value.id].message,'Keep this text');
 const notification=Object.values(app.state.admin_notifications)[0];assert.equal(notification.serviceImage,value.image);assert.equal(notification.ownerId,'owner');assert.equal(notification.tenantName,'Tenant Name');
 assert.equal((await r.GET(request('/service-requests?admin=true','other'))).status,403);
 assert.equal((await r.GET(request('/service-requests?userUID=owner','other'))).status,403);
 assert.equal((await r.GET(request('/service-requests?userUID=owner','owner'))).status,200);
 const update=route(app,'service-requests/[id]');assert.equal((await update.PUT(request('/service-requests/'+value.id,'owner','PUT',{status:'completed'}),context(value.id))).status,403);
 assert.equal((await update.PUT(request('/service-requests/'+value.id,'admin','PUT',{status:'completed',adminNotes:'Done'}),context(value.id))).status,200);assert.equal(app.state.service_requests[value.id].adminNotes,'Done');
 app.r2Outage();assert.equal((await r.POST(request('/service-requests','owner','POST',{userUID:'owner',serviceId:'S',image:'data:image/png;base64,AQID'}))).status,201);
 
});
test('inspection reports preserve attachment URLs, typed Go schema, notifications and ordered queries',async()=>{
 const app=isolated({users,properties}),r=route(app,'inspection-reports');
 assert.equal((await r.POST(request('/inspection-reports',null,'POST',{}))).status,401);
 assert.equal((await r.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'bad'}))).status,400);
 const result=await r.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'on_possession',report:'Original report',apartmentConditionImages:['https://existing-r2.test/documents/P/photo.png'],keysDetails:'Two keys',unknown:'ignored'}));assert.equal(result.status,201);
 const {report}=await result.json();assert.equal(report.userId,'tenant');assert.equal(report.propertyTitle,'Existing Home');assert.equal(report.keysDetails,'Two keys');assert.equal(report.unknown,undefined);assert.equal(report.apartmentConditionImages[0],'https://existing-r2.test/documents/P/photo.png');assert.ok(app.state.inspection_reports[report.id].createdAt instanceof Date);
 const byProperty=await (await route(app,'inspection-reports/property/[propertyId]').GET(request('/inspection-reports/property/P','admin'),context('P','propertyId'))).json();assert.equal(byProperty.reports[0].id,report.id);
 const byUser=route(app,'inspection-reports/user/[userId]');assert.equal((await byUser.GET(request('/inspection-reports/user/tenant','admin'),context('tenant','userId'))).status,200);assert.equal((await byUser.GET(request('/inspection-reports/user/tenant','other'),context('tenant','userId'))).status,403);
 const notification=Object.values(app.state.admin_notifications)[0];assert.equal(notification.type,'inspection_report');assert.match(notification.message,/On Possession/);assert.equal(notification.tenantName,'Tenant Name');
});
test('reviews preserve nested rating defaults, owner/tenant metadata and structured notification',async()=>{
 const app=isolated({users,properties}),r=route(app,'reviews');
 const result=await r.POST(request('/reviews','tenant','POST',{propertyId:'P',reviewerType:'tenant',tenantPart:{overallExperience:'Great',softNature:'Yes'}}));assert.equal(result.status,201);
 const {review}=await result.json();assert.equal(review.reviewerId,'tenant');assert.equal(review.tenantId,'T');assert.equal(review.tenantPart.overallExperience,'Great');assert.equal(review.ownerPart.overallExperience,'');assert.equal(review.tenantPart.ownerTransparent,'');assert.ok(app.state.reviews[review.id].createdAt instanceof Date);
 const notification=Object.values(app.state.admin_notifications)[0];assert.equal(notification.reviewerType,'tenant');assert.match(notification.message,/- Overall Experience: Great/);assert.equal(notification.tenantPart.softNature,'Yes');
});
test('site settings use the original document and replacement semantics with persisted admin permission',async()=>{
 const app=isolated({users}),r=route(app,'admin/site-settings');
 const initial=await (await r.GET(request('/admin/site-settings',null))).json();assert.equal(initial.settings.quote,'Manage your properties and plan visits with ease');assert.equal(app.writes.length,0);
 assert.equal((await r.PUT(request('/admin/site-settings','owner','PUT',{quote:'Changed'}))).status,403);
 const result=await r.PUT(request('/admin/site-settings','admin','PUT',{quote:'Changed',bannerImages:['https://existing-r2.test/banner.png'],heroTitle:'Title'}));assert.equal(result.status,200);const {settings}=await result.json();assert.equal(settings.updatedBy,'admin');assert.equal(settings.id,'main_settings');assert.equal(app.state.siteSettings.main_settings.heroTitle,'Title');
 assert.equal((await r.PATCH(request('/admin/site-settings','admin','PATCH',{quote:'Replacement'}))).status,200);assert.equal(app.state.siteSettings.main_settings.heroTitle,undefined);
});
test('new request/response and Firestore field schemas match the compiled original Go models',()=>{
 const binary=path.join(os.tmpdir(),`propbank-final-go-reference-${process.pid}${process.platform==='win32'?'.exe':''}`);
 try {
  execFileSync('go',['build','-o',binary,'.'],{cwd:path.resolve('tests/go-reference'),stdio:'pipe'});
  const contracts=isolated().load('@/lib/server/services/contracts');
  const normalized=value=>JSON.parse(JSON.stringify(value));
  const fixtures={Review:{propertyId:'P',reviewerType:'tenant',tenantPart:{overallExperience:'Great'}},CreateReviewRequest:{propertyId:'P',reviewerType:'owner',ownerPart:{softNature:'Yes'}},InspectionReport:{propertyId:'P',reportType:'on_handover',report:'Keep',apartmentConditionImages:['https://existing/url'],createdAt:'2026-10-09T01:02:03Z'},CreateInspectionReportRequest:{propertyId:'P',reportType:'on_possession',electricityBillReceipt:'https://existing/url'},Service:{id:'S',category:'legal',isActive:true},ServiceRequest:{id:'R',userUID:'U',status:'in_progress',message:'Keep'},SiteSettings:{quote:'Keep',bannerImages:['https://existing/banner'],isAnnouncementActive:true}};
  for(const [kind,data]of Object.entries(fixtures)) {
   const go=JSON.parse(execFileSync(binary,{input:JSON.stringify({kind,data}),encoding:'utf8'}));
   assert.deepEqual(normalized(contracts.wireModel(kind,contracts.model(kind,data,true))),go,kind+' JSON');
   if(kind.startsWith('Create'))continue; // Request DTOs are never stored in Firestore.
   const stored=JSON.parse(execFileSync(binary,{input:JSON.stringify({kind,data,Store:true}),encoding:'utf8'}));
   assert.deepEqual(normalized(contracts.wireValue(contracts.storeModel(kind,contracts.model(kind,data,true)))),stored,kind+' Firestore');
  }
 }finally{try{fs.unlinkSync(binary);}catch{}}
});
