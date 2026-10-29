const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const compile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;

function refreshPolicy(){const output={};new Function('exports','require',compile('src/lib/data-refresh.ts'))(output,name=>name==='react'?{useEffect(){},useRef:value=>({current:value})}:require(name));return output;}

test('mutation dependency map targets all principal business workflows',()=>{
 const {mutationDomains,queryKeysByDomain}=refreshPolicy();
 const cases=[['/api/properties','POST',['properties','relationships']],['/api/tenants/T','PUT',['tenants','relationships','properties','agreements']],['/api/relationship-links','POST',['relationships','properties','tenants']],['/api/documents/D','DELETE',['documents','properties','notifications']],['/api/inspection-reports','POST',['inspections','properties','notifications']],['/api/agreements/renew','POST',['agreements','properties','tenants','ledger','notifications']],['/api/property-hub','PATCH',['properties','tenants','agreements','ledger']],['/api/visits/V','PUT',['visits','notifications']],['/api/service-requests/R','PUT',['services','notifications']],['/api/owner-verification','POST',['verification','properties','relationships','notifications']],['/api/admin/site-settings','PUT',['settings']],['/api/admin/email-deliveries/E/retry','POST',['emails']]];
 for(const [path,method,expected]of cases)assert.deepEqual(Array.from(mutationDomains(path,method)),expected);
 assert.ok(queryKeysByDomain.properties.includes('userProperties'));assert.ok(queryKeysByDomain.properties.includes('archivedProperties'));assert.ok(queryKeysByDomain.relationships.includes('relationshipLinks'));
});

test('reads, validation failures and failed mutations never announce a refresh',async()=>{
 const published=[];let response=new Response('{}',{status:400});const auth={currentUser:null,authStateReady:async()=>{}};
 const policy=refreshPolicy(),output={};new Function('exports','require','fetch','window',compile('src/lib/api-client.ts'))(output,name=>name==='@/firebase'?{auth}:name==='@/lib/data-refresh'?{mutationDomains:policy.mutationDomains,publishDataRefresh:value=>published.push(value)}:require(name),async()=>response,{location:{origin:'http://local'}});
 await output.apiFetch('/api/properties',{method:'POST'});assert.equal(published.length,0);
 response=new Response('{}',{status:200});await output.apiFetch('/api/properties');assert.equal(published.length,0);
});

test('a confirmed mutation publishes once after server success',async()=>{
 const published=[],auth={currentUser:null,authStateReady:async()=>{}},output={};
 new Function('exports','require','fetch','window',compile('src/lib/api-client.ts'))(output,name=>name==='@/firebase'?{auth}:name==='@/lib/data-refresh'?{mutationDomains:(path,method)=>path==='/api/properties/P'&&method==='PATCH'?['properties']:[],publishDataRefresh:value=>published.push(value)}:require(name),async()=>new Response('{"success":true}',{status:200}),{location:{origin:'http://local'}});
 await output.apiFetch('/api/properties/P',{method:'PATCH'});assert.deepEqual(published,[['properties']]);
});

test('property invalidation covers active, archived, detail, hub, counts and admin caches without polling',()=>{
 const source=fs.readFileSync('src/hooks/useProperties.ts','utf8'),policy=refreshPolicy();assert.deepEqual(policy.queryKeysByDomain.properties,['userProperties','allProperties','archivedProperties','property','productHub']);assert.doesNotMatch(source,/refetchInterval/);
});

test('same-origin tab synchronization uses a lightweight broadcast with a storage fallback',()=>{const source=fs.readFileSync('src/lib/data-refresh.ts','utf8');assert.match(source,/BroadcastChannel/);assert.match(source,/storage/);assert.match(source,/source!==source/);});
