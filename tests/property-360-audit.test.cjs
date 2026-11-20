const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const p=()=>({...structuredClone(properties.P),buildingName:'Cedar Court',unitNumber:'204',monthlyRent:'35000',securityDeposit:'50000',agreementStartDate:'2030-01-01',agreementEndDate:'2030-12-31',agreementStatus:'active',moderationStatus:'approved'});
function app(extra={}){const property=p(),a=isolated({users:structuredClone(users),properties:{P:property},tenants:{T:{...property.tenants[0],propertyId:'P',ownerUID:'owner'}},...extra});a.env.TEST_STRICT_TRANSACTIONS='1';return a;}
const rows=(a,collection)=>Object.values(a.state[collection]||{});
const mail=a=>rows(a,'email_deliveries').filter(r=>r.kind!=='notification_intent');
const keyRequest=(url,uid,body,key='property360-request-key-0001',tenantId)=>{
 const source=request(url,uid,'POST',body),headers=new Headers(source.headers);headers.set('Idempotency-Key',key);if(tenantId)headers.set('X-Tenancy-ID',tenantId);return new Request(source,{headers});
};
const createService=(a,uid='tenant',serviceId='plumbing',key)=>route(a,'service-requests').POST(keyRequest('/service-requests',uid,{propertyId:'P',userUID:uid,serviceId,message:'Fixture request'},key));
async function upload(a,type='tds_report',uid='tenant',key='document-request-key-0001'){
 const res=await route(a,'documents').POST(request('/documents',uid,'POST',{propertyId:'P',documentName:'Fixture report',documentType:type,fileUrl:'data:application/pdf;base64,JVBERi0xLjQK',idempotencyKey:key,...(type==='tds_report'?{financialYear:'2030-31',amount:'1000',receiptDate:'2030-06-01'}:{})}));
 return {res,document:(await res.clone().json()).document};
}

test('all twelve Property 360 actions map to real protected pages; renewal/termination are eligibility gated',()=>{
 const source=fs.readFileSync('src/features/properties/ManageProperty.tsx','utf8');
 for(const label of ['View Details','Edit Property','Add Tenant Info','Request Services','Inspection Report','TDS Updation Report','Review','Legal Services','Other Related Services','Attach Documents','Go for Renewal','Terminate Agreement'])assert.ok(source.includes(label),label);
 for(const page of ['add-tenant','request-services','inspection-report','review','legal-services','other-services','attach-documents','renew-agreement','terminate-agreement'])assert.ok(fs.existsSync(`src/app/(protected)/${page}/[propertyId]/page.tsx`),page);
 assert.match(source,/disabled=\{!hasEligibleAgreement\(property\)\} onClick=\{\(\) => navigate\(`\/renew-agreement/);
 const attachment=fs.readFileSync('src/features/services/AttachDocuments.tsx','utf8');assert.ok(!attachment.includes('admin/notifications'));assert.match(attachment,/idempotencyKey:documentRequestKey/);
});
test('View Details and authorized history reads do not stage email or notifications; private IDOR stays denied',async()=>{
 const a=app(),get=route(a,'properties/[id]');assert.equal((await get.GET(request('/properties/P','owner'),context('P'))).status,200);
 for(const path of ['documents/property/[propertyId]','inspection-reports/property/[propertyId]'])assert.equal((await route(a,path).GET(request('/history','owner'),context('P','propertyId'))).status,200);
 assert.equal(rows(a,'email_deliveries').length,0);assert.equal(rows(a,'admin_notifications').length,0);
 assert.equal((await route(a,'documents/property/[propertyId]').GET(request('/documents/property/P','other'),context('P','propertyId'))).status,403);
});
test('Edit Property stages a readable administrative event only for meaningful edits',async()=>{
 const a=app(),endpoint=route(a,'properties/[id]');const body={buildingName:'Cedar Court Updated'};
 const first=await endpoint.PATCH(request('/properties/P','owner','PATCH',body),context('P'));assert.equal(first.status,200,await first.clone().text());
 assert.equal(a.state.properties.P.buildingName,body.buildingName);assert.ok(rows(a,'admin_notifications').length);
 const count=rows(a,'admin_notifications').length,again=await endpoint.PATCH(request('/properties/P','owner','PATCH',body),context('P'));assert.equal(again.status,200);assert.equal(rows(a,'admin_notifications').length,count);
 assert.ok(mail(a).some(e=>e.recipientRole==='admin'));
});
test('Add Tenant commits canonical data, admin notice and invitation without pretending an unconfirmed account is linked',async()=>{
 const a=app({properties:{P:{...p(),tenants:[],rentalStatus:'available'}},tenants:{}});
 const res=await route(a,'tenants').POST(request('/tenants','owner','POST',{propertyId:'P',ownerUID:'owner',tenants:[{firstName:'Other',lastName:'Member',email:users.other.email,phone:users.other.phoneNumber,monthlyRent:'35000',leaseStartDate:'2030-01-01',leaseEndDate:'2030-12-31'}]}));
 assert.equal(res.status,200,await res.clone().text());assert.equal(rows(a,'tenants').length,1);assert.equal(rows(a,'tenants')[0].linkConfirmationRequired,true);assert.equal(rows(a,'tenants')[0].userUID??'','');
 assert.ok(rows(a,'admin_notifications').some(n=>n.type==='tenant_assigned'));assert.ok(mail(a).some(e=>e.recipientRole==='admin'));
 assert.ok(!mail(a).some(e=>e.eventType==='tenancy.tenant_assigned'&&e.recipientUID==='other'));
});
for(const service of ['plumbing','legal-consultation','society-procedure'])test(`Request Services / Legal / Related: ${service} stages one admin notice, correct owner email and idempotent retry`,async()=>{
 const a=app(),res=await createService(a,'tenant',service);assert.equal(res.status,201,await res.clone().text());assert.equal(rows(a,'service_requests').length,1);
 const notices=rows(a,'admin_notifications');assert.equal(notices.length,1);assert.match(notices[0].message,/Cedar Court.*204.*Existing Address.*Tenant \(Tenant\)/);assert.match(notices[0].message,/\d{2}\/\d{2}\/\d{4}/);
 assert.deepEqual(new Set(mail(a).map(e=>e.recipientRole)),new Set(['owner','admin']));assert.equal(a.emails.length,0);
 const before=rows(a,'email_deliveries').length;assert.equal((await createService(a,'tenant',service)).status,200);assert.equal(rows(a,'email_deliveries').length,before);assert.equal(rows(a,'admin_notifications').length,1);
 await a.flush();assert.equal(a.emails.filter(e=>e.to.includes('admin@test.invalid')).length,1);assert.equal(a.emails.filter(e=>e.to.includes('tenant@test.invalid')).length,0);
});
test('failed or unauthorized service/inspection/review submissions leave no successful notifications',async()=>{
 const a=app();assert.equal((await createService(a,'other')).status,403);
 for(const [path,body]of [['inspection-reports',{propertyId:'P',reportType:'bad',report:'Fixture'}],['reviews',{propertyId:'P',tenantPart:{}}]])assert.equal((await route(a,path).POST(request('/'+path,'tenant','POST',body))).status,400);
 assert.equal(rows(a,'admin_notifications').length,0);assert.equal(rows(a,'email_deliveries').length,0);
});
test('business/outbox failure rolls back reports, media bindings and notifications together',async()=>{
 const a=app();a.env.TEST_DB_WRITE_COLLECTION='email_deliveries';
 const res=await route(a,'inspection-reports').POST(keyRequest('/inspection-reports','owner',{propertyId:'P',reportType:'on_possession',report:'Fixture'}));
 assert.equal(res.status,500);assert.equal(rows(a,'inspection_reports').length,0);assert.equal(rows(a,'admin_notifications').length,0);assert.equal(rows(a,'email_deliveries').length,0);assert.equal(a.emails.length,0);
});
test('Inspection Report persists a durable event; retry and provider failure never duplicate the record',async()=>{
 const a=app();a.env.TEST_MAIL_FAIL='1';const endpoint=route(a,'inspection-reports'),body={propertyId:'P',reportType:'on_possession',report:'Private inspection narrative'};
 assert.equal((await endpoint.POST(keyRequest('/inspection-reports','owner',body))).status,201);assert.equal((await endpoint.POST(keyRequest('/inspection-reports','owner',body))).status,200);
 assert.equal(rows(a,'inspection_reports').length,1);assert.equal(rows(a,'admin_notifications').length,1);await a.flush();assert.ok(mail(a).every(e=>e.status==='failed'));assert.ok(mail(a).every(e=>!e.html.includes('Private inspection narrative')));
});
test('Review infers tenant relationship before validating answers and preserves admin ratings without emailing them',async()=>{
 const a=app(),endpoint=route(a,'reviews'),body={propertyId:'P',tenantPart:{overallExperience:'Private feedback'}};
 const res=await endpoint.POST(keyRequest('/reviews','tenant',body));assert.equal(res.status,201,await res.clone().text());
 const review=(await res.json()).review;assert.equal(review.reviewerType,'tenant');assert.equal(review.ownerPart.overallExperience,'');
 assert.equal(rows(a,'admin_notifications')[0].tenantPart.overallExperience,'Private feedback');assert.ok(mail(a).every(e=>!e.html.includes('Private feedback')));
 assert.equal((await endpoint.POST(keyRequest('/reviews','tenant',{...body,tenantPart:{overallExperience:'Different'}}))).status,409);
});
test('multiple tenancy review requires explicit selection and never notifies a different tenant',async()=>{
 const second={...p().tenants[0],id:'U',userUID:'other',firstName:'Other',email:users.other.email};
 const a=app({properties:{P:{...p(),tenants:[...p().tenants,second]}},tenants:{T:{...p().tenants[0],propertyId:'P',ownerUID:'owner'},U:{...second,propertyId:'P',ownerUID:'owner'}}}),endpoint=route(a,'reviews'),body={propertyId:'P',ownerPart:{overallExperience:'Good'}};
 assert.equal((await endpoint.POST(keyRequest('/reviews','owner',body))).status,400);
 assert.equal((await endpoint.POST(keyRequest('/reviews','owner',body,'property360-review-key-0001','U'))).status,201);
 assert.ok(mail(a).some(e=>e.recipientUID==='other'));assert.ok(!mail(a).some(e=>e.recipientUID==='tenant'));
});
test('TDS / shared document upload and admin review stage appropriate notices without private file links or financial evidence',async()=>{
 const a=app(),{res,document}=await upload(a);assert.equal(res.status,201,await res.clone().text());assert.equal(a.state.documents[document.id].receiptDate,'2030-06-01');
 assert.equal(rows(a,'admin_notifications').length,1);assert.ok(mail(a).some(e=>e.recipientUID==='owner'));assert.ok(mail(a).every(e=>!e.html.includes('/api/media/')&&!e.html.includes('1000')));
 const patch=route(a,'documents/[id]'),body={status:'verified',comment:'Private review note'};
 assert.equal((await patch.PATCH(request('/documents/'+document.id,'owner','PATCH',body),context(document.id))).status,403);
 assert.equal((await patch.PATCH(request('/documents/'+document.id,'admin','PATCH',body),context(document.id))).status,200);
 const count=rows(a,'email_deliveries').length;assert.equal((await patch.PATCH(request('/documents/'+document.id,'admin','PATCH',body),context(document.id))).status,200);assert.equal(rows(a,'email_deliveries').length,count);
 assert.ok(mail(a).some(e=>e.eventType==='document.reviewed'&&e.recipientUID==='tenant'));assert.ok(mail(a).every(e=>!e.html.includes('Private review note')));
});
test('private Pre-Leased evidence never stages tenant notification and metadata/download restrictions remain enforced',async()=>{
 const a=app({properties:{P:{...p(),listingType:'pre_leased'}}}),{res,document}=await upload(a,'rental_agreement','owner');assert.equal(res.status,201,await res.clone().text());
 assert.ok(!mail(a).some(e=>e.recipientUID==='tenant'));assert.equal((await route(a,'documents/[id]').GET(request('/documents/'+document.id,'tenant'),context(document.id))).status,403);
 const notes=await route(a,'admin/notifications').GET(request('/admin/notifications?propertyId=P','tenant'));assert.deepEqual(await notes.json(),[]);
});
test('canonical inactive/unconfirmed/cross-owner relationships are excluded even when embedded records are stale',async()=>{
 const a=app({tenants:{T:{...p().tenants[0],propertyId:'P',ownerUID:'owner',isActive:false},U:{id:'U',propertyId:'P',ownerUID:'owner',userUID:'other',isActive:true,linkConfirmationRequired:true}}});
 assert.equal((await createService(a,'owner')).status,201);assert.ok(!mail(a).some(e=>e.recipientRole==='tenant'));
});
test('recipient membership is rechecked before provider delivery if tenancy ended after staging',async()=>{
 const a=app();assert.equal((await createService(a,'owner')).status,201);a.state.tenants.T.isActive=false;a.state.properties.P.tenants[0].isActive=false;await a.flush();
 assert.equal(a.emails.some(e=>e.to.includes('tenant@test.invalid')),false);assert.ok(mail(a).some(e=>e.recipientUID==='tenant'&&e.status==='cancelled'));
});
test('missing admin configuration retains a recoverable delivery; later repair uses the same provider key',async()=>{
 const a=app();delete a.env.ADMIN_EMAIL;assert.equal((await createService(a,'owner')).status,201);
 const admin=mail(a).find(e=>e.recipientRole==='admin');assert.ok(admin);const id=admin.id;await a.flush();assert.equal(a.state.email_deliveries[id].status,'pending');assert.equal(a.state.email_deliveries[id].recipientEmail,'');assert.equal(rows(a,'admin_notifications')[0].emailStatus,'unconfigured');
 a.env.ADMIN_EMAIL='admin@test.invalid';a.state.email_deliveries[id].nextRetryAt=new Date(0);a.state.email_deliveries[id].recoveryAt=new Date(0);
 await a.load('@/lib/server/services/transactional-email').recoverNotification(id);assert.equal(a.state.email_deliveries[id].status,'sent');assert.equal(a.emails.filter(e=>e.to.includes('admin@test.invalid')).length,1);
});
test('Go for Renewal / Terminate reject unoccupied registrations; expired active rentals remain eligible',async()=>{
 for(const listingType of ['rent','sell','pre_leased','manage']){const a=app({properties:{P:{...p(),listingType,rentalStatus:'available',tenants:[],tenantEmail:'',agreementStartDate:'',agreementEndDate:''}},tenants:{}});
  for(const endpoint of ['renew','terminate'])assert.equal((await route(a,'agreements/'+endpoint).POST(request('/agreements/'+endpoint,'owner','POST',{propertyId:'P',action:endpoint==='renew'?'request':'terminate'}))).status,409);
  assert.equal(rows(a,'email_deliveries').length,0);
 }
 const a=app();assert.equal(a.load('@/lib/agreement-eligibility').hasEligibleAgreement({...p(),agreementStatus:'expired'}),true);
});
test('renewal proposal preserves active terms, notifies all confirmed affected tenants and stages one admin email',async()=>{
 const second={...p().tenants[0],id:'U',userUID:'other',email:users.other.email},a=app({properties:{P:{...p(),tenants:[...p().tenants,second]}},tenants:{T:{...p().tenants[0],propertyId:'P',ownerUID:'owner'},U:{...second,propertyId:'P',ownerUID:'owner'}}});
 const res=await route(a,'agreements/renew').POST(request('/agreements/renew','owner','POST',{propertyId:'P',action:'request',terms:{monthlyRent:'40000',agreementStartDate:'2031-01-01',agreementEndDate:'2031-12-31',agreementPeriod:'12'}}));
 assert.equal(res.status,200,await res.clone().text());assert.equal(a.state.properties.P.monthlyRent,'35000');assert.equal(a.state.properties.P.agreementStartDate,'2030-01-01');assert.ok(mail(a).some(e=>e.recipientUID==='tenant'));assert.ok(mail(a).some(e=>e.recipientUID==='other'));assert.equal(mail(a).filter(e=>e.recipientRole==='admin').length,1);
});
test('termination synchronizes canonical tenants atomically and creates one admin notice; repeats are no-ops',async()=>{
 const a=app(),endpoint=route(a,'agreements/terminate');assert.equal((await endpoint.POST(request('/agreements/terminate','owner','POST',{propertyId:'P',action:'terminate'}))).status,200);
 assert.equal(a.state.tenants.T.isActive,false);assert.equal(a.state.properties.P.rentalStatus,'available');assert.equal(rows(a,'admin_notifications').length,1);assert.equal(mail(a).filter(e=>e.recipientRole==='admin').length,1);
 const count=rows(a,'email_deliveries').length;assert.equal((await endpoint.POST(request('/agreements/terminate','owner','POST',{propertyId:'P',action:'terminate'}))).status,200);assert.equal(rows(a,'email_deliveries').length,count);
});

test('service history uses bounded stable cursor pages and never implies the first page is complete',async()=>{
 const requests={};for(let i=0;i<60;i++){const id=String(i).padStart(3,'0');requests[id]={id,propertyId:'P',userUID:'tenant',serviceName:'Plumbing',status:'pending'};}
 const a=app({service_requests:requests}),endpoint=route(a,'service-requests'),seen=[];let cursor='';
 do{const response=await endpoint.GET(request('/service-requests?propertyId=P&pageSize=25'+(cursor?'&cursor='+cursor:''),'owner'));assert.equal(response.status,200);const page=await response.json();seen.push(...page.data.map(r=>r.id));cursor=page.nextCursor;}while(cursor);
 assert.equal(seen.length,60);assert.equal(new Set(seen).size,60);assert.ok(a.reads.filter(r=>r.collection==='service_requests'&&!r.id).every(r=>r.returnedDocuments<=26));
 const ui=fs.readFileSync('src/features/services/ServiceRequestWorkflow.tsx','utf8');assert.match(ui,/useInfiniteQuery/);assert.match(ui,/Load more requests/);assert.match(ui,/query\.hasNextPage/);
});

test('activity visibility remains scoped to the actor/affected relationship and admin read state stays per account',async()=>{
 const a=app();assert.equal((await createService(a,'tenant')).status,201);const notice=rows(a,'admin_notifications')[0];
 const list=route(a,'admin/notifications');for(const uid of ['owner','tenant']){const response=await list.GET(request('/admin/notifications?propertyId=P',uid));assert.equal(response.status,200);assert.ok((await response.json()).some(n=>n.id===notice.id));}
 assert.equal((await list.GET(request('/admin/notifications?propertyId=P','other'))).status,403);
 assert.equal((await route(a,'admin/notifications/[id]/read').PUT(request('/admin/notifications/'+notice.id+'/read','owner','PUT',{}),context(notice.id))).status,403);
 assert.equal((await route(a,'admin/notifications/[id]/read').PUT(request('/admin/notifications/'+notice.id+'/read','admin','PUT',{}),context(notice.id))).status,200);
 assert.ok(a.state.admin_notifications[notice.id].readByUIDs.includes('admin'));
});

test('agreement termination refuses inconsistent canonical tenancy state instead of committing a partial closure',async()=>{
 const a=app();a.state.tenants.T.isActive=false;
 const res=await route(a,'agreements/terminate').POST(request('/agreements/terminate','owner','POST',{propertyId:'P',action:'terminate'}));
 assert.equal(res.status,409);assert.equal(a.state.properties.P.agreementStatus,'active');assert.equal(a.state.properties.P.tenants[0].isActive,true);assert.equal(rows(a,'email_deliveries').length,0);
});

test('admin-assisted service notice distinguishes the actual requester from the submitting administrator',async()=>{
 const a=app(),res=await route(a,'service-requests').POST(keyRequest('/service-requests','admin',{propertyId:'P',userUID:'owner',serviceId:'plumbing',message:'Fixture request'}));assert.equal(res.status,201);
 const notice=rows(a,'admin_notifications')[0];assert.equal(notice.userId,'owner');assert.equal(notice.actorUID,'admin');assert.match(notice.message,/Requested by: Owner \(Owner\).*Submitted by: Admin \(Administrator\)/);
});

test('admin property edit notifies the owner while retaining one moderation email to admin',async()=>{
 const a=app(),response=await route(a,'properties/[id]').PATCH(request('/properties/P','admin','PATCH',{buildingName:'Admin updated name'}),context('P'));
 assert.equal(response.status,200,await response.clone().text());assert.ok(mail(a).some(e=>e.recipientRole==='owner'));assert.equal(mail(a).filter(e=>e.recipientRole==='admin').length,1);
});

test('document removal preserves storage authorization and stages an accurate cleanup-request notice',async()=>{
 const a=app(),{res,document}=await upload(a,'rental_agreement','owner');assert.equal(res.status,201);
 const endpoint=route(a,'documents/[id]');assert.equal((await endpoint.DELETE(request('/documents/'+document.id,'other','DELETE'),context(document.id))).status,403);
 assert.equal((await endpoint.DELETE(request('/documents/'+document.id,'owner','DELETE'),context(document.id))).status,200);
 assert.equal(a.state.documents[document.id],undefined);assert.ok(rows(a,'admin_notifications').some(n=>n.title==='Document removal requested'&&n.status==='cleanup_pending'));
 assert.ok(mail(a).every(e=>!e.html.includes('/api/media/')));
 const source=fs.readFileSync('src/features/services/AttachDocuments.tsx','utf8');assert.ok(!source.includes('// Refresh documents list'));assert.match(source,/documentOperations\.current\.has/);
});

test('an available property without a tenancy cannot create a review of an invented tenant',async()=>{
 const a=app({properties:{P:{...p(),tenants:[],rentalStatus:'available'}},tenants:{}}),res=await route(a,'reviews').POST(request('/reviews','owner','POST',{propertyId:'P',ownerPart:{overallExperience:'Fixture'}}));
 assert.equal(res.status,400);assert.equal(rows(a,'reviews').length,0);assert.equal(rows(a,'email_deliveries').length,0);
});

test('a client cannot fabricate a document-upload success notification without the document transaction',async()=>{
 const a=app(),response=await route(a,'admin/notifications').POST(request('/admin/notifications','owner','POST',{type:'document_upload',propertyId:'P',title:'Forged upload',message:'No document was saved'}));
 assert.equal(response.status,403);assert.equal(rows(a,'admin_notifications').length,0);assert.equal(rows(a,'email_deliveries').length,0);
});

test('property-level renewal/termination cannot merge independent tenant agreement periods',async()=>{
 const second={...p().tenants[0],id:'U',userUID:'other',leaseEndDate:'2032-12-31',monthlyRent:'12000'},a=app({properties:{P:{...p(),tenants:[...p().tenants,second]}},tenants:{T:{...p().tenants[0],propertyId:'P',ownerUID:'owner'},U:{...second,propertyId:'P',ownerUID:'owner'}}});
 const res=await route(a,'agreements/terminate').POST(request('/agreements/terminate','owner','POST',{propertyId:'P',action:'terminate'}));
 assert.equal(res.status,409);assert.equal(a.state.tenants.T.isActive,true);assert.equal(a.state.tenants.U.isActive,true);assert.equal(a.state.properties.P.agreementStatus,'active');assert.equal(rows(a,'email_deliveries').length,0);
});

test('service update notices retain the real request reference and expose its recorded status to the owner',async()=>{
 const a=app(),created=await createService(a),id=(await created.json()).serviceRequest.id;
 const response=await route(a,'service-requests/[id]').PUT(request('/service-requests/'+id,'admin','PUT',{status:'resolved',resolutionReport:'Fixture resolution'}),context(id));assert.equal(response.status,200);
 const updated=rows(a,'admin_notifications').find(n=>n.title==='Service request updated');assert.equal(updated.recordId,id);assert.equal(updated.relatedId,id);
 const notifications=await route(a,'admin/notifications').GET(request('/admin/notifications?propertyId=P','owner'));assert.ok((await notifications.json()).some(n=>n.status==='resolved'));
});
