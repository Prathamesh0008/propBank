const assert=require('node:assert/strict'),{test}=require('node:test');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');

test('all=true never exposes tenant-submitted private properties in lists or search',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,createdAs:'tenant',ownerUID:'',images:['private-tenant-photo'],rentalStatus:'rented'}}});
 for(const [name,url] of [['properties','/properties?all=true'],['properties/search','/properties/search?all=true']]){
  const response=await route(app,name).GET(request(url));assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.count,0);assert.ok(!JSON.stringify(body).includes('private-tenant-photo'));
 }
});

test('removing the final property image persists an empty gallery after refresh',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,images:['https://existing-r2.test/properties/P/old.jpg']}}});
 const api=route(app,'properties/[id]');
 const response=await api.PUT(request('/properties/P','owner','PUT',{images:[]}),context('P'));assert.equal(response.status,200);
 const refreshed=await(await api.GET(request('/properties/P','owner'),context('P'))).json();assert.deepEqual(refreshed.property.images,[]);assert.equal(app.state.properties.P.images.length,0);
});

test('API inventory includes workflow helpers and only real negotiation method/path branches',()=>{
 const {spawnSync}=require('node:child_process');
 const result=spawnSync(process.execPath,['scripts/audit-active-api.cjs'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const inventory=JSON.parse(require('node:fs').readFileSync('migration-audit/api-inventory.json','utf8'));
 for(const [method,endpoint]of [['GET','/api/property-hub'],['PATCH','/api/property-hub'],['POST','/api/owner-verification'],['POST','/api/negotiations'],['PATCH','/api/negotiations/:id']])assert.ok(inventory.rows.some(row=>row.reachable&&row.method===method&&row.endpoint===endpoint&&row.nativeImplemented),method+' '+endpoint);
 assert.ok(!inventory.rows.some(row=>row.method==='PATCH'&&row.endpoint==='/api/negotiations'));
 assert.ok(!inventory.rows.some(row=>row.method==='POST'&&row.endpoint==='/api/negotiations/:id'));
 assert.ok(!inventory.rows.some(row=>row.reachable&&!row.nativeImplemented));
});


test('property hub does not disclose a different tenant service request or its history',async()=>{
 const app=isolated({users,properties,service_requests:{mine:{id:'mine',propertyId:'P',userUID:'tenant',serviceName:'Plumbing',message:'My request',status:'pending'},theirs:{id:'theirs',propertyId:'P',userUID:'other',serviceName:'PRIVATE_SERVICE',message:'PRIVATE_COMMENT',status:'pending',history:[{status:'PRIVATE_HISTORY',at:'2026-01-01'}]}}});
 const response=await route(app,'property-hub').GET(request('/property-hub?propertyId=P','tenant'));assert.equal(response.status,200);const data=await response.json();assert.equal(data.hubs[0].requests.length,1);assert.equal(data.hubs[0].requests[0].id,'mine');assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
 const owner=await(await route(app,'property-hub').GET(request('/property-hub?propertyId=P','owner'))).json();assert.equal(owner.hubs[0].requests.length,2);
});


test('duplicate and concurrent tenant assignment cannot create repeated active relationships',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,tenants:[]}}}),api=route(app,'tenants');
 const body={propertyId:'P',ownerUID:'owner',tenants:[{firstName:'Tenant',lastName:'Name',email:'tenant@test.invalid',phone:'9876543210'}]};
 const results=await Promise.all([api.POST(request('/tenants','owner','POST',body)),api.POST(request('/tenants','owner','POST',body))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(app.state.properties.P.tenants.length,1);assert.equal(Object.keys(app.state.tenants).length,1);
 const before=app.writes.length;assert.equal((await api.POST(request('/tenants','owner','POST',body))).status,409);assert.equal(app.writes.length,before);
});


test('general enquiry validates empty, malformed and visit input at the API before any writes',async()=>{
 const app=isolated({users}),api=route(app,'admin/notifications'),valid={type:'general_inquiry',inquiryType:'rent',propertyType:'residential',userName:'Test Guest',userEmail:'guest@test.invalid',userPhone:'9999999999'};
 for(const body of [{type:'general_inquiry'},{...valid,userEmail:'bad'},{...valid,userPhone:'bad'},{...valid,requestVisit:true,visitDate:'2030-02-30',visitTime:'09:00 AM'}])assert.equal((await api.POST(request('/admin/notifications',null,'POST',body))).status,400);
 assert.equal(app.writes.length,0);assert.equal((await api.POST(request('/admin/notifications',null,'POST',valid))).status,201);
});


test('empty reviews and inspection reports are rejected without database or notification writes',async()=>{
 const app=isolated({users,properties});
 for(const [name,body]of [['reviews',{propertyId:'P',reviewerType:'tenant',tenantPart:{overallExperience:'  '}}],['inspection-reports',{propertyId:'P',reportType:'on_possession',report:'  '}]])assert.equal((await route(app,name).POST(request('/'+name,'tenant','POST',body))).status,400);
 assert.equal(app.writes.length,0);assert.equal(app.emails.length,0);
});


test('phone lookup never discloses another account or rental relationships to a property owner',async()=>{
 const app=isolated({users:{...users,tenant:{...users.tenant,phoneNumber:'+919876543210',rentedPropertyId:'PRIVATE_PROPERTY',rentedPropertyOwnerName:'PRIVATE_OWNER',rentedPropertyOwnerId:'PRIVATE_OWNER_ID'}}});
 const api=route(app,'users/search');const response=await api.GET(request('/users/search?phone=%2B919876543210','owner'));assert.equal(response.status,200);const data=await response.json();assert.equal(data.verificationRequired,true);assert.equal(data.user,undefined);assert.ok(!JSON.stringify(data).includes('PRIVATE_'));
 assert.equal((await api.GET(request('/users/search?phone=%2B919876543210','unregistered'))).status,403);
});
