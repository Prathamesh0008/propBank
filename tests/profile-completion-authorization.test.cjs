const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isolated,request,route}=require('./fixtures/native-server.cjs');

const complete=(uid='member',overrides={})=>({uid,name:'Complete Member',email:`${uid}@test.invalid`,phoneNumber:'+919876543210',role:'individual',isActive:true,...overrides});
const appWith=(profile,claims={})=>{const app=isolated({users:profile?{[profile.uid]:profile}:{},properties:{},storage_objects:{}});Object.assign(app.claims,claims);return app;};

test('onboarding status distinguishes Firebase identity from a complete persisted profile',async()=>{
  for(const [profile,expected]of [[null,false],[complete('member',{phoneNumber:''}),false],[complete('member',{phoneNumber:'+915123456789'}),false],[complete('member'),true]]){
    const app=appWith(profile,{member:{email:'member@test.invalid',email_verified:true,emailVerified:true}});
    const response=await route(app,'auth/user').GET(request('/auth/user','member'));
    assert.equal(response.status,200);assert.equal((await response.json()).profileComplete,expected);
  }
});

test('protected property and private-file APIs reject incomplete profiles server-side',async()=>{
  for(const profile of [complete('member',{name:''}),complete('member',{phoneNumber:''}),complete('member',{role:''}),complete('member',{isActive:false})]){
    const app=appWith(profile,{member:{email:'member@test.invalid',email_verified:true,emailVerified:true}});
    const property=await route(app,'properties').POST(request('/properties','member','POST',{propertyTitle:'Blocked',propertyType:'residential',structure:'Flat',listingType:'manage'}));
    assert.equal(property.status,403);assert.equal(Object.keys(app.state.properties).length,0);
    const media=await route(app,'media/session').POST(request('/media/session','member','POST'));
    assert.equal(media.status,403);assert.equal(app.sessions.size,0);
  }
});

test('complete active profile authorizes the shared protected boundary',async()=>{
  const app=appWith(complete(),{member:{email:'member@test.invalid',email_verified:true,emailVerified:true}});
  const response=await route(app,'media/session').POST(request('/media/session','member','POST'));
  assert.equal(response.status,204);assert.equal(app.sessions.size,1);
});

test('self user details reuse the authoritative authorization profile read',async()=>{
  const app=appWith(complete(),{member:{email:'member@test.invalid',email_verified:true,emailVerified:true}});
  const response=await route(app,'users/[id]').GET(request('/users/member','member'),{params:Promise.resolve({id:'member'})});
  assert.equal(response.status,200);assert.equal(app.reads.filter(read=>read.collection==='users'&&read.id==='member').length,1);
});

test('profile completion repairs a partially persisted Google profile with the submitted mobile and role',async()=>{
  const partial=complete('member',{phoneNumber:'',role:''}),app=appWith(partial,{member:{email:'member@test.invalid',email_verified:true,emailVerified:true,providerData:[{providerId:'google.com'}]}});
  const response=await route(app,'auth/user').POST(request('/auth/user','member','POST',{uid:'member',email:'member@test.invalid',name:'Google Member',phoneNumber:'+919123456789',role:'agent'}));
  assert.equal(response.status,200,await response.clone().text());assert.equal(app.state.users.member.phoneNumber,'+919123456789');assert.equal(app.state.users.member.role,'agent');
  const status=await route(app,'auth/user').GET(request('/auth/user','member'));assert.equal((await status.json()).profileComplete,true);
});

test('wrong, changed, or unverified Firebase email cannot reuse a persisted profile',async()=>{
  for(const claims of [{email:'other@test.invalid',email_verified:true,emailVerified:true},{email:'member@test.invalid',email_verified:false,emailVerified:false},{email:'member@test.invalid',email_verified:true,emailVerified:true,disabled:true}]){
    const app=appWith(complete(),{member:claims});
    const response=await route(app,'media/session').POST(request('/media/session','member','POST'));
    assert.ok([401,403].includes(response.status));assert.equal(app.sessions.size,0);
  }
});
