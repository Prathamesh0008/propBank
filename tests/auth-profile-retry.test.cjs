const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

function loadProfileClient(fetchImpl,override){
  const source=ts.transpileModule(fs.readFileSync('src/lib/api-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  const auth=override||{currentUser:{uid:'member',getIdToken:async()=> 'token'},authStateReady:async()=>{}};
  const context=vm.createContext({exports,Headers,Request,Response,URL,setTimeout,fetch:fetchImpl,window:{location:{origin:'http://local'}},require:name=>{
    if(name==='@/firebase')return {auth};
    if(name==='@/lib/data-refresh')return {mutationDomains:()=>[],publishDataRefresh:()=>{}};
    return require(name);
  }});
  vm.runInContext(source,context);
  return exports;
}

test('concurrent profile checks share one bounded retry sequence and recover',async()=>{
  let calls=0;
  const client=loadProfileClient(async()=>new Response(JSON.stringify(++calls===1?{message:'temporary'}:{profileComplete:true}),{status:calls===1?503:200,headers:{'Content-Type':'application/json'}}));
  const [first,second]=await Promise.all([client.loadAuthProfile('member'),client.loadAuthProfile('member')]);
  assert.equal(calls,2);assert.equal(first.response.status,200);assert.equal(second.data.profileComplete,true);
});

test('profile service failures stop after one retry and never become successful',async()=>{
  let calls=0;
  const client=loadProfileClient(async()=>{calls++;return new Response(JSON.stringify({message:'unavailable'}),{status:503,headers:{'Content-Type':'application/json'}});});
  const result=await client.loadAuthProfile('member');
  assert.equal(calls,2);assert.equal(result.response.status,503);assert.notEqual(result.data.profileComplete,true);
});

test('confirmed Firestore resource exhaustion is not retried automatically',async()=>{
  let calls=0;
  const client=loadProfileClient(async()=>{calls++;return new Response(JSON.stringify({code:'FIRESTORE_RESOURCE_EXHAUSTED',message:'service limit'}),{status:503,headers:{'Content-Type':'application/json'}});});
  const result=await client.loadAuthProfile('member');
  assert.equal(calls,1);assert.equal(result.response.status,503);assert.equal(result.data.code,'FIRESTORE_RESOURCE_EXHAUSTED');
});

test('verified-email refresh challenge retries a safe read once with the fresh token',async()=>{
 let calls=0,refreshes=0;const auth={currentUser:{uid:'member',getIdToken:async force=>{if(force)refreshes++;return force?'fresh':'old';}},authStateReady:async()=>{}};
 const client=loadProfileClient(async(_url,init)=>{calls++;if(calls===2)assert.equal(init.headers.get('Authorization'),'Bearer fresh');return Response.json(calls===1?{code:'TOKEN_REFRESH_REQUIRED'}:{profileComplete:true},{status:calls===1?401:200});},auth);
 assert.equal((await client.loadAuthProfile('member')).response.status,200);assert.equal(calls,2);assert.equal(refreshes,1);
});
test('email refresh never replays mutations or unrelated 401 responses',async()=>{
 for(const method of ['GET','PATCH']){let calls=0;const client=loadProfileClient(async()=>{calls++;return Response.json({code:method==='GET'?'OTHER_FAILURE':'TOKEN_REFRESH_REQUIRED'},{status:401});});const r=await client.apiFetch('/api/account',{method});assert.equal(r.status,401);assert.equal(calls,1);}
});
test('account switching during forced refresh prevents replay with another identity',async()=>{
 let calls=0;const auth={currentUser:{uid:'member',getIdToken:async force=>{if(force)auth.currentUser={uid:'other',getIdToken:async()=> 'other'};return 'token';}},authStateReady:async()=>{}};
 const client=loadProfileClient(async()=>{calls++;return Response.json({code:'TOKEN_REFRESH_REQUIRED'},{status:401});},auth);
 await assert.rejects(()=>client.loadAuthProfile('member'),/Account changed/);assert.equal(calls,1);
});
