const test=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,defaults,request,route,context}=require('./fixtures/native-server.cjs');

const available={...defaults,id:'A',title:'Available Home',address:'Address',location:'Address',ownerUID:'owner',ownerName:'Owner',ownerEmail:'owner@test.invalid',listingType:'rent',rentalStatus:'available',status:'active',tenants:[]};
const setup=()=>{const app=isolated({users,properties:{A:available},tenants:{}});app.env.ADMIN_EMAIL='admin@test.invalid';return app;};
const tenancy=(app,uid,body)=>route(app,'admin/properties/[id]/tenancy').POST(request('/admin/properties/A/tenancy',uid,'POST',body),context('A'));
const tenant=(uid,email,overrides={})=>({userUID:uid,firstName:uid==='tenant'?'Tenant':'Other',lastName:'User',email,phone:uid==='tenant'?'9123456789':'9234567890',monthlyRent:'25000',securityDeposit:'50000',paymentDueDate:'5',leaseStartDate:'2026-01-01',leaseEndDate:'2026-12-31',...overrides});

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

const prove=(app,uid,phone)=>{app.claims[uid]={phoneNumber:phone,phone_number:phone,emailVerified:true,auth_time:Math.floor(Date.now()/1000)};};
async function confirm(app,uid){
 prove(app,uid,uid==='tenant'?'+919123456789':'+919234567890');
 prove(app,'owner','+919876543210');
 const claim=Object.values(app.state.relationship_links).find(row=>row.candidateUID===uid&&row.status!=='linked');
 const api=route(app,'relationship-links');
 assert.equal((await api.POST(request('/relationship-links',uid,'POST',{action:'confirm_tenancy',claimId:claim.id}))).status,200);
 assert.equal((await api.POST(request('/relationship-links','owner','POST',{action:'approve_tenancy',claimId:claim.id}))).status,200);
}

test('admin assignment creates a pending invitation and requires tenant confirmation plus owner approval',async()=>{
 const app=setup();prove(app,'tenant','+919123456789');
 const response=await tenancy(app,'admin',{action:'assign',expectedRevision:0,tenant:tenant('tenant','tenant@test.invalid')});
 assert.equal(response.status,200,await response.clone().text());assert.equal(app.state.properties.A.tenancyRevision,1);
 assert.equal(app.state.properties.A.tenants.filter(value=>value.isActive).length,1);
 assert.equal(app.state.properties.A.relationshipHistory.at(-1).actorUID,'admin');
 assert.ok(!app.state.properties.A.tenants[0].userUID);
 const before=await(await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=tenant','tenant'))).json();assert.equal(before.count,0);
 const deliveries=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='tenancy.tenant_assign');
 assert.equal(deliveries.length,1);assert.equal(deliveries[0].recipientUID,'owner');
 await confirm(app,'tenant');
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

test('admin replacement and removal preserve historical records and never expose the new tenancy before confirmation',async()=>{
 const app=setup();prove(app,'tenant','+919123456789');
 await tenancy(app,'admin',{action:'assign',expectedRevision:0,tenant:tenant('tenant','tenant@test.invalid')});await confirm(app,'tenant');
 const oldTenantID=app.state.properties.A.tenants[0].id;prove(app,'other','+919234567890');
 const replacement=await tenancy(app,'admin',{action:'replace',expectedRevision:2,tenant:tenant('other','other@test.invalid')});assert.equal(replacement.status,200,await replacement.clone().text());
 const active=app.state.properties.A.tenants.filter(value=>value.isActive);assert.equal(active.length,1);assert.ok(!active[0].userUID);assert.equal(app.state.tenants[oldTenantID].isActive,false);
 assert.equal(app.state.properties.A.relationshipHistory.length,2);
 const oldView=await(await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=tenant','tenant'))).json();assert.equal(oldView.count,0);
 let currentView=await(await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=other','other'))).json();assert.equal(currentView.count,0);
 await confirm(app,'other');currentView=await(await route(app,'properties/tenant').GET(request('/properties/tenant?tenantUID=other','other'))).json();assert.equal(currentView.properties[0].id,'A');
 const removal=await tenancy(app,'admin',{action:'remove',expectedRevision:4,tenantId:active[0].id});assert.equal(removal.status,200);assert.equal(app.state.properties.A.rentalStatus,'available');assert.equal(app.state.properties.A.tenants.some(value=>value.isActive),false);assert.equal(app.state.properties.A.relationshipHistory.at(-1).action,'tenant_remove');
 assert.equal(app.state.tenants[oldTenantID].isActive,false);assert.equal(app.state.tenants[active[0].id].isActive,false);
});
