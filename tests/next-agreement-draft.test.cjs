const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const {isolated,users,properties,request,route}=require('./fixtures/native-server.cjs');
const draft={durationMonths:'12',startDate:'2027-01-01',endDate:'2027-12-31',monthlyRent:'35000',securityDeposit:'70000',noticePeriod:'2',lockInPeriod:'6'};

test('next agreement dates use date-only Indian lease periods for 11, 12 and 24 months',()=>{
 const {calculateNextAgreementDates}=isolated().load('@/lib/next-agreement-draft');
 assert.equal(JSON.stringify(calculateNextAgreementDates('2026-10-30','11')),JSON.stringify({startDate:'2026-10-31',endDate:'2027-09-29'}));
 assert.equal(JSON.stringify(calculateNextAgreementDates('2026-10-30','12')),JSON.stringify({startDate:'2026-10-31',endDate:'2027-10-30'}));
 assert.equal(JSON.stringify(calculateNextAgreementDates('2026-10-30','24')),JSON.stringify({startDate:'2026-10-31',endDate:'2028-10-30'}));
});

test('next agreement date arithmetic handles leap years and short months without UTC conversion',()=>{
 const {calculateNextAgreementDates}=isolated().load('@/lib/next-agreement-draft');
 for(const [current,duration,expected] of [['2024-02-28','1',{startDate:'2024-02-29',endDate:'2024-03-28'}],['2023-02-27','12',{startDate:'2023-02-28',endDate:'2024-02-27'}],['2026-01-30','1',{startDate:'2026-01-31',endDate:'2026-02-27'}],['2026-04-29','1',{startDate:'2026-04-30',endDate:'2026-05-29'}]])assert.equal(JSON.stringify(calculateNextAgreementDates(current,duration)),JSON.stringify(expected));
});

test('next agreement draft validates calculated dates, duration and amounts',()=>{
 const {calculateNextAgreementDates,validateNextAgreementDraft}=isolated().load('@/lib/next-agreement-draft');
 const validate=validateNextAgreementDraft;
 assert.equal(validate(draft,'2026-12-31'),'');
 assert.match(validate({...draft,endDate:'2027-12-30'},'2026-12-31'),/do not match/);
 assert.match(validate({...draft,monthlyRent:''},'2026-12-31'),/Complete every/);
 assert.match(validate({...draft,durationMonths:'0'},'2026-12-31'),/whole-number/);
 assert.match(validate({...draft,durationMonths:'12.5'},'2026-12-31'),/whole-number/);
 assert.equal(JSON.stringify(calculateNextAgreementDates('','12')),JSON.stringify({startDate:'',endDate:''}));
 assert.equal(JSON.stringify(calculateNextAgreementDates('2026-12-31','')),JSON.stringify({startDate:'2027-01-01',endDate:''}));
});

test('owner property intake stores a draft without replacing active agreement terms',async()=>{
 const app=isolated({users}),response=await route(app,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Draft home',propertyType:'residential',structure:'Apartment',configuration:'2 BHK',location:'Pune',ownerUID:'owner',listingType:'rent',rentalStatus:'rented',monthlyRent:'30000',paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31',noticePeriod:'1',lockInPeriod:'3',tenantEmail:'tenant@test.invalid',tenantFirstName:'Tenant',tenantLastName:'Name',mobileNumber:'9876543210',nextAgreementDraft:draft}));
 assert.equal(response.status,200,await response.clone().text());const saved=Object.values(app.state.properties)[0];assert.deepEqual(saved.nextAgreementDraft,draft);assert.equal(saved.monthlyRent,'30000');assert.equal(saved.agreementStartDate,'2026-01-01');assert.equal(saved.agreementRequest,undefined);
});

test('Add Tenant stores the same draft on the existing tenancy without creating a renewal request',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,agreementEndDate:'2026-12-31',tenants:[]}}}),response=await route(app,'tenants').POST(request('/tenants','owner','POST',{propertyId:'P',ownerUID:'owner',tenants:[{firstName:'Tenant',lastName:'Name',email:'tenant@test.invalid',phone:'9876543210',leaseStartDate:'2026-01-01',leaseEndDate:'2026-12-31',monthlyRent:'30000',securityDeposit:'50000',nextAgreementDraft:draft}]}));
 assert.equal(response.status,200,await response.clone().text());const tenant=Object.values(app.state.tenants)[0];assert.deepEqual(tenant.nextAgreementDraft,draft);assert.deepEqual(app.state.properties.P.nextAgreementDraft,draft);assert.equal(app.state.properties.P.agreementRequest,undefined);
});

test('future agreement controls follow current agreement fields and include amount words',()=>{
 const owner=fs.readFileSync('src/features/properties/AddPropertyForm.tsx','utf8'),tenant=fs.readFileSync('src/features/services/AddTenant.tsx','utf8'),tenantProperty=fs.readFileSync('src/features/properties/TenantPropertyForm.tsx','utf8'),component=fs.readFileSync('src/components/NextAgreementFields.tsx','utf8');
 const ownerToggle=owner.indexOf('idPrefix="owner-next-agreement"');assert.ok(ownerToggle>owner.indexOf('name="agreementStartDate"'));assert.ok(ownerToggle>owner.indexOf('name="agreementEndDate"'));assert.ok(ownerToggle>owner.indexOf('name="noticePeriod"'));assert.ok(ownerToggle>owner.indexOf('name="lockInPeriod"'));
 const tenantToggle=tenant.indexOf('idPrefix={`tenant-${tenant.id}-next-agreement`}');assert.ok(tenantToggle>tenant.lastIndexOf('Agreement Start Date',tenantToggle));assert.ok(tenantToggle>tenant.lastIndexOf('Agreement End Date',tenantToggle));assert.ok(tenantToggle>tenant.lastIndexOf('Notice Period / Early Termination Notice',tenantToggle));assert.ok(tenantToggle>tenant.lastIndexOf('Lock-in Period',tenantToggle));
 const tenantPropertyToggle=tenantProperty.indexOf('idPrefix="tenant-property-next-agreement"');assert.ok(tenantPropertyToggle>tenantProperty.indexOf("['agreementStartDate','Agreement start date'"));assert.ok(tenantPropertyToggle>tenantProperty.indexOf("['agreementEndDate','Agreement end date'"));assert.ok(tenantPropertyToggle>tenantProperty.indexOf("['noticePeriod','Notice / Early termination period"));assert.ok(tenantPropertyToggle>tenantProperty.indexOf("['lockInPeriod','Lock-in period"));assert.match(tenantProperty,/nextAgreementDraft:addNextAgreementManually\?nextAgreementDraft:undefined/);
 assert.match(component,/Add Next Agreement/);assert.match(component,/Next Agreement Duration \(Months\)/);assert.match(component,/Starts automatically after the current agreement ends/);assert.match(component,/readOnly/);assert.match(component,/Next Agreement Monthly Rent/);assert.match(component,/Next Agreement Security Deposit/);assert.match(component,/AmountInWords/);
});

test('server rejects altered calculated dates and does not create a property',async()=>{
 const app=isolated({users}),altered={...draft,endDate:'2027-12-30'},response=await route(app,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Forged draft',propertyType:'residential',structure:'Apartment',configuration:'2 BHK',location:'Pune',ownerUID:'owner',listingType:'rent',rentalStatus:'rented',monthlyRent:'30000',paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31',noticePeriod:'1',lockInPeriod:'3',tenantEmail:'tenant@test.invalid',tenantFirstName:'Tenant',tenantLastName:'Name',mobileNumber:'9876543210',nextAgreementDraft:altered}));
 assert.equal(response.status,400);assert.equal(Object.keys(app.state.properties||{}).length,0);
});

test('an exact legacy draft derives and persists its duration',async()=>{
 const legacy={...draft};delete legacy.durationMonths;
 const app=isolated({users}),response=await route(app,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Legacy draft',propertyType:'residential',structure:'Apartment',configuration:'2 BHK',location:'Pune',ownerUID:'owner',listingType:'rent',rentalStatus:'rented',monthlyRent:'30000',paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31',noticePeriod:'1',lockInPeriod:'3',tenantEmail:'tenant@test.invalid',tenantFirstName:'Tenant',tenantLastName:'Name',mobileNumber:'9876543210',nextAgreementDraft:legacy}));
 assert.equal(response.status,200,await response.clone().text());assert.equal(Object.values(app.state.properties)[0].nextAgreementDraft.durationMonths,'12');
});
