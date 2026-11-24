const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {isolated,users,defaults,request,route,context}=require('./fixtures/native-server.cjs');
async function queued(role='requester'){
 const now=new Date(),at=new Date(now.getTime()+10*60000),visit={...defaults,id:'V',userId:'owner',title:'Synthetic viewing',description:'Existing notes',visitDate:at,status:'scheduled',isCompleted:false,managementVersion:0,reminderType:'email',reminderTime:30};
 const a=isolated({users,visits:{V:visit}}),mail=a.load('@/lib/server/services/transactional-email'),generation=createHash('sha256').update(`${at.getTime()}:30:owner`).digest('hex');
 const event={eventType:'visit.reminder',eventId:`V:${generation}:${role}`,recordId:'V',recipientRole:role,...(role==='requester'?{recipientUID:'owner'}:{recipientEmail:'admin@test.invalid'}),templateId:`visit-reminder-${role}`,templateVersion:1,subject:'Synthetic reminder',html:'<p>Viewing</p>',text:'Viewing',scheduledFor:new Date(at.getTime()-30*60000).toISOString(),reminderOffset:30,idempotencyKey:`visit.reminder:V:${generation}:${role}`};
 const {id}=await mail.enqueueTransactionalEmail(event);assert.ok(id);return {a,mail,id,now,at};
}
test('pending and failed reminders for requester and admin are suppressed after cancellation',async()=>{
 for(const role of ['requester','admin'])for(const failed of [false,true]){
  const {a,mail,id}=await queued(role);if(failed){a.env.TEST_MAIL_FAIL='1';await mail.recoverNotification(id);assert.equal(a.state.email_deliveries[id].status,'failed');delete a.env.TEST_MAIL_FAIL;a.state.email_deliveries[id].nextRetryAt=new Date(0);}
  const before=a.emails.length;assert.equal((await route(a,'visits/[id]').PUT(request('/visits/V','owner','PUT',{status:'cancelled',isCompleted:false,expectedVersion:0}),context('V'))).status,200);
  await mail.recoverNotification(id);assert.equal(a.emails.length,before);assert.equal(a.state.email_deliveries[id].status,'cancelled');assert.match(a.state.email_deliveries[id].errorSummary,/no longer applicable/);
 }
});
test('completion, legacy completion flags, deleted visits and expired schedules suppress queued mail',async()=>{
 for(const state of ['completed','legacy','deleted','expired']){const {a,mail,id}=await queued();if(state==='deleted')delete a.state.visits.V;else if(state==='expired')a.state.visits.V.visitDate=new Date(Date.now()-1000);else if(state==='legacy')a.state.visits.V.isCompleted=true;else Object.assign(a.state.visits.V,{status:'completed',isCompleted:true});await mail.recoverNotification(id);assert.equal(a.emails.length,0);assert.equal(a.state.email_deliveries[id].status,'cancelled');}
});
test('rescheduling invalidates old failed reminders while the new schedule can send once',async()=>{
 const {a,mail,id,now}=await queued();a.env.TEST_MAIL_FAIL='1';await mail.recoverNotification(id);delete a.env.TEST_MAIL_FAIL;a.state.email_deliveries[id].nextRetryAt=new Date(0);const before=a.emails.length;
 const next=new Date(now.getTime()+20*60000).toISOString();const r=await route(a,'visits/[id]').PUT(request('/visits/V','owner','PUT',{visitDate:next,expectedVersion:0}),context('V'));assert.equal(r.status,200);
 await mail.recoverNotification(id);assert.equal(a.emails.length,before);assert.equal(a.state.email_deliveries[id].status,'cancelled');
 await a.load('@/lib/server/services/reminders').runVisitReminders(new Date());assert.equal(a.emails.length,before+2);await a.load('@/lib/server/services/reminders').runVisitReminders(new Date());assert.equal(a.emails.length,before+2);
});
test('unchanged eligible reminders retain their idempotency key and concurrent recovery sends once',async()=>{
 const {a,mail,id}=await queued();const key=a.state.email_deliveries[id].idempotencyKey;await Promise.all([mail.recoverNotification(id),mail.recoverNotification(id)]);assert.equal(a.emails.length,1);assert.equal(a.emailKeys[0],key);assert.equal(a.state.email_deliveries[id].status,'sent');await mail.recoverNotification(id);assert.equal(a.emails.length,1);
});
test('a cancellation after the delivery lease is claimed is rechecked before provider I/O',async()=>{
 const {a,mail,id}=await queued(),db=a.load('@/lib/server/firestore').getDatabase(),collection=db.collection;let reads=0;
 db.collection=name=>{const c=collection(name);if(name==='visits'){const doc=c.doc;c.doc=key=>{const ref=doc.call(c,key),get=ref.get;ref.get=async()=>{if(++reads===2)a.state.visits.V.status='cancelled';return get.call(ref)};return ref}}return c};
 await mail.recoverNotification(id);assert.ok(reads>=2);assert.equal(a.emails.length,0);assert.equal(a.state.email_deliveries[id].status,'cancelled');
});
test('clearing notes differs from omitted notes and preserves unrelated visit fields',async()=>{
 for(const uid of ['owner','admin']){const {a,at}=await queued();let r=await route(a,'visits/[id]').PUT(request('/visits/V',uid,'PUT',{title:'Updated viewing',expectedVersion:0}),context('V'));assert.equal(r.status,200);assert.equal(a.state.visits.V.description,'Existing notes');
  r=await route(a,'visits/[id]').PUT(request('/visits/V',uid,'PUT',{description:'',expectedVersion:1}),context('V'));assert.equal(r.status,200);assert.equal((await r.json()).visit.description,'');assert.equal(a.state.visits.V.description,'');assert.equal(a.state.visits.V.title,'Updated viewing');assert.equal(a.state.visits.V.userId,'owner');assert.equal(a.state.visits.V.visitDate.getTime(),at.getTime());assert.equal(a.state.visits.V.status,'scheduled');
  r=await route(a,'visits/[id]').PUT(request('/visits/V',uid,'PUT',{description:'Stale notes',expectedVersion:1}),context('V'));assert.equal(r.status,409);assert.equal(a.state.visits.V.description,'');
 }
});
