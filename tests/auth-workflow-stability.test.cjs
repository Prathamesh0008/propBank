const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react');
function fixture(file,cut,expression){const s=fs.readFileSync(file,'utf8');return new Function('require',s.slice(0,s.indexOf(cut))+';return '+expression)(require);}
const ui=fixture('tests/registration-mobile-ui.test.cjs',"\ntest('",'harness');
const {harness,deferred}=fixture('tests/private-file-auth-lifecycle.test.cjs','const user=uid=>','({harness,deferred})');
const member=(extra={})=>({uid:'A',email:'member@test.invalid',emailVerified:true,getIdToken:async()=> 'fixture-token',...extra});

test('login waits for authoritative context publication and redirects once after a slow profile response',async()=>{
 const hold=deferred(),h=ui({existing:true,refreshResult:()=>hold.promise,runEffects:true});
 await h.click('Continue with Google');await h.settle();
 assert.deepEqual(h.navigation,[]);assert.equal(h.button('Continue with Google').props.disabled,true);
 hold.resolve(true);await h.settle();assert.deepEqual(h.navigation,['/']);
 assert.equal(h.calls.filter(c=>c.url==='context:refresh').length,1);
});
test('same-tick duplicate Google clicks share one login operation',async()=>{
 const hold=deferred(),h=ui({existing:true,holdLogin:hold.promise});
 const click=h.button('Continue with Google').props.onClick;click();click();await h.settle();
 assert.equal(h.calls.filter(c=>c.url==='/api/auth/login').length,1);
 hold.resolve();await h.settle();assert.deepEqual(h.navigation,['/']);
});
test('same-tick duplicate signup submissions cannot create a second Firebase account or profile',async()=>{
 const hold=deferred(),h=ui({refreshResult:()=>hold.promise});h.button('Create account').props.onClick();
 h.change(h.input('text'),'Fixture Member');h.change(h.input('email'),'member@test.invalid');h.change(h.input('password'),'isolated-password');h.change(h.input('tel'),'9123456789');
 const handler=h.find(n=>n.type==='form').props.onSubmit,event={preventDefault(){}};
 const first=handler(event),second=handler(event);await h.settle();
 assert.equal(h.created(),1);assert.equal(h.calls.filter(c=>c.method==='POST'&&c.url==='/api/auth/user').length,1);
 hold.resolve(true);await Promise.all([first,second]);assert.deepEqual(h.navigation,['/']);
});
test('failed post-login profile validation never redirects through a stale complete state',async()=>{
 const h=ui({existing:true,refreshResult:false,runEffects:true});await h.click('Continue with Google');await h.settle();
 h.setContext({loading:false,profileStatus:'complete'});await h.settle();
 assert.deepEqual(h.navigation,[]);assert.match(h.html(),/account is not ready/);
});
test('restored admin identity uses server profile role and safe next takes precedence',async()=>{
 for(const [next,target]of [['','/admin'],['/manage-property','/manage-property']]){
  const h=ui({runEffects:true,next,context:{loading:false,profileStatus:'complete',profileRole:'admin'}});
  h.auth.currentUser=h.user;await h.settle();assert.deepEqual(h.navigation,[target]);
 }
});
test('unverified login opens verification, never the registration form or session endpoint',async()=>{
 const h=ui({existing:false,emailVerified:false,runEffects:true});await h.click('Continue with Google');await h.settle();
 assert.match(h.html(),/Verify your email/);assert.doesNotMatch(h.html(),/Create your account/);
 assert.ok(!h.calls.some(c=>c.url==='/api/auth/login'||c.method==='POST'));assert.deepEqual(h.navigation,[]);
});
test('verification refresh resumes login only after Firebase confirms verification',async()=>{
 const h=ui({existing:true,emailVerified:false});await h.click('Continue with Google');
 await h.click('I have verified my email');assert.deepEqual(h.navigation,[]);
 h.user.emailVerified=true;await h.click('I have verified my email');await h.settle();
 assert.deepEqual(h.navigation,['/']);assert.equal(h.calls.filter(c=>c.url==='/api/auth/login').length,1);
});
test('explicit refresh awaits profile publication, supersedes stale requests and retains a single listener',async()=>{
 const old=deferred(),fresh=deferred();let count=0;
 const h=harness({user:member(),profileResponse:()=>++count===1?old.promise:fresh.promise});h.render();
 const refresh=h.value().refreshProfile();let done=false;void refresh.then(()=>done=true);await h.settle();assert.equal(done,false);assert.equal(h.observers.size,1);
 fresh.resolve(Response.json({profileComplete:true,role:'admin'}));assert.equal(await refresh,true);await h.settle();
 assert.equal(h.value().profileRole,'admin');assert.equal(h.value().lifecycle,'authenticated');
 old.resolve(Response.json({profileComplete:false}));await h.settle();assert.equal(h.value().profileStatus,'complete');h.unmount();
});
test('temporary background failure preserves known identity and exposes retry, not registration',async()=>{
 let fail=false;const h=harness({user:member(),profileResponse:async()=>fail?Response.json({message:'Temporary failure'},{status:503}):Response.json({profileComplete:true})});
 h.render();await h.settle();fail=true;h.emit(member());await h.settle();
 assert.equal(h.value().user.uid,'A');assert.equal(h.value().profileStatus,'unavailable');assert.equal(h.value().lifecycle,'authentication_error');assert.equal(h.value().loading,false);
 fail=false;assert.equal(await h.value().refreshProfile(),true);await h.settle();assert.equal(h.value().profileStatus,'complete');h.unmount();
});
test('application 403 blocks access without treating disabled/forbidden accounts as incomplete registration',async()=>{
 const h=harness({user:member(),profileResponse:async()=>Response.json({code:'ACCOUNT_DISABLED',message:'Disabled'},{status:403})});h.render();await h.settle();
 assert.equal(h.value().user,null);assert.equal(h.value().profileStatus,'unavailable');assert.equal(h.value().profileError,'Disabled');h.unmount();
});
test('unverified Firebase event has a distinct verification lifecycle and never starts profile/media writes',async()=>{
 let profiles=0;const h=harness({user:member({emailVerified:false}),profileResponse:async()=>{profiles++;return Response.json({profileComplete:false});}});h.render();await h.settle();
 assert.equal(h.value().profileStatus,'unverified');assert.equal(h.value().lifecycle,'email_verification_required');assert.equal(profiles,0);assert.ok(!h.calls.some(c=>c.method==='POST'));h.unmount();
});
test('concurrent sign-out clicks share one operation and subsequent login initializes normally',async()=>{
 const hold=deferred(),h=harness({user:member(),signOutResponse:()=>hold.promise});h.render();await h.settle();
 const first=h.value().signOut(),second=h.value().signOut();h.render();assert.equal(h.value().lifecycle,'signing_out');assert.equal(h.signOutCalls(),1);
 hold.resolve();await Promise.all([first,second]);await h.settle();assert.equal(h.value().lifecycle,'unauthenticated');assert.equal(h.value().user,null);
 h.emit(member());await h.settle();assert.equal(h.value().lifecycle,'authenticated');h.unmount();
});
test('protected route redirects anonymous identities to sign-in once and leaves onboarding to the shell',()=>{
 let context={user:null,loading:false,profileStatus:'anonymous'},index=0;const refs=[],effects=[],navigation=[];
 const router={replace:to=>navigation.push(to)},toast=()=>{};
 const out={},source=ts.transpileModule(fs.readFileSync('src/components/RouteGuard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','window',source)(name=>{
  if(name==='react')return {...React,useState:()=>[null,()=>{}],useRef:value=>{const i=index++;return refs[i]||(refs[i]={current:value});},useEffect:fn=>effects.push(fn)};
  if(name==='next/navigation')return {useRouter:()=>router};if(name==='@/contexts/AuthContext')return {useAuth:()=>context};if(name==='@/hooks/use-toast')return {useToast:()=>({toast})};
  if(name==='@/lib/api-client')return {apiFetch:()=>{throw Error('No anonymous admin query allowed');}};if(name==='@/utils/config')return {API_BASE_URL:'/api'};return require(name);
 },out,{location:{pathname:'/manage-property',search:'?tab=owner',hash:''}});
 const render=()=>{index=0;out.default({children:null});for(const effect of effects.splice(0))effect();};
 render();render();assert.deepEqual(navigation,['/auth?next=%2Fmanage-property%3Ftab%3Downer']);
 for(const profileStatus of ['checking','incomplete','unverified','unavailable']){context={...context,profileStatus};render();assert.equal(navigation.length,1);}
});

test('canceled Google sign-in leaves a usable login form with no profile or session writes',async()=>{
 const h=ui({googleError:new Error('Google sign-in was cancelled.')});await h.click('Continue with Google');await h.settle();
 assert.match(h.html(),/Google sign-in was cancelled/);assert.equal(h.button('Continue with Google').props.disabled,false);assert.deepEqual(h.navigation,[]);assert.equal(h.calls.length,0);
});
test('encoded auth/API routes cannot create a redirect loop through next',()=>{
 const out={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/auth-navigation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(out);
 for(const next of ['/%2561uth','/x/%252e%252e/auth','/%2561pi/account'])assert.equal(out.safeAuthNext(next),'');
});

test('duplicate explicit profile retries share one forced validation promise',async()=>{
 let pending;const h=harness({user:member(),profileResponse:()=>pending?pending.promise:Promise.resolve(Response.json({profileComplete:true}))});h.render();await h.settle();
 pending=deferred();const first=h.value().refreshProfile(),second=h.value().refreshProfile();assert.equal(first,second);
 pending.resolve(Response.json({profileComplete:true}));assert.equal(await first,true);await h.settle();assert.equal(h.observers.size,1);h.unmount();
});
test('a queued stale Firebase event cannot replace the current account or start another validation',async()=>{
 let count=0;const h=harness({user:member(),profileResponse:async()=>{count++;return Response.json({profileComplete:true});}});h.render();await h.settle();
 const before=count;for(const observer of h.observers)observer(member({uid:'old-user'}));await h.settle();
 assert.equal(h.value().user.uid,'A');assert.equal(count,before);h.unmount();
});
test('failed sign-out exits signing-out state and exposes recovery without claiming success',async()=>{
 const h=harness({user:member(),signOutResponse:async()=>{throw Error('Isolated sign-out failure');}});h.render();await h.settle();
 await assert.rejects(()=>h.value().signOut(),/Isolated sign-out failure/);await h.settle();
 assert.equal(h.value().lifecycle,'authentication_error');assert.equal(h.value().user.uid,'A');assert.match(h.value().profileError,/Unable to sign out/);h.unmount();
});

test('registration validation retains the selected form and typed fields while still anonymous',async()=>{
 const h=ui({runEffects:true});h.button('Create account').props.onClick();h.change(h.input('text'),'Fixture Member');h.change(h.input('email'),'member@test.invalid');h.change(h.input('password'),'isolated-password');h.change(h.input('tel'),'51234');
 await h.submit();await h.settle();assert.match(h.html(),/Create your account/);assert.equal(h.input('text').props.value,'Fixture Member');assert.equal(h.input('tel').props.value,'51234');assert.equal(h.created(),0);assert.deepEqual(h.navigation,[]);
});
