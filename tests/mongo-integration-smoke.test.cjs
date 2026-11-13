// Focused integration checks for the production-main merge, not the historical
// 74-test suite or Atlas tests. Every dependency is isolated; no env file loads.
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {isolated,users,properties,request,route}=require('./fixtures/native-server.cjs');
const {memoryMongo}=require('./fixtures/memory-mongo.cjs');
const {prepareHistorical}=require('../scripts/mongo-mobile-history.cjs');
function setup(){
 const mongo=memoryMongo();mongo.db.databaseName='propbank_mobile_sandbox';
 const app=isolated({users,properties,service_requests:{open:{status:'pending',isArchived:false},archived:{status:'in_progress',isArchived:true},closed:{status:'completed',isArchived:false}}},{modules:{[path.resolve('src/lib/server/mongodb.ts')]:{getMobileMongo:async()=>({client:mongo.client,db:mongo.db})}}});
 app.env.PROPBANK_MOBILE_BACKEND='mongodb';app.env.NODE_ENV='production';app.env.TEST_STRICT_TRANSACTIONS='1';
 const policy=app.load('@/lib/server/mongo-mobile-policy');mongo.setIndexes(policy.MOBILE_CLAIM_INDEXES);
 mongo.state.mobile_claims_control.push({_id:'main',status:'active',version:1,policy:policy.MONGO_MOBILE_POLICY,verifiedImport:true,writerIsolationVerified:true,fingerprint:'a'.repeat(64)});
 const plan=prepareHistorical(Object.values(users),[],{enforceAuditedCounts:false});mongo.state.mobile_claims=plan.claims;mongo.state.mobile_accounts=plan.accounts;
 return {app,mongo};
}
function identity(app,uid,provider='password'){app.claims[uid]={email:`${uid}@test.invalid`,email_verified:true,emailVerified:true,providerData:[{providerId:provider}]};}
const register=(app,uid,phone)=>route(app,'auth/user').POST(request('/auth/user',uid,'POST',{uid,email:`${uid}@test.invalid`,name:'Synthetic Local User',role:'individual',phoneNumber:phone}));
for(const provider of ['password','google.com'])test(`${provider}: production-main onboarding selects Mongo without Firestore registry; duplicate is 409`,async()=>{
 const {app,mongo}=setup();identity(app,'newone',provider);identity(app,'newtwo',provider);
 assert.equal((await register(app,'newone','9876543210')).status,200);
 const response=await register(app,'newtwo','+91 (98765) 43210');assert.equal(response.status,409);assert.equal((await response.json()).message,'Number already registered. Use a different number.');
 assert.equal(mongo.state.mobile_claims.find(c=>c.firebaseUID==='newone').status,'owned');
 assert.equal(app.reads.filter(r=>r.collection.startsWith('mobile_number_registry')).length,0);
 assert.equal(app.writes.filter(r=>r.collection.startsWith('mobile_number_registry')).length,0);
 assert.ok(Object.values(app.state.email_deliveries||{}).some(v=>v.kind==='notification_intent'&&v.sourceEventType==='user.registration_welcome'));
});
test('profile phone update retains production notification staging and releases only its old owned claim',async()=>{
 const {app,mongo}=setup(),phone='+919988776655';app.claims.owner={emailVerified:true,email_verified:true,auth_time:Math.floor(Date.now()/1000),phone_number:phone,phoneNumber:phone};
 const response=await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Owner',phoneNumber:phone}));assert.equal(response.status,200);
 assert.equal(app.state.users.owner.phoneNumber,phone);assert.equal(mongo.state.mobile_claims.find(c=>c.normalizedNumber===users.owner.phoneNumber),undefined);
 assert.ok(Object.values(app.state.email_deliveries||{}).some(v=>v.sourceEventType==='user.mobile_number_changed'));
});
test('Firestore/notification partial failure retains reservation and same-UID retry completes exactly one intent',async()=>{
 const {app,mongo}=setup();identity(app,'newone');app.env.TEST_DB_WRITE_COLLECTION='users';
 assert.equal((await register(app,'newone','9876543210')).status,503);
 assert.equal(app.state.users.newone,undefined);assert.equal(mongo.state.mobile_claims.find(c=>c.firebaseUID==='newone').status,'reserved');
 assert.equal(Object.values(app.state.email_deliveries||{}).length,0);delete app.env.TEST_DB_WRITE_COLLECTION;
 assert.equal((await register(app,'newone','9876543210')).status,200);assert.equal((await register(app,'newone','9876543210')).status,200);
 assert.equal(Object.values(app.state.email_deliveries||{}).filter(v=>v.kind==='notification_intent'&&v.sourceEventType==='user.registration_welcome').length,1);
});
test('inactive Mongo fails closed despite a legacy active flag; forged UID is rejected',async()=>{
 const {app,mongo}=setup();identity(app,'newone');app.state.mobile_number_registry_state={main:{status:'active',version:2}};mongo.state.mobile_claims_control[0].status='maintenance';
 assert.equal((await register(app,'newone','9876543210')).status,503);assert.equal(app.state.users.newone,undefined);
 assert.equal((await route(app,'auth/user').POST(request('/auth/user','newone','POST',{uid:'owner',email:users.owner.email,name:'Spoof',phoneNumber:'9876543210'}))).status,403);
});
test('existing login, property API and admin dashboard work with Mongo unavailable',async()=>{
 const {app,mongo}=setup();mongo.faults.read=true;
 assert.equal((await route(app,'auth/login').POST(request('/auth/login','owner','POST',{uid:'owner'}))).status,200);
 assert.equal((await route(app,'properties').GET(request('/properties','owner'))).status,200);
 const dashboard=await route(app,'admin/overview').GET(request('/admin/overview','admin'));assert.equal(dashboard.status,200);assert.equal((await dashboard.json()).openRequests,1);
 assert.equal(app.state.properties.P.title,properties.P.title);
});
test('ordinary profile metadata preserves raw contact and production email intent while Mongo is unavailable',async()=>{
 const {app,mongo}=setup();mongo.faults.read=true;app.state.users.owner.phoneNumber='+91 (91234) 56781';
 assert.equal((await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Updated Owner'}))).status,200);
 assert.equal(app.state.users.owner.phoneNumber,'+91 (91234) 56781');assert.equal(app.state.users.owner.name,'Updated Owner');
 assert.ok(Object.values(app.state.email_deliveries||{}).some(v=>v.sourceEventType==='user.profile_changed'));
});

test('metadata-only writes preserve the current ownership operation marker',async()=>{
 const {app}=setup();app.state.users.owner._mobileClaimOperation='current-operation';
 const service=app.load('@/lib/server/mobile-registry');
 await service.writeUserMetadata('owner',{name:'Metadata Updated',phoneNumber:'9876543210',_mobileClaimOperation:'stale-operation'},users.owner.phoneNumber);
 assert.equal(app.state.users.owner._mobileClaimOperation,'current-operation');
 assert.equal(app.state.users.owner.phoneNumber,users.owner.phoneNumber);
 assert.equal(app.state.users.owner.name,'Metadata Updated');
});
