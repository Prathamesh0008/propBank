const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {isolated,users,request,route,context}=require('./fixtures/native-server.cjs');
const {registrySeed,key}=require('./fixtures/mobile-registry.cjs');
const migration=require('../scripts/mobile-registry-migration.cjs');
const setup=()=>{const app=isolated(registrySeed());app.env.TEST_STRICT_TRANSACTIONS='1';return app;};
function identity(app,uid,provider='password'){
 app.claims[uid]={email:`${uid}@test.invalid`,email_verified:provider==='google.com',emailVerified:provider==='google.com',providerData:[{providerId:provider}]};
}
const register=(app,uid,phoneNumber,extra={})=>route(app,'auth/user').POST(request('/auth/user',uid,'POST',{uid,email:`${uid}@test.invalid`,name:'New User',role:'individual',phoneNumber,...extra}));
const conflict=async response=>{assert.equal(response.status,409);const body=await response.json();assert.equal(body.code,'MOBILE_ALREADY_REGISTERED');assert.equal(body.message,'This mobile number is already registered. Please use a different mobile number.');assert.equal(body.user,undefined);assert.equal(body.ownerUID,undefined);};

for(const provider of ['password','google.com']){
 test(`${provider}: new onboarding then duplicate conflict, retry preserves Firebase UID`,async()=>{
  const app=setup();identity(app,'first',provider);identity(app,'second',provider);
  assert.equal((await register(app,'first','9876543210')).status,200);
  await conflict(await register(app,'second','+91 (98765) 43210'));
  assert.equal(app.state.users.second,undefined);assert.ok(app.claims.second);
  assert.equal((await register(app,'second','9988776655')).status,200);
  assert.equal(app.state.users.second.uid,'second');assert.equal(app.state.mobile_number_registry[key('+919876543210')].ownerUID,'first');
 });
}
test('normal Google login does not read/write registry or readiness gate',async()=>{
 const app=setup();app.claims.owner={email:'owner@test.invalid',emailVerified:true,providerData:[{providerId:'google.com'}]};delete app.state.mobile_number_registry_state;
 const response=await route(app,'auth/login').POST(request('/auth/login','owner','POST',{uid:'owner'}));assert.equal(response.status,200);
 assert.equal(app.reads.filter(x=>x.collection.startsWith('mobile_number_registry')).length,0);
 assert.equal(app.writes.filter(x=>x.collection.startsWith('mobile_number_registry')).length,0);
});
test('same UID retains canonical ownership on repeated equivalent onboarding',async()=>{
 const app=setup();identity(app,'first');assert.equal((await register(app,'first','9876543210')).status,200);
 assert.equal((await register(app,'first','+91 9876543210')).status,200);
 assert.equal(app.state.users.first.phoneNumber,'+919876543210');assert.equal(Object.values(app.state.mobile_number_registry).filter(x=>x.ownerUID==='first').length,1);
});
test('two concurrent UIDs cannot own one canonical mobile; normal writes never scan users',async()=>{
 const app=setup();identity(app,'first');identity(app,'second');
 const results=await Promise.all([register(app,'first','9876543210'),register(app,'second','+919876543210')]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
 assert.equal(['first','second'].filter(uid=>app.state.users[uid]).length,1);
 assert.equal(app.reads.filter(x=>x.collection==='users'&&!x.id).length,0);
});
test('registry is fail-closed for unbackfilled legacy formats, even without matching raw equality',async()=>{
 const app=setup();app.state.users.owner.phoneNumber='(91234) 56781';delete app.state.mobile_number_registry_state;app.state.mobile_number_registry={};identity(app,'newuser');
 const response=await register(app,'newuser','+919123456781');assert.equal(response.status,503);assert.equal((await response.json()).code,'MOBILE_REGISTRY_NOT_READY');assert.equal(app.state.users.newuser,undefined);assert.equal(Object.keys(app.state.mobile_number_registry).length,0);
});
test('registry and profile roll back together on failure; same Auth UID can retry',async()=>{
 const app=setup();identity(app,'newuser');app.env.TEST_DB_WRITE_COLLECTION='users';
 assert.equal((await register(app,'newuser','9876543210')).status,500);assert.equal(app.state.mobile_number_registry[key('+919876543210')],undefined);assert.equal(app.state.users.newuser,undefined);assert.ok(app.claims.newuser);
 delete app.env.TEST_DB_WRITE_COLLECTION;assert.equal((await register(app,'newuser','9876543210')).status,200);
});
test('verified self profile update conflicts without releasing old claim or changing name',async()=>{
 const app=setup(),phone=users.other.phoneNumber;app.claims.owner={auth_time:Math.floor(Date.now()/1000),phone_number:phone,phoneNumber:phone};
 const response=await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Edited Owner',phoneNumber:phone}));await conflict(response);
 assert.equal(app.state.users.owner.name,'Owner');assert.equal(app.state.users.owner.phoneNumber,users.owner.phoneNumber);assert.equal(app.state.mobile_number_registry[key(users.owner.phoneNumber)].ownerUID,'owner');
});
test('verified change atomically reserves new canonical phone and releases old phone; equivalent save succeeds',async()=>{
 const app=setup(),phone='+919988776655';app.claims.owner={auth_time:Math.floor(Date.now()/1000),phone_number:phone,phoneNumber:phone};
 const response=await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Owner',phoneNumber:'+91 (99887) 76655'}));assert.equal(response.status,200);
 assert.equal(app.state.users.owner.phoneNumber,phone);assert.equal(app.state.mobile_number_registry[key(phone)].ownerUID,'owner');assert.equal(app.state.mobile_number_registry[key(users.owner.phoneNumber)],undefined);
 assert.equal((await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Owner Saved',phoneNumber:'9988776655'}))).status,200);
});
test('recent-auth and verified Auth-phone requirements remain mandatory, including admin changes',async()=>{
 const app=setup();app.claims.owner={auth_time:1,phone_number:'+919988776655',phoneNumber:'+919988776655'};
 assert.equal((await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Owner',phoneNumber:'+919988776655'}))).status,403);
 app.claims.owner.auth_time=Math.floor(Date.now()/1000);app.claims.owner.phone_number='';
 assert.equal((await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Owner',phoneNumber:'+919988776655'}))).status,503);
 assert.equal((await route(app,'users/[id]').PATCH(request('/users/owner','admin','PATCH',{phoneNumber:'+919988776655'}),context('owner'))).status,403);
});
test('both admin creation paths reject other UID ownership with stable conflict',async()=>{
 for(const method of ['POST','PUT']){
  const app=setup();identity(app,'newuser');const body={uid:'newuser',name:'New User',email:'newuser@test.invalid',phoneNumber:users.owner.phoneNumber,role:'individual'};
  const response=method==='POST'?await route(app,'users').POST(request('/users','admin','POST',body)):await route(app,'users/[id]').PUT(request('/users/newuser','admin','PUT',body),context('newuser'));
  await conflict(response);assert.equal(app.state.users.newuser,undefined);
 }
});
test('admin update retaining another profile phone still checks ownership; no role/status side effect on conflict',async()=>{
 const app=setup();app.state.mobile_number_registry[key(users.owner.phoneNumber)].ownerUID='other';
 const response=await route(app,'users/[id]').PATCH(request('/users/owner','admin','PATCH',{name:'Changed',isActive:false}),context('owner'));await conflict(response);assert.equal(app.state.users.owner.isActive,true);assert.equal(app.claims.owner?.disabled,undefined);
});
test('only authenticated self/admin can invoke profile routes; registry has no browser endpoint',async()=>{
 const app=setup();identity(app,'newuser');
 assert.equal((await register(app,'newuser','9876543210',{uid:'owner'})).status,403);
 assert.equal((await route(app,'users/[id]').PATCH(request('/users/owner','other','PATCH',{phoneNumber:'9876543210'}),context('owner'))).status,403);
 assert.equal((await route(app,'auth/user').POST(request('/auth/user','','POST',{uid:'newuser',phoneNumber:'9876543210'}))).status,401);
 assert.equal(fs.existsSync('src/app/api/mobile-number-registry'),false);assert.equal(fs.existsSync('src/app/api/mobile_number_registry'),false);
});
test('metadata saves cannot replay stale mobile numbers or create an unregistered mobile',async()=>{
 const app=setup(),service=app.load('@/lib/server/services/users');await service.saveUser({...app.state.users.owner,phoneNumber:'9876543210',rentedPropertyId:'P'});
 assert.equal(app.state.users.owner.phoneNumber,users.owner.phoneNumber);assert.equal(app.state.users.owner.rentedPropertyId,'P');
});
test('invalid server formats rejected and stale verified snapshots/corrupt claims fail closed',async()=>{
 const app=setup();identity(app,'newuser');for(const number of ['+449876543210','9876543210abc','1234567890',''])assert.equal((await register(app,'newuser',number)).status,400);
 const service=app.load('@/lib/server/mobile-registry');await assert.rejects(()=>service.writeUserWithMobile('owner',{phoneNumber:users.owner.phoneNumber},{expectedPhone:'stale'}),e=>e.code==='MOBILE_PROFILE_CHANGED');
 delete app.state.mobile_number_registry[key(users.owner.phoneNumber)];await assert.rejects(()=>service.writeUserWithMobile('owner',{phoneNumber:users.owner.phoneNumber},{expectedPhone:users.owner.phoneNumber}),e=>e.code==='MOBILE_REGISTRY_INCONSISTENT');
});

// The fixture serializes atomic transactions and rolls them back on failure. It
// checks read-before-write ordering; this is not a live Firestore contention/rules test.
function migrationDb(app){return app.load('@/lib/server/firestore').getDatabase();}
test('migration dry-run finds equivalent duplicate, invalid, missing including inactive accounts; never chooses owner',async()=>{
 const app=isolated({users:{a:{phoneNumber:'9876543210'},b:{phoneNumber:'+91 (98765) 43210',isActive:false},c:{phoneNumber:'bad'},d:{}}});app.env.TEST_STRICT_TRANSACTIONS='1';const db=migrationDb(app),report=await migration.inspect(db);
 assert.equal(report.duplicateNumbers,1);assert.equal(report.invalid,1);assert.equal(report.missing,1);assert.equal(report.conflicts[0].count,2);assert.equal(app.writes.length,0);assert.equal(JSON.stringify(report).includes('9876543210'),false);
 await migration.begin(db);await migration.backfill(db,report);assert.equal(app.state.mobile_number_registry[key('+919876543210')].status,'blocked');assert.equal('ownerUID' in app.state.mobile_number_registry[key('+919876543210')],false);assert.equal(app.state.mobile_number_registry_accounts.c.state,'invalid');assert.equal(app.state.mobile_number_registry_accounts.d.state,'missing');
});
test('legacy reservation is paginated, resumable, idempotent and leaves profiles and relationships untouched',async()=>{
 const profiles={};for(let i=0;i<260;i++)profiles['u'+String(i).padStart(3,'0')]={phoneNumber:String(9000000000+i),role:'individual',ownedPropertyIds:['P']};
 const app=isolated({users:profiles});app.env.TEST_STRICT_TRANSACTIONS='1';const db=migrationDb(app),report=await migration.inspect(db);await migration.begin(db);
 const original=db.runTransaction;let calls=0;db.runTransaction=async fn=>{if(++calls===3)throw new Error('Injected interruption after first checkpoint');return original(fn);};
 await assert.rejects(()=>migration.backfill(db,report));assert.equal(Object.keys(app.state.mobile_number_registry||{}).length,1);assert.equal(app.state.mobile_number_registry_state.main.cursor,'u000');delete app.env.TEST_DB_WRITE_COLLECTION;db.runTransaction=original;
 await migration.backfill(db,await migration.inspect(db));assert.equal(app.state.mobile_number_registry_state.main.status,'backfilled');assert.equal(Object.keys(app.state.mobile_number_registry).length,260);
 await migration.backfill(db,await migration.inspect(db));
 await migration.activate(db,await migration.inspect(db));await migration.activate(db,await migration.inspect(db));assert.equal(app.state.mobile_number_registry_state.main.status,'active');assert.equal(app.state.users.u000.phoneNumber,'9000000000');assert.deepEqual(app.state.users,profiles);assert.equal(Object.keys(app.state.mobile_number_registry_accounts).length,260);assert.deepEqual(app.state.users.u000.ownedPropertyIds,['P']);
 assert.ok(app.reads.filter(x=>x.collection==='users'&&!x.id).length>2);
});
test('activation refuses incomplete claims or inventory drift',async()=>{
 const app=isolated({users:{a:{phoneNumber:'9876543210'}}}),db=migrationDb(app);await migration.begin(db);await migration.backfill(db,await migration.inspect(db));delete app.state.mobile_number_registry[key('+919876543210')];await assert.rejects(async()=>migration.activate(db,await migration.inspect(db)));assert.equal(app.state.mobile_number_registry_state.main.status,'backfilled');
});

async function legacyApp(){
 const profiles={...structuredClone(users),duplicate:{...structuredClone(users.owner),uid:'duplicate',email:'duplicate@test.invalid',phoneNumber:'+91 (91234) 56781'},missing:{...structuredClone(users.other),uid:'missing',email:'missing@test.invalid',phoneNumber:''},invalid:{...structuredClone(users.other),uid:'invalid',email:'invalid@test.invalid',phoneNumber:'invalid contact'}};
 const app=isolated({users:profiles,properties:{P:{ownerUID:'owner',tenants:[{userUID:'owner',isActive:true}]}},visits:{V:{userId:'owner'}}});app.env.TEST_STRICT_TRANSACTIONS='1';const db=migrationDb(app),before=structuredClone({users:app.state.users,properties:app.state.properties,visits:app.state.visits});
 await migration.begin(db);const report=await migration.inspect(db);await migration.backfill(db,report);await migration.activate(db,report);
 return {app,db,report,before};
}

test('legacy conflicts reserve each valid number without choosing an owner; missing/invalid users remain untouched',async()=>{
 const {app,before,report}=await legacyApp();assert.equal(report.duplicateNumbers,1);assert.equal(report.duplicateAccounts,2);assert.equal(report.uniqueValidNumbers,3);assert.equal(report.validMobileNumbers,4);
 const claim=app.state.mobile_number_registry[key(users.owner.phoneNumber)];assert.equal(claim.status,'blocked');assert.equal(claim.memberCount,2);assert.equal('ownerUID'in claim,false);assert.equal(typeof claim.membersFingerprint,'string');
 assert.equal(app.state.mobile_number_registry_accounts.owner.state,'conflicted');assert.equal(app.state.mobile_number_registry_accounts.duplicate.state,'conflicted');assert.equal(app.state.mobile_number_registry_accounts.missing.state,'missing');assert.equal(app.state.mobile_number_registry_accounts.invalid.state,'invalid');
 assert.equal('phoneKey'in app.state.mobile_number_registry_accounts.missing,false);assert.deepEqual(app.state.users,before.users);assert.deepEqual(app.state.properties,before.properties);assert.deepEqual(app.state.visits,before.visits);
 assert.equal(app.writes.filter(w=>['users','properties','visits'].includes(w.collection)).length,0);
});

for(const provider of ['password','google.com'])test(`${provider}: quarantined and unique legacy numbers both reject new onboarding; free number succeeds`,async()=>{
 const {app}=await legacyApp();identity(app,'newuser',provider);
 await conflict(await register(app,'newuser',users.owner.phoneNumber));await conflict(await register(app,'newuser',users.other.phoneNumber));
 assert.equal((await register(app,'newuser','9876543210')).status,200);assert.equal(app.state.mobile_number_registry_accounts.newuser.state,'owned');
});

test('conflicted account can log in and edit non-phone fields without normalizing or releasing historical number',async()=>{
 const {app}=await legacyApp();const claim=structuredClone(app.state.mobile_number_registry[key(users.owner.phoneNumber)]),state=structuredClone(app.state.mobile_number_registry_accounts.duplicate);
 app.claims.duplicate={email:'duplicate@test.invalid',emailVerified:true};
 assert.equal((await route(app,'auth/login').POST(request('/auth/login','duplicate','POST',{uid:'duplicate'}))).status,200);
 assert.equal((await route(app,'account').PATCH(request('/account','duplicate','PATCH',{name:'Edited Name',phoneNumber:'9123456781'}))).status,200);
 assert.equal(app.state.users.duplicate.name,'Edited Name');assert.equal(app.state.users.duplicate.phoneNumber,'+91 (91234) 56781');assert.deepEqual(app.state.mobile_number_registry[key(users.owner.phoneNumber)],claim);assert.deepEqual(app.state.mobile_number_registry_accounts.duplicate,state);
});

test('even a recently authenticated verified phone change cannot transfer a conflicted claim',async()=>{
 const {app}=await legacyApp(),phone='+919988776655';app.claims.owner={auth_time:Math.floor(Date.now()/1000),phone_number:phone,phoneNumber:phone};
 const response=await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Owner',phoneNumber:phone}));assert.equal(response.status,409);assert.equal((await response.json()).code,'MOBILE_RESOLUTION_REQUIRED');
 assert.equal(app.state.mobile_number_registry[key(users.owner.phoneNumber)].status,'blocked');assert.equal(app.state.mobile_number_registry[key(phone)],undefined);assert.equal(app.state.users.owner.phoneNumber,users.owner.phoneNumber);
});

test('missing/invalid legacy onboarding cannot claim any free number; deleted profile cannot erase quarantine',async()=>{
 const {app}=await legacyApp();
 for(const uid of ['missing','invalid']){identity(app,uid,'google.com');const response=await register(app,uid,'9876543210');assert.equal(response.status,409);assert.equal((await response.json()).code,'MOBILE_RESOLUTION_REQUIRED');assert.equal(app.state.mobile_number_registry[key('+919876543210')],undefined);}
 delete app.state.users.missing;
 assert.equal((await register(app,'missing','9876543210')).status,409);assert.equal(app.state.mobile_number_registry_accounts.missing.state,'missing');
});

test('admin non-phone edit preserves quarantine; missing contacts still fail existing profile/login gates',async()=>{
 const {app}=await legacyApp();assert.equal((await route(app,'users/[id]').PATCH(request('/users/owner','admin','PATCH',{name:'Owner Edited'}),context('owner'))).status,200);assert.equal(app.state.mobile_number_registry[key(users.owner.phoneNumber)].status,'blocked');
 assert.equal((await route(app,'auth/login').POST(request('/auth/login','missing','POST',{uid:'missing'}))).status,403);
});

test('reservation transaction rolls claim and account quarantine back together on interruption',async()=>{
 const app=isolated({users:{a:{phoneNumber:'9876543210'},b:{phoneNumber:'+919876543210'}}}),db=migrationDb(app);app.env.TEST_STRICT_TRANSACTIONS='1';await migration.begin(db);app.env.TEST_DB_WRITE_COLLECTION='mobile_number_registry_accounts';
 await assert.rejects(async()=>migration.backfill(db,await migration.inspect(db)));assert.equal(Object.keys(app.state.mobile_number_registry||{}).length,0);assert.equal(app.state.mobile_number_registry_state.main.cursor,'');
 delete app.env.TEST_DB_WRITE_COLLECTION;await migration.backfill(db,await migration.inspect(db));await migration.backfill(db,await migration.inspect(db));assert.equal(app.state.mobile_number_registry[key('+919876543210')].status,'blocked');
});

test('activation refuses an unreserved valid number, missing unresolved state, or blocked claim with an owner',async()=>{
 for(const mutation of ['claim','account','blocked-owner']){
  const {app,db}=await legacyApp();app.state.mobile_number_registry_state.main.status='backfilled';
  if(mutation==='claim')delete app.state.mobile_number_registry[key(users.other.phoneNumber)];
  if(mutation==='account')delete app.state.mobile_number_registry_accounts.missing;
  if(mutation==='blocked-owner')app.state.mobile_number_registry[key(users.owner.phoneNumber)].ownerUID='owner';
  await assert.rejects(async()=>migration.activate(db,await migration.inspect(db)));assert.equal(app.state.mobile_number_registry_state.main.status,'backfilled');
 }
});

test('a blocked number never becomes owned merely because one duplicate profile disappears',async()=>{
 const {app,db}=await legacyApp();delete app.state.users.duplicate;app.state.mobile_number_registry_state.main.status='backfilled';
 await assert.rejects(async()=>migration.activate(db,await migration.inspect(db)));assert.equal(app.state.mobile_number_registry[key(users.owner.phoneNumber)].status,'blocked');
});

test('version-1 activation cannot bypass the versioned legacy policy',async()=>{
 const app=setup();app.state.mobile_number_registry_state.main.version=1;identity(app,'newuser');assert.equal((await register(app,'newuser','9876543210')).status,503);
 await assert.rejects(()=>migration.begin(migrationDb(app)));
});


test('a corrupt owned-account state cannot cause a blocked old claim to be released',async()=>{
 const {app}=await legacyApp();const before=structuredClone(app.state.mobile_number_registry[key(users.owner.phoneNumber)]);app.state.mobile_number_registry_accounts.owner.state='owned';
 const phone='+919988776655';app.claims.owner={auth_time:Math.floor(Date.now()/1000),phone_number:phone,phoneNumber:phone};
 assert.equal((await route(app,'account').PATCH(request('/account','owner','PATCH',{name:'Owner',phoneNumber:phone}))).status,503);assert.deepEqual(app.state.mobile_number_registry[key(users.owner.phoneNumber)],before);assert.equal(app.state.mobile_number_registry[key(phone)],undefined);
});

test('migration may quarantine a matching v1 partial claim but never overwrites an unrelated owner',async()=>{
 for(const relatedOwner of [true,false]){
  const app=isolated({users:{a:{phoneNumber:'9876543210'},b:{phoneNumber:'+919876543210'}},mobile_number_registry:{[key('+919876543210')]:{ownerUID:relatedOwner?'a':'unrelated',createdAt:new Date()}}}),db=migrationDb(app);app.env.TEST_STRICT_TRANSACTIONS='1';await migration.begin(db);const report=await migration.inspect(db);
  if(relatedOwner){await migration.backfill(db,report);await migration.activate(db,report);assert.equal(app.state.mobile_number_registry[key('+919876543210')].status,'blocked');assert.equal('ownerUID'in app.state.mobile_number_registry[key('+919876543210')],false);}
  else {await assert.rejects(()=>migration.backfill(db,report));assert.equal(app.state.mobile_number_registry[key('+919876543210')].ownerUID,'unrelated');assert.equal(Object.keys(app.state.mobile_number_registry_accounts||{}).length,0);}
 }
});
