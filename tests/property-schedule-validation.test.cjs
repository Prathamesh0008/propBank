const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
function setup(months=24){const a=isolated({users}),lib=a.load('@/lib/rent-schedule'),start='2026-01-01',end=lib.calculateAgreementEndDate(start,months),rows=lib.initializeRentSchedule([],start,end,'30000').map((r,i)=>({...r,amount:i?'36000':'30000'}));const body={createdAs:'tenant',propertyTitle:'Schedule fixture',propertyType:'residential',configuration:'2 BHK',location:'Fixture location',monthlyRent:'30000',paymentDueDate:'5',agreementPeriod:String(months),agreementStartDate:start,agreementEndDate:end,reportedOwner:{personName:'Fixture Owner',phone:'9999999999'},rentSchedule:rows};return {a,lib,body};}
const post=(a,b)=>route(a,'properties').POST(request('/properties','tenant','POST',b));
const put=(a,b)=>route(a,'properties/[id]').PUT(request('/properties/P','owner','PUT',b),context('P'));
for(const months of [11,12,24,30])for(const version of [undefined,2])test(`${months} months, version ${version??'omitted'}: actual API accepts and persists the complete schedule`,async()=>{
 const {a,body}=setup(months);const response=await post(a,{...body,...(version?{rentScheduleVersion:version}:{})});assert.equal(response.status,200,await response.clone().text());const p=Object.values(a.state.properties)[0];assert.equal(p.monthlyRent,body.rentSchedule[0].amount);assert.deepEqual(JSON.parse(JSON.stringify(p.rentSchedule)),JSON.parse(JSON.stringify(body.rentSchedule)));
});
for(const kind of ['gap','overlap','invalid rent','invalid months','invalid date','out of bounds','incomplete'])test(`unmarked ${kind} is rejected on create and update without persistence`,async()=>{
 const {a,body}=setup(),rows=body.rentSchedule.map(r=>({...r}));
 if(kind==='gap')rows[1].fromDate='2027-02-01';if(kind==='overlap')rows[1].fromDate='2026-12-31';if(kind==='invalid rent')rows[1].amount='Infinity';if(kind==='invalid months')rows[1].months='1.5';if(kind==='invalid date')rows[1].fromDate='2027-02-30';if(kind==='out of bounds')rows[1].toDate='2028-01-01';if(kind==='incomplete')rows.pop();
 a.state.properties={P:{...properties.P,...body,ownerUID:'owner',securityDeposit:'0'}};
 for(const r of [await post(a,{...body,rentSchedule:rows}),await put(a,{rentSchedule:rows})]){assert.equal(r.status,400,await r.clone().text());assert.match((await r.json()).message,/rentSchedule/);}assert.equal(a.writes.length,0);
});
test('contradictory versions, malformed rows and empty unified schedules cannot downgrade validation',async()=>{
 for(const alter of [b=>({...b,rentScheduleVersion:1}),b=>({...b,rentScheduleVersion:'2'}),b=>({...b,rentScheduleVersion:3}),b=>({...b,rentScheduleVersion:2,rentSchedule:[]}),b=>({...b,rentScheduleVersion:2,rentSchedule:null}),b=>({...b,rentScheduleVersion:2,rentSchedule:b.rentSchedule.slice(1)}),b=>({...b,rentSchedule:[{...b.rentSchedule[0],months:12},b.rentSchedule[1]]})]){const {a,body}=setup();assert.equal((await post(a,alter(body))).status,400);assert.equal(a.writes.length,0);}
});
test('conflicting base rent, deleting unified rows and changing agreement dates cannot bypass the schedule',async()=>{
 const {a,body}=setup();assert.equal((await post(a,{...body,monthlyRent:'40000'})).status,400);a.state.properties={P:{...properties.P,...body,ownerUID:'owner'}};
 for(const b of [{monthlyRent:'40000'},{rentSchedule:[]},{agreementEndDate:'2028-01-31'},{rentScheduleVersion:1,rentSchedule:body.rentSchedule.slice(1)}])assert.equal((await put(a,b)).status,400);assert.equal(a.writes.length,0);
});
test('valid schedule update is persisted; unrelated historical schedule edits remain compatible',async()=>{
 const {a,body}=setup();a.state.properties={P:{...properties.P,...body,ownerUID:'owner'}};a.state.tenants={T:{...properties.P.tenants[0],propertyId:'P',ownerUID:'owner',leaseStartDate:body.agreementStartDate,leaseEndDate:body.agreementEndDate,rentSchedule:body.rentSchedule,monthlyRent:'30000',paymentDueDate:'5'}};const rows=body.rentSchedule.map((r,i)=>({...r,amount:i?'38000':'30000'}));assert.equal((await put(a,{rentSchedule:rows})).status,200);assert.equal(a.state.properties.P.rentSchedule[1].amount,'38000');
 a.state.properties.P.rentSchedule=[{year:'1st Year',amount:'legacy',months:'12',fromDate:'2000-01-01',toDate:'2000-12-31'}];assert.equal((await put(a,{description:'Unrelated edit'})).status,200);assert.equal(a.state.properties.P.rentSchedule[0].amount,'legacy');
});
test('legacy core-only and additional-only periods retain their supported behavior',async()=>{
 const {a,body,lib}=setup();const {rentSchedule,...core}=body;assert.equal((await post(a,core)).status,200);const legacy={...lib.additionalRentPeriod(body.agreementStartDate,body.agreementPeriod,0),amount:'36000'};assert.equal((await post(a,{...body,propertyTitle:'Legacy fixture',rentSchedule:[legacy]})).status,200);
});
test('embedded tenant schedules cannot bypass validation through property updates',async()=>{
 const {a,body}=setup();a.state.properties={P:{...properties.P,...body,ownerUID:'owner'}};const tenant={...properties.P.tenants[0],leaseStartDate:body.agreementStartDate,leaseEndDate:body.agreementEndDate,monthlyRent:'30000',rentSchedule:[body.rentSchedule[0],{...body.rentSchedule[1],fromDate:'2027-02-01'}]};assert.equal((await put(a,{tenants:[tenant]})).status,400);assert.equal(a.writes.length,0);
});

test('direct tenancy creation rejects an unmarked gapped schedule',async()=>{
 const {a,body}=setup();a.state.properties={P:{...properties.P,tenants:[]}};const response=await route(a,'tenants').POST(request('/tenants','owner','POST',{propertyId:'P',ownerUID:'owner',tenants:[{firstName:'Draft',lastName:'Tenant',email:'draft@test.invalid',phone:'9123456785',monthlyRent:'30000',leaseStartDate:body.agreementStartDate,leaseEndDate:body.agreementEndDate,rentSchedule:[body.rentSchedule[0],{...body.rentSchedule[1],fromDate:'2027-02-01'}]}]}));assert.equal(response.status,400);assert.equal(a.writes.length,0);
});
test('direct tenancy update and administrator assignment cannot bypass unified validation',async()=>{
 const {a,body}=setup(),tenant={...properties.P.tenants[0],propertyId:'P',ownerUID:'owner',monthlyRent:'30000',leaseStartDate:body.agreementStartDate,leaseEndDate:body.agreementEndDate,rentSchedule:body.rentSchedule};a.state.properties={P:{...properties.P,...body,tenants:[tenant],ownerUID:'owner'}};a.state.tenants={T:tenant};const bad=[body.rentSchedule[0],{...body.rentSchedule[1],amount:'0'}];assert.equal((await route(a,'tenants/[id]').PUT(request('/tenants/T','owner','PUT',{rentSchedule:bad}),context('T'))).status,400);assert.equal((await route(a,'admin/properties/[id]/tenancy').POST(request('/admin/properties/P/tenancy','admin','POST',{action:'replace',expectedRevision:0,tenant:{...tenant,rentSchedule:bad}}),context('P'))).status,400);assert.equal(a.writes.length,0);
});
