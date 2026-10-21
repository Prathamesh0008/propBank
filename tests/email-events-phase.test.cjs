const test=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,properties}=require('./fixtures/native-server.cjs');
const baseSeed=()=>({users:structuredClone(users),properties:structuredClone(properties)});

const event={eventType:'property.created',eventId:'property:P:created',recipientUID:'owner',recipientRole:'owner',propertyId:'P',recordId:'P',templateId:'property-created',templateVersion:1,subject:'Property submitted',html:'<p>Submitted</p>',text:'Submitted'};

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
