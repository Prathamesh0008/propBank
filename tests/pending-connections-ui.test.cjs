const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');

// Render the real component with isolated query results; no browser, database,
// auth service or network is used. Event mutations are covered by API fixtures.
function render(result={},reviewId='') {
  let stateIndex=0;
  const cache=new Map();
  const query={isLoading:false,isFetching:false,isError:false,error:null,refetch:async()=>{},...result};
  const load=file=>{
    if(cache.has(file))return cache.get(file);
    const output={};cache.set(file,output);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    const scopedRequire=name=>{
      if(name==='react')return {...React,useState:initial=>React.useState(++stateIndex===2?reviewId:initial)};
      if(name==='@tanstack/react-query')return {useQuery:()=>query,useQueryClient:()=>({invalidateQueries:async()=>{}})};
      if(name==='@/contexts/AuthContext')return {useAuth:()=>({user:{uid:'tenant',phoneNumber:'+919123456789'}})};
      if(name==='@/lib/api-client')return {apiFetch:()=>{throw new Error('Rendering must not access the network');}};
      if(name==='@/lib/navigation')return {Link:({to,children,...rest})=>React.createElement('a',{href:to,...rest},children)};
      if(name.endsWith('.module.css'))return new Proxy({},{get:(_,key)=>key==='__esModule'?false:String(key)});
      if(name.startsWith('@/'))return load(path.resolve('src',name.slice(2))+'.ts');
      return require(name);
    };
    new Function('require','exports',code)(scopedRequire,output);return output;
  };
  const component=load(path.resolve('src/features/properties/PendingConnections.tsx')).default;
  return renderToStaticMarkup(React.createElement(component));
}
const connection=overrides=>({id:'a'.repeat(64),reference:'aaaaaaaa',relationship:'tenant',status:'pending_tenant_acceptance',viewer:'candidate',version:1,expiresAt:'2099-01-01T00:00:00Z',...overrides});
const data=connections=>({emailVerified:true,connections,truncated:false});

test('pending section renders loading without claiming there are no connections',()=>{const html=render({isLoading:true});assert.match(html,/Pending Connections/);assert.match(html,/role="status"/);assert.match(html,/Loading pending connections/);assert.doesNotMatch(html,/No pending connections/);});

test('verified empty state is compact and contains no illustrative connections',()=>{const html=render({data:data([])});assert.match(html,/No pending connections/);assert.doesNotMatch(html,/Accept Tenancy|Property example|Rental invitation/);});

test('email verification requirement links to existing authentication without phone OTP controls',()=>{const html=render({data:{...data([]),emailVerified:false}});assert.match(html,/Verification Required/);assert.match(html,/verified email that received your invitation/);assert.match(html,/Verify Email<\/a>/);assert.doesNotMatch(html,/No pending connections|Enter OTP|Send OTP/);});

test('rental review and acceptance are shown while unapproved private fields never appear',()=>{const html=render({data:data([connection({propertyId:'PRIVATE-P',propertyLabel:'PRIVATE_ADDRESS',candidateUID:'PRIVATE_UID',candidateEmail:'private@email.invalid',contactE164:'+919999999999'})])});assert.match(html,/Awaiting your confirmation/);assert.match(html,/Review/);assert.match(html,/Accept Tenancy/);assert.match(html,/aria-expanded="false"/);assert.match(html,/Support reference: aaaaaaaa/);assert.doesNotMatch(html,/PRIVATE_ADDRESS|PRIVATE-P|PRIVATE_UID|private@email.invalid|919999999999/);});

test('ownership requests use the existing evidence action and do not expose property details',()=>{const html=render({data:data([connection({relationship:'owner',status:'pending_owner_authorization'})])});assert.match(html,/Ownership verification/);assert.match(html,/Request Ownership Verification/);assert.match(html,/documentary ownership evidence/);assert.doesNotMatch(html,/Accept Tenancy|Approve Tenant Connection/);});

test('owner approvals show only an authorized property label and do not display tenant identity fields',()=>{const html=render({data:data([connection({viewer:'owner',status:'pending_owner_authorization',propertyId:'P',propertyLabel:'Owned apartment / A204',candidateUID:'secret-uid',candidateEmail:'secret@example.invalid'})])});assert.match(html,/Owned apartment \/ A204/);assert.match(html,/Awaiting Owner Approval/);assert.match(html,/Approve Tenant Connection/);assert.match(html,/Reject/);assert.doesNotMatch(html,/secret-uid|secret@example.invalid/);});

test('awaiting admin verification has a clear status without accepting tenancy or bypassing approval',()=>{const html=render({data:data([connection({relationship:'owner',status:'pending_admin_verification'})])});assert.match(html,/Awaiting Admin Verification/);assert.match(html,/existing administrator verification workflow/);assert.doesNotMatch(html,/Accept Tenancy|Request Ownership Verification|Approve Tenant Connection/);});

test('linked records are absent from pending UI and rejected/expired records have no mutation actions',()=>{const html=render({data:data([connection({status:'linked',reference:'LINKED-SECRET'}),connection({id:'b'.repeat(64),reference:'rejected-ref',status:'rejected'}),connection({id:'c'.repeat(64),reference:'expired-ref',status:'expired'})])});assert.match(html,/No pending connections/);assert.match(html,/Rejected \/ Expired/);assert.match(html,/rejected-ref/);assert.match(html,/expired-ref/);assert.doesNotMatch(html,/LINKED-SECRET|Accept Tenancy|Approve Tenant Connection|Request Ownership Verification/);});

test('API failure renders an accessible retry state without presenting stale success',()=>{const html=render({isError:true,error:new Error('Connections unavailable')});assert.match(html,/role="alert"/);assert.match(html,/Connections unavailable/);assert.match(html,/>Retry<\/button>/);assert.doesNotMatch(html,/No pending connections|Confirmation saved/);});


test('tenant review makes acceptance available while explaining when the property appears',()=>{const item=connection({}),before=render({data:data([item])}),after=render({data:data([item])},item.id);assert.match(before,/Tenant connection request/);assert.match(before,/Review Invitation/);assert.match(before,/property will appear after confirmation/);assert.match(before,/<button[^>]*disabled[^>]*>.*?Accept Tenancy/s);assert.match(after,/aria-expanded="true"/);const accept=[...after.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].find(match=>match[2].includes('Accept Tenancy'));assert.ok(accept);assert.doesNotMatch(accept[1],/disabled/);});
test('tenant awaiting owner approval receives a clear explanation and no repeated accept action',()=>{const html=render({data:data([connection({status:'pending_owner_authorization'})])});assert.match(html,/Your acceptance has been recorded/);assert.match(html,/Waiting for the property owner/);assert.doesNotMatch(html,/Accept Tenancy/);});
test('owner can review and authorize sending an admin-created invitation',()=>{const item=connection({viewer:'owner',status:'verification_required',canAuthorizeInvitation:true,propertyLabel:'Owned property'});const html=render({data:data([item])},item.id);assert.match(html,/Authorize &amp; Send Invitation/);assert.match(html,/needs your authorization/);assert.doesNotMatch(html,/Accept Tenancy/);});
