const test=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,defaults,request,route,context}=require('./fixtures/native-server.cjs');

const available={...defaults,id:'A',title:'Available Home',address:'Address',location:'Address',ownerUID:'owner',ownerName:'Owner',ownerEmail:'owner@test.invalid',listingType:'rent',rentalStatus:'available',status:'active',tenants:[]};
const setup=()=>{const app=isolated({users,properties:{A:available},tenants:{}});app.env.ADMIN_EMAIL='admin@test.invalid';return app;};
const tenancy=(app,uid,body)=>route(app,'admin/properties/[id]/tenancy').POST(request('/admin/properties/A/tenancy',uid,'POST',body),context('A'));
const tenant=(uid,email,overrides={})=>({userUID:uid,firstName:uid==='tenant'?'Tenant':'Other',lastName:'User',email,phone:uid==='tenant'?'456':'789',monthlyRent:'25000',securityDeposit:'50000',paymentDueDate:'5',leaseStartDate:'2026-01-01',leaseEndDate:'2026-12-31',...overrides});

test('persisted admins can search registered users by name, email, or phone while others are denied',async()=>{
 const app=setup(),api=route(app,'admin/users/search');
 assert.equal((await api.GET(request('/admin/users/search?q=tenant','owner'))).status,403);
 for(const query of ['Tenant','tenant@test.invalid','456']){
  const response=await api.GET(request(`/admin/users/search?q=${encodeURIComponent(query)}`,'admin'));
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.users.length,1);assert.equal(body.users[0].uid,'tenant');assert.equal(body.users[0].isActive,true);
 }
});

test('admin-created property belongs to the selected active owner and remains pending review',async()=>{
 const app=setup();
 const response=await route(app,'properties').POST(request('/properties','admin','POST',{propertyTitle:'Assisted Listing',propertyType:'residential',location:'Owner address',ownerUID:'owner',listingType:'rent',monthlyRent:'30000'}));
 assert.equal(response.status,200,await response.clone().text());const property=(await response.json()).property,stored=app.state.properties[property.id];
 assert.equal(stored.ownerUID,'owner');assert.equal(stored.createdByUID,'admin');assert.equal(stored.adminCreatedForUID,'owner');assert.equal(stored.moderationStatus,'pending_review');assert.equal(stored.relationshipHistory[0].relationship,'owner');
 const deliveries=Object.values(app.state.email_deliveries);assert.equal(deliveries.length,2);assert.deepEqual(new Set(deliveries.map(row=>row.recipientUID||row.recipientEmail)),new Set(['owner','admin@test.invalid']));assert.ok(deliveries.every(row=>row.eventType==='property.submitted'&&row.html.includes('Assisted Listing')));
 const ownerView=await(await route(app,'properties').GET(request('/properties?ownerUID=owner','owner'))).json();
 assert.ok(ownerView.properties.some(value=>value.id===property.id));
});

test('non-admin cannot create a property for another account and inactive owners are rejected',async()=>{
 const app=setup(),api=route(app,'properties'),body={propertyTitle:'Forbidden',propertyType:'residential',location:'Address',ownerUID:'owner',listingType:'rent',monthlyRent:'100'};
 assert.equal((await api.POST(request('/properties','other','POST',body))).status,403);
 app.state.users.owner.isActive=false;
 assert.equal((await api.POST(request('/properties','admin','POST',body))).status,400);
 app.state.users.owner.isActive=true;app.claims.owner={disabled:true};
 assert.equal((await api.POST(request('/properties','admin','POST',body))).status,400);
});

test('admin assignment persists one relationship and appears in owner and tenant accounts',async()=>{
 const app=setup();const response=await tenancy(app,'admin',{action:'assign',expectedRevision:0,tenant:tenant('tenant','tenant@test.invalid')});
 assert.equal(response.status,200,await response.clone().text());assert.equal(app.state.properties.A.tenancyRevision,1);assert.equal(app.state.properties.A.tenants.filter(value=>value.isActive).length,1);assert.equal(app.state.properties.A.relationshipHistory.at(-1).actorUID,'admin');
 const deliveries=Object.values(app.state.email_deliveries);assert.equal(deliveries.length,2);assert.deepEqual(new Set(deliveries.map(row=>row.recipientUID)),new Set(['owner','tenant']));assert.ok(deliveries.every(row=>row.eventType==='tenancy.tenant_assign'&&row.html.includes('Available Home')));
 const ownerView=await(await route(app,'properties').GET(request('/properties?ownerUID=owner','owner'))).json();assert.equal(ownerView.properties.find(value=>value.id==='A').tenants[0].userUID,'tenant');
 const tenantView=await(await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=tenant','tenant'))).json();assert.equal(tenantView.properties[0].id,'A');
});

test('assignment rejects duplicates, unauthorized callers, and stale revisions',async()=>{
 const app=setup(),payload={action:'assign',expectedRevision:0,tenant:tenant('tenant','tenant@test.invalid')};
 assert.equal((await tenancy(app,'owner',payload)).status,403);
 assert.equal((await tenancy(app,'admin',payload)).status,200);
 assert.equal((await tenancy(app,'admin',payload)).status,409);
 assert.equal((await tenancy(app,'admin',{action:'replace',expectedRevision:0,tenant:tenant('other','other@test.invalid')})).status,409);
 assert.equal(app.state.properties.A.tenants.filter(value=>value.isActive).length,1);
});

test('admin replacement and removal preserve history and tenant isolation',async()=>{
 const app=setup();await tenancy(app,'admin',{action:'assign',expectedRevision:0,tenant:tenant('tenant','tenant@test.invalid')});
 const replacement=await tenancy(app,'admin',{action:'replace',expectedRevision:1,tenant:tenant('other','other@test.invalid')});assert.equal(replacement.status,200,await replacement.clone().text());
 const active=app.state.properties.A.tenants.filter(value=>value.isActive);assert.equal(active.length,1);assert.equal(active[0].userUID,'other');assert.equal(app.state.properties.A.relationshipHistory.length,2);
 let rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='tenancy.tenant_replace');assert.equal(rows.length,3);assert.deepEqual(new Set(rows.map(row=>row.recipientUID)),new Set(['owner','tenant','other']));
 assert.equal(app.state.users.tenant.rentedPropertyId,'');assert.equal(app.state.users.other.rentedPropertyId,'A');
 const oldView=await(await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=tenant','tenant'))).json();assert.equal(oldView.count,0);
 const currentView=await(await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=other','other'))).json();assert.equal(currentView.properties[0].id,'A');
 const removal=await tenancy(app,'admin',{action:'remove',expectedRevision:2,tenantId:active[0].id});assert.equal(removal.status,200);assert.equal(app.state.properties.A.rentalStatus,'available');assert.equal(app.state.properties.A.tenants.some(value=>value.isActive),false);assert.equal(app.state.properties.A.relationshipHistory.at(-1).action,'tenant_remove');
 rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='tenancy.tenant_remove');assert.equal(rows.length,2);assert.deepEqual(new Set(rows.map(row=>row.recipientUID)),new Set(['owner','other']));
 assert.equal(app.state.users.other.rentedPropertyId,'');
});
