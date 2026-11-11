const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const base={propertyTitle:'Money fixture',propertyType:'residential',structure:'Flat',configuration:'2 BHK',location:'Fixture location',ownerUID:'owner'};
const lease={existingTenant:{type:'individual',name:'Fixture tenant',mobile:'9123456782',occupancyStartDate:'2020-01-01'},tenantOccupied:true,monthlyRentalIncome:'20000',leaseStartDate:'2020-01-01',leaseEndDate:'2099-12-31',leaseType:'registered'};
const invalid=['-1','0','NaN','Infinity','0x10','1e3','',null,true];
const post=(a,body,uid='owner')=>route(a,'properties').POST(request('/properties',uid,'POST',{...base,...body}));
const put=(a,body,uid='owner')=>route(a,'properties/[id]').PUT(request('/properties/P',uid,'PUT',body),context('P'));
for(const [field,listingType,defaults] of [
 ['sellingPrice','sell',{sellingPrice:'4000000'}],
 ['expectedRent','rent',{expectedRent:'20000',securityDeposit:'0',rentalStatus:'available'}],
 ['monthlyRent','rent',{monthlyRent:'20000',securityDeposit:'0',rentalStatus:'rented'}],
])test(`${field}: invalid create/update amounts fail with field-specific 400 and no writes`,async()=>{
 for(const value of invalid){const a=isolated({users,properties:{P:{...properties.P,...defaults,listingType}}});
  for(const response of [await post(a,{...defaults,listingType,[field]:value}),await put(a,{[field]:value})]){assert.equal(response.status,400,`${field}: ${String(value)}: ${await response.clone().text()}`);assert.match((await response.json()).message,new RegExp(field));}
  assert.equal(a.writes.length,0);
 }
});
test('securityDeposit is non-negative, strict, and required only by existing owner rental intake',async()=>{
 for(const value of ['-1','NaN','Infinity','0x10','1e3',null,true,'']){const a=isolated({users,properties:{P:{...properties.P,securityDeposit:'100',expectedRent:'20000'}}});
  for(const response of [await post(a,{listingType:'rent',expectedRent:'20000',securityDeposit:value}),await put(a,{securityDeposit:value})]){assert.equal(response.status,400);assert.match((await response.json()).message,/securityDeposit/);}assert.equal(a.writes.length,0);
 }
 const a=isolated({users});assert.equal((await post(a,{listingType:'rent',expectedRent:'20000'})).status,400);assert.equal((await post(a,{listingType:'rent',expectedRent:'20000',securityDeposit:'0'})).status,200);
});
test('ordinary sale has no rent/deposit requirement; owner/admin residential/commercial create and edit work',async()=>{
 for(const uid of ['owner','admin'])for(const propertyType of ['residential','commercial']){const a=isolated({users});const response=await post(a,{listingType:'sell',sellingPrice:'4000000',propertyType,structure:propertyType==='commercial'?'Office':'Flat'},uid);assert.equal(response.status,200,await response.clone().text());const p=(await response.json()).property;assert.equal((await route(a,'properties/[id]').PUT(request('/properties/'+p.id,uid,'PUT',{sellingPrice:'4500000'}),context(p.id))).status,200);assert.equal((await route(a,'properties/[id]').PUT(request('/properties/'+p.id,uid,'PUT',{sellingPrice:'-1'}),context(p.id))).status,400);}
});
test('missing required selling price and asking rent cannot be introduced through defaults',async()=>{
 for(const body of [{listingType:'sell'},{listingType:'rent',securityDeposit:'0'},{listingType:'sell_rent',expectedRent:'20000',securityDeposit:'0'}]){const a=isolated({users});assert.equal((await post(a,body)).status,400);assert.equal(a.writes.length,0);}
});
test('unrelated legacy edits preserve historical invalid/empty amounts; changing them is validated',async()=>{
 for(const listingType of ['sell','rent']){const a=isolated({users,properties:{P:{...properties.P,listingType,sellingPrice:'legacy unknown',monthlyRent:'-10',securityDeposit:'legacy unknown'}}});assert.equal((await put(a,{description:'Unrelated edit'})).status,200);assert.equal(a.state.properties.P.monthlyRent,'-10');assert.equal((await put(a,{securityDeposit:'-2'})).status,400);assert.equal((await put(a,{sellingPrice:'-2'})).status,400);}
});
test('pre-leased selling price, income and supplied deposit are strict on create/update',async()=>{
 for(const field of ['sellingPrice','monthlyRentalIncome','securityDeposit'])for(const value of (field==='securityDeposit'?['-1','NaN','Infinity','0x10',null]:['-1','0','NaN','Infinity','0x10',null])){
  const a=isolated({users,properties:{P:{...properties.P,listingType:'pre_leased',sellingPrice:'4000000',preLeased:lease}}}),body=field==='sellingPrice'?{sellingPrice:value}:{preLeased:{...lease,[field]:value}};
  for(const response of [await post(a,{listingType:'pre_leased',sellingPrice:'4000000',preLeased:lease,...body}),await put(a,body)]){assert.equal(response.status,400,await response.clone().text());assert.match((await response.json()).message,new RegExp(field));}assert.equal(a.writes.length,0);
 }
});
test('pre-leased unrelated edit preserves historical optional money without skipping active lease rules',async()=>{
 const a=isolated({users,properties:{P:{...properties.P,listingType:'pre_leased',sellingPrice:'legacy',preLeased:{...lease,securityDeposit:'legacy'}}}});assert.equal((await put(a,{description:'Unrelated edit'})).status,200);assert.equal(a.state.properties.P.sellingPrice,'legacy');assert.equal((await put(a,{preLeased:{...lease,tenantOccupied:false}})).status,400);
});
test('To Manage requires no marketing prices and remains private after owner/admin registration',async()=>{
 for(const uid of ['owner','admin']){const a=isolated({users});const response=await post(a,{listingType:'manage'},uid);assert.equal(response.status,200,await response.clone().text());const id=(await response.json()).property.id;assert.equal((await route(a,'properties/[id]').PUT(request('/properties/'+id,uid,'PUT',{description:'Updated management registration'}),context(id))).status,200);const publicResponse=await route(a,'properties').GET(request('/properties'));assert.equal((await publicResponse.json()).count,0);}
});

test('generic price overrides cannot persist invalid numeric values',async()=>{for(const price of [-1,Infinity,NaN,'100',true]){const a=isolated({users,properties:{P:{...properties.P,listingType:'sell',sellingPrice:'4000000'}}});assert.equal((await put(a,{price})).status,400);assert.equal(a.writes.length,0);}});

test('changing rental mode requires the corresponding valid rent instead of omitted defaults',async()=>{
 const a=isolated({users,properties:{P:{...properties.P,rentalStatus:'available',expectedRent:'20000',monthlyRent:'',securityDeposit:'0'}}});assert.equal((await put(a,{rentalStatus:'rented'})).status,400);assert.equal(a.writes.length,0);assert.equal((await put(a,{rentalStatus:'rented',monthlyRent:'25000'})).status,200);
});
