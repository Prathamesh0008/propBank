const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),React=require('react');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const core={};new Function('exports',compile('src/lib/private-file-session.ts'))(core);
const ok=()=>new Response(null,{status:204}),tick=()=>new Promise(setImmediate);
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function harness(options={}){
 const auth={currentUser:options.user||null},observers=new Set(),calls=[],notices=[],dismissed=[],invalidated=[],slots=[],effects=[],timers=new Set(),events=new Map();
 let cursor=0,dirty=false,tree,lastNotice=-1,clearCount=0,profileComplete=options.profileComplete!==false;
 const manager=core.createPrivateFileSession({ready:()=>options.ready||Promise.resolve(),currentUser:()=>auth.currentUser,wait:async()=>{},request:async(method,token)=>{calls.push({method,token});return options.request?options.request(method,token):ok();}});
 function state(initial){const key=cursor++;if(!(key in slots))slots[key]=typeof initial==='function'?initial():initial;return [slots[key],value=>{const next=typeof value==='function'?value(slots[key]):value;if(!Object.is(next,slots[key])){slots[key]=next;dirty=true;}}];}
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
 const fakeReact={...React,useState:state,useRef:initial=>{const key=cursor++;return slots[key]||(slots[key]={current:initial});},useCallback:(fn,deps)=>{const key=cursor++;if(!slots[key]||!same(slots[key].deps,deps))slots[key]={fn,deps};return slots[key].fn;},useEffect:(fn,deps)=>{const key=cursor++;if(!effects[key]||!same(effects[key].deps,deps)){effects[key]?.cleanup?.();effects[key]={deps,pending:fn};}}};
 const queryClient={clear:()=>{clearCount++;},invalidateQueries:async({queryKey})=>{invalidated.push(queryKey[0]);}};
 const toast=value=>{notices.push(value);return {id:String(notices.length)};},dismiss=id=>dismissed.push(id);
 const window={setInterval:fn=>{timers.add(fn);return fn;},clearInterval:id=>timers.delete(id),addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);},removeEventListener:(name,fn)=>events.get(name)?.delete(fn)};
 const scoped=name=>{
  if(name==='react')return fakeReact;if(name==='@tanstack/react-query')return {useQueryClient:()=>queryClient};
  if(name==='@/firebase')return {auth};if(name==='firebase/auth')return {onIdTokenChanged:(_,fn)=>{observers.add(fn);assert.equal(fn(auth.currentUser),undefined);return ()=>observers.delete(fn);}};
  if(name==='@/lib/private-file-session')return core;if(name==='@/lib/private-file-client')return {privateFileSession:manager,claimFileSessionNotice:revision=>{if(lastNotice===revision)return false;lastNotice=revision;return true;}};
  if(name==='@/lib/data-refresh')return {queryKeysByDomain:{properties:[],documents:[]},subscribeDataRefresh:()=>()=>{}};
  if(name==='@/hooks/use-toast')return {useToast:()=>({toast,dismiss})};if(name==='@/ui/toast')return {ToastAction:()=>null};if(name==='@/lib/api-client'){const apiFetch=async url=>new Response(url==='/api/auth/user'?JSON.stringify({success:true,profileComplete}):'{"success":true}');return {apiFetch,loadAuthProfile:async()=>{const response=await apiFetch('/api/auth/user');return {response,data:await response.clone().json()};}};}return require(name);
 };
 const output={};new Function('exports','require','window',compile('src/contexts/AuthContext.tsx'))(output,scoped,window);
 const render=()=>{cursor=0;dirty=false;tree=output.AuthProvider({children:null});for(const effect of effects)if(effect?.pending){const fn=effect.pending;effect.pending=null;effect.cleanup=fn();}return tree.props.value;};
 const settle=async()=>{for(let i=0;i<8;i++){await tick();if(dirty)render();}return tree.props.value;};
 return {auth,calls,notices,dismissed,invalidated,timers,observers,render,settle,manager,value:()=>tree.props.value,clearCount:()=>clearCount,
  emit(user){auth.currentUser=user;for(const fn of [...observers])assert.equal(fn(user),undefined);},
  completeProfile(){profileComplete=true;for(const fn of events.get('propbank:profile-completed')||[])fn();},
  strictRemount(){for(const effect of effects)effect?.cleanup?.();effects.length=0;return render();},
  unmount(){for(const effect of effects)effect?.cleanup?.();},
 };
}
const user=uid=>({uid,emailVerified:true,getIdToken:async()=>uid});
test('auth observer stays synchronous, waits for readiness and publishes authenticated UI after initialization',async()=>{
 const ready=deferred(),h=harness({user:user('A'),ready:ready.promise});h.render();await h.settle();assert.equal(h.calls.length,0);assert.equal(h.value().loading,true);assert.equal(h.value().user,null);ready.resolve();await h.settle();assert.equal(h.value().loading,false);assert.equal(h.value().user.uid,'A');assert.equal(h.value().fileAccess.phase,'ready');assert.equal(h.notices.length,0);h.unmount();
});
test('Strict Mode setup/cleanup/setup deduplicates session work and maintains one listener/timer',async()=>{
 const hold=deferred(),h=harness({user:user('A'),request:async method=>method==='POST'?hold.promise:ok()});h.render();await h.settle();assert.equal(h.calls.filter(call=>call.method==='POST').length,1);h.strictRemount();await h.settle();assert.equal(h.observers.size,1);assert.equal(h.timers.size,1);hold.resolve(ok());await h.settle();assert.equal(h.calls.filter(call=>call.method==='POST').length,1);assert.equal(h.value().fileAccess.phase,'ready');assert.equal(h.notices.length,0);h.unmount();
});
test('profile completion blocks private-file initialization and a persisted completion can recover',async()=>{
 const identity=user('A'),h=harness({user:identity,profileComplete:false});h.render();await h.settle();assert.equal(h.value().fileAccess.phase,'idle');assert.equal(h.value().profileStatus,'incomplete');assert.equal(h.notices.length,0);assert.equal(h.value().loading,false);h.completeProfile();await h.settle();assert.equal(h.value().fileAccess.phase,'ready');assert.equal(h.value().profileStatus,'complete');assert.equal(h.notices.length,0);h.unmount();
});
test('exhausted retries show one accurate notice; manual Retry recovers and invalidates file queries',async()=>{
 let failing=true;const h=harness({user:user('A'),request:async method=>method==='POST'&&failing?new Response('{}',{status:503}):ok()});h.render();await h.settle();assert.equal(h.calls.filter(call=>call.method==='POST').length,3);assert.equal(h.notices.length,1);assert.equal(h.notices[0].description,'Secure file access is temporarily unavailable. Please try again.');h.render();await h.settle();assert.equal(h.notices.length,1);failing=false;h.notices[0].action.props.onClick();await h.settle();assert.equal(h.value().fileAccess.phase,'ready');assert.equal(h.dismissed.length,1);assert.ok(h.invalidated.includes('property'));assert.ok(h.invalidated.includes('documents'));h.unmount();
});
test('account switch and logout clear caches and do not expose the previous session as ready',async()=>{
 const h=harness({user:user('A')});h.render();await h.settle();h.emit(user('B'));h.render();assert.equal(h.value().loading,true);assert.equal(h.value().user,null);assert.notEqual(h.value().fileAccess.uid,'B');await h.settle();assert.equal(h.value().user.uid,'B');assert.equal(h.value().fileAccess.phase,'ready');h.emit(null);h.render();assert.equal(h.value().user,null);assert.equal(h.value().loading,false);await h.settle();assert.equal(h.value().fileAccess.phase,'idle');assert.equal(h.calls.at(-1).method,'DELETE');assert.equal(h.clearCount(),3);h.unmount();
});
test('API token acquisition cancels the request if the Firebase UID changes while awaiting a token',async()=>{
 const token=deferred(),auth={currentUser:{uid:'A',getIdToken:()=>token.promise},authStateReady:async()=>{}};const output={},calls=[];new Function('exports','require','fetch','window',compile('src/lib/api-client.ts'))(output,name=>name==='@/firebase'?{auth}:name==='@/lib/data-refresh'?{mutationDomains:()=>[],publishDataRefresh:()=>{}}:require(name),async(...args)=>{calls.push(args);return ok();},{location:{origin:'https://public.example'}});
 const request=output.apiFetch('/api/media/file');await tick();auth.currentUser={uid:'B',getIdToken:async()=> 'B'};token.resolve('A');await assert.rejects(()=>request,error=>error.name==='AbortError');assert.equal(calls.length,0);await output.apiFetch('/api/media/file');assert.equal(calls[0][1].headers.get('Authorization'),'Bearer B');
});
test('API requests cannot silently switch UID while Firebase readiness is pending',async()=>{
 const ready=deferred(),auth={currentUser:user('A'),authStateReady:()=>ready.promise},output={},calls=[];new Function('exports','require','fetch','window',compile('src/lib/api-client.ts'))(output,name=>name==='@/firebase'?{auth}:name==='@/lib/data-refresh'?{mutationDomains:()=>[],publishDataRefresh:()=>{}}:require(name),async(...args)=>{calls.push(args);return ok();},{location:{origin:'https://public.example'}});const request=output.apiFetch('/api/media/file');auth.currentUser=user('B');ready.resolve();await assert.rejects(()=>request,error=>error.name==='AbortError');assert.equal(calls.length,0);
});
