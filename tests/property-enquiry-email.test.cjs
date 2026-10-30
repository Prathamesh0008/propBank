const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {isolated,users,properties,request,route}=require('./fixtures/native-server.cjs');

function setup(options){const app=isolated({users,properties},options);app.env.ADMIN_EMAIL='admin@test.invalid';return app;}
function idempotentRequest(body,key='property-enquiry-key-0001'){
  return new Request('http://local/api/admin/notifications',{method:'POST',headers:{Authorization:'Bearer tenant','Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
}
const submit=(app,body={type:'property_enquiry',propertyId:'P'})=>route(app,'admin/notifications').POST(request('/admin/notifications','tenant','POST',body));
const delivery=(app)=>Object.values(app.state.email_deliveries||{}).find(row=>row.eventType==='enquiry.property_created');

test('property enquiry persists trusted property/contact data and one transactional admin delivery',async()=>{
  const app=setup(),api=route(app,'admin/notifications');
  const response=await api.POST(idempotentRequest({type:'property_enquiry',propertyId:'P',propertyTitle:'Forged',userEmail:'forged@test.invalid',userPhone:'000'}));
  assert.equal(response.status,201);const body=await response.json(),saved=app.state.admin_notifications[body.notification.id],mail=delivery(app);
  assert.equal(saved.propertyId,'P');assert.equal(saved.propertyTitle,'Existing Home');assert.equal(saved.userEmail,'tenant@test.invalid');assert.equal(saved.userPhone,'+919123456782');
  assert.equal(body.emailNotification.status,'pending');assert.equal(mail.recordId,saved.id);assert.equal(mail.status,'pending');assert.equal(mail.recipientEmail,'admin@test.invalid');
  assert.ok(!mail.html.includes('forged@test.invalid'));assert.ok(!mail.html.includes(properties.P.ownerEmail));
  await app.flush();assert.equal(mail.status,'sent');assert.equal(app.emails.length,1);assert.equal(app.emails[0].to[0],'admin@test.invalid');assert.match(app.emails[0].from,/connect@test\.invalid/);
});

test('enquiry replay is idempotent and never creates or sends a duplicate email',async()=>{
  const app=setup(),api=route(app,'admin/notifications'),payload={type:'property_enquiry',propertyId:'P'};
  const first=await api.POST(idempotentRequest(payload)),second=await api.POST(idempotentRequest(payload));
  assert.equal(first.status,201);assert.equal(second.status,200);assert.equal((await second.json()).duplicate,true);
  assert.equal(Object.keys(app.state.admin_notifications).length,1);assert.equal(Object.keys(app.state.email_deliveries).length,1);await app.flush();assert.equal(app.emails.length,1);
});

test('database transaction failure persists neither enquiry nor email job',async()=>{
  const app=setup();app.env.TEST_DB_WRITE_COLLECTION='email_deliveries';const response=await submit(app);
  assert.equal(response.status,500);assert.equal(Object.keys(app.state.admin_notifications||{}).length,0);assert.equal(Object.keys(app.state.email_deliveries||{}).length,0);await app.flush();assert.equal(app.emails.length,0);
});

for(const [status,name,code] of [[403,'restricted_api_key','restricted_api_key'],[422,'validation_error','validation_error']])test(`Resend ${status} leaves a visible, retryable failure`,async()=>{
  const app=setup({fetch:async()=>new Response(JSON.stringify({name,message:'sanitized provider rejection'}),{status,headers:{'Content-Type':'application/json'}})});
  assert.equal((await submit(app)).status,201);await app.flush();const mail=delivery(app);
  assert.equal(mail.status,'failed');assert.equal(mail.providerStatus,status);assert.equal(mail.providerErrorCode,code);assert.equal(mail.errorSummary,'Email provider delivery failed');assert.equal(Object.keys(app.state.admin_notifications).length,1);
});

test('missing mail configuration is operationally visible without losing the enquiry',async()=>{
  const app=setup();app.env.RESEND_API_KEY='';app.env.ADMIN_EMAIL='';
  assert.equal((await submit(app)).status,201);assert.equal(delivery(app).status,'pending');await app.flush();
  assert.equal(delivery(app).status,'failed');assert.equal(delivery(app).failureCategory,'configuration');assert.match(delivery(app).errorSummary,/ADMIN_EMAIL/);assert.equal(Object.keys(app.state.admin_notifications).length,1);
});

test('temporary transport failure is retryable and provider idempotency is stable',async()=>{
  let unavailable=true;const app=setup({fetch:async()=>{if(unavailable)throw new Error('isolated network outage');return new Response('{"id":"accepted-after-retry"}',{status:200,headers:{'Content-Type':'application/json'}});}});
  assert.equal((await submit(app)).status,201);await app.flush();const mail=delivery(app),firstKey=mail.idempotencyKey;assert.equal(mail.status,'failed');assert.equal(mail.failureCategory,'provider_or_transport');
  unavailable=false;mail.nextRetryAt=new Date(0);const response=await app.load('@/lib/server/services/transactional-email').retryEmailDelivery(request(`/admin/email-deliveries/${mail.id}/retry`,'admin','POST',{}),mail.id);assert.equal(response.status,200);await app.flush();
  assert.equal(mail.status,'sent');assert.equal(mail.idempotencyKey,firstKey);assert.deepEqual(new Set(app.emailKeys),new Set([firstKey]));
});

test('admin inbox exposes enquiry and sanitized delivery state while public submission remains accurate',async()=>{
  const app=setup();const submitted=await submit(app),id=(await submitted.json()).notification.id;await app.flush();
  const inbox=await route(app,'enquiries').GET(request('/enquiries','admin'));assert.equal(inbox.status,200);const row=(await inbox.json()).enquiries.find(entry=>entry.id===id);
  assert.equal(row.propertyId,'P');assert.equal(row.propertyTitle,'Existing Home');assert.equal(row.userEmail,'tenant@test.invalid');assert.equal(row.emailDeliveryStatus,'sent');assert.equal(row.emailDeliveryFailure,'');
  assert.equal((await route(app,'enquiries').GET(request('/enquiries','owner'))).status,403);
  assert.match(fs.readFileSync('src/features/search/SearchResults.tsx','utf8'),/Enquiry submitted/);assert.doesNotMatch(fs.readFileSync('src/features/search/SearchResults.tsx','utf8'),/enquiry has been sent to the admin/i);
});

test('anonymous property enquiry is rejected while the privacy-safe public general enquiry remains available',async()=>{
  const app=setup(),api=route(app,'admin/notifications');assert.equal((await api.POST(request('/admin/notifications',null,'POST',{type:'property_enquiry',propertyId:'P'}))).status,401);
  const general=await api.POST(request('/admin/notifications',null,'POST',{type:'general_inquiry',userName:'Guest',userEmail:'guest@test.invalid',userPhone:'9876543210',inquiryType:'rent',propertyType:'residential'}));assert.equal(general.status,201);
});
