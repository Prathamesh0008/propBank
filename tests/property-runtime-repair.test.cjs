const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,request,route}=require('./fixtures/native-server.cjs');
const base={propertyTitle:'Repair fixture',propertyType:'residential',location:'Fixture address',ownerUID:'owner',listingType:'rent',monthlyRent:'25000',rentalStatus:'available'};
const tenant={...base,createdAs:'tenant',reportedOwner:{personName:'Owner',phone:'9876543210',email:'owner@test.invalid'},paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31'};
const fresh=()=>isolated({users:structuredClone(users),properties:{},tenants:{}});
const submit=(app,body=base,uid='owner')=>route(app,'properties').POST(request('/properties',uid,'POST',body));
test('optional pre-discovery outage preserves an unbound pending claim and legitimate tenant property',async()=>{
 const app=fresh(),firebase=app.load('@/lib/server/firebase-admin'),original=firebase.getFirebaseAdminAuth;firebase.getFirebaseAdminAuth=()=>({...original(),getUserByEmail:async()=>{throw {code:'auth/insufficient-permission'};}});const response=await submit(app,tenant,'tenant');assert.equal(response.status,200);const claim=Object.values(app.state.relationship_links)[0];assert.equal(claim.candidateUID,'');assert.equal(claim.status,'verification_required');assert.equal(claim.recipientEmailNormalized,'owner@test.invalid');assert.equal(Object.values(app.state.properties)[0].ownerUID,'');assert.equal(Object.values(app.state.email_deliveries).filter(row=>row.eventType==='relationship.owner_invitation').length,1);
});
test('post-commit after registration failure leaves durable pending mail without reporting saved property as failed',async()=>{
 const app=fresh();app.env.TEST_AFTER_REGISTRATION_FAIL='1';const response=await submit(app);assert.equal(response.status,200);assert.equal(Object.keys(app.state.properties).length,1);const deliveries=Object.values(app.state.email_deliveries);assert.ok(deliveries.length);assert.ok(deliveries.every(row=>row.status==='pending'));const retry=await submit(app);assert.equal(retry.status,200);assert.equal(Object.keys(app.state.properties).length,1);assert.equal(Object.values(app.state.email_deliveries).length,deliveries.length);assert.equal(app.emails.length,0);
});
test('essential outbox persistence failure returns a correlation reference and rolls back all business records',async()=>{
 const app=fresh();app.env.TEST_DB_WRITE_COLLECTION='email_deliveries';const response=await submit(app,tenant,'tenant');assert.equal(response.status,503);const data=await response.json();assert.equal(data.code,'PROPERTY_CREATION_FAILED');assert.match(data.reference,/^[a-f0-9-]{36}$/);assert.match(data.message,/Reference:/);assert.ok(!data.message.includes('database outage'));assert.equal(Object.keys(app.state.properties).length,0);assert.equal(Object.keys(app.state.relationship_links||{}).length,0);assert.equal(Object.keys(app.state.email_deliveries||{}).length,0);
});
test('invalid explicitly supplied addresses produce precise field errors; absent optional owner email succeeds',async()=>{
 const app=fresh();for(const [body,uid,field]of [[{...base,tenantEmail:'invalid'},'owner','tenantEmail'],[{...tenant,reportedOwner:{...tenant.reportedOwner,email:'invalid'}},'tenant','reportedOwner.email']]){const response=await submit(app,body,uid);assert.equal(response.status,400);assert.ok((await response.json()).fieldErrors[field]);}assert.equal((await submit(app,{...tenant,reportedOwner:{personName:'Owner',phone:'9876543210'}},'tenant')).status,200);
});
test('provider failures expose safe status/code metadata and never raw provider message',async()=>{
 const app=fresh();app.env.TEST_MAIL_FAIL='1';assert.equal((await submit(app)).status,200);await app.flush();const row=Object.values(app.state.email_deliveries)[0];assert.equal(row.status,'failed');assert.equal(row.providerStatus,503);assert.equal(row.providerErrorCode,'provider_error');assert.equal(row.errorSummary,'Email provider delivery failed');assert.equal(Object.keys(app.state.properties).length,1);
});
