const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');
const brokers={broker:{...users.other,uid:'broker',name:'Test Broker',role:'agent'},broker2:{...users.other,uid:'broker2',name:'Second Broker',role:'agent'}};
const enquiry={...defaults,id:'E',type:'property_enquiry',propertyId:'P',propertyTitle:'Existing Home',userId:'other',userName:'Customer',userEmail:'other@test.invalid',userPhone:'123456',timestamp:new Date(),isRead:false,adminRemarks:'EXISTING_SHARED_RESPONSE',ownerEmail:'OWNER_SECRET',adminImage:'PRIVATE_FILE'};
const setup=()=>isolated({users:{...users,...brokers},properties,admin_notifications:{E:enquiry,H:{...enquiry,id:'H',timestamp:undefined,isRead:true},G:{...enquiry,id:'G',type:'general_inquiry'}}});
const list=(app,uid,url='/enquiries')=>route(app,'enquiries').GET(request(url,uid));
const update=(app,uid,body,id='E')=>route(app,'enquiries/[id]').PATCH(request('/enquiries/'+id,uid,'PATCH',body),context(id));
const assign=(app,brokerUID,version=0,extra={})=>update(app,'admin',{action:'assign',brokerUID,expectedVersion:version,...extra});
const progress=(app,uid,status,version,extra={})=>update(app,uid,{action:'status',status,expectedVersion:version,...extra});

test('admin inbox includes historical archived enquiries without assignment and excludes general notifications',async()=>{
 const app=setup(),r=await list(app,'admin');assert.equal(r.status,200);const body=await r.json();assert.equal(body.enquiries.length,2);assert.ok(body.enquiries.every(e=>e.brokerUID===''&&e.status==='new'&&e.version===0));assert.equal(app.writes.length,0);
 assert.equal((await list(app)).status,401);assert.equal((await list(app,'other')).status,403);assert.equal((await list(app,'owner')).status,403);
});

test('admin assigns only existing active registered agents and records private history without notifications',async()=>{
 const app=setup();
 for(const uid of ['missing','other','owner','admin'])assert.equal((await assign(app,uid)).status,400);
 app.state.users.broker.isActive=false;assert.equal((await assign(app,'broker')).status,400);app.state.users.broker.isActive=true;
 app.claims.broker={disabled:true};assert.equal((await assign(app,'broker')).status,400);delete app.claims.broker.disabled;
 const response=await assign(app,'broker',0,{notes:'PRIVATE_ASSIGNMENT_NOTE'});assert.equal(response.status,200);const e=(await response.json()).enquiry;assert.equal(e.brokerUID,'broker');assert.equal(e.brokerName,'Test Broker');assert.equal(e.version,1);assert.equal(e.history[0].actorUID,'admin');assert.ok(Date.parse(e.history[0].at));assert.equal(e.history[0].notes,'PRIVATE_ASSIGNMENT_NOTE');
 assert.equal(app.state.admin_notifications.E.type,'property_enquiry');assert.equal(app.emails.length,0);assert.ok(app.writes.every(w=>w.collection==='enquiry_assignments'));
});

test('broker inbox is assignment scoped even with forged UID and property filters',async()=>{
 const app=setup();await assign(app,'broker');
 // Assign the second historical record through its own ID.
 assert.equal((await update(app,'admin',{action:'assign',brokerUID:'broker2',expectedVersion:0,notes:'OTHER_BROKER_NOTE'},'H')).status,200);
 const mine=await(await list(app,'broker','/enquiries?brokerUID=broker2&propertyId=P&admin=true')).json();assert.equal(mine.enquiries.length,1);assert.equal(mine.enquiries[0].id,'E');assert.ok(!JSON.stringify(mine).includes('OTHER_BROKER_NOTE'));assert.ok(!JSON.stringify(mine).includes('OWNER_SECRET'));assert.ok(!JSON.stringify(mine).includes('EXISTING_SHARED_RESPONSE'));assert.ok(!JSON.stringify(mine).includes('PRIVATE_FILE'));
 assert.equal((await progress(app,'broker2','contacted',1)).status,403);
});

test('reassignment and unassignment immediately revoke old broker access without resetting progress',async()=>{
 const app=setup();await assign(app,'broker');await progress(app,'broker','contacted',1);
 assert.equal((await assign(app,'broker2',2,{notes:'Reassigned'})).status,200);
 assert.equal((await(await list(app,'broker')).json()).enquiries.length,0);assert.equal((await progress(app,'broker','negotiating',3)).status,403);
 const current=(await(await list(app,'broker2')).json()).enquiries[0];assert.equal(current.status,'contacted');assert.equal(current.history[2].action,'reassigned');assert.equal(current.history[2].previousBrokerUID,'broker');
 assert.equal((await assign(app,'',3)).status,200);assert.equal((await(await list(app,'broker2')).json()).enquiries.length,0);assert.equal((await progress(app,'broker2','closed_won',4)).status,403);
 const admin=(await(await list(app,'admin')).json()).enquiries.find(e=>e.id==='E');assert.equal(admin.status,'contacted');assert.equal(admin.history.at(-1).action,'unassigned');
});

test('assigned brokers track every supported progress state and notes without changing visits or deals',async()=>{
 const app=setup();await assign(app,'broker');let version=1;
 for(const status of ['contacted','visit_scheduled','negotiating','closed_won','closed_lost','new']){
  const r=await progress(app,'broker',status,version++,{notes:'PRIVATE_PROGRESS_'+status});assert.equal(r.status,200);assert.equal((await r.json()).enquiry.status,status);
 }
 const stored=app.state.enquiry_assignments.E;assert.equal(stored.history.length,7);assert.equal(stored.history.at(-1).actorUID,'broker');assert.equal(app.emails.length,0);assert.ok(!app.state.visits);assert.ok(!app.state.negotiations);
});

test('brokers cannot self-assign, reassign, unassign or mutate another brokers enquiry',async()=>{
 const app=setup();
 for(const brokerUID of ['broker','broker2',''])assert.equal((await update(app,'broker',{action:'assign',brokerUID,expectedVersion:0})).status,403);
 await assign(app,'broker2');assert.equal((await progress(app,'broker','contacted',1)).status,403);
 for(const uid of [null,'other','owner','tenant'])assert.equal((await progress(app,uid,'contacted',1)).status,uid?403:401);
 app.state.users.broker2.role='individual';assert.equal((await progress(app,'broker2','contacted',1)).status,403);assert.equal((await list(app,'broker2')).status,403);
});

test('stale/concurrent assignment and progress writes cannot overwrite reassignment',async()=>{
 const app=setup();await assign(app,'broker');
 const replies=await Promise.all([assign(app,'broker2',1),progress(app,'broker','contacted',1)]);
 assert.equal(replies.filter(r=>r.status===200).length,1);assert.ok(replies.some(r=>[403,409].includes(r.status)));
 const current=app.state.enquiry_assignments.E;assert.equal(current.version,2);assert.equal(current.history.length,2);
 assert.equal((await assign(app,'broker2',0)).status,409);assert.equal(app.state.enquiry_assignments.E.version,2);
 if(current.brokerUID==='broker')assert.equal((await assign(app,'broker2',2)).status,200);
 assert.equal((await progress(app,'broker','closed_won',1)).status,403);
});

test('owners/customers cannot retrieve private tracking through notifications, property hub or submission replay',async()=>{
 const app=setup();await assign(app,'broker',0,{notes:'PRIVATE_ASSIGNMENT_SECRET'});await progress(app,'broker','contacted',1,{notes:'PRIVATE_BROKER_SECRET'});
 for(const uid of ['owner','other'])assert.equal((await list(app,uid)).status,403);
 for(const url of ['/admin/notifications?propertyId=P']){
  const response=await route(app,'admin/notifications').GET(request(url,'owner'));assert.equal(response.status,200);const text=await response.text();assert.ok(!text.includes('PRIVATE_ASSIGNMENT_SECRET'));assert.ok(!text.includes('PRIVATE_BROKER_SECRET'));
 }
 const hub=await route(app,'property-hub').GET(request('/property-hub?propertyId=P','owner'));assert.equal(hub.status,200);assert.ok(!(await hub.text()).includes('PRIVATE_BROKER_SECRET'));
 assert.equal((await route(app,'enquiries/[id]').GET(request('/enquiries/E','owner'),context('E'))).status,405);
});

test('invalid status, oversized notes, wrong notification types and mixed payloads fail without writes',async()=>{
 const app=setup();
 for(const body of [{action:'status',status:'not_valid',expectedVersion:0},{action:'status',status:'toString',expectedVersion:0},{action:'status',status:'new'},{action:'status',status:'new',expectedVersion:0,notes:9},{action:'status',status:'new',expectedVersion:0,notes:'x'.repeat(2001)},{action:'status',status:'new',expectedVersion:0,brokerUID:'broker'},{action:'assign',brokerUID:'broker',expectedVersion:0,status:'new'},{action:'assign',brokerUID:'broker',expectedVersion:0,history:[]}])assert.equal((await update(app,'admin',body)).status,400);
 assert.equal((await update(app,'admin',{action:'status',status:'new',expectedVersion:0},'G')).status,404);assert.equal((await update(app,'admin',{action:'status',status:'new',expectedVersion:0},'missing')).status,404);assert.equal(app.writes.length,0);
});

test('existing property/general enquiry intake cannot forge tracking and remains visible in existing notifications',async()=>{
 const app=setup(),api=route(app,'admin/notifications');
 const r=await api.POST(request('/admin/notifications','tenant','POST',{type:'property_enquiry',propertyId:'P',userId:'tenant',brokerUID:'broker',status:'closed_won',notes:'FORGED_PRIVATE',history:[]}));assert.equal(r.status,201);const id=(await r.json()).notification.id;
 assert.ok(!app.state.enquiry_assignments);assert.ok(!JSON.stringify(app.state.admin_notifications[id]).includes('FORGED_PRIVATE'));
 const general=await api.POST(request('/admin/notifications',null,'POST',{type:'general_inquiry',userName:'Guest',userEmail:'guest@test.invalid',userPhone:'1234567890',inquiryType:'rent',propertyType:'residential'}));assert.equal(general.status,201);
 const admin=(await(await list(app,'admin')).json()).enquiries;assert.equal(admin.length,3);assert.ok(admin.some(e=>e.id===id&&e.status==='new'&&e.brokerUID===''));
 assert.equal((await api.GET(request('/admin/notifications','admin'))).status,200);
});

test('notification archival and shared responses cannot overwrite private assignment/version history',async()=>{
 const app=setup();await assign(app,'broker',0,{notes:'KEEP_PRIVATE'});
 assert.equal((await route(app,'admin/notifications/[id]/read').PUT(request('/admin/notifications/E/read','admin','PUT',{}),context('E'))).status,200);
 assert.equal((await route(app,'admin/notifications/[id]/remarks').PUT(request('/admin/notifications/E/remarks','admin','PUT',{remarks:'Shared customer response'}),context('E'))).status,200);
 assert.equal(app.state.enquiry_assignments.E.version,1);assert.equal(app.state.enquiry_assignments.E.history[0].notes,'KEEP_PRIVATE');assert.equal((await(await list(app,'admin')).json()).enquiries.length,2);
});
