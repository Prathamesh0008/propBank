const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {isolated,users,properties,request}=require('./fixtures/native-server.cjs');
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
