const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {isolated,users,properties,request}=require('./fixtures/native-server.cjs');
const {QueryClient}=require('@tanstack/react-query');
function hook(file,fetch){const output={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('exports','require',code)(output,name=>name==='@tanstack/react-query'?{useQuery:options=>options}:name==='@/lib/api-client'?{apiFetch:fetch}:name==='@/contexts/AuthContext'?{useAuth:()=>({user:{uid:'owner'},loading:false})}:{});return output;}
test('Manage Property makes one request and preserves owned and tenant rows',async()=>{
 const calls=[];const hooks=hook('src/hooks/useProperties.ts',async url=>{calls.push(url);return Response.json({success:true,properties:[{id:'O',ownerUID:'owner',userRole:'owner',status:'active'},{id:'T',ownerUID:'other',userRole:'tenant'},{id:'A',ownerUID:'other',userRole:'agent'}]});});
 const query=hooks.useUserProperties({uid:'owner'}),data=await query.queryFn();assert.equal(calls.length,1);assert.deepEqual(data.owned.map(p=>p.id),['O']);assert.deepEqual(data.tenant.map(p=>p.id),['T']);assert.equal(query.staleTime,60000);assert.equal(query.retry,false);
 assert.equal(hooks.useAllProperties(false).enabled,false);
});
test('user directory is disabled outside Agents tab',()=>{assert.equal(hook('src/hooks/useUsers.ts').useAllUsers(false).enabled,false);});
test('combined property list preserves the dedicated tenant endpoint projection',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,price:12345}}});const service=app.load('@/lib/server/services/properties');
 const combined=await (await service.listProperties(request('/properties?ownerUID=tenant','tenant'))).json();
 const dedicated=await (await service.listTenantProperties(request('/properties/tenant?tenantUID=tenant','tenant'))).json();
 assert.deepEqual(combined.properties,dedicated.properties);assert.equal(combined.properties[0].price,12345);
});
test('archive query filters in Firestore and still requires administrator authorization',async()=>{
 const app=isolated({users,admin_notifications:{A:{id:'A',type:'general_inquiry',isRead:true,timestamp:new Date()},B:{id:'B',type:'general_inquiry',isRead:false,timestamp:new Date()}}});
 const service=app.load('@/lib/server/services/notifications');const response=await service.listNotifications(request('/admin/notifications?unread=false','admin'));assert.equal(response.status,200);assert.deepEqual((await response.json()).map(row=>row.id),['A']);assert.ok(app.reads.some(row=>row.collection==='admin_notifications'&&row.filters?.some(([key,value])=>key==='isRead'&&value===true)));
 await assert.rejects(()=>service.listNotifications(request('/admin/notifications?unread=false','tenant')),error=>error.status===403);
 assert.equal(app.reads.find(row=>row.collection==='admin_notifications').estimatedDocumentReads,1);
});
test('document type is filtered by the database after property membership authorization',async()=>{
 const app=isolated({users,properties,documents:{A:{propertyId:'P',documentType:'payment_receipt',createdAt:new Date()},B:{propertyId:'P',documentType:'agreement',createdAt:new Date()}}});
 const response=await app.load('@/lib/server/services/documents').listDocuments(request('/documents/property/P?documentType=payment_receipt','owner'),'P');assert.equal(response.status,200);assert.equal((await response.json()).documents.length,1);assert.ok(app.reads.some(row=>row.collection==='documents'&&row.filters?.some(([key,value])=>key==='documentType'&&value==='payment_receipt')));
 assert.equal(app.reads.find(row=>row.collection==='documents').estimatedDocumentReads,1);
});

test('fresh reads deduplicate, mutation invalidation refetches, and different identities do not share data',async()=>{
 const cache=new QueryClient({defaultOptions:{queries:{staleTime:60000,retry:false}}});let calls=0;
 const options=uid=>({queryKey:['userProperties',uid],queryFn:async()=>({uid,call:++calls})});
 try{await Promise.all([cache.fetchQuery(options('owner')),cache.fetchQuery(options('owner'))]);await cache.fetchQuery(options('owner'));assert.equal(calls,1);
 await cache.invalidateQueries({queryKey:['userProperties'],refetchType:'none'});await cache.fetchQuery(options('owner'));assert.equal(calls,2);
 assert.equal((await cache.fetchQuery(options('tenant'))).uid,'tenant');assert.equal(calls,3);
 cache.clear();await cache.fetchQuery(options('owner'));assert.equal(calls,4);
 }finally{cache.clear();}
});

test('role-only administrator check reads one current profile and no property/activity collections',async()=>{
 const app=isolated({users,properties}),service=app.load('@/lib/server/services/users');
 const response=await service.readUser(request('/users/admin?summary=true','admin'),'admin');
 assert.equal((await response.json()).user.role,'admin');
 assert.equal(app.reads.filter(row=>row.collection==='users').length,1);
 assert.ok(!app.reads.some(row=>['properties','auth_activity'].includes(row.collection)));
 app.state.users.admin.role='individual';
 const next=await service.readUser(request('/users/admin?summary=true','admin'),'admin');assert.equal((await next.json()).user.role,'individual');
});

test('public query reads only explicitly approved active properties',async()=>{
 const app=isolated({users,properties:{A:{...properties.P,moderationStatus:'approved'},B:{...properties.P,moderationStatus:'pending_review'},C:{...properties.P,moderationStatus:'rejected'}}});
 const response=await app.load('@/lib/server/services/properties').listProperties(request('/properties'));
 assert.equal(response.status,200);const read=app.reads.find(row=>row.collection==='properties');
 assert.ok(read.filters.some(([field,value])=>field==='moderationStatus'&&value==='approved'));assert.equal(read.returnedDocuments,1);
});

test('email history uses bounded snapshot cursor pages including equal timestamps, masking, filters and legacy access',async()=>{
 const deliveries=Object.fromEntries(Array.from({length:125},(_,i)=>['D'+String(i).padStart(3,'0'),{status:i%2?'failed':'sent',eventType:'test',createdAt:new Date('2026-10-01T00:00:00Z'),recipientEmail:'fixture@example.invalid',html:'PRIVATE',text:'PRIVATE'}]));
 deliveries.legacy={status:'sent',recipientEmail:'legacy@example.invalid'};
 const app=isolated({users,email_deliveries:deliveries}),service=app.load('@/lib/server/services/transactional-email');
 let cursor='',ids=[];
 do{const response=await service.listEmailDeliveries(request('/admin/email-deliveries?pageSize=50'+(cursor?'&after='+cursor:''),'admin'));const data=await response.json();
 assert.ok(data.deliveries.length<=50);assert.ok(data.deliveries.every(row=>row.html===undefined&&row.text===undefined&&row.recipientEmail.includes('***')));
 ids.push(...data.deliveries.map(row=>row.id));cursor=data.nextCursor;
 }while(cursor);
 assert.equal(ids.length,125);assert.equal(new Set(ids).size,125);
 assert.ok(app.reads.filter(row=>row.collection==='email_deliveries'&&!row.id).every(row=>row.returnedDocuments<=51));
 const filtered=await(await service.listEmailDeliveries(request('/admin/email-deliveries?pageSize=50&status=failed','admin'))).json();assert.ok(filtered.deliveries.every(row=>row.status==='failed'));assert.ok(filtered.nextCursor);
 const legacy=await(await service.listEmailDeliveries(request('/admin/email-deliveries?legacy=true&pageSize=200','admin'))).json();assert.equal(legacy.deliveries.length,1);assert.equal(legacy.deliveries[0].id,'legacy');
 await assert.rejects(()=>service.listEmailDeliveries(request('/admin/email-deliveries?pageSize=201','admin')),e=>e.status===400);
 await assert.rejects(()=>service.listEmailDeliveries(request('/admin/email-deliveries','owner')),e=>e.status===403);
});

test('read instrumentation is opt-in and reports only counts and fixed labels',()=>{
 const app=isolated(),metrics=app.load('@/lib/server/read-budget');
 metrics.recordRead('property_list',12);assert.equal(Object.keys(metrics.readBudgetSnapshot()).length,0);
 app.env.PROPBANK_READ_METRICS='1';metrics.recordRead('property_list',12);metrics.recordRead('property_list',0);
 const row=metrics.readBudgetSnapshot().property_list;assert.equal(row.queries,2);assert.equal(row.documents,12);assert.equal(row.estimatedDocumentReads,13);
});

test('admin enquiries query only their relevant delivery events',async()=>{
 const app=isolated({users,admin_notifications:{E:{type:'property_enquiry'}},email_deliveries:{A:{eventType:'enquiry.property_created',recordId:'E',status:'sent'},B:{eventType:'user.welcome',recordId:'E',status:'sent'}}});
 const response=await app.load('@/lib/server/services/enquiries').listEnquiries(request('/enquiries','admin'));assert.equal(response.status,200);
 const read=app.reads.find(row=>row.collection==='email_deliveries');assert.equal(read.returnedDocuments,1);
 assert.ok(read.filters.some(([key,value])=>key==='eventType'&&value==='enquiry.property_created'));
});

test('admin visit property filter is applied before reads and profile enrichment',async()=>{
 const app=isolated({users,properties,visits:{A:{userId:'owner',propertyId:'P',visitDate:new Date('2026-12-01'),status:'scheduled'},B:{userId:'tenant',propertyId:'unrelated',visitDate:new Date('2026-12-01'),status:'scheduled'}}});
 const response=await app.load('@/lib/server/services/visits').listAdminVisits(request('/admin/visits?propertyId=P','admin'));assert.equal(response.status,200);
 const read=app.reads.find(row=>row.collection==='visits');assert.equal(read.returnedDocuments,1);
 assert.ok(read.filters.some(([key,value])=>key==='propertyId'&&value==='P'));
});
