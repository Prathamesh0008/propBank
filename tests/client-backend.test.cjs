const assert=require('node:assert/strict'),{test}=require('node:test');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');

test('tenant-submitted properties link only the verified submitter, remain private and retain reported owner data for admin',async()=>{
 const app=isolated({users,properties});
 const body={createdAs:'tenant',ownerUID:'other',propertyTitle:'Self recorded rental',propertyType:'residential',location:'Rental address',monthlyRent:'30000',paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2027-01-01',tenantEmail:'other@test.invalid',reportedOwner:{personName:'Supplied Landlord',phone:'999',email:'other@test.invalid'},listingType:'sell',isSold:true};
 const response=await route(app,'properties').POST(request('/properties','owner','POST',body));assert.equal(response.status,200);const property=(await response.json()).property,id=property.id;
 assert.equal(property.userRole,'tenant');assert.equal(property.ownerUID,'');assert.equal(property.submittedByUID,'owner');assert.equal(property.tenants[0].userUID,'owner');assert.equal(property.tenants[0].email,'owner@test.invalid');assert.equal(property.ownershipVerification,'pending');assert.equal(app.state.properties[id].listingType,'rent');assert.equal(app.state.properties[id].isSold,false);
 assert.equal(Object.values(app.state.tenants).filter(t=>t.propertyId===id&&t.userUID==='owner').length,1);
 const rented=await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=owner','owner'));assert.ok((await rented.json()).properties.some(p=>p.id===id));
 const admin=await route(app,'properties').GET(request('/properties?admin=true','admin'));assert.equal((await admin.json()).properties.find(p=>p.id===id).reportedOwner.personName,'Supplied Landlord');
 assert.equal((await route(app,'properties/[id]').GET(request(`/properties/${id}`,null),context(id))).status,404);
 assert.equal((await route(app,'properties/[id]').GET(request(`/properties/${id}`,'other'),context(id))).status,404);
 assert.equal((await route(app,'properties/[id]').PUT(request(`/properties/${id}`,'owner','PUT',{monthlyRent:'1'}),context(id))).status,403);
 await app.flush();assert.equal(app.emails.length,0);
});

test('tenant property intake rejects invalid mode, spoofed owner fields and missing rental terms before writing',async()=>{
 const app=isolated({users,properties});const api=route(app,'properties');
 for(const body of [{createdAs:'admin'},{createdAs:'tenant',reportedOwner:{personName:'Owner',phone:'999',userUID:'other'}},{createdAs:'tenant',reportedOwner:{personName:'Owner',phone:'999'},propertyTitle:'Rental',propertyType:'residential',location:'Address'}])assert.equal((await api.POST(request('/properties','tenant','POST',body))).status,400);
 assert.equal(app.writes.length,0);
});

test('assigning a new tenancy after termination restores active agreement state and retains history',async()=>{
 const history=[{action:'terminated',actorUID:'owner',at:'2026-01-01'}];
 const app=isolated({users,properties:{P:{...properties.P,agreementStatus:'terminated',agreementHistory:history,rentalStatus:'available',tenants:properties.P.tenants.map(t=>({...t,isActive:false}))}}});
 const response=await route(app,'tenants').POST(request('/tenants','owner','POST',{propertyId:'P',ownerUID:'owner',tenants:[{firstName:'Tenant',lastName:'User',email:'tenant@test.invalid',phone:'456',monthlyRent:'35000',leaseStartDate:'2027-01-01',leaseEndDate:'2028-01-01'}]}));
 assert.equal(response.status,200);assert.equal(app.state.properties.P.agreementStatus,'active');assert.equal(app.state.properties.P.monthlyRent,'35000');assert.equal(app.state.properties.P.agreementStartDate,'2027-01-01');assert.deepEqual(app.state.properties.P.agreementHistory[0],history[0]);assert.equal(app.state.properties.P.agreementHistory[1].action,'tenancy_started');assert.equal(app.state.properties.P.tenants[0].isActive,false);
});

test('tenant assignment validates Firebase accounts and atomically synchronizes relationship changes',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,tenants:[],rentalStatus:'available'}}});
 const root=route(app,'tenants');const input={propertyId:'P',ownerUID:'owner',tenants:[{firstName:'Tenant',lastName:'User',email:'tenant@test.invalid',phone:'456',userUID:'tenant',monthlyRent:'30000'}]};
 assert.equal((await root.POST(request('/tenants','owner','POST',{...input,tenants:[{...input.tenants[0],email:'other@test.invalid'}]}))).status,403);assert.equal(app.writes.length,0);
 assert.equal((await root.POST(request('/tenants','owner','POST',{...input,tenants:[input.tenants[0],{}]}))).status,400);assert.equal(app.writes.length,0);
 const response=await root.POST(request('/tenants','admin','POST',input));assert.equal(response.status,200);const id=(await response.json()).tenants[0].id;
 assert.equal(app.state.tenants[id].userUID,'tenant');assert.equal(app.state.properties.P.tenants[0].id,id);
 assert.equal((await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=tenant','tenant'))).status,200);
 const detail=route(app,'tenants/[id]');assert.equal((await detail.PUT(request(`/tenants/${id}`,'owner','PUT',{monthlyRent:'35000'}),context(id))).status,200);assert.equal(app.state.properties.P.tenants[0].monthlyRent,'35000');
 assert.equal((await detail.DELETE(request(`/tenants/${id}`,'owner','DELETE'),context(id))).status,200);assert.equal(app.state.properties.P.tenants[0].isActive,false);
 assert.equal((await route(app,'documents/property/[propertyId]').GET(request('/documents/property/P','tenant'),context('P','propertyId'))).status,403);
});

test('renewal keeps old terms until owner approval and persists snapshots and synchronized tenant terms',async()=>{
 const tenant={...properties.P.tenants[0],leaseStartDate:'2029-01-01',leaseEndDate:'2029-12-31'};
 const app=isolated({users,properties:{P:{...properties.P,monthlyRent:'30000',agreementStartDate:'2029-01-01',agreementEndDate:'2029-12-31',tenants:[tenant]}},tenants:{T:{...tenant,propertyId:'P',ownerUID:'owner'}}});
 const req=route(app,'agreements/request-renewal'),owner=route(app,'agreements/renew');
 const proposal={propertyId:'P',terms:{monthlyRent:'35000',agreementStartDate:'2030-01-01',agreementEndDate:'2030-12-31'}};
 assert.equal((await req.POST(request('/agreements/request-renewal','other','POST',proposal))).status,403);
 const response=await req.POST(request('/agreements/request-renewal','tenant','POST',proposal));assert.equal(response.status,200);const body=await response.json();
 assert.equal(app.state.properties.P.monthlyRent,'30000');assert.equal(body.request.status,'pending');assert.equal(body.request.requestedBy,'tenant');
 assert.equal((await req.POST(request('/agreements/request-renewal','tenant','POST',{...proposal,action:'approve',requestId:body.request.id}))).status,403);
 assert.equal((await owner.POST(request('/agreements/renew','admin','POST',{propertyId:'P',action:'approve',requestId:body.request.id}))).status,403);
 assert.equal((await owner.POST(request('/agreements/renew','owner','POST',{propertyId:'P',action:'approve',requestId:'stale'}))).status,409);
 assert.equal((await owner.POST(request('/agreements/renew','owner','POST',{propertyId:'P',action:'approve',requestId:body.request.id}))).status,200);
 assert.equal(app.state.properties.P.monthlyRent,'35000');assert.equal(app.state.tenants.T.monthlyRent,'35000');assert.equal(app.state.properties.P.agreementHistory.length,2);assert.equal(app.state.properties.P.agreementHistory[1].previousTerms.monthlyRent,'30000');
 assert.equal((await owner.POST(request('/agreements/renew','owner','POST',{propertyId:'P',action:'approve',requestId:body.request.id}))).status,409);
});

test('termination records notice dates and retains inactive tenancy and prior agreement history',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,agreementStartDate:'2029-01-01',agreementEndDate:'2030-12-31'}},tenants:{T:{...properties.P.tenants[0],propertyId:'P',ownerUID:'owner'}}});const r=route(app,'agreements/terminate');
 assert.equal((await r.POST(request('/agreements/terminate','other','POST',{propertyId:'P'}))).status,403);
 assert.equal((await r.POST(request('/agreements/terminate','owner','POST',{propertyId:'P',noticePeriod:'1 Month',noticeStartDate:'bad',terminationDate:'2030-02-01'}))).status,400);
 assert.equal((await r.POST(request('/agreements/terminate','owner','POST',{propertyId:'P',noticePeriod:'1 Month',noticeStartDate:'2030-01-01',terminationDate:'2030-02-01'}))).status,200);
 assert.equal(app.state.properties.P.agreementStatus,'notice_served');assert.equal(app.state.properties.P.noticeStartDate,'2030-01-01T00:00:00.000Z');
 assert.equal((await r.POST(request('/agreements/terminate','owner','POST',{propertyId:'P'}))).status,200);
 assert.equal(app.state.properties.P.rentalStatus,'available');assert.equal(app.state.properties.P.tenants[0].isActive,false);assert.equal(app.state.tenants.T.isActive,false);assert.equal(app.state.properties.P.agreementHistory[1].previousTerms.agreementEndDate,'2030-12-31');
 assert.equal((await r.POST(request('/agreements/terminate','owner','POST',{propertyId:'P'}))).status,200);assert.equal(app.state.properties.P.agreementHistory.length,2);
});

test('service requests authorize property membership, validate admin resolutions and retain archive history',async()=>{
 const app=isolated({users,properties,services:{S:{...defaults,id:'S',name:'Plumbing',isActive:true}}});const root=route(app,'service-requests');
 const input={userUID:'other',propertyId:'P',serviceId:'S',message:'Leakage'};assert.equal((await root.POST(request('/service-requests','other','POST',input))).status,403);
 const response=await root.POST(request('/service-requests','tenant','POST',{...input,userUID:'tenant'}));assert.equal(response.status,201);const id=(await response.json()).serviceRequest.id;const detail=route(app,'service-requests/[id]');
 const notifications=await (await route(app,'admin/notifications').GET(request('/admin/notifications','admin'))).json();assert.ok(notifications.some(n=>n.relatedId===id));
 assert.equal((await detail.PUT(request(`/service-requests/${id}`,'owner','PUT',{status:'completed'}),context(id))).status,403);
 assert.equal((await detail.PUT(request(`/service-requests/${id}`,'admin','PUT',{status:'invalid'}),context(id))).status,400);
 assert.equal((await detail.PUT(request('/service-requests/missing','admin','PUT',{status:'completed'}),context('missing'))).status,404);
 assert.equal((await detail.PUT(request(`/service-requests/${id}`,'admin','PUT',{status:'resolved',adminNotes:'Fixed',resolutionReport:'Replaced pipe',adminImage:'https://legacy/report.png',action:'archive'}),context(id))).status,200);
 assert.equal(app.state.service_requests[id].isArchived,true);assert.equal(app.state.service_requests[id].resolutionReport,'Replaced pipe');assert.equal(app.state.service_requests[id].history.length,2);
 const list=await (await root.GET(request('/service-requests?propertyId=P','owner'))).json();assert.equal(list.data[0].resolutionReport,'Replaced pipe');
 assert.equal((await detail.PUT(request(`/service-requests/${id}`,'admin','PUT',{action:'unarchive'}),context(id))).status,200);assert.equal(app.state.service_requests[id].isArchived,false);
});
test('owner can reject a tenant termination request without releasing the property',async()=>{
 const app=isolated({users,properties}),tenant=route(app,'agreements/request-termination'),owner=route(app,'agreements/terminate');
 const response=await tenant.POST(request('/agreements/request-termination','tenant','POST',{propertyId:'P'}));assert.equal(response.status,200);const id=(await response.json()).request.id;
 assert.equal((await owner.POST(request('/agreements/terminate','other','POST',{propertyId:'P',action:'reject',requestId:id}))).status,403);
 assert.equal((await owner.POST(request('/agreements/terminate','owner','POST',{propertyId:'P',action:'reject',requestId:id}))).status,200);assert.equal(app.state.properties.P.rentalStatus,'rented');assert.equal(app.state.properties.P.tenants[0].isActive,true);assert.equal(app.state.properties.P.agreementRequest.status,'rejected');
});

test('TDS and payment receipt reports reuse documents and preserve supplied metadata without tax computation',async()=>{
 const app=isolated({users,properties});const root=route(app,'documents');
 const input={propertyId:'P',documentName:'TDS receipt',documentType:'tds_report',fileUrl:'https://legacy/receipt.pdf',financialYear:'2029-30',period:'Q1',amount:'2500',description:'Owner supplied'};
 assert.equal((await root.POST(request('/documents','other','POST',input))).status,403);
 const response=await root.POST(request('/documents','tenant','POST',input));assert.equal(response.status,201);const id=(await response.json()).document.id;
 assert.equal(app.state.documents[id].amount,'2500');assert.equal(app.state.documents[id].status,'submitted');
 const detail=route(app,'documents/[id]');assert.equal((await detail.PATCH(request(`/documents/${id}`,'tenant','PATCH',{status:'verified'}),context(id))).status,403);
 assert.equal((await detail.PATCH(request(`/documents/${id}`,'admin','PATCH',{status:'verified',comment:'Receipt reviewed'}),context(id))).status,200);
 const list=await (await root.GET(request('/documents?propertyId=P&documentType=tds_report','owner'))).json();assert.equal(list.documents[0].financialYear,'2029-30');assert.equal(list.documents[0].statusHistory.length,1);
});

test('document metadata cannot cause deletion of a different property storage object',async()=>{
 const app=isolated({users,properties});const response=await route(app,'documents').POST(request('/documents','owner','POST',{propertyId:'P',documentName:'Legacy',documentType:'agreement',fileUrl:'https://existing-r2.test/documents/OTHER/private.pdf'}));const id=(await response.json()).document.id;
 assert.equal((await route(app,'documents/[id]').DELETE(request(`/documents/${id}`,'owner','DELETE'),context(id))).status,200);assert.equal(app.objects.length,0);
});

test('admin property query includes archived records while public fields exclude private histories',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,isActive:false,status:'inactive',agreementHistory:[{secret:'private'}]}}});const root=route(app,'properties');
 assert.equal((await root.GET(request('/properties?admin=true','owner'))).status,403);const admin=await (await root.GET(request('/properties?admin=true','admin'))).json();assert.equal(admin.count,1);assert.equal(admin.properties[0].agreementHistory.length,1);
 assert.equal((await route(app,'properties/[id]').GET(request('/properties/P'),context('P'))).status,404);
});

test('profile self-promotion to agent is forbidden while administrators can assign agents',async()=>{
 const app=isolated({users});const detail=route(app,'users/[id]');assert.equal((await detail.PATCH(request('/users/owner','owner','PATCH',{role:'agent'}),context('owner'))).status,403);
 assert.equal((await detail.PATCH(request('/users/owner','admin','PATCH',{role:'agent'}),context('owner'))).status,200);assert.equal(app.state.users.owner.role,'agent');
});
test('service catalog supplies client categories without creating service records',async()=>{
 const app=isolated({users,properties});const response=await route(app,'services').GET(request('/services'));assert.equal(response.status,200);const catalog=(await response.json()).data;
 for(const id of ['plumbing','leakage','fixtures','painting','electrical','other','rent-agreement-registration','sale-agreement-procedure','legal-consultation','society-procedure','pre-rental'])assert.ok(catalog.some(service=>service.id===id));assert.equal(app.writes.length,0);
 assert.equal((await route(app,'service-requests').POST(request('/service-requests','tenant','POST',{userUID:'tenant',propertyId:'P',serviceId:'plumbing',message:'Pipe leaking'}))).status,201);
});

test('authorized cron endpoint runs existing visits and additive property reminders without live delivery',async()=>{
 const app=isolated({users});app.env.CRON_SECRET='x'.repeat(40);app.env.FROM_EMAIL='staging@test.invalid';const r=route(app,'cron/reminders');const response=await r.GET(request('/cron/reminders','x'.repeat(40)));
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.success,true);assert.equal(body.properties.scanned,0);assert.equal(app.emails.length,0);
});

test('mobile delivery is explicitly rejected until an integration exists',async()=>{
 const app=isolated({users});assert.equal((await route(app,'visits').POST(request('/visits','owner','POST',{title:'Visit',visitDate:'2030-01-01T00:00:00Z',reminderType:'mobile'}))).status,400);assert.equal(app.writes.length,0);
});

test('rent reminders clamp month end in IST and expiry notices use 90/60-day phases',async()=>{
 const app=isolated({users});const service=app.load('@/lib/server/services/reminders');const property={...properties.P,paymentDueDate:'31',monthlyRent:'30000',agreementEndDate:'2030-05-01',tenants:[{...properties.P.tenants[0],paymentDueDate:'31',monthlyRent:'30000'}]};
 let events=service.propertyReminderEvents(property,new Date('2030-02-28T03:30:00Z'));assert.equal(events.filter(e=>e.kind==='rent_due').length,1);assert.equal(events.filter(e=>e.kind==='agreement_expiry').length,2);assert.match(events.find(e=>e.kind==='agreement_expiry').key,/:90$/);
 events=service.propertyReminderEvents(property,new Date('2030-03-02T03:30:00Z'));assert.match(events.find(e=>e.kind==='agreement_expiry').key,/:60$/);
 assert.equal(service.propertyReminderEvents({...property,agreementStatus:'terminated'},new Date('2030-02-28T03:30:00Z')).length,0);
});

test('property reminders lease concurrent jobs and freeze retry payloads and provider keys',async()=>{
 const now=new Date('2030-01-01T03:30:00Z');const app=isolated({users,properties:{P:{...properties.P,paymentDueDate:'1',monthlyRent:'30000',agreementEndDate:'2030-04-01',tenants:[{...properties.P.tenants[0],paymentDueDate:'1',monthlyRent:'30000'}]}}});app.env.FROM_EMAIL='staging@test.invalid';const service=app.load('@/lib/server/services/reminders');
 app.env.TEST_MAIL_FAIL='1';assert.equal((await service.runPropertyReminders(now)).failed,3);const first=structuredClone(app.emails);delete app.env.TEST_MAIL_FAIL;app.state.properties.P.title='Changed';
 await Promise.all([service.runPropertyReminders(new Date(now.getTime()+60000)),service.runPropertyReminders(new Date(now.getTime()+60000))]);assert.equal(app.emails.length,6);assert.deepEqual(app.emails.slice(3),first);assert.deepEqual(app.emailKeys.slice(3),app.emailKeys.slice(0,3));
 await service.runPropertyReminders(now);assert.equal(app.emails.length,6);assert.equal(Object.keys(app.state.admin_notifications).length,3);assert.ok(Object.values(app.state.properties.P.reminderDeliveries).every(d=>d.status==='sent'));
});
