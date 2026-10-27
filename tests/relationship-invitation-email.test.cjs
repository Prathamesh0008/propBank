const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const fresh=()=>{const app=isolated({users:structuredClone(users),properties:{},tenants:{}});app.env.TEST_STRICT_TRANSACTIONS='1';return app;};
const intake={propertyTitle:'Private flat secret',propertyType:'residential',location:'Private address secret',createdAs:'tenant',reportedOwner:{personName:'Private owner secret',phone:'9876543210',email:' New.Owner@Example.com '},monthlyRent:'25000',securityDeposit:'50000',paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31',tenantFirstName:'Private tenant secret'};
const mailRows=app=>Object.values(app.state.email_deliveries||{}).filter(row=>/^relationship\.(owner|tenant)_invitation$/.test(row.eventType));
const submit=(app,body=intake,uid='tenant')=>route(app,'properties').POST(request('/properties',uid,'POST',body));
const action=(app,uid,action,claimId)=>route(app,'relationship-links').POST(request('/relationship-links',uid,'POST',{action,...(claimId?{claimId}:{})}));
const prove=(app,uid,phone)=>{app.claims[uid]={phoneNumber:phone,phone_number:phone,auth_time:Math.floor(Date.now()/1000)};};
function owned(app,id='P'){app.state.properties[id]={...structuredClone(properties.P),id,tenants:[],rentalStatus:'available'};}
const assignment=(email=' New.Tenant@Example.com ')=>( {propertyId:'P',ownerUID:'owner',tenants:[{firstName:'Private tenant secret',lastName:'Name',email,phone:'9123456789',monthlyRent:'25000',securityDeposit:'50000',leaseStartDate:'2026-01-01',leaseEndDate:'2026-12-31',paymentDueDate:'5'}]});
const add=(app,body=assignment(),uid='owner')=>route(app,'tenants').POST(request('/tenants',uid,'POST',body));
const retry=(app,id)=>app.load('@/lib/server/services/transactional-email').retryEmailDelivery(request('/admin/email-deliveries/'+id,'admin','POST',{}),id);

test('tenant intake atomically queues normalized owner invitation for an unregistered recipient without granting access',async()=>{
 const app=fresh(),response=await submit(app);assert.equal(response.status,200,await response.clone().text());
 const pid=(await response.json()).property.id,row=mailRows(app)[0];assert.equal(row.status,'pending');assert.equal(row.recipientEmail,'new.owner@example.com');assert.equal(row.subject,'Property Ownership Verification Request | PropBank');assert.equal(app.state.properties[pid].reportedOwner.email,'new.owner@example.com');assert.equal(app.state.properties[pid].ownerUID,'');assert.equal(app.emails.length,0);
 await app.flush();assert.equal(row.id,mailRows(app)[0].id);assert.equal(mailRows(app)[0].status,'sent');assert.equal(app.emails.filter(mail=>mail.subject===row.subject).length,1);
});
test('owner property intake queues tenant invitation only after the original property and tenancy persist',async()=>{
 const app=fresh(),body={...intake,createdAs:'owner',reportedOwner:undefined,ownerUID:'owner',rentalStatus:'rented',tenantEmail:'tenant@example.com',tenantFirstName:'Private tenant secret',tenantLastName:'Name',mobileNumber:'9123456789'};
 const response=await submit(app,body,'owner');assert.equal(response.status,200,await response.clone().text());const pid=(await response.json()).property.id,row=mailRows(app)[0];assert.ok(row);assert.equal(row.eventType,'relationship.tenant_invitation');assert.equal(row.recipientEmail,'tenant@example.com');assert.equal(app.state.properties[pid].ownerUID,'owner');assert.ok(!app.state.properties[pid].tenants[0].userUID);await app.flush();assert.equal(mailRows(app)[0].status,'sent');
});
test('Add Tenant queues generic invitation to existing or unregistered recipients and never links by email',async()=>{
 for(const email of ['tenant@test.invalid','unregistered@example.com']){const app=fresh();owned(app);const response=await add(app,assignment(email));assert.equal(response.status,200);assert.equal(mailRows(app).length,1);assert.equal(mailRows(app)[0].recipientEmail,email);assert.ok(!app.state.properties.P.tenants[0].userUID);await app.flush();assert.equal(mailRows(app)[0].status,'sent');}
});
test('missing optional owner email preserves pending relationship without mail; invalid email rejects either intake',async()=>{
 const app=fresh();assert.equal((await submit(app,{...intake,reportedOwner:{...intake.reportedOwner,email:''}})).status,200);assert.equal(mailRows(app).length,0);assert.equal(Object.keys(app.state.relationship_links).length,1);
 for(const email of ['invalid','a..b@example.com','x@example.com\r\nBcc: victim@example.com','a@-invalid.com']){const invalid=fresh();assert.equal((await submit(invalid,{...intake,reportedOwner:{...intake.reportedOwner,email}})).status,400);assert.equal(mailRows(invalid).length,0);owned(invalid);assert.equal((await add(invalid,assignment(email))).status,400);assert.equal(mailRows(invalid).length,0);}
});
test('failed property, tenancy, claim, or outbox writes roll back invitation records and never send',async()=>{
 for(const collection of ['properties','tenants','relationship_links','email_deliveries']){const app=fresh();app.env.TEST_DB_WRITE_COLLECTION=collection;const response=await submit(app);assert.ok(response.status>=400);assert.equal(Object.keys(app.state.properties).length,0);assert.equal(Object.keys(app.state.relationship_links||{}).length,0);assert.equal(mailRows(app).length,0);await app.flush();assert.equal(app.emails.length,0);}
});
test('repeated and concurrent property submissions produce one property, connection and invitation',async()=>{
 const app=fresh();const responses=await Promise.all([submit(app),submit(app)]);assert.ok(responses.every(r=>r.status===200));assert.equal(Object.keys(app.state.properties).length,1);assert.equal(Object.keys(app.state.relationship_links).length,1);assert.equal(mailRows(app).length,1);await submit(app);await app.flush();assert.equal(app.emails.filter(mail=>mail.subject===mailRows(app)[0].subject).length,1);
});
test('repeated Add Tenant requests cannot duplicate an active tenancy or its invitation',async()=>{
 const app=fresh();owned(app);assert.equal((await add(app)).status,200);assert.equal((await add(app)).status,409);assert.equal(mailRows(app).length,1);assert.equal(app.state.properties.P.tenants.length,1);
});
test('email templates and links contain no submitted private data, account identifiers or authorization tokens',async()=>{
 const app=fresh();await submit(app);for(const kind of ['owner','tenant']){const template=app.load('@/lib/server/services/relationship-invitation-email').invitationEmailTemplate(kind);for(const value of ['Private flat secret','Private address secret','Private owner secret','Private tenant secret','9876543210','25000','50000'])assert.ok(!template.html.includes(value)&&!template.text.includes(value));assert.match(template.html,/role="presentation"/);assert.match(template.html,/#183c32/);assert.match(template.text,/http:\/\/local\/manage-property#pending-connections/);const links=[...template.html.matchAll(/href="([^"]+)"/g)].map(match=>match[1]);assert.ok(links.every(link=>!link.includes('?')));for(const claim of Object.values(app.state.relationship_links)){assert.ok(!template.html.includes(claim.id));assert.ok(!template.html.includes(claim.propertyId));}}
});
test('verified email discovery exposes only a generic claim, never private property access, and rejection cancels mail',async()=>{
 const app=fresh();await submit(app);const claim=Object.values(app.state.relationship_links)[0];app.claims.other={email:'new.owner@example.com',emailVerified:true};await action(app,'other','discover');let list=await route(app,'relationship-links').GET(request('/relationship-links','other'));assert.equal((await list.json()).links.length,1);assert.equal((await route(app,'properties/[id]').GET(request('/properties/'+claim.propertyId,'other'),context(claim.propertyId))).status,404);assert.equal((await action(app,'other','request_owner_verification',claim.id)).status,403);app.claims.other.auth_time=Math.floor(Date.now()/1000);assert.equal((await action(app,'other','request_owner_verification',claim.id)).status,200);assert.equal((await action(app,'other','reject',claim.id)).status,200);assert.equal(app.state.properties[claim.propertyId].ownerUID,'');await app.flush();assert.equal(mailRows(app)[0].status,'cancelled');
});
test('provider failures preserve the property and retry uses the same immutable Resend key',async()=>{
 const app=fresh();app.env.TEST_MAIL_FAIL='1';assert.equal((await submit(app)).status,200);await app.flush();const row=mailRows(app)[0];assert.equal(row.status,'failed');assert.equal(row.errorSummary,'Email provider delivery failed');assert.equal(Object.keys(app.state.properties).length,1);const oldKey=row.idempotencyKey;assert.ok(app.emailKeys.includes(oldKey));delete app.env.TEST_MAIL_FAIL;assert.equal((await retry(app,row.id)).status,200);await app.flush();assert.equal(mailRows(app)[0].status,'sent');assert.equal(app.emailKeys.at(-1),oldKey);assert.equal((await retry(app,row.id).catch(error=>({status:error.status}))).status,409);
});
test('obsolete rejected, expired and linked invitations cannot be retried',async()=>{
 for(const status of ['rejected','expired','linked']){const app=fresh();app.env.TEST_MAIL_FAIL='1';await submit(app);await app.flush();const row=mailRows(app)[0];app.state.relationship_links[row.invitationClaimId].status=status;await assert.rejects(()=>retry(app,row.id),error=>error.status===409);}
});
test('recipient quota suppresses excess mail while preserving all property and claim records',async()=>{
 const app=fresh();for(let i=0;i<4;i++)assert.equal((await submit(app,{...intake,propertyTitle:'Separate private property '+i})).status,200);assert.equal(Object.keys(app.state.properties).length,4);assert.equal(mailRows(app).filter(row=>row.status==='pending').length,3);const suppressed=mailRows(app).find(row=>row.status==='suppressed');assert.match(suppressed.errorSummary,/rate limit/);await assert.rejects(()=>retry(app,suppressed.id),error=>error.status===409);await app.flush();assert.equal(mailRows(app).filter(row=>row.status==='sent').length,3);
});
test('sender hourly quota also applies across different recipients',async()=>{
 const app=fresh();for(let i=0;i<11;i++)assert.equal((await submit(app,{...intake,propertyTitle:'Separate '+i,reportedOwner:{...intake.reportedOwner,email:`recipient${i}@example.com`}})).status,200);assert.equal(mailRows(app).filter(row=>row.status==='pending').length,10);assert.equal(mailRows(app).filter(row=>row.status==='suppressed').length,1);
});
test('admin assignment without authenticated owner authorization does not send reported tenant invitation',async()=>{
 const app=fresh();owned(app);assert.equal((await add(app,assignment(),'admin')).status,200);assert.equal(mailRows(app).length,0);
});
test('discovery, registration and refresh do not repeat invitation events',async()=>{
 const app=fresh();await submit(app);prove(app,'owner','+919876543210');for(let i=0;i<3;i++){await action(app,'owner','discover');await route(app,'relationship-links').GET(request('/relationship-links','owner'));}assert.equal(mailRows(app).length,1);await app.flush();assert.equal(app.emails.filter(mail=>mail.subject===mailRows(app)[0].subject).length,1);
});
test('deployment URLs are constrained and unsafe configuration suppresses sending without breaking intake',async()=>{
 const app=fresh();app.env.APP_URL='javascript:alert(1)';assert.equal((await submit(app)).status,200);assert.equal(mailRows(app)[0].status,'suppressed');await app.flush();assert.equal(app.emails.filter(mail=>mail.subject===mailRows(app)[0].subject).length,0);
 app.env.APP_URL='https://example.com/path?private=secret#private';app.env.SUPPORT_EMAIL='bad"><script>@example.com';const content=app.load('@/lib/server/services/relationship-invitation-email').invitationEmailTemplate('owner');assert.match(content.text,/https:\/\/example.com\/manage-property#pending-connections/);assert.ok(!content.html.includes('<script>'));assert.ok(!content.html.includes('private=secret'));
});
test('reported recipient exception cannot be used for arbitrary account notification templates',async()=>{
 const app=fresh(),service=app.load('@/lib/server/services/transactional-email');const result=await service.enqueueTransactionalEmail({eventType:'relationship.owner_invitation',eventId:'forged',recipientEmail:'victim@example.com',recipientRole:'reported_owner_invitation',subject:'Private content',html:'secret',text:'secret',templateId:'forged',templateVersion:1});assert.equal(result.queued,false);assert.equal(mailRows(app).length,0);
});
test('expired claims, changed contacts and deactivated tenancies cancel queued invitations before delivery',async()=>{
 for(const change of ['expired','contact','inactive','sender']){const app=fresh();owned(app);await add(app);const row=mailRows(app)[0],claim=app.state.relationship_links[row.invitationClaimId],tenant=app.state.tenants[claim.tenantId];if(change==='expired')claim.expiresAt=new Date(0);if(change==='contact')tenant.email='different@example.com';if(change==='inactive')tenant.isActive=false;if(change==='sender')app.state.users.owner.isActive=false;await app.flush();assert.equal(mailRows(app)[0].status,'cancelled');assert.equal(app.emails.filter(mail=>mail.subject===row.subject).length,0);assert.ok(!tenant.userUID);}
});
test('unauthenticated or unrelated users cannot create invitations or inspect delivery details',async()=>{
 const app=fresh();owned(app);assert.equal((await submit(app,intake,'')).status,401);assert.equal((await add(app,assignment(),'other')).status,403);assert.equal(mailRows(app).length,0);await assert.rejects(()=>app.load('@/lib/server/services/transactional-email').listEmailDeliveries(request('/admin/email-deliveries','other')),error=>error.status===403);
});
