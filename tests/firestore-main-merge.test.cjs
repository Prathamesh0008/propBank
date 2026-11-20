const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const {registrySeed,key}=require('./fixtures/mobile-registry.cjs');
const setup=()=>{const a=isolated(registrySeed());a.env.NODE_ENV='production';a.env.TEST_STRICT_TRANSACTIONS='1';return a;};
const preflight=(a,body={phoneNumber:'+919876543210'})=>route(a,'auth/registration-check').POST(request('/auth/registration-check',undefined,'POST',body));
const register=(a,uid)=>route(a,'auth/user').POST(request('/auth/user',uid,'POST',{uid,email:`${uid}@test.invalid`,name:'Fixture User',role:'individual',phoneNumber:'+919876543210'}));

test('production preflight uses the active schema-2 Firestore registry with no Mongo configuration, writes or scans',async()=>{
 const a=setup(),before=JSON.stringify(a.state);assert.equal((await preflight(a)).status,200);assert.equal(JSON.stringify(a.state),before);assert.equal(a.writes.length,0);assert.equal(a.emails.length,0);assert.ok(a.reads.every(read=>read.id));
 for(const variable of ['MONGODB_URI','MONGODB_MOBILE_DATABASE','PROPBANK_MOBILE_BACKEND'])assert.equal(a.env[variable],undefined);
});
for(const control of [{status:'inactive'},{version:1},{reservationPolicy:'wrong'}])test(`preflight cannot bypass registry readiness: ${JSON.stringify(control)}`,async()=>{
 const a=setup();Object.assign(a.state.mobile_number_registry_state.main,control);const response=await preflight(a);assert.equal(response.status,503);assert.equal((await response.json()).code,'MOBILE_REGISTRY_NOT_READY');assert.equal(a.writes.length,0);
});
test('preflight rejects owned numbers, legacy reservations and malformed claims without exposing owners',async()=>{
 for(const claim of [{version:2,status:'owned',ownerUID:'owner'},{version:2,status:'blocked',memberCount:2,membersFingerprint:'a'.repeat(64)},{version:1,status:'owned',ownerUID:'owner'}]){
  const a=setup();a.state.mobile_number_registry[key('+919876543210')]=claim;const response=await preflight(a);assert.equal(response.status,claim.version===1?503:409);const body=await response.text();assert.ok(!body.includes('ownerUID'));assert.equal(a.writes.length,0);
 }
});
test('Firebase verified phone reservations are enforced even before a Firestore claim exists',async()=>{
 const a=setup();a.claims.reserved={phone_number:'+919876543210'};assert.equal((await preflight(a)).status,409);assert.equal((await register(a,'newuser')).status,409);assert.equal(a.state.users.newuser,undefined);
});
test('a successful preflight does not reserve the number or bypass the final concurrent ownership transaction',async()=>{
 const a=setup();assert.equal((await preflight(a)).status,200);assert.equal((await preflight(a)).status,200);const results=await Promise.all([register(a,'first'),register(a,'second')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const winner=a.state.mobile_number_registry[key('+919876543210')].ownerUID;assert.ok(['first','second'].includes(winner));assert.ok(a.state.users[winner]);assert.equal(a.state.users[winner==='first'?'second':'first'],undefined);
});
test('registration and non-phone account updates remain functional in production without Mongo settings',async()=>{
 const a=setup();assert.equal((await register(a,'newuser')).status,200);const phone=a.state.users.owner.phoneNumber;const response=await route(a,'account').PATCH(request('/account','owner','PATCH',{name:'Updated Owner',phoneNumber:phone}));assert.equal(response.status,200,await response.clone().text());assert.equal(a.state.users.owner.phoneNumber,phone);assert.equal(a.state.mobile_number_registry[key(phone)].ownerUID,'owner');
});
test('preflight only accepts a mobile number and malformed requests cannot create identities or claims',async()=>{
 for(const body of [{phoneNumber:'invalid'},{phoneNumber:'+919876543210',uid:'forged'},[],null]){const a=setup();const response=await preflight(a,body);assert.equal(response.status,400);assert.equal(a.writes.length,0);}
});
function authHarness(options){const source=fs.readFileSync('tests/registration-mobile-ui.test.cjs','utf8').split('\ntest(')[0];return new Function('require',source+';return harness;')(require)(options);}
for(const status of [409,503])test(`registration preflight ${status} prevents Firebase account creation and retains form input`,async()=>{
 const h=authHarness({preflightStatus:status});h.button('Create account').props.onClick();h.change(h.input('text'),'New Person');h.change(h.input('email'),'person@example.invalid');h.change(h.input('password'),'fixture-password');h.change(h.input('tel'),'9876543210');await h.submit();assert.equal(h.created(),0);assert.equal(h.calls.filter(c=>c.url==='/api/auth/user'&&c.method==='POST').length,0);assert.equal(h.input('tel').props.value,'9876543210');assert.equal(h.calls.filter(c=>c.url==='/api/auth/registration-check').length,1);
});
test('main country-prefix paste support is retained without changing the canonical registry policy',()=>{
 for(const input of ['+91 98765 43210','919876543210']){const h=authHarness();h.button('Create account').props.onClick();h.render();let prevented=false;h.input('tel').props.onPaste({clipboardData:{getData:()=>input},preventDefault:()=>{prevented=true;}});h.render();assert.equal(h.input('tel').props.value,'9876543210');assert.equal(prevented,true);}
});
test('runtime and direct dependencies contain no Mongo backend or production environment gate',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):[`${dir}/${entry.name}`]);for(const file of walk('src').filter(f=>/\.tsx?$/.test(f)))assert.doesNotMatch(fs.readFileSync(file,'utf8'),/MONGODB_URI|MONGODB_MOBILE_DATABASE|PROPBANK_MOBILE_BACKEND|from ['"]mongodb['"]|import\(['"].*mongo-mobile/);
 assert.equal(JSON.parse(fs.readFileSync('package.json','utf8')).dependencies.mongodb,undefined);
});
test('legacy formatted rent is read compatibly without rewriting storage or accepting formatted API input',async()=>{
 const record={...properties.P,tenants:[],rentalStatus:'available',monthlyRent:'\u20b912,500',moderationStatus:'approved',price:0};const a=isolated({users,properties:{P:record}});const response=await route(a,'properties/[id]').GET(request('/properties/P','owner'),context('P'));assert.equal(response.status,200);const p=(await response.json()).property;assert.equal(p.price,12500);assert.equal(p.monthlyRent,'12500');assert.equal(a.state.properties.P.monthlyRent,'\u20b912,500');const edit=await route(a,'properties/[id]').PATCH(request('/properties/P','owner','PATCH',{monthlyRent:'\u20b913,000'}),context('P'));assert.equal(edit.status,400);assert.equal(a.state.properties.P.monthlyRent,'\u20b912,500');
});
test('authorized legacy price projection never becomes invented contractual rent',async()=>{
 const a=isolated({users,properties:{P:{...properties.P,price:12345}}});const response=await route(a,'properties/[id]').GET(request('/properties/P','owner'),context('P'));const p=(await response.json()).property;assert.equal(p.price,12345);assert.equal(p.effectiveMonthlyRent,null);assert.equal(a.load('@/lib/property-presentation').propertyPricing(p).amount,null);
});
test('compatible monetary reads preserve canonical decimal strings exactly',()=>{
 const {propertyReadValues}=isolated().load('@/lib/server/services/contracts');
 for(const value of ['00012500.00','123456789012345678901.25'])assert.equal(propertyReadValues({monthlyRent:value}).monthlyRent,value);
});
test('submitting-agent listing updates stage notifications without granting tenant or document permissions',async()=>{
 const agent={...users.other,uid:'agent',email:'agent@test.invalid',role:'agent'},a=isolated({users:{...users,agent},properties:{P:{...properties.P,submittedByUID:'agent',moderationStatus:'pending_review'}}});const edit=await route(a,'properties/[id]').PATCH(request('/properties/P','agent','PATCH',{title:'Revised listing'}),context('P'));assert.equal(edit.status,200,await edit.clone().text());assert.equal((await route(a,'properties/[id]').PATCH(request('/properties/P','agent','PATCH',{tenants:[]}),context('P'))).status,403);assert.equal((await route(a,'documents').GET(request('/documents?propertyId=P','agent'))).status,403);assert.equal(a.state.properties.P.tenants[0].userUID,'tenant');assert.ok(Object.values(a.state.email_deliveries).some(row=>row.sourceEventType==='property.updated'));
});
