const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const record=(id='R',extra={})=>({id,userUID:'tenant',propertyId:'P',serviceId:'plumbing',serviceName:'Plumbing',status:'pending',message:'Kitchen tap is leaking',createdAt:'2026-11-18T06:00:00Z',updatedAt:'2026-11-18T06:00:00Z',history:[{status:'pending',actorUID:'tenant',at:'2026-11-18T06:00:00Z'}],...extra});
function setup(records={R:record()}) {return isolated({users:{...users,tenant:{...users.tenant,name:'Actual Requester',phoneNumber:'+919123456782'}},properties:{P:{...properties.P,title:'Cedar Residence',buildingName:'Cedar Residence',unitNumber:'204',address:'Fixture Road'}},service_requests:records});}
const list=(a,query='',uid='admin')=>route(a,'service-requests').GET(request('/service-requests?admin=true&directory=true'+query,uid));
const detail=(a,id='R',uid='admin')=>route(a,'service-requests/[id]').GET(request('/service-requests/'+id,uid),context(id));
const put=(a,body,uid='admin')=>route(a,'service-requests/[id]').PUT(request('/service-requests/R',uid,'PUT',body),context('R'));
test('directory uses actual requester UID, current profile and property records, not owner snapshots',async()=>{
  const a=setup({R:record('R',{userName:'Old snapshot',userPhone:'old',ownerName:'Wrong owner'})}),r=await list(a);assert.equal(r.status,200,await r.clone().text());const body=await r.json(),row=body.data[0];
  assert.equal(row.requester.name,'Actual Requester');assert.equal(row.requester.uid,'tenant');assert.equal(row.requester.role,'Tenant');assert.equal(row.requester.mobile,'+919123456782');
  assert.equal(row.propertySummary.name,'Cedar Residence');assert.equal(row.propertySummary.unit,'204');assert.equal(row.history,undefined);assert.equal(row.image,undefined);assert.equal(row.message,undefined);
  assert.ok(a.reads.filter(r=>['users','properties'].includes(r.collection)&&!r.id).every(r=>r.filters.some(([key,,op])=>key==='__name__'&&op==='in')));assert.equal(a.writes.length,0);
});
test('owner, agent and missing-profile identities are labeled honestly without owner substitution',async()=>{
  const a=setup({A:record('A',{userUID:'owner'}),B:record('B',{userUID:'other'}),C:record('C',{userUID:'gone',userName:'Historical requester'})});
  const rows=(await (await list(a)).json()).data;
  assert.equal(rows.find(r=>r.id==='A').requester.role,'Owner');assert.equal(rows.find(r=>r.id==='B').requester.role,'Registered user');
  const missing=rows.find(r=>r.id==='C');assert.equal(missing.requester.name,'Historical requester');assert.equal(missing.requester.profileAvailable,false);assert.equal(missing.requester.source,'submission_snapshot');
});
test('newest-first snapshot pagination handles tied timestamps without omissions or duplicates',async()=>{
  const records=Object.fromEntries(Array.from({length:8},(_,i)=>{const id=String(i).padStart(2,'0');return [id,record(id,{createdAt:i<4?'2026-11-17T06:00:00Z':'2026-11-18T06:00:00Z'})]})),a=setup(records),ids=[];let cursor='';
  do {const r=await list(a,'&pageSize=3&cursor='+cursor);assert.equal(r.status,200,await r.clone().text());const b=await r.json();ids.push(...b.data.map(r=>r.id));cursor=b.nextCursor||'';}while(cursor);
  assert.deepEqual(ids,['07','06','05','04','03','02','01','00']);assert.equal(new Set(ids).size,8);
});
test('hundreds of requests use bounded pages and constant batched relationship queries',async()=>{
  const records=Object.fromEntries(Array.from({length:250},(_,i)=>{const id=String(i).padStart(3,'0');return [id,record(id)]}));
  const baseline=setup(records),db=baseline.load('@/lib/server/firestore').getDatabase();const old=await db.collection('service_requests').get();assert.equal(old.docs.length,250);
  const a=setup(records),r=await list(a,'&pageSize=25'),b=await r.json();assert.equal(b.data.length,25);assert.ok(b.nextCursor);
  const requests=a.reads.filter(r=>r.collection==='service_requests'&&!r.id);assert.equal(requests.length,1);assert.equal(requests[0].returnedDocuments,26);
  const related=a.reads.filter(r=>['users','properties'].includes(r.collection)&&!r.id);assert.equal(related.length,2);assert.equal(related.reduce((n,r)=>n+r.returnedDocuments,0),2);
});
test('undated legacy continuation stays bounded and does not fabricate dates',async()=>{
  const a=setup({A:record('A'),B:record('B',{createdAt:undefined}),C:record('C',{createdAt:null}),D:record('D',{createdAt:'0001-01-01T00:00:00Z'})});
  const ids=[];let cursor='';do {const b=await (await list(a,'&mode=undated&pageSize=2&cursor='+cursor)).json();ids.push(...b.data.map(r=>r.id));cursor=b.nextCursor||'';}while(cursor);
  assert.deepEqual(ids,['D','C','B']);assert.ok(!ids.includes('A'));
});
test('directory/detail require administrator and validate page/cursor inputs before data exposure',async()=>{
  for(const uid of ['owner','tenant','other',null]) {const a=setup();assert.equal((await list(a,'',uid)).status,uid?403:401);assert.equal((await detail(a,'R',uid)).status,uid?403:401);}
  for(const query of ['&pageSize=51','&pageSize=0','&mode=all','&cursor=a%2Fb'])assert.equal((await list(setup(),query)).status,400);
  assert.equal((await list(setup(),'&cursor=deleted')).status,409);
});
test('owner/tenant request APIs keep existing scoping and receive no admin enrichment',async()=>{
  const a=setup({R:record(),O:record('O',{userUID:'owner'})});
  const r=await route(a,'service-requests').GET(request('/service-requests?propertyId=P','tenant'));assert.equal(r.status,200);const b=await r.json();assert.deepEqual(b.data.map(r=>r.id),['R']);assert.equal(b.data[0].requester,undefined);
});
test('selected-request details include only its real history, actor names and bound media references',async()=>{
  const a=setup({R:record('R',{image:'/api/media/original',resolutionReport:'Recorded work',adminNotes:'Recorded update',history:[{status:'resolved',actorUID:'admin',comment:'Actual note',at:'2026-11-18T08:00:00Z'}]}),OTHER:record('OTHER',{message:'Other request secret'})});
  const r=await detail(a);assert.equal(r.status,200);const b=await r.json();assert.equal(b.request.history[0].actorName,'Admin');assert.equal(b.request.image,'/api/media/original');assert.ok(!JSON.stringify(b).includes('Other request secret'));assert.equal(a.writes.length,0);
  assert.equal((await detail(a,'missing')).status,404);
});
test('resolved/completed remain distinct; resolution and archive preserve notification staging and history',async()=>{
  const a=setup();let r=await put(a,{status:'resolved',resolutionReport:'Tap repaired',adminNotes:'Please review'});assert.equal(r.status,200,await r.clone().text());
  assert.equal(a.state.service_requests.R.status,'resolved');assert.equal(a.state.service_requests.R.isArchived,undefined);assert.equal(a.state.service_requests.R.history.at(-1).comment,'Please review');
  assert.ok(Object.values(a.state.email_deliveries||{}).some(r=>r.sourceEventType==='maintenance.resolved'));await a.flush();
  r=await put(a,{status:'completed'});assert.equal(r.status,200);assert.equal(a.state.service_requests.R.status,'completed');
  r=await put(a,{action:'archive'});assert.equal(r.status,200);assert.equal(a.state.service_requests.R.isArchived,true);assert.equal(a.state.service_requests.R.status,'completed');
  assert.equal(a.state.service_requests.R.resolutionReport,'Tap repaired');assert.equal(a.state.service_requests.R.history.at(-1).action,'archive');
});
test('unauthorized updates, invalid status and failed persistence do not report successful resolution',async()=>{
  for(const uid of ['owner','tenant','other'])assert.equal((await put(setup(),{status:'resolved'},uid)).status,403);
  assert.equal((await put(setup(),{status:'fake'})).status,400);
  const a=setup();a.env.TEST_DB_WRITE_COLLECTION='email_deliveries';assert.equal((await put(a,{status:'resolved',adminNotes:'Should not commit'})).status,500);assert.equal(a.state.service_requests.R.status,'pending');
});

function loadUI(options={}) {
  const cache=new Map(),captured={queries:[],infinite:[],calls:[],invalidations:[]};let slots=[],index=0;
  const stateReact={...React,useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef(value){const i=index++;if(!(i in slots))slots[i]={current:value};return slots[i];}};
  function load(file){file=path.resolve(file);if(!path.extname(file))file+=fs.existsSync(file+'.tsx')?'.tsx':'.ts';if(cache.has(file))return cache.get(file);const out={};cache.set(file,out);
    const scoped=name=>{
      if(name==='react')return stateReact;
      if(name==='@/contexts/AuthContext')return {useAuth:()=>({user:{uid:'admin'},fileAccess:options.fileAccess||{phase:'ready'},retryFileAccess:()=>captured.calls.push('retry')})};
      if(name==='@tanstack/react-query')return {useInfiniteQuery:c=>{captured.infinite.push(c);return {data:options.page?{pages:[options.page]}:undefined,isLoading:options.loading,error:options.error,hasNextPage:!!options.page?.nextCursor,isFetchingNextPage:options.fetchingNext,refetch:async()=>{},fetchNextPage:()=>captured.calls.push('more')};},useQuery:c=>{captured.queries.push(c);return {data:options.detail,isLoading:false,refetch:async()=>{}};},useQueryClient:()=>({invalidateQueries:async config=>captured.invalidations.push(config)})};
      if(name==='@/ui/button')return {Button:({children,variant,size,...props})=>React.createElement('button',props,children)};
      if(name==='@/ui/input')return {Input:props=>React.createElement('input',props)};
      if(name==='@/ui/textarea')return {Textarea:props=>React.createElement('textarea',props)};
      if(name==='@/ui/date-picker')return {DateRangePicker:()=>React.createElement('div',null,'Date filters')};
      if(name==='@/ui/dialog')return {Dialog:({open,children})=>open?React.createElement('div',{'data-dialog':true},children):null,...Object.fromEntries(['DialogContent','DialogTitle','DialogHeader','DialogDescription'].map(k=>[k,({children})=>React.createElement('div',null,children)]))};
      if(name==='@/components/SessionMediaImage')return {__esModule:true,default:props=>React.createElement('img',props)};
      if(name==='@/features/services/ServiceRequestWorkflow')return {readFile:async()=> 'data:image/png;base64,AQID'};
      if(name==='@/lib/client-workflows')return {workflowRequest:async(...args)=>{captured.calls.push(args);if(options.fail)throw Error('Isolated save failed');return args[0].startsWith('upload/')?{url:'/api/media/resolution'}:{success:true};}};
      if(name==='@/lib/api-client')return {apiFetch:async(...args)=>{captured.calls.push(args);return Response.json(options.page||{data:[],nextCursor:null});}};
      if(name.endsWith('.module.css'))return {__esModule:true,default:new Proxy({},{get:(_,k)=>String(k)})};
      if(name.startsWith('@/'))return load(path.resolve('src',name.slice(2)));if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name));return require(name);
    };
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','exports',code)(scoped,out);return out;
  }
  const component=load('src/features/admin/AdminServiceRequestsWorkspace.tsx'),helpers=load('src/lib/admin-service-request-directory.ts');
  return {component,helpers,captured,render(name,props){index=0;return component[name](props);}};
}
const row={id:'R',propertyId:'P',serviceName:'Plumbing',status:'pending',createdAt:'2026-11-18T06:00:00Z',requester:{uid:'tenant',name:'Actual Requester',email:'tenant@test.invalid',mobile:'9000000000',role:'Tenant',profileAvailable:true,source:'current_profile'},propertySummary:{id:'P',name:'Cedar Residence',unit:'204',address:'Fixture Road',available:true}};
const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
test('compact table displays meaningful fields and opens details by mouse and keyboard without inline forms',()=>{
  const h=loadUI(),calls=[],tree=h.component.ServiceRequestTable({rows:[row],onSelect:r=>calls.push(r.id)}),html=renderToStaticMarkup(tree);
  for(const text of ['Requested by','Actual Requester','Tenant','Cedar Residence','204','Plumbing','18/11/2026','Pending','View Details'])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/<form|Resolution report|propertyId|>P</);const tr=nodes(tree).find(n=>n.type==='tr'&&n.props.tabIndex===0);tr.props.onClick();tr.props.onKeyDown({target:tr,currentTarget:tr,key:'Enter',preventDefault(){}});assert.deepEqual(calls,['R','R']);
});
test('search/filter/sort operate on loaded names, include continuation and deduplicate appended pages',()=>{
  const {helpers}=loadUI(),other={...row,id:'B',serviceName:'Cleaning',status:'resolved',createdAt:'2026-11-17T21:00:00Z'},filters={search:'cedar',status:'',category:'',from:'2026-11-18',to:'2026-11-18',archived:false};
  assert.equal(helpers.visibleServiceRequests([row,other],filters).length,2);assert.equal(helpers.visibleServiceRequests([row,other],{...filters,search:'actual',category:'Cleaning'}).length,1);
  assert.equal(helpers.visibleServiceRequests([row,other],{...filters,status:'completed'}).length,0);assert.equal(helpers.uniqueRequestRows([row,row,other]).length,2);
  assert.equal(helpers.requestMetrics([row,other]).resolved,1);assert.equal(helpers.requestMetrics([row,other]).completed,0);
});
test('workspace keeps queries identity-scoped, paginated, on-demand and honest about loaded coverage',async()=>{
  const h=loadUI({page:{data:[row],nextCursor:'R'}}),tree=h.render('default',{onViewProperty(){}}),html=renderToStaticMarkup(tree);
  assert.match(html,/Counts for loaded requests/);assert.match(html,/Search and filters cover loaded records only/);assert.match(html,/Load more requests/);assert.doesNotMatch(html,/Save resolution and status/);
  assert.equal(h.captured.queries[0].enabled,false);assert.equal(h.captured.infinite[0].refetchOnWindowFocus,false);assert.equal(h.captured.infinite[0].staleTime,60000);
  assert.equal(h.captured.infinite[0].getNextPageParam({nextCursor:'R'}),'R');assert.equal(h.captured.infinite[0].getNextPageParam({nextCursor:null}),undefined);
  await h.captured.infinite[0].queryFn({pageParam:'R',signal:undefined});assert.match(h.captured.calls[0][0],/cursor=R/);assert.match(h.captured.calls[0][0],/pageSize=25/);
  const fetching=loadUI({page:{data:[row],nextCursor:'R'},fetchingNext:true});assert.match(renderToStaticMarkup(fetching.render('default',{onViewProperty(){}})),/disabled=""[^>]*>Loading/);
});
test('details retain inputs, existing report, real history, profile/property actions and private media handling',()=>{
  const h=loadUI(),r={...row,message:'Tap is leaking',resolutionReport:'Previous report',image:'/api/media/private',history:[{status:'resolved',actorUID:'admin',actorName:'Admin',at:row.createdAt,comment:'Actual update'}]};
  const html=renderToStaticMarkup(React.createElement(h.component.ServiceRequestDetails,{record:r,onViewProperty(){},onViewUser(){},onChanged:async()=>{}}));
  for(const text of ['Actual Requester','9000000000','tenant@test.invalid','View requester profile','View Property','Tap is leaking','Previous report','Actual update','Admin','18/11/2026','Resolution report','Update for requester','Save resolution and status','Archive request'])assert.ok(html.includes(text),text);
  assert.match(html,/maxLength="8000"/);assert.match(html,/maxLength="4000"/);
  const blocked=loadUI({fileAccess:{phase:'unavailable',message:'File session unavailable'}}),blockedHtml=renderToStaticMarkup(React.createElement(blocked.component.ServiceRequestDetails,{record:r,onViewProperty(){},onChanged:async()=>{}}));
  assert.match(blockedHtml,/Retry secure file access/);assert.doesNotMatch(blockedHtml,/href="\/api\/media\/private"/);
});
test('empty/error states and production demo exclusion remain explicit',()=>{
  for(const options of [{},{error:Error('Fixture query failed')},{loading:true}]){const h=loadUI(options),html=renderToStaticMarkup(h.render('default',{onViewProperty(){}}));assert.match(html,/No matching requests in the loaded records/);if(options.error)assert.match(html,/Fixture query failed/);if(options.loading)assert.match(html,/Loading requests/);assert.doesNotMatch(html,/Load more requests/);}
  const a=isolated({users});assert.equal(a.load('@/lib/demo-form-data').isDemoAutofillEnvironment('prop-bank.vercel.app','production'),false);
  const source=fs.readFileSync('src/features/admin/AdminPortal.tsx','utf8');assert.match(source,/activeTab==='service-requests'&&<AdminServiceRequestsWorkspace/);assert.doesNotMatch(source,/<ServiceRequestHistory admin/);
});
test('resolution submits the selected request and managed attachment; a failed save retains an error',async()=>{
  const original=global.FormData;
  global.FormData=class{constructor(form){this.values=form.values;}get(key){return this.values[key];}};
  try {
    for(const fail of [false,true]) {
      const h=loadUI({fail}),changed=[],props={record:row,onViewProperty(){},onChanged:async()=>changed.push('changed')},tree=h.render('ServiceRequestDetails',props);
      const form=nodes(tree).find(n=>n.type==='form');form.props.onSubmit({preventDefault(){},currentTarget:{values:{status:'resolved',resolutionReport:'Tap repaired',adminNotes:'Ready for review'}}});
      await new Promise(resolve=>setImmediate(resolve));
      const call=h.captured.calls.find(args=>Array.isArray(args)&&args[0]==='service-requests/R');assert.equal(call[2],'PUT');assert.equal(call[1].status,'resolved');assert.equal(call[1].resolutionReport,'Tap repaired');
      const html=renderToStaticMarkup(h.render('ServiceRequestDetails',props));
      if(fail){assert.match(html,/Isolated save failed/);assert.doesNotMatch(html,/Resolution and status saved/);assert.equal(changed.length,0);}else {assert.match(html,/Resolution and status saved/);assert.equal(changed.length,1);}
    }
    const h=loadUI(),tree=h.render('ServiceRequestDetails',{record:row,onViewProperty(){},onChanged:async()=>{}});
    nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){},currentTarget:{values:{status:'resolved',attachment:new File(['fixture'],'resolution.png',{type:'image/png'})}}});
    await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.captured.calls[0][0],'upload/service-request-image');assert.equal(h.captured.calls[0][1].requestId,'R');assert.equal(h.captured.calls[1][1].adminImage,'/api/media/resolution');
  }finally {global.FormData=original;}
});
test('archive confirmation prevents accidental writes and never changes lifecycle status',async()=>{
  const original=global.window;
  try {for(const confirmed of [false,true]) {global.window={confirm:()=>confirmed};const h=loadUI(),tree=h.render('ServiceRequestDetails',{record:row,onViewProperty(){},onChanged:async()=>{}});
    nodes(tree).find(n=>n.props?.children==='Archive request').props.onClick();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(h.captured.calls.length,confirmed?1:0);if(confirmed)assert.deepEqual(h.captured.calls[0],['service-requests/R',{action:'archive'},'PUT']);
  }}finally{global.window=original;}
});
