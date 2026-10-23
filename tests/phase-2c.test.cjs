const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');
function verification(){const app=isolated({users:{...users,agent:{...users.other,uid:'agent',role:'agent'}},properties:{P:{...properties.P,createdAs:'tenant',submittedByUID:'tenant',ownerUID:'',ownershipVerification:'pending',reportedOwner:{personName:'Reported owner'}}},documents:{D:{id:'D',propertyId:'P',status:'submitted'}},tenants:{T:{id:'T',propertyId:'P',userUID:'tenant',ownerUID:'',isActive:true}}});app.claims.owner={emailVerified:true};return app;}
const decide=(app,body,uid='admin')=>route(app,'owner-verification').POST(request('/owner-verification',uid,'POST',{propertyId:'P',...body}));
const approval={ownerUID:'owner',evidenceDocumentId:'D',reviewNote:'Independent ownership check'};

test('rejection requires persisted admin, mandatory reason and matching version without ownership/tenant mutation',async()=>{
 const app=verification(),before=JSON.stringify(app.state.properties.P.tenants),records=JSON.stringify(app.state.tenants);
 for(const uid of [null,'tenant','owner','agent'])assert.equal((await decide(app,{action:'reject',expectedVersion:0,reason:'Mismatch'},uid)).status,uid?403:401);
 for(const reason of ['', '  ',9,'x'.repeat(2001)])assert.equal((await decide(app,{action:'reject',expectedVersion:0,reason})).status,400);
 assert.equal((await decide(app,{action:'reject',reason:'Missing version'})).status,400);assert.equal((await decide(app,{action:'reject',expectedVersion:1,reason:'Stale'})).status,409);assert.equal(app.writes.length,0);
 assert.equal((await decide(app,{action:'reject',expectedVersion:0,reason:'  Evidence does not identify the owner  '})).status,200);
 const p=app.state.properties.P;assert.equal(p.ownershipVerification,'rejected');assert.equal(p.ownershipVerificationReason,'Evidence does not identify the owner');assert.equal(p.ownershipVerificationReviewerUID,'admin');assert.ok(p.ownershipVerificationReviewedAt instanceof Date);assert.equal(p.ownerUID,'');assert.equal(JSON.stringify(p.tenants),before);assert.equal(JSON.stringify(app.state.tenants),records);assert.equal(p.ownershipVerificationHistory[0].actorUID,'admin');
 const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='owner_verification.reject');assert.equal(rows.length,2);assert.deepEqual(new Set(rows.map(row=>row.recipientUID)),new Set(['tenant','admin']));assert.ok(rows.every(row=>row.html.includes('Evidence does not identify the owner')));
});

test('reconsideration is explicit, versioned and auditable; reopening never links an owner',async()=>{
 const app=verification();await decide(app,{action:'reject',expectedVersion:0,reason:'Ownership mismatch'});
 assert.equal((await decide(app,approval)).status,409);assert.equal((await decide(app,{...approval,expectedVersion:1})).status,409);
 assert.equal((await decide(app,{action:'reconsider',expectedVersion:0,reason:'New evidence'})).status,409);
 assert.equal((await decide(app,{action:'reconsider',expectedVersion:1,reason:'New evidence available'})).status,200);
 const reconsider=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='owner_verification.reconsider');assert.equal(reconsider.length,2);assert.deepEqual(new Set(reconsider.map(row=>row.recipientUID)),new Set(['tenant','admin']));
 let p=app.state.properties.P;assert.equal(p.ownerUID,'');assert.equal(p.ownershipVerification,'pending');assert.equal(p.ownershipVerificationHistory.length,2);assert.equal(p.ownershipVerificationHistory[1].action,'reconsider');assert.equal(p.ownershipVerificationHistory[1].reason,'New evidence available');
 assert.equal((await decide(app,approval)).status,409);assert.equal((await decide(app,{...approval,expectedVersion:2})).status,200);
 p=app.state.properties.P;assert.equal(p.ownershipVerification,'verified');assert.equal(p.ownerUID,'owner');assert.equal(p.ownershipVerificationAudit.evidenceDocumentId,'D');assert.equal(p.ownershipVerificationHistory.length,3);assert.equal(app.state.tenants.T.userUID,'tenant');assert.equal(app.state.tenants.T.ownerUID,'owner');
 assert.equal((await decide(app,{action:'reconsider',expectedVersion:3})).status,409);assert.equal((await decide(app,{action:'reject',expectedVersion:3,reason:'Cannot unlink'})).status,409);
});

test('concurrent approve/reject decisions cannot overwrite ownership or decision history',async()=>{
 const app=verification(),results=await Promise.all([decide(app,{...approval,expectedVersion:0}),decide(app,{action:'reject',expectedVersion:0,reason:'Conflicting review'})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(app.state.properties.P.ownershipVerificationVersion,1);assert.equal(app.state.properties.P.ownershipVerificationHistory.length,1);
 if(app.state.properties.P.ownershipVerification==='rejected')assert.equal(app.state.properties.P.ownerUID,'');else assert.equal(app.state.tenants.T.ownerUID,'owner');
});

test('reconsideration retains same-property evidence, verified identity and tenant-owner restrictions',async()=>{
 const app=verification();await decide(app,{action:'reject',expectedVersion:0,reason:'Review needed'});await decide(app,{action:'reconsider',expectedVersion:1});
 app.claims.owner.emailVerified=false;assert.equal((await decide(app,{...approval,expectedVersion:2})).status,400);app.claims.owner.emailVerified=true;
 app.state.documents.D.propertyId='OTHER';assert.equal((await decide(app,{...approval,expectedVersion:2})).status,400);app.state.documents.D.propertyId='P';app.state.documents.D.status='rejected';assert.equal((await decide(app,{...approval,expectedVersion:2})).status,400);app.state.documents.D.status='submitted';app.state.documents.D.deletionStatus='pending';assert.equal((await decide(app,{...approval,expectedVersion:2})).status,400);delete app.state.documents.D.deletionStatus;
 app.claims.tenant={emailVerified:true};assert.equal((await decide(app,{...approval,ownerUID:'tenant',expectedVersion:2})).status,400);assert.equal(app.state.properties.P.ownerUID,'');assert.equal(app.state.properties.P.ownershipVerificationHistory.length,2);
});

test('rejection reason is visible to submitting tenant/admin while private records and reviewer history stay protected',async()=>{
 const app=verification();await decide(app,{action:'reject',expectedVersion:0,reason:'Tenant-visible reason'});const api=route(app,'properties/[id]');
 const tenant=await(await api.GET(request('/properties/P','tenant'),context('P'))).json();assert.equal(tenant.property.ownershipVerificationReason,'Tenant-visible reason');assert.ok(!('ownershipVerificationHistory' in tenant.property));
 const admin=await(await api.GET(request('/properties/P','admin'),context('P'))).json();assert.equal(admin.property.ownershipVerificationHistory[0].actorUID,'admin');
 for(const uid of [null,'other','agent'])assert.equal((await api.GET(request('/properties/P',uid),context('P'))).status,404);
 assert.equal((await route(app,'properties').GET(request('/properties?ownerUID=tenant','other'))).status,403);
});

function visits(){return isolated({users:{...users,agent:{...users.other,uid:'agent',role:'agent'}},properties,visits:{V:{...defaults,id:'V',userId:'tenant',propertyId:'P',title:'Tenant visit',visitDate:new Date('2030-01-01T20:00:00Z'),status:'scheduled',isCompleted:false,reminderType:'email',reminderTime:15,notifiedAt:'2030-01-01T19:00:00Z'},W:{...defaults,id:'W',userId:'owner',title:'Other visit',visitDate:new Date('2030-01-02T10:00:00Z'),status:'completed',isCompleted:true},X:{...defaults,id:'X',userId:'other',propertyId:'P',title:'Cancelled visit',visitDate:new Date('2030-01-03T10:00:00Z'),status:'cancelled',isCompleted:false}}});}
const all=(app,url='/admin/visits',uid='admin')=>route(app,'admin/visits').GET(request(url,uid));
const change=(app,body,uid='admin',id='V')=>route(app,'visits/[id]').PUT(request('/visits/'+id,uid,'PUT',body),context(id));

test('new visit notifies only its requester and listing owner through email and the admin website inbox',async()=>{const app=visits();app.state.properties.P.moderationStatus='approved';app.state.properties.P.rentalStatus='available';app.state.properties.P.tenants=[];const response=await route(app,'visits').POST(request('/visits','other','POST',{propertyId:'P',title:'Viewing',visitDate:'2031-01-01T10:00:00Z',reminderType:'none'}));assert.equal(response.status,201);const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='visit.scheduled');assert.equal(rows.length,2);assert.deepEqual(new Set(rows.map(row=>row.recipientUID)),new Set(['other','owner']));assert.ok(rows.every(row=>row.html.includes('Existing Home')));const website=Object.values(app.state.admin_notifications).filter(row=>row.type==='visit_update');assert.equal(website.length,1);assert.equal(website[0].userId,'other');});

test('all-visits and contact/property context are persisted-admin only; ordinary users retain requester-only scope',async()=>{
 const app=visits();for(const uid of [null,'owner','tenant','other','agent'])assert.equal((await all(app,'/admin/visits',uid)).status,uid?403:401);
 const result=await(await all(app)).json();assert.equal(result.visits.length,3);const row=result.visits.find(v=>v.id==='V');assert.equal(row.requester.name,'Tenant');assert.equal(row.requester.phone,'456');assert.equal(row.property.id,'P');assert.equal(row.managementVersion,0);
 const own=await(await route(app,'visits').GET(request('/visits?userId=tenant','tenant'))).json();assert.equal(own.visits.length,1);assert.equal(own.visits[0].id,'V');assert.ok(!('requester' in own.visits[0]));
 assert.equal((await route(app,'visits').GET(request('/visits?userId=owner','tenant'))).status,403);assert.equal((await route(app,'visits/[id]').GET(request('/visits/W','tenant'),context('W'))).status,403);
 assert.equal(app.writes.length,0);
});

test('admin filters visits by status, inclusive IST date range and property, validating malformed filters',async()=>{
 const app=visits();for(const [url,ids] of [['/admin/visits?status=scheduled',['V']],['/admin/visits?status=cancelled',['X']],['/admin/visits?dateFrom=2030-01-02&dateTo=2030-01-02',['V','W']],['/admin/visits?propertyId=P',['V','X']],['/admin/visits?propertyId=P&dateTo=2030-01-02&status=scheduled',['V']]]){const r=await all(app,url);assert.equal(r.status,200);assert.deepEqual((await r.json()).visits.map(v=>v.id),ids);}
 for(const url of ['/admin/visits?status=won','/admin/visits?dateFrom=2030-02-30','/admin/visits?dateFrom=2030-01-03&dateTo=2030-01-01','/admin/visits?propertyId=A/B'])assert.equal((await all(app,url)).status,400);
});

test('admin status changes use existing states, preserve cancellation/reminder fields, and record identity/time',async()=>{
 const app=visits();assert.equal((await change(app,{status:'cancelled',expectedVersion:0})).status,200);let v=app.state.visits.V;assert.equal(v.status,'cancelled');assert.equal(v.isCompleted,false);assert.equal(v.notifiedAt,'2030-01-01T19:00:00Z');assert.equal(v.reminderType,'email');assert.equal(v.visitAdminHistory[0].actorUID,'admin');assert.ok(v.visitAdminHistory[0].at instanceof Date);
 const deliveries=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='visit.cancelled');assert.equal(deliveries.length,2);assert.deepEqual(new Set(deliveries.map(row=>row.recipientUID)),new Set(['tenant','owner']));assert.ok(deliveries.every(row=>row.html.includes('Existing Home')));
 assert.equal((await change(app,{status:'scheduled',expectedVersion:1})).status,200);assert.equal((await change(app,{status:'completed',expectedVersion:2})).status,200);v=app.state.visits.V;assert.equal(v.isCompleted,true);assert.equal(v.visitAdminHistory.length,3);
 const rescheduled=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='visit.scheduled'),completed=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='visit.completed');assert.equal(rescheduled.length,2);assert.equal(completed.length,2);assert.ok([...rescheduled,...completed].every(row=>['tenant','owner'].includes(row.recipientUID)));
 assert.equal((await change(app,{status:'invalid',expectedVersion:3})).status,400);assert.equal((await change(app,{status:'cancelled',isCompleted:true,expectedVersion:3})).status,400);assert.equal((await change(app,{visitAdminHistory:[]})).status,400);
 const own=await(await route(app,'visits/[id]').GET(request('/visits/V','tenant'),context('V'))).json();assert.equal(own.visit.status,'completed');assert.ok(!('visitAdminHistory' in own.visit));
});

test('stale/concurrent admin visit changes conflict and cannot overwrite requester edits or erase admin history',async()=>{
 const app=visits(),replies=await Promise.all([change(app,{status:'completed',expectedVersion:0}),change(app,{status:'cancelled',expectedVersion:0})]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);assert.equal(app.state.visits.V.visitAdminHistory.length,1);
 assert.equal((await change(app,{title:'Requester renamed visit'},'tenant')).status,200);assert.equal((await change(app,{status:'scheduled',expectedVersion:1})).status,409);assert.equal(app.state.visits.V.title,'Requester renamed visit');assert.equal(app.state.visits.V.visitAdminHistory.length,1);
 assert.equal((await change(app,{status:'scheduled'},'owner')).status,403);assert.equal((await change(app,{status:'scheduled'},'agent')).status,403);
});
