const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const output={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/private-file-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(output);
const {createPrivateFileSession}=output;
const ok=()=>new Response(null,{status:204});
const response=(status,code)=>new Response(JSON.stringify({code}),{status,headers:{'Content-Type':'application/json'}});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const tick=()=>new Promise(setImmediate);
function setup(options={}){
 let user=null,clock=1000000;const calls=[],refreshes=[],waits=[],states=[];
 const makeUser=(uid='A')=>({uid,emailVerified:true,getIdToken:async refresh=>{refreshes.push({uid,refresh:!!refresh});return options.token?options.token(uid,refresh):uid+(refresh?'-fresh':'');}});
 const session=createPrivateFileSession({ready:()=>options.ready||Promise.resolve(),currentUser:()=>user,request:async(method,token,signal)=>{calls.push({method,token});return options.request?options.request(method,token,signal,calls):ok();},wait:async(ms,signal)=>{waits.push(ms);if(options.wait)await options.wait(ms,signal);},now:()=>clock,timeoutMs:options.timeoutMs??100});
 session.subscribe(value=>states.push(value));
 return {session,calls,refreshes,waits,states,makeUser,setUser:value=>{user=value;return session.setUser(value);},setCurrent:value=>{user=value;},advance:ms=>{clock+=ms;}};
}
test('anonymous and unverified visitors only clear stale cookies, never initialize private access',async()=>{
 const h=setup();await h.setUser(null);await h.setUser(null);assert.deepEqual(h.calls.map(row=>row.method),['DELETE']);assert.equal(h.session.snapshot().phase,'idle');const unverified=h.makeUser();unverified.emailVerified=false;await h.setUser(unverified);assert.equal(h.calls.filter(row=>row.method==='POST').length,0);assert.equal(h.refreshes.length,0);
});
test('initialization waits for Firebase readiness and then confirms the retained cookie',async()=>{
 const ready=deferred(),h=setup({ready:ready.promise}),user=h.makeUser();const work=h.setUser(user);await tick();assert.equal(h.calls.length,0);assert.equal(h.session.snapshot().message,'Preparing secure file access...');ready.resolve();await work;assert.deepEqual(h.calls.map(row=>row.method),['DELETE','POST','GET']);assert.equal(h.calls[1].token,'A');assert.equal(h.calls[2].token,'A');assert.equal(h.session.snapshot().phase,'ready');
});
test('concurrent calls and Strict Mode reinitialization share one operation and ready lease',async()=>{
 const hold=deferred(),h=setup({request:async method=>method==='POST'?hold.promise:ok()}),user=h.makeUser();const a=h.setUser(user),b=h.setUser(user),c=h.setUser(user);assert.equal(a,b);assert.equal(b,c);await tick();assert.equal(h.calls.filter(row=>row.method==='POST').length,1);hold.resolve(ok());await a;await h.setUser(user);assert.equal(h.calls.filter(row=>row.method==='POST').length,1);
});
test('temporary network errors retry at most three attempts with exponential backoff',async()=>{
 let posts=0;const h=setup({request:async method=>{if(method==='POST'&&++posts<3)throw new TypeError('offline');return ok();}});await h.setUser(h.makeUser());assert.equal(posts,3);assert.deepEqual(h.waits,[500,1000]);assert.equal(h.session.snapshot().phase,'ready');assert.ok(h.states.some(state=>state.message==='Secure file access is temporarily unavailable. Retrying...'));
});
for(const status of [429,502,503,504])test(`HTTP ${status} is recoverable with bounded retries`,async()=>{
 let posts=0;const h=setup({request:async method=>method==='POST'&&++posts===1?response(status):ok()});await h.setUser(h.makeUser());assert.equal(posts,2);assert.deepEqual(h.waits,[500]);assert.equal(h.session.snapshot().phase,'ready');
});
test('timeout is bounded and a manual retry recovers without reloading',async()=>{
 let failing=true;const h=setup({timeoutMs:5,request:async method=>method==='POST'&&failing?new Promise(()=>{}):ok()});await h.setUser(h.makeUser());assert.equal(h.session.snapshot().phase,'failed');assert.equal(h.session.snapshot().failure,'network');assert.equal(h.calls.filter(row=>row.method==='POST').length,3);failing=false;await h.session.retry();assert.equal(h.session.snapshot().phase,'ready');
});
test('HTTP 401 refreshes this UID token once and retries once',async()=>{
 const h=setup({request:async(method,token)=>method==='POST'&&token==='A'?response(401):ok()});await h.setUser(h.makeUser());assert.equal(h.session.snapshot().phase,'ready');assert.equal(h.refreshes.filter(row=>row.refresh).length,1);assert.deepEqual(h.calls.filter(row=>row.method==='POST').map(row=>row.token),['A','A-fresh']);
});
test('persistent 401 stops after one forced refresh and requests sign-in',async()=>{
 const h=setup({request:async method=>method==='POST'?response(401):ok()});await h.setUser(h.makeUser());assert.equal(h.calls.filter(row=>row.method==='POST').length,2);assert.equal(h.refreshes.filter(row=>row.refresh).length,1);assert.equal(h.session.snapshot().failure,'unauthenticated');assert.equal(h.waits.length,0);
});
test('HTTP 403 is not retried automatically on renewal or remount',async()=>{
 const h=setup({request:async method=>method==='POST'?response(403):ok()}),user=h.makeUser();await h.setUser(user);assert.equal(h.session.snapshot().message,"You don't have permission to access these files.");await h.setUser(user);h.advance(20*60000);await h.session.renew();assert.equal(h.calls.filter(row=>row.method==='POST').length,1);assert.equal(h.waits.length,0);assert.equal(h.refreshes.filter(row=>row.refresh).length,0);
});
test('configuration errors are not retried despite HTTP 503',async()=>{
 const h=setup({request:async method=>method==='POST'?response(503,'FILE_SESSION_CONFIGURATION'):ok()});await h.setUser(h.makeUser());assert.equal(h.session.snapshot().failure,'configuration');assert.equal(h.calls.filter(row=>row.method==='POST').length,1);assert.equal(h.waits.length,0);
});
test('new verified Firebase accounts without platform profiles are onboarding, not a storage outage',async()=>{
 let complete=false;const h=setup({request:async method=>method==='POST'&&!complete?response(403,'ACCOUNT_PROFILE_REQUIRED'):ok()}),user=h.makeUser();await h.setUser(user);assert.equal(h.session.snapshot().phase,'profile_required');assert.equal(h.waits.length,0);complete=true;await h.setUser(user);assert.equal(h.session.snapshot().phase,'ready');
});
test('cookie rejection is distinguished from token expiry and is not retried blindly',async()=>{
 const h=setup({request:async method=>method==='GET'?response(401,'FILE_SESSION_COOKIE_MISSING'):ok()});await h.setUser(h.makeUser());assert.equal(h.session.snapshot().failure,'cookies');assert.equal(h.refreshes.filter(row=>row.refresh).length,0);assert.equal(h.calls.filter(row=>row.method==='POST').length,1);
});
test('expired or mismatched cookie is repaired with one refresh and a new session',async()=>{
 let probes=0;const h=setup({request:async method=>method==='GET'&&++probes===1?response(401,'FILE_SESSION_COOKIE_MISMATCH'):ok()});await h.setUser(h.makeUser());assert.equal(h.session.snapshot().phase,'ready');assert.equal(h.refreshes.filter(row=>row.refresh).length,1);assert.equal(h.calls.filter(row=>row.method==='POST').length,2);
});
test('switching accounts serializes old responses, clears the old cookie, and uses only the new UID token',async()=>{
 const hold=deferred(),h=setup({request:async(method,token)=>method==='POST'&&token==='A'?hold.promise:ok()});const a=h.setUser(h.makeUser('A'));await tick();const b=h.setUser(h.makeUser('B'));assert.equal(h.session.snapshot().uid,'B');assert.equal(h.session.snapshot().phase,'preparing');assert.equal(h.calls.filter(row=>row.token==='B').length,0);hold.resolve(ok());await Promise.all([a,b]);assert.deepEqual(h.calls.map(row=>row.method+':'+(row.token||'')),['DELETE:','POST:A','DELETE:','POST:B','GET:B']);assert.equal(h.session.snapshot().uid,'B');assert.equal(h.session.snapshot().phase,'ready');
});
test('logout invalidates state immediately and clears the cookie after any old request finishes',async()=>{
 const hold=deferred(),h=setup({request:async method=>method==='POST'?hold.promise:ok()});const pending=h.setUser(h.makeUser());await tick();const out=h.setUser(null);assert.equal(h.session.snapshot().phase,'idle');assert.equal(h.session.snapshot().uid,null);hold.resolve(ok());await Promise.all([pending,out]);assert.equal(h.calls.at(-1).method,'DELETE');assert.equal(h.calls.filter(row=>row.method==='GET').length,0);
});
test('an account change while token acquisition is pending never sends the old token',async()=>{
 const hold=deferred(),h=setup({token:uid=>uid==='A'?hold.promise:uid});const a=h.setUser(h.makeUser('A'));await tick();const b=h.setUser(h.makeUser('B'));hold.resolve('A');await Promise.all([a,b]);assert.ok(!h.calls.some(row=>row.token==='A'));assert.equal(h.session.snapshot().uid,'B');
});
test('ready sessions renew on lease expiry but repeated focus events are deduplicated',async()=>{
 const h=setup();await h.setUser(h.makeUser());await h.session.renew();assert.equal(h.calls.filter(row=>row.method==='POST').length,1);h.advance(11*60000);await Promise.all([h.session.renew(),h.session.renew()]);assert.equal(h.calls.filter(row=>row.method==='POST').length,2);
});
test('failed retries stop without an endless background loop, and explicit retry can succeed later',async()=>{
 let failing=true;const h=setup({request:async method=>method==='POST'&&failing?response(503):ok()});const user=h.makeUser();await h.setUser(user);assert.equal(h.calls.filter(row=>row.method==='POST').length,3);h.advance(60*60000);await h.session.renew();await h.setUser(user);assert.equal(h.calls.filter(row=>row.method==='POST').length,3);failing=false;await h.session.retry();assert.equal(h.session.snapshot().phase,'ready');
});
test('initialization does not require the browser-specific AbortSignal.timeout helper',async()=>{
 const original=AbortSignal.timeout;try{AbortSignal.timeout=undefined;const h=setup();await h.setUser(h.makeUser());assert.equal(h.session.snapshot().phase,'ready');}finally{AbortSignal.timeout=original;}
});
