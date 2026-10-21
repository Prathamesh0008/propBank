const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const setup=()=>isolated({users:{...users,agent:{...users.other,uid:'agent',role:'agent'}},properties:{P:{...properties.P,tenants:[],rentalStatus:'available'}}});
async function submit(app,extra={}) {
 const response=await route(app,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Review Home',propertyType:'residential',location:'Isolated address',ownerUID:'owner',listingType:'rent',monthlyRent:'70000',...extra}));
 assert.equal(response.status,200,await response.clone().text());return (await response.json()).property;
}
const patch=(app,id,uid,body)=>route(app,'properties/[id]').PATCH(request('/properties/'+id,uid,'PATCH',body),context(id));
const read=(app,id,uid)=>route(app,'properties/[id]').GET(request('/properties/'+id,uid),context(id));
const decision=(app,id,action,reason='',uid='admin',revision=app.state.properties[id].moderationRevision||0)=>patch(app,id,uid,{moderationAction:action,reason,expectedRevision:revision});
async function hidden(app,id){
 for(const [name,url] of [['properties','/properties'],['properties','/properties?all=true'],['properties/search','/properties/search?all=true&q=Review']]){
  const result=await(await route(app,name).GET(request(url))).json();assert.ok(!(result.properties||[]).some(p=>p.id===id));
 }
 for(const uid of [undefined,'other'])assert.equal((await read(app,id,uid)).status,404);
}

test('new owner listings remain pending and private until administrator approval',async()=>{
 const app=setup(),p=await submit(app);assert.equal(p.moderationStatus,'pending_review');assert.equal(app.state.properties[p.id].moderationRevision,1);await hidden(app,p.id);
 const mine=await(await route(app,'properties').GET(request('/properties?ownerUID=owner','owner'))).json();assert.equal(mine.properties.find(v=>v.id===p.id).moderationStatus,'pending_review');
 assert.equal((await read(app,p.id,'admin')).status,200);assert.equal((await decision(app,p.id,'approve')).status,200);
 assert.equal((await read(app,p.id)).status,200);const listing=await(await route(app,'properties/search').GET(request('/properties/search?q=Review'))).json();assert.equal(listing.count,1);
 const stored=app.state.properties[p.id];assert.equal(stored.moderationReviewerUID,'admin');assert.ok(stored.moderationReviewedAt instanceof Date);assert.equal(stored.moderationHistory.length,2);assert.equal(stored.moderationHistory[1].action,'approve');
 const publicBody=await(await read(app,p.id)).json();assert.ok(!('moderationHistory' in publicBody.property));
});

test('rejection/change requests require reasons and owner edits resubmit while preserving history',async()=>{
 for(const action of ['reject','request_changes']){
  const app=setup(),p=await submit(app);assert.equal((await decision(app,p.id,action,'  ')).status,400);assert.equal(app.state.properties[p.id].moderationStatus,'pending_review');
  assert.equal((await decision(app,p.id,action,'Please correct the address')).status,200);await hidden(app,p.id);
  const mine=await(await read(app,p.id,'owner')).json();assert.equal(mine.property.moderationReason,'Please correct the address');
  assert.equal((await patch(app,p.id,'owner',{address:'Corrected address'})).status,200);assert.equal(app.state.properties[p.id].moderationStatus,'pending_review');assert.equal(app.state.properties[p.id].moderationHistory.length,3);await hidden(app,p.id);
  assert.equal((await decision(app,p.id,'approve')).status,200);assert.equal((await read(app,p.id)).status,200);
 }
});

test('owner can explicitly resubmit unchanged rejected listings, but not self-approve',async()=>{
 const app=setup(),p=await submit(app);assert.equal((await decision(app,p.id,'reject','Clarify details')).status,200);
 assert.equal((await decision(app,p.id,'approve','','owner')).status,403);assert.equal((await decision(app,p.id,'resubmit','','other')).status,403);
 assert.equal((await decision(app,p.id,'resubmit','','owner')).status,200);assert.equal(app.state.properties[p.id].moderationStatus,'pending_review');
 assert.equal((await decision(app,p.id,'resubmit','','owner')).status,409);
});

test('moderation metadata cannot be forged through creation or ordinary edits',async()=>{
 const app=setup();const response=await route(app,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Forgery',propertyType:'residential',location:'Address',ownerUID:'owner',listingType:'sell',moderationStatus:'approved'}));assert.equal(response.status,400);
 const p=await submit(app);
 for(const body of [{moderationStatus:'approved'},{moderationHistory:[]},{moderationRevision:50}])assert.equal((await patch(app,p.id,'owner',body)).status,400);
 for(const uid of [null,'other','tenant','agent'])assert.equal((await decision(app,p.id,'approve','',uid)).status,uid?403:401);
 assert.equal((await patch(app,p.id,'admin',{moderationAction:'approve',expectedRevision:1,title:'Unreviewed change'})).status,400);
});

test('stale and concurrent decisions cannot approve a changed submission',async()=>{
 const app=setup(),p=await submit(app);await patch(app,p.id,'owner',{title:'Review Revised'});
 assert.equal((await decision(app,p.id,'approve','','admin',1)).status,409);
 const responses=await Promise.all([decision(app,p.id,'approve'),decision(app,p.id,'reject','Conflicting decision')]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 assert.equal(app.state.properties[p.id].moderationHistory.length,3);
});

test('legacy publication compatibility is read-only; listing content edits require review',async()=>{
 const app=setup();assert.equal((await read(app,'P')).status,200);assert.ok(!('moderationStatus' in app.state.properties.P));assert.equal(app.writes.length,0);
 assert.equal((await patch(app,'P','owner',{title:'Review Updated legacy home'})).status,200);assert.equal(app.state.properties.P.moderationStatus,'pending_review');await hidden(app,'P');
});

test('archival and restoration preserve approval and do not bypass pending moderation',async()=>{
 const app=setup(),p=await submit(app);await decision(app,p.id,'approve');const count=app.state.properties[p.id].moderationHistory.length;
 await patch(app,p.id,'owner',{status:'inactive'});assert.equal((await read(app,p.id)).status,404);
 await patch(app,p.id,'owner',{status:'active'});assert.equal((await read(app,p.id)).status,200);assert.equal(app.state.properties[p.id].moderationHistory.length,count);
 await patch(app,p.id,'owner',{title:'Review Edited approved home'});await patch(app,p.id,'owner',{isActive:false});await patch(app,p.id,'owner',{isActive:true});await hidden(app,p.id);
 assert.equal((await patch(app,p.id,'other',{status:'active'})).status,403);
});

test('tenant supplied records use owner verification and cannot enter listing moderation',async()=>{
 const app=setup();const response=await route(app,'properties').POST(request('/properties','tenant','POST',{createdAs:'tenant',propertyTitle:'Private tenancy',propertyType:'residential',location:'Private address',reportedOwner:{personName:'Reported owner',phone:'123456'},monthlyRent:'20000',paymentDueDate:'5',agreementPeriod:'12 months',agreementStartDate:'2026-01-01',agreementEndDate:'2027-01-01'}));assert.equal(response.status,200,await response.clone().text());const p=(await response.json()).property;
 assert.equal(p.ownershipVerification,'pending');assert.ok(!('moderationStatus' in app.state.properties[p.id]));await hidden(app,p.id);
 assert.equal((await decision(app,p.id,'approve')).status,400);
});

test('pending listing photos cannot be downloaded anonymously and approval publishes only the cover',async()=>{
 const app=setup(),p=await submit(app,{images:['data:image/png;base64,AQID']});const id=p.images[0].split('/').at(-1),api=route(app,'media/[id]');
 assert.equal((await api.GET(request('/media/'+id),context(id))).status,401);
 assert.equal((await api.GET(request('/media/'+id,'other'),context(id))).status,403);
 await decision(app,p.id,'approve');assert.equal((await api.GET(request('/media/'+id),context(id))).status,200);
 await patch(app,p.id,'owner',{description:'Changed content'});assert.equal((await api.GET(request('/media/'+id),context(id))).status,401);
});

test('pending listings cannot be used to submit unrelated offers, visits or enquiries',async()=>{
 const app=setup(),p=await submit(app);
 assert.equal((await route(app,'negotiations').POST(request('/negotiations','other','POST',{propertyId:p.id,amount:60000}))).status,404);
 assert.equal((await route(app,'visits').POST(request('/visits','other','POST',{propertyId:p.id,title:'Visit',visitDate:'2027-01-01T10:00:00Z',reminderType:'none'}))).status,403);
 assert.equal((await route(app,'admin/notifications').POST(request('/admin/notifications','other','POST',{type:'property_enquiry',propertyId:p.id}))).status,403);
});

test('unknown moderation states fail closed even on all=true lists',async()=>{
 const app=setup();app.state.properties.P.moderationStatus=null;await hidden(app,'P');
});
