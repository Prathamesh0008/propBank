const assert=require('node:assert/strict'),{test}=require('node:test');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');
const setup=()=>isolated({users:{...users,broker:{...defaults,uid:'broker',role:'agent',email:'broker@test.invalid',name:'Broker'}},properties:{P:{...properties.P,moderationStatus:'approved',rentalStatus:'available',monthlyRent:'70000',tenants:[]}}});
async function offer(app){const response=await route(app,'negotiations').POST(request('/negotiations','other','POST',{propertyId:'P',amount:60000}));assert.equal(response.status,201);return (await response.json()).negotiation;}
async function action(app,n,uid,action,extra={}){const response=await route(app,'negotiations/[id]').PATCH(request(`/negotiations/${n.id}`,uid,'PATCH',{action,version:n.version,...extra}),context(n.id));return {response,body:await response.json()};}
test('original offer requires owner approval and explicit customer acceptance before completion',async()=>{
 const app=setup();let n=await offer(app);
 assert.equal((await action(app,n,'admin','accept')).response.status,403);
 assert.equal((await action(app,n,'admin','complete')).response.status,409);
 n=(await action(app,n,'admin','propose',{amount:60000})).body.negotiation;assert.equal(n.finalAgreedAmount,null);
 n=(await action(app,n,'owner','accept')).body.negotiation;assert.equal(n.finalAgreedAmount,null);assert.equal(n.status,'owner_approved');assert.equal(n.originalAskingPrice,70000);
 assert.equal((await action(app,n,'admin','complete')).response.status,409);
 n=(await action(app,n,'other','customer_accept')).body.negotiation;assert.equal(n.finalAgreedAmount,60000);assert.equal(n.status,'accepted');
 n=(await action(app,n,'admin','complete')).body.negotiation;assert.equal(n.status,'completed');assert.equal(n.history.length,5);assert.equal(app.state.properties.P.monthlyRent,'70000');
});
test('owner counter requires customer acceptance and preserves all proposed amounts',async()=>{
 const app=setup();let n=await offer(app);
 n=(await action(app,n,'admin','propose',{amount:65000})).body.negotiation;
 n=(await action(app,n,'owner','counter',{amount:67000})).body.negotiation;assert.equal(n.finalAgreedAmount,null);
 assert.equal((await action(app,n,'admin','customer_accept')).response.status,403);
 n=(await action(app,n,'other','customer_accept')).body.negotiation;assert.equal(n.finalAgreedAmount,67000);assert.equal(n.customerOffer,60000);assert.equal(n.brokerProposedAmount,65000);assert.equal(n.ownerCounterAmount,67000);
});
test('assigned agent, privacy, version conflict, rejection and spoofed payload checks',async()=>{
 const app=setup();let n=await offer(app);
 assert.equal((await action(app,n,'broker','propose',{amount:61000})).response.status,403);
 n=(await action(app,n,'admin','assign_broker',{brokerUID:'broker'})).body.negotiation;
 const stale=n;n=(await action(app,n,'broker','propose',{amount:61000,ownerUID:'broker',finalAgreedAmount:1})).body.negotiation;
 assert.equal(n.ownerUID,'owner');assert.equal(n.finalAgreedAmount,null);
 assert.equal((await action(app,stale,'owner','accept')).response.status,409);
 const hidden=await (await route(app,'negotiations').GET(request('/negotiations','tenant'))).json();assert.equal(hidden.negotiations.length,0);
 n=(await action(app,n,'owner','reject')).body.negotiation;assert.equal(n.status,'rejected');assert.equal((await action(app,n,'admin','propose',{amount:2})).response.status,409);
});
test('concurrent acceptance and broker changes cannot overwrite an owner decision',async()=>{
 const app=setup();const n=await offer(app);
 const results=await Promise.all([action(app,n,'owner','accept'),action(app,n,'admin','propose',{amount:50000})]);assert.deepEqual(results.map(r=>r.response.status).sort(),[200,409]);assert.equal(app.state.negotiations[n.id].finalAgreedAmount,null);assert.equal(app.state.negotiations[n.id].status,'owner_approved');
});
test('negotiation events notify exactly the owner, customer, and assigned broker without leaking offer data to others',async()=>{const app=setup();let n=await offer(app);let rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='negotiation.offered');assert.equal(rows.length,2);assert.deepEqual(new Set(rows.map(row=>row.recipientUID)),new Set(['owner','other']));assert.ok(rows.every(row=>row.html.includes('Existing Home')));n=(await action(app,n,'admin','assign_broker',{brokerUID:'broker'})).body.negotiation;n=(await action(app,n,'broker','propose',{amount:62000})).body.negotiation;rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='negotiation.proposed');assert.equal(rows.length,3);assert.deepEqual(new Set(rows.map(row=>row.recipientUID)),new Set(['owner','other','broker']));n=(await action(app,n,'owner','reject')).body.negotiation;rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='negotiation.rejected');assert.equal(rows.length,3);assert.ok(!rows.some(row=>row.recipientUID==='tenant'));const website=Object.values(app.state.admin_notifications).filter(row=>row.type==='negotiation_update');assert.equal(website.length,4);assert.ok(website.every(row=>row.userId==='other'&&row.ownerId==='owner'));});
const now=new Date('2030-01-01T10:00:00Z');
function reminders(seed={}){const app=isolated({users,visits:{V:{...defaults,id:'V',userId:'owner',title:'Home',description:'<script>',visitDate:new Date('2030-01-01T10:10:00Z'),reminderTime:15,reminderType:'email',status:'scheduled',isCompleted:false,...seed}}});app.env.FROM_EMAIL='staging@test.invalid';app.env.CRON_SECRET='x'.repeat(40);return app;}
test('cron authentication and missing email configuration fail closed before any reads or writes',async()=>{
 const app=reminders();const r=route(app,'cron/reminders');
 assert.equal((await r.GET(request('/cron/reminders'))).status,401);assert.equal(app.reads.length,0);
 delete app.env.CRON_SECRET;assert.equal((await r.GET(request('/cron/reminders'))).status,503);
 const service=app.load('@/lib/server/services/reminders');delete app.env.RESEND_API_KEY;await assert.rejects(service.runVisitReminders(now),e=>e.status===503);assert.equal(app.writes.length,0);
});
test('visit reminders lease concurrent runs, persist notifiedAt and deduplicate repeated execution',async()=>{
 const app=reminders(),service=app.load('@/lib/server/services/reminders');
 await Promise.all([service.runVisitReminders(now),service.runVisitReminders(now)]);assert.equal(app.emails.length,2);assert.deepEqual(new Set(app.emails.flatMap(mail=>mail.to)),new Set(['owner@test.invalid','admin@test.invalid']));assert.equal(app.state.visits.V.reminderDelivery.status,'sent');assert.equal(app.state.visits.V.notifiedAt.toISOString(),now.toISOString());assert.ok(app.emails.every(mail=>mail.html.includes('&lt;script&gt;')));
 await service.runVisitReminders(now);assert.equal(app.emails.length,2);assert.ok(app.emailKeys.every(key=>key.startsWith('visit.reminder:V:')));
});
test('failed reminder retries reuse exactly the same payload and idempotency key',async()=>{
 const app=reminders(),service=app.load('@/lib/server/services/reminders');app.env.TEST_MAIL_FAIL='1';
 assert.equal((await service.runVisitReminders(now)).failed,1);assert.equal(app.state.visits.V.notifiedAt,undefined);
 delete app.env.TEST_MAIL_FAIL;for(const row of Object.values(app.state.email_deliveries))row.nextRetryAt=new Date(0);app.state.users.owner.name='Changed';assert.equal((await service.runVisitReminders(new Date(now.getTime()+5*60000))).sent,1);assert.equal(app.emailKeys[0],app.emailKeys[2]);assert.equal(app.emailKeys[1],app.emailKeys[3]);assert.deepEqual(app.emails[0],app.emails[2]);assert.deepEqual(app.emails[1],app.emails[3]);
});
test('completed, expired, future and previously Go-notified visits do not send reminders',async()=>{
 for(const seed of [{isCompleted:true},{status:'completed'},{visitDate:new Date(now.getTime()-1)},{reminderTime:1},{notifiedAt:new Date(now.getTime()-1000)}]){const app=reminders(seed);await app.load('@/lib/server/services/reminders').runVisitReminders(now);assert.equal(app.emails.length,0);}
});

test('fixed thirty-minute due window reminds requester and administrator but not property owner',async()=>{
 const at=new Date(now.getTime()+30*60000),app=reminders({userId:'tenant',propertyId:'P',visitDate:at,reminderTime:30}),service=app.load('@/lib/server/services/reminders');
 assert.equal(service.dueReminder(app.state.visits.V,now.getTime()-1),false);assert.equal(service.dueReminder(app.state.visits.V,now.getTime()),true);
 const result=await service.runVisitReminders(now);assert.equal(result.sent,1);assert.deepEqual(new Set(app.emails.flatMap(mail=>mail.to)),new Set(['tenant@test.invalid','admin@test.invalid']));assert.ok(!app.emails.flatMap(mail=>mail.to).includes('owner@test.invalid'));
});

test('ambiguous old deliveries require reconciliation without starving later due visits',async()=>{
 const app=reminders(),service=app.load('@/lib/server/services/reminders');app.env.TEST_MAIL_FAIL='1';await service.runVisitReminders(now);delete app.env.TEST_MAIL_FAIL;
 const original=app.state.visits.V;original.reminderDelivery.firstAttemptAt=new Date(now.getTime()-24*3600000);original.reminderDelivery.leaseUntil=now;
 for(let i=0;i<21;i++)app.state.visits[`OLD${i}`]={...original,id:`OLD${i}`};
 app.state.visits.FRESH={...original,id:'FRESH',reminderDelivery:undefined};
 const result=await service.runVisitReminders(now);assert.equal(result.needsReconciliation,22);assert.equal(result.sent,1);assert.equal(app.state.visits.FRESH.reminderDelivery.status,'sent');
});
