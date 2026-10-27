const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,request,route,context}=require('./fixtures/native-server.cjs');
const setup=()=>{const app=isolated({users:structuredClone(users),properties:{},tenants:{}});app.claims.newuser={email:'newuser@test.invalid',email_verified:false,emailVerified:false,providerData:[{providerId:'password'}]};return app;};
const body={uid:'newuser',email:'newuser@test.invalid',name:'New User',role:'individual'};
const create=(app,phoneNumber,extra={})=>route(app,'auth/user').POST(request('/auth/user','newuser','POST',{...body,...(phoneNumber===undefined?{}:{phoneNumber}),...extra}));

test('individual and agent new profiles require and persist a canonical contact number',async()=>{
 for(const role of ['individual','agent'])for(const value of ['9876543210','+919876543210','+91 9876543210']){const app=setup();assert.equal((await create(app,value,{role})).status,200);assert.equal(app.state.users.newuser.phoneNumber,'+919876543210');assert.equal(app.state.users.newuser.role,role);assert.equal(app.state.users.newuser.emailVerified,false);assert.equal(app.claims.newuser.phoneNumber,undefined);assert.equal(app.state.users.newuser.phoneVerified,undefined);assert.equal((await route(app,'properties').GET(request('/properties?ownerUID=newuser','newuser'))).status,403);}
});
test('missing, malformed, wrong length and wrong starting digits cannot create profiles or welcome events',async()=>{
 for(const value of [undefined,'','1234567890','5123456789','987654321','98765432101','+449876543210','9876543210abc',1234567890]){const app=setup();const response=await create(app,value);assert.equal(response.status,400);assert.equal(app.state.users.newuser,undefined);assert.equal(Object.keys(app.state.auth_activity||{}).length,0);assert.equal(Object.keys(app.state.email_deliveries||{}).length,0);}
});
test('all four supported starting digits are accepted',async()=>{for(const first of ['6','7','8','9']){const app=setup();assert.equal((await create(app,first+'123456789')).status,200);assert.equal(app.state.users.newuser.phoneNumber,'+91'+first+'123456789');}});
test('Google identity stays incomplete until a valid contact is submitted, and completion uses the same Firebase UID',async()=>{
 const app=setup();app.claims.newuser={email:'newuser@test.invalid',email_verified:true,emailVerified:true,providerData:[{providerId:'google.com'}]};const status=await route(app,'auth/user').GET(request('/auth/user','newuser'));assert.equal((await status.json()).profileExists,false);assert.equal((await create(app,'')).status,400);assert.equal(app.state.users.newuser,undefined);assert.equal((await create(app,'9876543210',{role:'agent'})).status,200);assert.equal(app.state.users.newuser.uid,'newuser');assert.equal((await(await route(app,'auth/user').GET(request('/auth/user','newuser'))).json()).profileExists,true);assert.equal(app.state.users.newuser.phoneNumber,'+919876543210');assert.equal(app.state.users.newuser.providerIds[0],'google.com');
});
test('legacy users without mobile still log in through Google or password and retain relationships',async()=>{
 for(const providerId of ['password','google.com']){const app=setup();app.state.users.owner.phoneNumber='';app.state.users.owner.ownedPropertyIds=['P'];app.claims.owner={email:'owner@test.invalid',email_verified:true,emailVerified:true,providerData:[{providerId}]};const response=await route(app,'auth/login').POST(request('/auth/login','owner','POST',{uid:'owner'}));assert.equal(response.status,200);assert.equal(app.state.users.owner.phoneNumber,'');assert.equal(app.state.users.owner.ownedPropertyIds[0],'P');assert.equal((await(await route(app,'auth/user').GET(request('/auth/user','owner'))).json()).profileExists,true);}
});
test('registration sync cannot clear or replace an existing contact or elevate an established role',async()=>{
 const app=setup();const original=app.state.users.owner.phoneNumber;const response=await route(app,'auth/user').POST(request('/auth/user','owner','POST',{uid:'owner',email:'owner@test.invalid',name:'Owner',role:'agent',phoneNumber:'9988776655'}));assert.equal(response.status,200);assert.equal(app.state.users.owner.phoneNumber,original);assert.equal(app.state.users.owner.role,'individual');
});
test('mobile does not authorize claims or bypass verified email and role/UID protections',async()=>{
 const app=setup();assert.equal((await create(app,'9876543210')).status,200);assert.equal(Object.keys(app.state.relationship_links||{}).length,0);assert.equal((await route(app,'relationship-links').POST(request('/relationship-links','newuser','POST',{action:'discover'}))).status,403);const forged=setup();assert.equal((await create(forged,'9876543210',{uid:'owner',email:'owner@test.invalid'})).status,403);assert.equal((await create(forged,'9876543210',{role:'admin'})).status,403);assert.equal(forged.state.users.newuser,undefined);
});
test('self-scoped onboarding check does not expose another account or accept anonymous access',async()=>{
 const app=setup();assert.equal((await route(app,'auth/user').GET(request('/auth/user',''))).status,401);const response=await route(app,'auth/user').GET(request('/auth/user?uid=owner&email=owner@test.invalid','newuser'));assert.deepEqual(await response.json(),{success:true,profileExists:false});assert.equal(app.writes.length,0);
});
test('admin-created profiles cannot bypass the mandatory contact through either creation route',async()=>{
 const app=setup();let response=await route(app,'users').POST(request('/users','admin','POST',body));assert.equal(response.status,400);response=await route(app,'users/[id]').PUT(request('/users/newuser','admin','PUT',{email:'newuser@test.invalid',name:'New User',role:'individual'}),context('newuser'));assert.equal(response.status,400);assert.equal(app.state.users.newuser,undefined);
});
test('repeated or concurrent registration preserves a single profile and one registration event',async()=>{
 const app=setup();const results=await Promise.all([create(app,'9876543210'),create(app,'9876543210')]);assert.ok(results.some(response=>response.status===200));assert.ok(results.every(response=>[200,409].includes(response.status)));assert.equal(app.state.users.newuser.phoneNumber,'+919876543210');const repeat=setup();assert.equal((await create(repeat,'9876543210')).status,200);assert.equal((await create(repeat,'9876543210')).status,200);assert.equal(Object.values(repeat.state.auth_activity).filter(row=>row.eventType==='registration').length,1);assert.equal(Object.values(repeat.state.email_deliveries).filter(row=>row.eventType==='user.registration_welcome').length,1);
});
