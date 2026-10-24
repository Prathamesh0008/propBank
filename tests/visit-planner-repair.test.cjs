const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');
const future='2099-06-15T10:00:00Z';
function setup(seed={}){const app=isolated({users,properties:{P:{...properties.P,moderationStatus:'approved',rentalStatus:'available',tenants:[]}},visits:{...seed}});app.env.FROM_EMAIL='mail@test.invalid';return app;}

test('visits route returns the exact empty-list contract without a composite order query',async()=>{
 const app=setup(),response=await route(app,'visits').GET(request('/visits?userId=owner','owner'));assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true,message:'Visits retrieved successfully',visits:[]});assert.equal(app.reads.at(-1).order,null);assert.deepEqual(app.reads.at(-1).filters,[['userId','owner','==']]);
});

test('verified requester loads grouped visits while invalid, expired and unverified identities fail closed',async()=>{
 const app=setup({A:{...defaults,id:'A',userId:'owner',visitDate:new Date('2099-01-01'),status:'scheduled',isCompleted:false},B:{...defaults,id:'B',userId:'owner',visitDate:new Date('2099-01-02'),status:'completed',isCompleted:true},C:{...defaults,id:'C',userId:'owner',visitDate:new Date('2099-01-03'),status:'cancelled',isCompleted:false}}),api=route(app,'visits');
 for(const [status,id] of [['active','A'],['completed','B'],['cancelled','C']]){const body=await(await api.GET(request(`/visits?userId=owner&status=${status}`,'owner'))).json();assert.deepEqual(body.visits.map(v=>v.id),[id]);}
 assert.equal((await api.GET(request('/visits?userId=owner',null))).status,401);assert.equal((await api.GET(request('/visits?userId=owner','expired-token'))).status,401);app.claims.owner={email_verified:false};const denied=await api.GET(request('/visits?userId=owner','owner'));assert.equal(denied.status,403);assert.equal((await denied.json()).code,'EMAIL_VERIFICATION_REQUIRED');
});

test('creation rejects past dates and persists a valid property-linked future visit',async()=>{
 const app=setup(),api=route(app,'visits'),past=new Date(Date.now()-60000).toISOString();assert.equal((await api.POST(request('/visits','other','POST',{title:'Past',propertyId:'P',visitDate:past,reminderType:'email',reminderTime:15}))).status,400);
 const response=await api.POST(request('/visits','other','POST',{title:'Fictional viewing',propertyId:'P',visitDate:future,reminderType:'none',reminderTime:5}));assert.equal(response.status,201);const {visit}=await response.json();assert.equal(visit.userId,'other');assert.equal(visit.propertyId,'P');assert.equal(visit.status,'scheduled');assert.equal(visit.managementVersion,0);assert.equal(visit.reminderType,'email');assert.equal(visit.reminderTime,30);assert.equal(Object.values(app.state.email_deliveries).filter(row=>row.eventType==='visit.scheduled').length,3);
});

test('general visits remain valid and notify only requester and configured administrator',async()=>{
 const app=setup(),response=await route(app,'visits').POST(request('/visits','other','POST',{title:'General consultation',visitDate:future}));assert.equal(response.status,201);const {visit}=await response.json();assert.equal(visit.propertyId,undefined);assert.equal(visit.reminderTime,30);
 const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='visit.scheduled');assert.equal(rows.length,2);assert.deepEqual(new Set(rows.map(row=>row.recipientRole)),new Set(['requester','admin']));assert.ok(!rows.some(row=>row.recipientRole==='owner'));
 assert.equal(app.emails.length,2);assert.deepEqual(new Set(app.emails.map(mail=>mail.to[0])),new Set(['other@test.invalid','admin@test.invalid']));assert.ok(app.emailKeys.every(Boolean));assert.ok(rows.every(row=>row.status==='sent'&&row.providerMessageId==='mock-resend-message'&&row.retryCount===1));
 const alerts=Object.values(app.state.admin_notifications||{}).filter(row=>row.type==='visit_update');assert.equal(alerts.length,1);assert.equal(alerts[0].relatedId,visit.id);assert.equal(alerts[0].userId,'other');assert.equal(alerts[0].userEmail,'other@test.invalid');
});

test('provider failure leaves durable failed deliveries and does not undo the scheduled visit',async()=>{
 const app=setup();app.env.TEST_MAIL_FAIL='1';const response=await route(app,'visits').POST(request('/visits','other','POST',{title:'Provider outage visit',visitDate:future}));assert.equal(response.status,201);const {visit}=await response.json();assert.ok(app.state.visits[visit.id]);
 const rows=Object.values(app.state.email_deliveries).filter(row=>row.recordId===visit.id);assert.equal(rows.length,2);assert.equal(app.emails.length,2);assert.ok(rows.every(row=>row.status==='failed'&&row.retryCount===1&&row.errorSummary==='Email provider delivery failed'));
});

test('visit scheduling fails before persistence when administrator email is missing or invalid',async()=>{
 for(const value of ['', 'not-an-email']){const app=setup();app.env.ADMIN_EMAIL=value;const response=await route(app,'visits').POST(request('/visits','other','POST',{title:'General consultation',visitDate:future}));assert.equal(response.status,503);assert.match((await response.json()).message,/ADMIN_EMAIL/);assert.equal(Object.keys(app.state.visits||{}).length,0);assert.equal(Object.keys(app.state.email_deliveries||{}).length,0);}
});

test('unapproved and malicious property references are rejected without creating a visit or email',async()=>{
 const app=setup();app.state.properties.P.moderationStatus='pending_review';const api=route(app,'visits');
 for(const propertyId of ['P','missing','../owner'])assert.equal((await api.POST(request('/visits','other','POST',{title:'Invalid property',propertyId,visitDate:future}))).status,404);
 assert.equal(Object.keys(app.state.visits||{}).length,0);assert.equal(Object.keys(app.state.email_deliveries||{}).length,0);
});

test('overlapping requester, owner and administrator addresses receive one delivery',async()=>{
 const app=setup();app.state.users.owner.email='admin@test.invalid';app.state.properties.P.ownerUID='owner';
 const response=await route(app,'visits').POST(request('/visits','owner','POST',{title:'Own listing visit',propertyId:'P',visitDate:future}));assert.equal(response.status,201);
 const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='visit.scheduled');assert.equal(rows.length,1);assert.equal(rows[0].recipientUID,'owner');
});

test('requester reschedules and completes with versioned responses, reminder invalidation and terminal transitions',async()=>{
 const app=setup({V:{...defaults,id:'V',userId:'owner',propertyId:'P',title:'Viewing',visitDate:new Date(future),status:'scheduled',isCompleted:false,reminderType:'email',reminderTime:15,managementVersion:0,notifiedAt:new Date(),reminderDelivery:{generation:'old',status:'sent'}}}),detail=route(app,'visits/[id]');
 let response=await detail.PUT(request('/visits/V','owner','PUT',{visitDate:'2099-06-16T10:00:00Z',status:'scheduled',isCompleted:false,expectedVersion:0}),context('V'));assert.equal(response.status,200);let visit=(await response.json()).visit;assert.equal(visit.userId,'owner');assert.equal(visit.managementVersion,1);
 assert.equal(app.state.visits.V.notifiedAt,null);assert.equal(app.state.visits.V.reminderDelivery,null);
 response=await detail.PUT(request('/visits/V','owner','PUT',{status:'completed',isCompleted:true,expectedVersion:1}),context('V'));assert.equal(response.status,200);visit=(await response.json()).visit;assert.equal(visit.status,'completed');assert.equal(visit.managementVersion,2);
 response=await detail.PUT(request('/visits/V','owner','PUT',{status:'cancelled',isCompleted:false,expectedVersion:2}),context('V'));assert.equal(response.status,409);assert.equal(app.state.visits.V.status,'completed');
});

test('scheduled visit cancellation succeeds and terminal visits cannot be rescheduled',async()=>{
 const app=setup({V:{...defaults,id:'V',userId:'owner',title:'Viewing',visitDate:new Date(future),status:'scheduled',isCompleted:false,reminderType:'email',reminderTime:30,managementVersion:0}}),detail=route(app,'visits/[id]');
 let response=await detail.PUT(request('/visits/V','owner','PUT',{status:'cancelled',isCompleted:false,expectedVersion:0}),context('V'));assert.equal(response.status,200);assert.equal((await response.json()).visit.status,'cancelled');
 response=await detail.PUT(request('/visits/V','owner','PUT',{visitDate:'2099-06-17T10:00:00Z',status:'scheduled',isCompleted:false,expectedVersion:1}),context('V'));assert.equal(response.status,409);
});

test('notification persistence outage never changes a committed visit response into an operation failure',async()=>{
 const app=setup(),api=route(app,'visits');app.env.TEST_DB_WRITE_COLLECTION='email_deliveries';let response=await api.POST(request('/visits','other','POST',{title:'Durable operation',visitDate:future}));assert.equal(response.status,201);const created=(await response.json()).visit;assert.ok(app.state.visits[created.id]);
 const detail=route(app,'visits/[id]');response=await detail.PUT(request(`/visits/${created.id}`,'other','PUT',{status:'completed',isCompleted:true,expectedVersion:0}),context(created.id));assert.equal(response.status,200);assert.equal(app.state.visits[created.id].status,'completed');
});

test('admin updates retain requester; owners and unrelated users cannot read or modify another request',async()=>{
 const app=setup({V:{...defaults,id:'V',userId:'tenant',propertyId:'P',title:'Tenant visit',visitDate:new Date(future),status:'scheduled',isCompleted:false,reminderType:'email',reminderTime:15,managementVersion:0}}),detail=route(app,'visits/[id]');
 assert.equal((await detail.GET(request('/visits/V','owner'),context('V'))).status,403);assert.equal((await detail.PUT(request('/visits/V','other','PUT',{status:'cancelled'}),context('V'))).status,403);
 const updated=await detail.PUT(request('/visits/V','admin','PUT',{status:'cancelled',isCompleted:false,expectedVersion:0}),context('V'));assert.equal(updated.status,200);assert.equal((await updated.json()).visit.userId,'tenant');assert.equal(app.state.visits.V.userId,'tenant');assert.equal(app.state.visits.V.visitAdminHistory[0].actorUID,'admin');
});

test('concurrent changes create one status notification and cancelled visits are reminder-ineligible',async()=>{
 const app=setup({V:{...defaults,id:'V',userId:'tenant',propertyId:'P',title:'Viewing',visitDate:new Date(future),status:'scheduled',isCompleted:false,reminderType:'email',reminderTime:15,managementVersion:0}}),detail=route(app,'visits/[id]');
 const replies=await Promise.all([detail.PUT(request('/visits/V','tenant','PUT',{status:'cancelled',isCompleted:false,expectedVersion:0}),context('V')),detail.PUT(request('/visits/V','tenant','PUT',{status:'completed',isCompleted:true,expectedVersion:0}),context('V'))]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
 const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType.startsWith('visit.')&&row.eventType!=='visit.scheduled');assert.equal(rows.length,3);assert.equal(new Set(rows.map(row=>row.eventId)).size,3);
 const reminders=app.load('@/lib/server/services/reminders');assert.equal(reminders.dueReminder(app.state.visits.V,Date.parse('2099-06-15T09:45:00Z')),false);
});
