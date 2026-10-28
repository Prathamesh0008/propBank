const assert=require('node:assert/strict'),{test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');
test('login returns the verified Firebase token even with a legacy JWT secret',async()=>{
 const app=isolated({users});app.env.JWT_SECRET='isolated-test-secret';const r=route(app,'auth/login');
 assert.equal((await r.POST(request('/auth/login',null,'POST',{uid:'owner'}))).status,401);
 assert.equal((await r.POST(request('/auth/login','other','POST',{uid:'owner'}))).status,403);
 assert.equal((await r.POST(request('/auth/login','owner','POST',{}))).status,400);
 const result=await r.POST(request('/auth/login','owner','POST',{uid:'owner'}));assert.equal(result.status,200);
 const body=await result.json();assert.equal(body.token,'owner');assert.equal(body.user.uid,'owner');
 assert.equal((await route(app,'properties').GET(request('/properties?ownerUID=owner',body.token))).status,200);
 delete app.env.JWT_SECRET;const native=await r.POST(request('/auth/login','owner','POST',{uid:'owner'}));assert.equal(native.status,200);assert.equal((await native.json()).token,'owner');
 assert.ok(app.writes.every(write=>['users','auth_activity'].includes(write.collection)));
});
test('services and service requests retain collections, omission, managed files and admin/self access',async()=>{
 const app=isolated({users,properties,services:{S:{...defaults,id:'S',name:'Legal',isActive:true},off:{...defaults,id:'off',isActive:false}}});
 const service=await (await route(app,'services').GET(request('/services',null))).json();assert.equal(service.data.length,12);assert.ok(service.data.some(value=>value.id==='S'));assert.ok(service.data.some(value=>value.id==='plumbing'));
 const r=route(app,'service-requests');
 assert.equal((await r.POST(request('/service-requests','other','POST',{userUID:'owner',serviceId:'S'}))).status,403);
 assert.equal((await r.POST(request('/service-requests','owner','POST',{userUID:'owner',serviceId:'missing'}))).status,404);
 const result=await r.POST(request('/service-requests','owner','POST',{userUID:'owner',serviceId:'S',propertyId:'P',message:'Keep this text',image:'data:image/png;base64,AQID'}));assert.equal(result.status,201);
 const {serviceRequest:value}=await result.json();assert.equal(value.status,'pending');assert.equal(value.userName,'Owner');assert.equal(value.serviceName,'Legal');assert.match(value.image,/^\/api\/media\/[a-f0-9-]{36}$/);assert.equal(app.state.service_requests[value.id].message,'Keep this text');
 const notification=Object.values(app.state.admin_notifications)[0];assert.equal(notification.serviceImage,value.image);assert.equal(notification.ownerId,'owner');assert.equal(notification.tenantName,'Tenant Name');
 assert.equal((await r.GET(request('/service-requests?admin=true','other'))).status,403);
 assert.equal((await r.GET(request('/service-requests?userUID=owner','other'))).status,403);
 assert.equal((await r.GET(request('/service-requests?userUID=owner','owner'))).status,200);
 const update=route(app,'service-requests/[id]');assert.equal((await update.PUT(request('/service-requests/'+value.id,'owner','PUT',{status:'completed'}),context(value.id))).status,403);
 assert.equal((await update.PUT(request('/service-requests/'+value.id,'admin','PUT',{status:'completed',adminNotes:'Done'}),context(value.id))).status,200);assert.equal(app.state.service_requests[value.id].adminNotes,'Done');
 app.r2Outage();assert.equal((await r.POST(request('/service-requests','owner','POST',{userUID:'owner',serviceId:'S',image:'data:image/png;base64,AQID'}))).status,502);assert.equal(Object.keys(app.state.service_requests).length,1);
 
});
test('inspection reports preserve managed attachments, typed schema, notifications and ordered queries',async()=>{
 const app=isolated({users,properties}),r=route(app,'inspection-reports');
 assert.equal((await r.POST(request('/inspection-reports',null,'POST',{}))).status,401);
 assert.equal((await r.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'bad'}))).status,400);
 const result=await r.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'on_possession',report:'Original report',apartmentConditionImages:['data:image/png;base64,AQID'],keysDetails:'Two keys',unknown:'ignored'}));assert.equal(result.status,201);
 const {report}=await result.json();assert.equal(report.userId,'tenant');assert.equal(report.propertyTitle,'Existing Home');assert.equal(report.keysDetails,'Two keys');assert.equal(report.unknown,undefined);assert.match(report.apartmentConditionImages[0],/^\/api\/media\/[a-f0-9-]{36}$/);assert.ok(app.state.inspection_reports[report.id].createdAt instanceof Date);
 const byProperty=await (await route(app,'inspection-reports/property/[propertyId]').GET(request('/inspection-reports/property/P','admin'),context('P','propertyId'))).json();assert.equal(byProperty.reports[0].id,report.id);
 const byUser=route(app,'inspection-reports/user/[userId]');assert.equal((await byUser.GET(request('/inspection-reports/user/tenant','admin'),context('tenant','userId'))).status,200);assert.equal((await byUser.GET(request('/inspection-reports/user/tenant','other'),context('tenant','userId'))).status,403);
 const notification=Object.values(app.state.admin_notifications)[0];assert.equal(notification.type,'inspection_report');assert.match(notification.message,/On Possession/);assert.equal(notification.tenantName,'Tenant Name');
});
test('inspection reports isolate report-specific attachments before storage staging',async()=>{
 const possession=isolated({users,properties}),possessionRoute=route(possession,'inspection-reports');
 const wrongPossession=await possessionRoute.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'on_possession',report:'Possession report',handoverLetterFile:'data:application/pdf;base64,AQID'}));
 assert.equal(wrongPossession.status,400);assert.equal(possession.objects.length,0);assert.equal(Object.keys(possession.state.inspection_reports||{}).length,0);

 const handover=isolated({users,properties}),handoverRoute=route(handover,'inspection-reports');
 const wrongHandover=await handoverRoute.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'on_handover',report:'Handover report',possessionLetterFile:'data:application/pdf;base64,AQID'}));
 assert.equal(wrongHandover.status,400);assert.equal(handover.objects.length,0);assert.equal(Object.keys(handover.state.inspection_reports||{}).length,0);

 const valid=isolated({users,properties}),validRoute=route(valid,'inspection-reports');
 const response=await validRoute.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'on_handover',report:'Handover report',handoverLetterFile:'data:application/pdf;base64,AQID',electricityBillMeterImage:'data:image/jpeg;base64,AQID'}));
 assert.equal(response.status,201);const {report}=await response.json();assert.match(report.handoverLetterFile,/^\/api\/media\//);assert.equal(report.possessionLetterFile,undefined);assert.equal(valid.objects.filter(item=>item.operation==='PutObjectCommand').length,2);
});
test('inspection report attachment limits and MIME rules fail before storage staging',async()=>{
 const tooMany=isolated({users,properties}),tooManyRoute=route(tooMany,'inspection-reports');
 const quantity=await tooManyRoute.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'on_possession',report:'Condition report',apartmentConditionImages:Array.from({length:9},()=> 'data:image/png;base64,AQID')}));
 assert.equal(quantity.status,400);assert.equal(tooMany.objects.length,0);

 const invalidType=isolated({users,properties}),invalidRoute=route(invalidType,'inspection-reports');
 const mime=await invalidRoute.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'on_possession',report:'Condition report',apartmentConditionImages:['data:image/gif;base64,AQID']}));
 assert.equal(mime.status,400);assert.equal(invalidType.objects.length,0);

 const oversized=isolated({users,properties}),oversizedRoute=route(oversized,'inspection-reports');
 const largeBody='A'.repeat(Math.ceil((5*1024*1024+1)/3)*4);
 const size=await oversizedRoute.POST(request('/inspection-reports','tenant','POST',{propertyId:'P',reportType:'on_possession',report:'Condition report',possessionLetterFile:`data:application/pdf;base64,${largeBody}`}));
 assert.equal(size.status,400);assert.equal(oversized.objects.length,0);
});
test('switching inspection report types retains common files and removes obsolete conditional files',()=>{
 const policy=isolated().load('@/lib/inspection-report-policy');
 const common='data:image/png;base64,AQID',letter='data:application/pdf;base64,AQID';
 const handover=policy.switchInspectionType('on_handover',{possessionLetterFile:letter,handoverLetterFile:letter,electricityBillMeterImage:common});
 assert.equal(handover.possessionLetterFile,undefined);assert.equal(handover.handoverLetterFile,letter);assert.equal(handover.electricityBillMeterImage,common);
 const possession=policy.switchInspectionType('on_possession',handover);
 assert.equal(possession.handoverLetterFile,undefined);assert.equal(possession.electricityBillMeterImage,common);
 const fourMegabytes='A'.repeat(Math.ceil((4*1024*1024)/3)*4);
 assert.match(policy.validateInspectionFiles('on_possession',{apartmentConditionImages:Array(7).fill(`data:image/png;base64,${fourMegabytes}`)}),/total 25 MB/);
});
test('reviews preserve nested rating defaults, owner/tenant metadata and structured notification',async()=>{
 const app=isolated({users,properties}),r=route(app,'reviews');
 const result=await r.POST(request('/reviews','tenant','POST',{propertyId:'P',reviewerType:'tenant',tenantPart:{overallExperience:'Great',softNature:'Yes'}}));assert.equal(result.status,201);
 const {review}=await result.json();assert.equal(review.reviewerId,'tenant');assert.equal(review.tenantId,'T');assert.equal(review.tenantPart.overallExperience,'Great');assert.equal(review.ownerPart.overallExperience,'');assert.equal(review.tenantPart.ownerTransparent,'');assert.ok(app.state.reviews[review.id].createdAt instanceof Date);
 const notification=Object.values(app.state.admin_notifications)[0];assert.equal(notification.reviewerType,'tenant');assert.match(notification.message,/- Overall Experience: Great/);assert.equal(notification.tenantPart.softNature,'Yes');
});
test('review relationship is derived from trusted property membership',async()=>{
 const app=isolated({users,properties}),r=route(app,'reviews');
 const tenant=await r.POST(request('/reviews','tenant','POST',{propertyId:'P',tenantPart:{overallExperience:'Accurate tenant review'},ownerPart:{overallExperience:'Must not be used'}}));
 assert.equal(tenant.status,201);const tenantBody=await tenant.json();assert.equal(tenantBody.review.reviewerType,'tenant');assert.equal(tenantBody.review.ownerPart.overallExperience,'');
 assert.equal((await r.POST(request('/reviews','tenant','POST',{propertyId:'P',reviewerType:'owner',ownerPart:{overallExperience:'Forged'}}))).status,403);
 assert.equal((await r.POST(request('/reviews','owner','POST',{propertyId:'P',reviewerType:'tenant',tenantPart:{overallExperience:'Forged'}}))).status,403);
 assert.equal((await r.POST(request('/reviews','admin','POST',{propertyId:'P',reviewerType:'owner',ownerPart:{overallExperience:'Admin is not the owner'}}))).status,403);
 const owner=await r.POST(request('/reviews','owner','POST',{propertyId:'P',ownerPart:{overallExperience:'Accurate owner review'}}));
 assert.equal(owner.status,201);assert.equal((await owner.json()).review.reviewerType,'owner');
});
test('site settings use the original document and replacement semantics with persisted admin permission',async()=>{
 const app=isolated({users}),r=route(app,'admin/site-settings');
 const initial=await (await r.GET(request('/admin/site-settings',null))).json();assert.equal(initial.settings.quote,'Manage your properties and plan visits with ease');assert.equal(app.writes.length,0);
 assert.equal((await r.PUT(request('/admin/site-settings','owner','PUT',{quote:'Changed'}))).status,403);
 const result=await r.PUT(request('/admin/site-settings','admin','PUT',{quote:'Changed',bannerImages:['https://existing-r2.test/banner.png'],heroTitle:'Title'}));assert.equal(result.status,200);const {settings}=await result.json();assert.equal(settings.updatedBy,'admin');assert.equal(settings.id,'main_settings');assert.equal(app.state.siteSettings.main_settings.heroTitle,'Title');
 assert.equal((await r.PATCH(request('/admin/site-settings','admin','PATCH',{quote:'Replacement'}))).status,200);assert.equal(app.state.siteSettings.main_settings.heroTitle,undefined);
});
test('new request/response and Firestore field schemas match the compiled original Go models',{skip:fs.existsSync(path.resolve('tests/go-reference'))?false:'Original Go reference source is unavailable'},()=>{
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
