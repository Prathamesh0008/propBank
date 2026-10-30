const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,defaults,request,route}=require('./fixtures/native-server.cjs');
const seed=()=>isolated({users,properties:{P:{...properties.P,monthlyRent:'30000',paymentDueDate:'5',agreementStartDate:'2026-01-01',agreementEndDate:'2030-01-01'},R:{...properties.P,id:'R',ownerUID:'other',tenants:[{userUID:'owner',isActive:true,email:'owner@test.invalid'}]}}});
test('portfolio hub batches related collection reads instead of querying once per property',async()=>{
 const app=seed();const response=await route(app,'property-hub').GET(request('/property-hub','owner'));assert.equal(response.status,200);
 const related=new Set(['documents','inspection_reports','service_requests','visits','negotiations']);
 const reads=app.reads.filter(read=>related.has(read.collection));
 for(const collection of related)assert.equal(reads.filter(read=>read.collection===collection&&read.filters.some(([,value,operator])=>operator==='in'&&value.length===2)).length,1,collection);
});
test('property hub is relationship scoped, preserves owner also tenant, and hides internal notes from members/public',async()=>{
 const app=seed();app.state.properties.P.internalNotes=[{id:'N',text:'Secret admin note',at:'2026-01-01'}];const api=route(app,'property-hub');
 assert.equal((await api.GET(request('/property-hub',null))).status,401);
 const owner=await (await api.GET(request('/property-hub','owner'))).json();assert.equal(owner.hubs.length,2);assert.equal(owner.hubs.find(h=>h.property.id==='R').role,'tenant');assert.ok(!JSON.stringify(owner).includes('Secret admin note'));
 assert.equal((await api.GET(request('/property-hub?propertyId=P','other'))).status,403);
 const admin=await (await api.GET(request('/property-hub','admin'))).json();assert.equal(admin.hubs[0].internalNotes[0].text,'Secret admin note');assert.equal(admin.metrics.totalProperties,2);
});
test('rent tracking uses explicit owner/admin records, versioning and property receipt validation',async()=>{
 const app=seed(),api=route(app,'property-hub'),body={propertyId:'P',action:'rent_ledger',version:0,month:'2026-10',expectedRent:30000,dueDate:'2026-10-05',status:'paid',receiptId:'',notes:'Owner confirmed receipt'};
 assert.equal((await api.PATCH(request('/property-hub','tenant','PATCH',body))).status,403);
 assert.equal((await api.PATCH(request('/property-hub','owner','PATCH',{...body,receiptId:'missing'}))).status,400);
 assert.equal((await api.PATCH(request('/property-hub','owner','PATCH',{...body,dueDate:'2026-10-32'}))).status,400);
 assert.equal((await api.PATCH(request('/property-hub','owner','PATCH',body))).status,200);
 const deliveries=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='rent.payment_recorded');assert.equal(deliveries.length,2);assert.deepEqual(new Set(deliveries.map(row=>row.recipientUID)),new Set(['owner','tenant']));assert.ok(deliveries.every(row=>row.html.includes('2026-10')));
 assert.equal((await api.PATCH(request('/property-hub','owner','PATCH',body))).status,409);
 const view=await (await api.GET(request('/property-hub?propertyId=P','tenant'))).json();assert.equal(view.hubs[0].ledger[0].displayStatus,'Paid');assert.equal(app.state.properties.P.rentLedgerHistory.length,1);
 assert.equal((await api.PATCH(request('/property-hub','owner','PATCH',{propertyId:'P',action:'internal_note',note:'secret'}))).status,403);
 assert.equal((await api.PATCH(request('/property-hub','admin','PATCH',{propertyId:'P',action:'internal_note',note:'secret'}))).status,200);
 assert.ok(!JSON.stringify(await (await api.GET(request('/property-hub?propertyId=P','owner'))).json()).includes('secret'));
});
test('hub derives truthful activity, service state, visit outcomes and inquiry progression without writes',async()=>{
 const app=seed();app.state.service_requests={S:{...defaults,id:'S',propertyId:'P',serviceName:'Plumbing',status:'resolved',history:[{status:'resolved',at:'2026-10-01'}]}};app.state.visits={V:{...defaults,id:'V',userId:'tenant',propertyId:'P',title:'Recorded visit',status:'scheduled',visitDate:'2020-01-01',isCompleted:false}};app.state.admin_notifications={I:{...defaults,id:'I',propertyId:'P',userId:'tenant',type:'property_enquiry',userName:'Tenant'}};
 const result=await (await route(app,'property-hub').GET(request('/property-hub','admin'))).json();assert.equal(result.metrics.pendingMaintenance,0);assert.equal(result.metrics.upcomingVisits,0);assert.equal(result.pipeline[0].stage,'Visit Scheduled');assert.ok(result.actions.some(a=>a.label.startsWith('Visit outcome not recorded')));assert.ok(result.hubs[0].history.some(e=>e.label.includes('resolved')));assert.equal(app.writes.length,0);
 const visits=route(app,'visits');assert.equal((await visits.GET(request('/visits?userId=tenant&status=completed','tenant'))).status,200);assert.equal(app.state.visits.V.status,'scheduled');assert.equal(app.writes.length,0);
});
test('ledger dates clamp month end and statuses reflect records rather than receipts alone',()=>{
 const app=seed(),helpers=app.load(require('node:path').join(process.cwd(),'src/lib/property-product.ts'));assert.equal(helpers.dueDate('2026-02',31),'2026-02-28');assert.equal(helpers.ledgerStatus({dueDate:'2026-10-05',status:'due'},'2026-10-10'),'Overdue');assert.equal(helpers.ledgerStatus({dueDate:'2026-10-05',status:'paid'},'2026-10-10'),'Paid');assert.equal(helpers.tenantLifecycle({isActive:false},{agreementStatus:'notice_served'}),'Former Tenant');
});

test('private and tenant-intake properties remain unavailable to public visit scheduling',async()=>{
 const app=seed(),api=route(app,'visits'),body={propertyId:'P',title:'Private visit',visitDate:'2030-01-01T10:00:00Z',reminderType:'none'};
 assert.equal((await api.POST(request('/visits','other','POST',body))).status,404);
 app.state.properties.P.ownerUID='';app.state.properties.P.createdAs='tenant';
 assert.equal((await api.POST(request('/visits','tenant','POST',body))).status,404);
 assert.equal(Object.keys(app.state.visits||{}).length,0);
});
