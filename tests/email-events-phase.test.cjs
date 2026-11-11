const {registrySeed}=require('./fixtures/mobile-registry.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,properties}=require('./fixtures/native-server.cjs');
const baseSeed=()=>({...registrySeed(users),properties:structuredClone(properties)});

const event={eventType:'property.created',eventId:'property:P:created',recipientUID:'owner',recipientRole:'owner',propertyId:'P',recordId:'P',templateId:'property-created',templateVersion:1,subject:'Property submitted',html:'<p>Submitted</p>',text:'Submitted'};

test('new account registration queues one welcome message only for the registered user',async()=>{const app=isolated(baseSeed());app.claims.newuser={email:'newuser@test.invalid',email_verified:false,emailVerified:false,providerData:[{providerId:'password'}]};const service=app.load('@/lib/server/services/users');const response=await service.createUser(new Request('http://test/api/auth/user',{method:'POST',headers:{authorization:'Bearer newuser','content-type':'application/json'},body:JSON.stringify({uid:'newuser',email:'newuser@test.invalid',name:'New User',phoneNumber:'9876543210',role:'individual'})}),true);assert.equal(response.status,200);await app.flush();const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='user.registration_welcome');assert.equal(rows.length,1);assert.equal(rows[0].eventType,'user.registration_welcome');assert.equal(rows[0].recipientUID,'newuser');assert.match(rows[0].subject,/Welcome/);});

test('transactional email records, sends, and deduplicates a stable event',async()=>{
  const app=isolated(baseSeed());const service=app.load('@/lib/server/services/transactional-email');
  const first=await service.enqueueTransactionalEmail(event);assert.equal(first.queued,true);
  const duplicate=await service.enqueueTransactionalEmail(event);assert.equal(duplicate.duplicate,true);
  service.queueTransactionalEmail({...event,eventId:'property:P:second'});await app.flush();
  assert.equal(app.emails.length,1);assert.equal(Object.keys(app.state.email_deliveries).length,2);
  assert.equal(Object.values(app.state.email_deliveries).filter(row=>row.status==='sent').length,1);
});

test('ineligible recipients are not queued and provider failure is sanitized',async()=>{
  const seed=baseSeed();seed.users.owner.isActive=false;const blocked=isolated(seed);const service=blocked.load('@/lib/server/services/transactional-email');
  const ineligible=await service.enqueueTransactionalEmail(event);assert.equal(ineligible.queued,false);assert.equal(ineligible.reason,'recipient_ineligible');
  const failed=isolated(baseSeed());failed.env.TEST_MAIL_FAIL='1';const failedService=failed.load('@/lib/server/services/transactional-email');
  failedService.queueTransactionalEmail(event);await failed.flush();const row=Object.values(failed.state.email_deliveries)[0];
  assert.equal(row.status,'failed');assert.equal(row.errorSummary,'Email provider delivery failed');assert.equal(row.retryCount,1);
});

test('only a persisted admin can inspect delivery metadata',async()=>{
  const app=isolated(baseSeed());const service=app.load('@/lib/server/services/transactional-email');await service.enqueueTransactionalEmail(event);
  const admin=await service.listEmailDeliveries(new Request('http://test/api/admin/email-deliveries',{headers:{authorization:'Bearer admin'}}));assert.equal(admin.status,200);const body=await admin.json();assert.match(body.deliveries[0].recipientEmail,/\*\*\*/);assert.equal(body.deliveries[0].html,undefined);
  await assert.rejects(()=>service.listEmailDeliveries(new Request('http://test/api/admin/email-deliveries',{headers:{authorization:'Bearer owner'}})),error=>error.status===403);
});

test('retry accepts no recipient or message override',async()=>{
  const seed=baseSeed();seed.email_deliveries={failed:{...event,id:'failed',recipientEmail:'owner@test.invalid',idempotencyKey:'fixed',status:'failed',retryCount:1,createdAt:new Date(),errorSummary:'Email provider delivery failed'}};const app=isolated(seed);const service=app.load('@/lib/server/services/transactional-email');
  await assert.rejects(()=>service.retryEmailDelivery(new Request('http://test',{method:'POST',headers:{authorization:'Bearer admin','content-type':'application/json'},body:JSON.stringify({recipientEmail:'other@test.invalid'})}),'failed'),error=>error.status===400);
  const response=await service.retryEmailDelivery(new Request('http://test',{method:'POST',headers:{authorization:'Bearer admin','content-type':'application/json'},body:'{}'}),'failed');assert.equal(response.status,200);await app.flush();assert.equal(app.state.email_deliveries.failed.status,'sent');assert.equal(app.emails[0].to[0],'owner@test.invalid');
});

test('one activity event selects each current relationship recipient once',async()=>{
  const app=isolated(baseSeed());app.env.ADMIN_EMAIL='admin@test.invalid';const service=app.load('@/lib/server/services/transactional-email');
  const result=await service.persistUserEvent({eventType:'tenancy.tenant_assigned',eventId:'P:1:assign',recipients:[{uid:'owner',role:'owner'},{uid:'tenant',role:'tenant'},{role:'admin',email:'admin@test.invalid'}],propertyId:'P',recordId:'P',templateId:'tenant-assigned',subject:'Tenant assigned',bodyHtml:'<p>Assigned</p>',bodyText:'Assigned'});
  assert.equal(result.recorded,1);await app.flush();assert.equal(Object.values(app.state.email_deliveries).filter(row=>row.kind!=='notification_intent').length,3);assert.deepEqual(new Set(app.emails.map(mail=>mail.to[0])),new Set(['owner@test.invalid','tenant@test.invalid','admin@test.invalid']));
});

test('mobile changes require recent Firebase phone verification and emit a security event',async()=>{
  const app=isolated(baseSeed());app.env.ADMIN_EMAIL='admin@test.invalid';const usersService=app.load('@/lib/server/services/users');
  let response=await usersService.updateUser(new Request('http://test',{method:'PUT',headers:{authorization:'Bearer owner','content-type':'application/json'},body:JSON.stringify({phoneNumber:'+919999999999'})}),'owner');
  assert.equal(response.status,403);
  app.claims.owner={auth_time:Math.floor(Date.now()/1000),phone_number:'+919999999999',phoneNumber:'+919999999999'};
  response=await usersService.updateUser(new Request('http://test',{method:'PUT',headers:{authorization:'Bearer owner','content-type':'application/json'},body:JSON.stringify({phoneNumber:'+919999999999'})}),'owner');
  assert.equal(response.status,200);await app.flush();assert.equal(app.state.users.owner.phoneNumber,'+919999999999');assert.equal(Object.values(app.state.email_deliveries).filter(row=>row.eventType==='user.mobile_number_changed').length,2);assert.equal(Object.values(app.state.admin_notifications).filter(row=>row.type==='user.mobile_number_changed').length,1);
});

test('rental term notifications are staged in the business transaction and roll back on persistence failure',async()=>{
 const {request,route,context}=require('./fixtures/native-server.cjs');
 const app=isolated(baseSeed());const response=await route(app,'properties/[id]').PATCH(request('/properties/P','owner','PATCH',{monthlyRent:'32000',expectedRentTermsVersion:0}),context('P'));assert.equal(response.status,200,await response.clone().text());
 const intents=Object.values(app.state.email_deliveries).filter(row=>row.kind==='notification_intent'&&row.sourceEventType==='tenancy.rental_terms_updated');assert.equal(intents.length,1);await app.flush();
 const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='tenancy.rental_terms_updated');assert.equal(rows.length,2);assert.deepEqual(new Set(rows.map(row=>row.recipientUID)),new Set(['owner','tenant']));assert.ok(rows.every(row=>row.html.includes('Existing Home')));
 const failed=isolated(baseSeed());failed.env.TEST_DB_WRITE_COLLECTION='email_deliveries';const result=await route(failed,'properties/[id]').PATCH(request('/properties/P','owner','PATCH',{monthlyRent:'32000'}),context('P'));assert.ok(result.status>=400);assert.equal(failed.state.properties.P.monthlyRent,undefined);assert.equal(Object.keys(failed.state.email_deliveries||{}).length,0);
});

test('legacy template interpolation escapes user input and permits only explicitly trusted formatting',()=>{const app=isolated(baseSeed()),effects=app.load('@/lib/server/services/property-effects');const html=effects.formatTemplate('<p>%s %s</p>',['<img src=x onerror=alert(1)>',effects.trustedTemplateHtml('<strong>Trusted</strong>')]);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);assert.match(html,/<strong>Trusted<\/strong>/);});
