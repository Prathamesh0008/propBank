const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');

const source=file=>fs.readFileSync(file,'utf8');

test('owner property intake keeps only minimum occupied-property tenant fields',()=>{
 const owner=source('src/features/properties/AddPropertyForm.tsx');
 assert.doesNotMatch(owner,/name="tenantEmergencyContact"|name="tenantEmploymentStatus"|name="tenantSpouse\./);
 assert.doesNotMatch(owner,/Additional Year-wise Rent \(Optional\)|Security Deposit Amount|Notice and Lock-in Period/);
 for(const field of ['tenantFirstName','tenantLastName','tenantEmail','mobileNumber','agreementPeriod','agreementStartDate','agreementEndDate','paymentDueDate'])assert.match(owner,new RegExp(`name="${field}"`));
 assert.match(owner,/Complete deposits, notices, rent schedules and tenant profile details later in Add Tenant/);
});

test('tenant intake retains essential agreement and owner discovery fields without duplicate working profile',()=>{
 const tenant=source('src/features/properties/TenantPropertyForm.tsx');
 for(const field of ['monthlyRent','paymentDueDate','agreementPeriod','agreementStartDate','agreementEndDate'])assert.match(tenant,new RegExp(`'${field}'`));
 assert.match(tenant,/reportedOwner:owner/);
 assert.doesNotMatch(tenant,/Your working profile/);
});

test('category-aware forms constrain structures and preserve legacy edit values',()=>{
 const shared=source('src/features/properties/ClientPropertyFields.tsx');
 const edit=source('src/features/properties/EditProperty.tsx');
 assert.match(shared,/PROPERTY_STRUCTURES\[selectedCategory\]/);
 assert.match(shared,/field\.value&&!options\.includes\(field\.value\)/);
 assert.match(edit,/editCategory==='residential'&&!editPlotStructure/);
 assert.match(edit,/editPlotStructure&&<FormField control=\{form\.control\} name="plotArea"/);
 assert.match(edit,/!editPlotStructure&&<FormField control=\{form\.control\} name="carpetArea"/);
});

test('Add Tenant updates the existing tenancy and synchronizes agreement terms without duplication',async()=>{
 const tenant={...properties.P.tenants[0],propertyId:'P',ownerUID:'owner',monthlyRent:'30000',securityDeposit:'50000',leaseStartDate:'2029-01-01',leaseEndDate:'2029-12-31'};
 const app=isolated({users,properties:{P:{...properties.P,monthlyRent:'30000',securityDeposit:'50000',agreementStartDate:'2029-01-01',agreementEndDate:'2029-12-31',tenants:[{...tenant}] }},tenants:{T:{...tenant}}});
 const expected=new Date(app.state.properties.P.updatedAt).toISOString();
 const response=await route(app,'tenants/[id]').PUT(request('/tenants/T','owner','PUT',{monthlyRent:'35000',securityDeposit:'60000',leaseStartDate:'2030-01-01',leaseEndDate:'2030-12-31',noticePeriod:'2 Months',expectedPropertyUpdatedAt:expected}),context('T'));
 assert.equal(response.status,200);
 assert.equal(app.state.properties.P.tenants.length,1);assert.equal(Object.keys(app.state.tenants).length,1);
 assert.equal(app.state.properties.P.monthlyRent,'35000');assert.equal(app.state.properties.P.securityDeposit,'60000');
 assert.equal(app.state.properties.P.agreementStartDate,'2030-01-01');assert.equal(app.state.properties.P.agreementEndDate,'2030-12-31');
 assert.equal(app.state.tenants.T.monthlyRent,'35000');assert.equal(app.state.properties.P.agreementHistory.at(-1).action,'tenant_details_updated');
});

test('stale Add Tenant prefill cannot overwrite newer agreement data',async()=>{
 const tenant={...properties.P.tenants[0],propertyId:'P',ownerUID:'owner',monthlyRent:'30000'};
 const app=isolated({users,properties:{P:{...properties.P,monthlyRent:'40000',updatedAt:new Date('2031-01-01'),tenants:[{...tenant}]}},tenants:{T:{...tenant}}});
 const response=await route(app,'tenants/[id]').PUT(request('/tenants/T','owner','PUT',{monthlyRent:'31000',expectedPropertyUpdatedAt:new Date('2030-01-01').toISOString()}),context('T'));
 assert.equal(response.status,409);assert.equal(app.state.properties.P.monthlyRent,'40000');assert.equal(app.state.tenants.T.monthlyRent,'30000');
});
