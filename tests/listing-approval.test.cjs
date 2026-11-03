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

test('legacy listings require approval; content edits require another review',async()=>{
 const app=setup();assert.equal((await read(app,'P')).status,404);assert.ok(!('moderationStatus' in app.state.properties.P));assert.equal(app.writes.length,0);
 assert.equal((await patch(app,'P','owner',{title:'Review Updated legacy home'})).status,200);assert.equal(app.state.properties.P.moderationStatus,'pending_review');await hidden(app,'P');
});

test('archival and restoration preserve approval and do not bypass pending moderation',async()=>{
 const app=setup(),p=await submit(app);await decision(app,p.id,'approve');const count=app.state.properties[p.id].moderationHistory.length;
 await patch(app,p.id,'owner',{status:'inactive'});assert.equal((await read(app,p.id)).status,404);
 await patch(app,p.id,'owner',{status:'active'});assert.equal((await read(app,p.id)).status,200);assert.equal(app.state.properties[p.id].moderationHistory.length,count);
 await patch(app,p.id,'owner',{title:'Review Edited approved home'});await patch(app,p.id,'owner',{isActive:false});await patch(app,p.id,'owner',{isActive:true});await hidden(app,p.id);
 assert.equal((await patch(app,p.id,'other',{status:'active'})).status,403);
});

test('tenant supplied records remain private and also support admin review',async()=>{
 const app=setup();const response=await route(app,'properties').POST(request('/properties','tenant','POST',{createdAs:'tenant',propertyTitle:'Private tenancy',propertyType:'residential',location:'Private address',reportedOwner:{personName:'Reported owner',phone:'123456'},monthlyRent:'20000',paymentDueDate:'5',agreementPeriod:'12 months',agreementStartDate:'2026-01-01',agreementEndDate:'2027-01-01'}));assert.equal(response.status,200,await response.clone().text());const p=(await response.json()).property;
 assert.equal(p.ownershipVerification,'pending');assert.equal(app.state.properties[p.id].moderationStatus,'pending_review');await hidden(app,p.id);
 assert.equal((await decision(app,p.id,'approve')).status,200);await hidden(app,p.id);
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
 assert.equal((await route(app,'visits').POST(request('/visits','other','POST',{propertyId:p.id,title:'Visit',visitDate:'2027-01-01T10:00:00Z',reminderType:'none'}))).status,404);
 assert.equal((await route(app,'admin/notifications').POST(request('/admin/notifications','other','POST',{type:'property_enquiry',propertyId:p.id}))).status,403);
});

test('unknown moderation states fail closed even on all=true lists',async()=>{
 const app=setup();app.state.properties.P.moderationStatus=null;await hidden(app,'P');
});


test('submission atomically queues both emails and concurrent resubmission deduplicates',async()=>{
 const app=setup();app.env.ADMIN_EMAIL='admin@test.invalid';app.env.APP_URL='https://propbank.test';
 const [first,second]=await Promise.all([submit(app),submit(app)]);assert.equal(first.id,second.id);
 assert.equal(Object.values(app.state.properties).filter(p=>p.title==='Review Home').length,1);
 const rows=Object.values(app.state.email_deliveries);assert.equal(rows.length,2);
 assert.ok(rows.every(row=>row.status==='pending'));assert.equal(app.emails.length,0);
 assert.ok(rows.some(row=>row.recipientEmail==='owner@test.invalid'&&row.text.includes(first.id)&&row.text.includes('pending review')));
 assert.ok(rows.some(row=>row.recipientEmail==='admin@test.invalid'&&row.text.includes('/admin?tab=properties&propertyId=')&&row.text.includes('owner@test.invalid')));
 const adminEmail=rows.find(row=>row.recipientRole==='admin');
 assert.equal(adminEmail.subject,'PropBank \u2013 New Property Submitted for Review');
 for(const value of ['Review Home',first.id,'Location: Isolated address','Owner name: Owner','Owner email: owner@test.invalid','Status: Pending Review','Submission date:','https://propbank.test/admin?tab=properties&propertyId='+first.id])assert.ok(adminEmail.text.includes(value),value);
 assert.match(adminEmail.html,/Review property/);
 assert.equal(rows.find(row=>row.recipientRole==='owner').subject,'Property submitted - Pending Review');
 await app.flush();assert.equal(app.emails.length,2);assert.ok(Object.values(app.state.email_deliveries).every(row=>row.status==='sent'));
 await submit(app);await app.flush();assert.equal(app.emails.length,2);
 const adminList=await(await route(app,'properties').GET(request('/properties?admin=true','admin'))).json();assert.ok(adminList.properties.some(p=>p.id===first.id&&p.moderationStatus==='pending_review'));
});

test('review notification contains reason and stale decisions cannot duplicate it',async()=>{
 const app=setup(),p=await submit(app);app.env.ADMIN_EMAIL='admin@test.invalid';
 assert.equal((await decision(app,p.id,'reject','Correct the address')).status,200);
 assert.equal((await decision(app,p.id,'reject','Correct the address')).status,409);
 const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='property.rejected');
 assert.equal(rows.length,1);assert.match(rows[0].text,/Correct the address/);assert.equal(rows[0].recipientEmail,'owner@test.invalid');
});

test('provider failure preserves saved property and admin can retry without duplicate successful sends',async()=>{
 const app=setup();app.env.ADMIN_EMAIL='admin@test.invalid';app.env.TEST_MAIL_FAIL='1';const p=await submit(app);await app.flush();
 assert.ok(app.state.properties[p.id]);const rows=Object.values(app.state.email_deliveries);assert.ok(rows.every(row=>row.status==='failed'));
 delete app.env.TEST_MAIL_FAIL;const email=app.load('@/lib/server/services/transactional-email');
 for(const row of rows)assert.equal((await email.retryEmailDelivery(request('/admin/email-deliveries/'+row.id+'/retry','admin','POST',{}),row.id)).status,200);
 await app.flush();assert.ok(Object.values(app.state.email_deliveries).every(row=>row.status==='sent'));
 await assert.rejects(()=>email.retryEmailDelivery(request('/retry','admin','POST',{}),rows[0].id),error=>error.status===409);
});


test('outbox write failure rolls back property and sends no notifications',async()=>{
 const app=setup();app.env.TEST_DB_WRITE_COLLECTION='email_deliveries';
 const response=await route(app,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Rollback Home',propertyType:'residential',location:'Address',ownerUID:'owner',listingType:'sell'}));
 assert.equal(response.status,500);assert.ok(!Object.values(app.state.properties).some(p=>p.title==='Rollback Home'));
 await app.flush();assert.equal(app.emails.length,0);assert.equal(Object.keys(app.state.property_submissions||{}).length,0);
});


test('admin directory includes every moderation state and archived records with review fields',async()=>{
 const app=setup();
 const states=['pending_review','approved','rejected','changes_requested'];
 for(const [index,status] of states.entries())app.state.properties['STATE'+index]={...properties.P,id:'STATE'+index,title:'State '+status,moderationStatus:status,status:index===2?'inactive':'active',isActive:index!==2};
 const response=await route(app,'properties').GET(request('/properties?admin=true','admin'));
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.count,Object.keys(app.state.properties).length);
 for(const [index,status] of states.entries()){
  const row=body.properties.find(property=>property.id==='STATE'+index);assert.ok(row);
  assert.equal(row.moderationStatus,status);assert.equal(row.ownerName,'Owner');assert.equal(row.ownerEmail,'owner@test.invalid');assert.ok(row.title);assert.ok(row.createdAt);
  assert.equal(body.properties.filter(property=>property.moderationStatus===status).length,1);
 }
 for(const uid of [undefined,'owner','tenant'])assert.equal((await route(app,'properties').GET(request('/properties?admin=true',uid))).status,uid?403:401);
});

test('approval and change requests queue owner notifications with the resulting status',async()=>{
 for(const [action,status] of [['approve','approved'],['request_changes','changes_requested']]){
  const app=setup(),property=await submit(app);
  assert.equal((await decision(app,property.id,action,action==='approve'?'':'Supply clearer photos')).status,200);
  const rows=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='property.'+status);
  assert.equal(rows.length,1);assert.equal(rows[0].recipientEmail,'owner@test.invalid');assert.ok(rows[0].text.includes(property.id));
  if(action==='request_changes')assert.match(rows[0].text,/Supply clearer photos/);
 }
});


test('submission distinguishes malformed JSON from invalid property fields and always returns JSON',async()=>{
 const app=setup();
 for(const [body,message] of [
  ['{"propertyTitle":','Invalid JSON request body'],
  [JSON.stringify({propertyTitle:'Invalid day',propertyType:'residential',location:'Address',ownerUID:'owner',listingType:'rent',paymentDueDate:'32'}),'Invalid property data: Invalid payment due day'],
  [JSON.stringify({propertyTitle:'Invalid type',propertyType:'residential',location:'Address',ownerUID:'owner',listingType:'rent',monthlyRent:123}),'Invalid property data:'],
 ]){
  const response=await route(app,'properties').POST(request('/properties','owner','POST',body));
  assert.equal(response.status,400);assert.match(response.headers.get('content-type'),/application\/json/);
  const result=await response.json();assert.equal(result.success,false);assert.ok(result.message.startsWith(message),result.message);
 }
 assert.equal(Object.keys(app.state.properties).length,1);await app.flush();assert.equal(app.emails.length,0);
});

test('property route errors preserve JSON and HTTP status for missing records, auth, paths, methods and failures',async()=>{
 const app=setup();
 const responses=[
  [await route(app,'properties').POST(request('/properties',undefined,'POST',{})),401],
  [await route(app,'properties').GET(request('/properties?admin=true','owner')),403],
  [await read(app,'MISSING','admin'),404],
  [await route(app,'properties').DELETE(request('/properties','admin','DELETE')),405],
  [await route(app,'properties').GET(request('/properties/','admin')),400],
  [await patch(app,'P','owner','{"title":'),400],
 ];
 app.outage();responses.push([await route(app,'properties').GET(request('/properties?admin=true','admin')),500]);
 for(const [response,status] of responses){assert.equal(response.status,status);assert.match(response.headers.get('content-type'),/application\/json/);const result=await response.json();assert.equal(result.success,false);assert.equal(typeof result.message,'string');}
});

test('submission frontend safely handles JSON, plain text, HTML, empty and malformed responses',async()=>{
 const parse=setup().load('@/features/properties/property-response').readPropertyResponse;
 const json=(body,status)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 const ok=await parse(json({success:true,property:{moderationStatus:'pending_review'}},200));assert.equal(ok.property.moderationStatus,'pending_review');
 await assert.rejects(()=>parse(json({success:false,message:'Invalid payment due day'},400)),/Invalid payment due day/);
 await assert.rejects(()=>parse(new Response('Invalid JSON: unexpected EOF',{status:400,headers:{'content-type':'text/plain'}})),/Invalid JSON: unexpected EOF/);
 await assert.rejects(()=>parse(new Response('<html>Gateway failure</html>',{status:502,headers:{'content-type':'text/html'}})),error=>/HTTP 502/.test(error.message)&&!error.message.includes('<html>'));
 await assert.rejects(()=>parse(new Response('',{status:503})),/HTTP 503/);
 await assert.rejects(()=>parse(new Response('Invalid JSON',{status:400,headers:{'content-type':'application/json'}})),/HTTP 400/);
 await assert.rejects(()=>parse(json({success:true},500)),/HTTP 500/);
 for(const value of [null,[],{},'unexpected'])await assert.rejects(()=>parse(json(value,200)),/Invalid property submission response/);
});
