const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function harness({existing=false,googleName='Google User',failOnce=false}={}){
 const state=[],calls=[],cache=new Map();let index=0,created=0,profileFailures=failOnce?1:0;
 const user={uid:'firebase-fixture',email:'person@example.invalid',displayName:googleName,emailVerified:true,photoURL:'',getIdToken:async()=> 'isolated-token',reload:async()=>{}};
 const auth={currentUser:null};const navigation=[];
 class FirebaseError extends Error{}
 const apiFetch=async(url,init={})=>{const body=init.body?JSON.parse(init.body):undefined;calls.push({url,method:init.method||'GET',body});if(url==='/api/auth/user'&&!init.method)return new Response(JSON.stringify({profileExists:existing,profileComplete:existing}),{status:200});if(url==='/api/auth/user'&&init.method==='POST'&&profileFailures-- >0)return new Response(JSON.stringify({message:'Profile save failed'}),{status:503});if(url==='/api/auth/login')return new Response(JSON.stringify({user:{role:'individual'}}));return new Response(JSON.stringify({success:true}));};
 const fakeReact={...React,useState:initial=>{const key=index++;if(!(key in state))state[key]=initial;return [state[key],value=>{state[key]=typeof value==='function'?value(state[key]):value;}];},useEffect:()=>{},useMemo:fn=>fn(),useId:()=> 'registration-mobile'};
 const load=file=>{if(cache.has(file))return cache.get(file);const output={};cache.set(file,output);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const scoped=name=>{
  if(name==='react')return fakeReact;if(name==='firebase/app')return {FirebaseError};
  if(name==='firebase/auth')return {GoogleAuthProvider:{},createUserWithEmailAndPassword:async()=>{created++;auth.currentUser=user;return {user};},signInWithEmailAndPassword:async()=>({user}),updateProfile:async()=>{},sendEmailVerification:async()=>{},sendPasswordResetEmail:async()=>{},linkWithCredential:async()=>{}};
  if(name==='@/firebase')return {auth,signInWithGoogle:async()=>{auth.currentUser=user;return {user};},signOutUser:async()=>{auth.currentUser=null;}};
  if(name==='@/lib/api-client')return {apiFetch,loadAuthProfile:async()=>{const response=await apiFetch('/api/auth/user');return {response,data:await response.clone().json()};}};if(name==='@/lib/navigation')return {useNavigate:()=>value=>navigation.push(value)};
  if(name==='lucide-react')return {Eye:()=>null,EyeOff:()=>null};if(name.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
  if(name.startsWith('./'))return load(path.resolve(path.dirname(file),name)+'.tsx');return require(name);
 };new Function('require','exports',code)(scoped,output);return output;};
 const Component=load(path.resolve('src/features/auth/GoogleAuth.tsx')).default;
 const render=()=>{index=0;return Component();};
 const all=tree=>{if(tree==null||typeof tree==='boolean')return [];if(Array.isArray(tree))return tree.flatMap(all);if(typeof tree!=='object')return [];if(typeof tree.type==='function')return all(tree.type(tree.props));return [tree,...all(tree.props?.children)];};
 const text=tree=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
 const find=(predicate)=>all(render()).find(predicate);
 const button=label=>find(node=>node.type==='button'&&text(node)===label);
 const input=(type)=>find(node=>node.type==='input'&&(node.props.type||'text')===type);
 const change=(node,value)=>node.props.onChange({target:{value}});
 const submit=()=>find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
 return {render,all,text,find,button,input,change,submit,click:async label=>{button(label).props.onClick();await new Promise(setImmediate);},calls,navigation,user,created:()=>created,html:()=>renderToStaticMarkup(render())};
}
test('registration places a required fixed-country mobile field between email and password; sign-in has none',()=>{
 const h=harness();assert.doesNotMatch(h.html(),/Mobile number/);h.button('Create account').props.onClick();const html=h.html();assert.ok(html.indexOf('Email address')<html.indexOf('Mobile number'));assert.ok(html.indexOf('Mobile number')<html.indexOf('Password'));assert.match(html,/\+91/);const input=h.input('tel');assert.equal(input.props.required,true);assert.equal(input.props.inputMode,'numeric');assert.equal(input.props.autoComplete,'tel-national');assert.equal(input.props.maxLength,10);assert.equal(input.props.pattern,'[6-9][0-9]{9}');
});
test('mobile input removes non-digits, caps length and renders accessible inline validation',async()=>{
 const h=harness();h.button('Create account').props.onClick();h.input('tel').props.onBlur();assert.match(h.html(),/Mobile number is required/);h.change(h.input('tel'),'a51234x');assert.equal(h.input('tel').props.value,'51234');assert.match(h.html(),/Enter 10 digits starting with 6, 7, 8 or 9/);assert.equal(h.input('tel').props['aria-invalid'],true);await h.submit();assert.equal(h.created(),0);h.change(h.input('tel'),'987654321099abc');assert.equal(h.input('tel').props.value,'9876543210');assert.equal(h.input('tel').props['aria-invalid'],false);
});
test('email registration submits the selected role and canonical contact only after validation',async()=>{
 const h=harness();h.button('Create account').props.onClick();h.change(h.input('text'),'New Person');h.change(h.input('email'),'person@example.invalid');h.change(h.input('password'),'fixture-password');h.change(h.input('tel'),'9876543210');const agent=h.find(node=>node.type==='input'&&node.props.type==='radio'&&node.props.checked===false);agent.props.onChange();await h.submit();const profile=h.calls.find(call=>call.method==='POST'&&call.url==='/api/auth/user');assert.equal(profile.body.phoneNumber,'+919876543210');assert.equal(profile.body.role,'agent');assert.equal(h.created(),1);
});
test('new Google user completes the same form without automatic profile creation or a second Firebase account',async()=>{
 const h=harness();await h.click('Continue with Google');assert.equal(h.calls.filter(call=>call.method==='POST').length,0);assert.match(h.html(),/Create your account/);assert.equal(h.input('password'),undefined);assert.equal(h.input('email').props.readOnly,true);assert.equal(h.input('text').props.value,'Google User');await h.submit();assert.equal(h.calls.filter(call=>call.method==='POST').length,0);h.change(h.input('tel'),'9123456789');await h.submit();assert.equal(h.created(),0);const profile=h.calls.find(call=>call.method==='POST'&&call.url==='/api/auth/user');assert.equal(profile.body.uid,'firebase-fixture');assert.equal(profile.body.phoneNumber,'+919123456789');assert.deepEqual(h.navigation,['/manage-property']);
});
test('existing Google profile signs in without requiring a contact or writing registration data',async()=>{
 const h=harness({existing:true});await h.click('Continue with Google');assert.equal(h.created(),0);assert.ok(!h.calls.some(call=>call.url==='/api/auth/user'&&call.method==='POST'));assert.ok(h.calls.some(call=>call.url==='/api/auth/login'));assert.deepEqual(h.navigation,['/manage-property']);
});
test('existing password login requires no mobile and never calls registration',async()=>{
 const h=harness({existing:true});h.change(h.input('email'),'person@example.invalid');h.change(h.input('password'),'fixture-password');await h.submit();assert.equal(h.input('tel'),undefined);assert.equal(h.created(),0);assert.ok(!h.calls.some(call=>call.url==='/api/auth/user'&&call.method==='POST'));assert.deepEqual(h.navigation,['/manage-property']);
});
test('failed profile persistence retries completion using the already created Firebase account',async()=>{
 const h=harness({failOnce:true});h.button('Create account').props.onClick();h.change(h.input('text'),'New Person');h.change(h.input('email'),'person@example.invalid');h.change(h.input('password'),'fixture-password');h.change(h.input('tel'),'9876543210');await h.submit();assert.equal(h.created(),1);assert.match(h.html(),/Profile save failed/);assert.equal(h.input('password'),undefined);await h.submit();assert.equal(h.created(),1);assert.equal(h.calls.filter(call=>call.url==='/api/auth/user'&&call.method==='POST').length,2);
});
