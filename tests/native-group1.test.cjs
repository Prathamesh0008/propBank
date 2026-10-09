const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const ts=require('typescript');

const clone=v=>structuredClone(v);
function isolated(seed={}) {
 const state=clone(seed), writes=[], emails=[], queued=[], verified=[];
 let failure=false;
 const env={RESEND_API_KEY:'isolated-mail-key'};
 class Query {
  constructor(collection,filters=[],limit=Infinity){this.collection=collection;this.filters=filters;this.count=limit;}
  where(field,_op,value){return new Query(this.collection,[...this.filters,[field,value]],this.count);}
  limit(count){return new Query(this.collection,this.filters,count);}
  async get(){if(failure)throw new Error('isolated database outage');return {docs:Object.entries(state[this.collection]||{}).sort(([a],[b])=>a.localeCompare(b)).filter(([,data])=>this.filters.every(([field,value])=>data[field]===value)).slice(0,this.count).map(([id,data])=>({id,exists:true,data:()=>clone(data)}))};}
  doc(id=crypto.randomUUID()) {
   const collection=this.collection;
   const write=async(data,create=false)=>{if(failure)throw new Error('isolated database outage');state[collection]||={};if(create&&state[collection][id])throw new Error('already exists');state[collection][id]=clone(data);writes.push({kind:create?'create':'set',collection,id,data:clone(data)});};
   return {id,get:async()=>{if(failure)throw new Error('isolated database outage');return {id,exists:!!state[collection]?.[id],data:()=>clone(state[collection]?.[id])};},set:data=>write(data),create:data=>write(data,true),update:async(data)=>{
    if(failure||!state[collection]?.[id])throw new Error('update failed');
    for(const [key,value] of Object.entries(data)){const parts=key.split('.');let cursor=state[collection][id];for(const part of parts.slice(0,-1))cursor=cursor[part]||={};cursor[parts.at(-1)]=clone(value);}
    writes.push({kind:'update',collection,id,data:clone(data)});
   }};
  }
 }
 const db={collection:name=>new Query(name)};
 const cache=new Map();
 const root=path.resolve('src');
 const stubs={
  'server-only':{},'node:crypto':crypto,
  'next/server':{after:fn=>queued.push(fn)},
  [path.join(root,'lib/server/firebase-admin.ts')]:{getFirebaseAdminAuth:()=>({verifyIdToken:async(token,revoked)=>{verified.push({token,revoked});if(token.startsWith('expired'))throw {code:'auth/id-token-expired'};return {uid:token,email:`${token}@test.invalid`,role:'admin'};}}),getFirebaseAdminStorage:()=>({bucket:()=>({name:'existing-bucket',file:filename=>({save:async(bytes,options)=>writes.push({kind:'storage',filename,bytes:Buffer.from(bytes),options}),makePublic:async()=>{}})})})},
  [path.join(root,'lib/server/firestore.ts')]:{getDatabase:()=>db,COLLECTIONS:{users:'users',properties:'properties',siteSettings:'siteSettings',adminNotifications:'admin_notifications'},SITE_SETTINGS_DOCUMENT:'main_settings'},
 };
 function load(file) {
  let resolved=file.startsWith('@/')?path.join(root,file.slice(2)):path.resolve(file);
  if(!resolved.endsWith('.ts'))resolved+='.ts';
  if(stubs[resolved])return stubs[resolved];
  if(cache.has(resolved))return cache.get(resolved);
  const exports={};cache.set(resolved,exports);
  const compiled=ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const context=vm.createContext({exports,Date,Buffer,URL,Headers,Request,Response,AbortSignal,process:{env},fetch:async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');emails.push(JSON.parse(init.body));return new Response('{}',{status:200});},require:name=>stubs[name]||load(name.startsWith('@/')?name:path.resolve(path.dirname(resolved),name))});
  vm.runInContext(compiled,context,{filename:resolved});return exports;
 }
 return {load,state,writes,emails,verified,env,outage:()=>{failure=true;},flush:async()=>{for(const task of queued.splice(0))await task();}};
}
const defaults={createdAt:new Date('2024-01-02T03:04:05Z'),updatedAt:new Date('2024-01-02T03:04:05Z'),isActive:true};
const users={owner:{...defaults,uid:'owner',email:'owner@test.invalid',name:'Owner',role:'individual',phoneNumber:'+91123'},tenant:{...defaults,uid:'tenant',email:'tenant@test.invalid',name:'Tenant',role:'individual',phoneNumber:'456'},admin:{...defaults,uid:'admin',email:'admin@test.invalid',name:'Admin',role:'admin'}};
function request(url,uid,method='GET',body) {return new Request(`http://local/api${url}`,{method,headers:{...(uid?{Authorization:`Bearer ${uid}`} : {}),'Content-Type':'application/json'},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});}
const route=(app,name)=>app.load(`@/app/api/${name}/route`);
const context=id=>({params:Promise.resolve({id})});
const body=response=>response.json();

test('permanently native routes, CORS, unsupported methods and verified token',async()=>{
 const app=isolated({users});const r=route(app,'users');
 assert.equal((await r.GET(request('/users'))).status,401);
 assert.equal((await r.GET(request('/users','owner'))).status,403);
 assert.equal((await r.GET(request('/users','expired-token'))).status,401);
 const list=await r.GET(request('/users','admin'));assert.equal(list.status,200);assert.equal((await body(list)).data.length,3);
 assert.ok(app.verified.every(v=>v.revoked===true));
 assert.equal((await r.OPTIONS(request('/users',null,'OPTIONS'))).status,200);
 assert.equal((await r.DELETE(request('/users','admin','DELETE'))).status,405);
 assert.equal((await r.HEAD(request('/users','admin','HEAD'))).status,405);
 assert.equal((await r.GET(request('/users/','admin'))).status,400);
 assert.equal((await r.POST(request('/users/','admin','POST',{}))).status,405);
 assert.equal((await r.GET(request('/users'))).status,401);
 assert.equal(app.writes.length,0);
});
test('auth registration preserves complete phone/role and creation date, validates input and duplicates',async()=>{
 const app=isolated({users});const r=route(app,'auth/user');
 assert.equal((await r.POST(request('/auth/user','fresh','POST',{uid:'fresh',email:'fresh@test.invalid',name:'Fresh',phoneNumber:'9',role:'admin'}))).status,403);
 assert.equal((await r.POST(request('/auth/user','fresh','POST',{uid:'someone-else',email:'fresh@test.invalid',name:'Fresh',phoneNumber:'9'}))).status,403);
 assert.equal((await r.POST(request('/auth/user','fresh','POST',{uid:'fresh'}))).status,400);
 assert.equal((await r.POST(request('/auth/user','fresh','POST',{uid:'fresh',email:'fresh@test.invalid',name:'Fresh',phoneNumber:'4-56'}))).status,409);
 const created=await r.POST(request('/auth/user','fresh','POST',{uid:'fresh',email:'fresh@test.invalid',name:'Fresh',phoneNumber:'+91 999',role:'agent'}));
 assert.equal(created.status,200);assert.equal(app.state.users.fresh.role,'agent');assert.equal(app.state.users.fresh.phoneNumber,'+91999');
 const updated=await r.POST(request('/auth/user','owner','POST',{uid:'owner',email:'owner@test.invalid',name:'Updated Owner',phoneNumber:'999',role:'agent'}));
 const data=await body(updated);assert.equal(data.user.role,'individual');assert.equal(data.user.phoneNumber,'+91123');assert.equal(data.user.createdAt,'2024-01-02T03:04:05Z');
 assert.ok(app.writes.every(w=>w.collection==='users'));
});
test('users read, search, POST, PUT/PATCH upsert and partial profile update preserve Go envelopes',async()=>{
 const app=isolated({users});const r=route(app,'users/[id]'),search=route(app,'users/search');
 assert.deepEqual(await body(await r.GET(request('/users/missing','owner'),context('missing'))),{success:false,message:'User not registered'});
 const found=await search.GET(request('/users/search?phone=%2B91%20-123','owner'));assert.equal((await body(found)).user.uid,'owner');
 assert.equal((await search.GET(request('/users/search?phone=none','owner'))).status,404);
 assert.equal((await search.GET(request('/users/search','owner'))).status,400);
 assert.equal((await r.PATCH(request('/users/tenant','owner','PATCH',{name:'Spoofed'}),context('tenant'))).status,403);
 assert.equal((await r.PUT(request('/users/fresh','fresh','PUT',{name:'New'}),context('fresh'))).status,400);
 const upsert=await r.PUT(request('/users/fresh','fresh','PUT',{name:'New',email:'fresh@test.invalid'}),context('fresh'));assert.equal(upsert.status,201);
 app.state.users.owner.rentedPropertyId='existing-rental';
 const updated=await r.PATCH(request('/users/owner','owner','PATCH',{name:'Changed',photoURL:'',phoneNumber:'123 45'}),context('owner'));
 assert.equal(updated.status,200);assert.equal((await body(updated)).user.rentedPropertyId,'existing-rental');
 assert.equal((await r.PUT(request('/users/owner','owner','PUT',{role:'admin'}),context('owner'))).status,403);
 assert.equal((await route(app,'users').POST(request('/users','fresh','POST',{uid:'fresh',name:'Fresh',email:'fresh@test.invalid'}))).status,201);
 assert.equal((await r.PATCH(request('/users/owner','owner','PATCH','{'),context('owner'))).status,400);
});
test('public lists, availability, owner+tenant merge, search filters, price and Go projections',async()=>{
 const app=isolated({users,properties:{
  A:{...defaults,title:'Home',id:'A',ownerUID:'owner',listingType:'rent',monthlyRent:'₹12,500',configuration:'2BHK',internalImages:['unchanged-url']},
  B:{...defaults,title:'Sold',id:'B',ownerUID:'owner',isSold:true},
  C:{...defaults,title:'Rented',id:'C',ownerUID:'someone',listingType:'rent',rentalStatus:'rented',tenants:[{userUID:'owner',isActive:true,email:'owner@test.invalid'}]},
  D:{...defaults,title:'Archived',id:'D',ownerUID:'owner',status:'inactive'},
  E:{...defaults,title:'Inactive',id:'E',ownerUID:'owner',isActive:false},
 }});
 const r=route(app,'properties');
 let data=await body(await r.GET(request('/properties')));assert.equal(data.count,1);assert.equal(data.properties[0].price,12500);assert.equal(data.properties[0].internalImages,null);
 data=await body(await r.GET(request('/properties?all=true')));assert.equal(data.count,4);
 assert.equal((await r.GET(request('/properties?ownerUID=owner','tenant'))).status,403);
 data=await body(await r.GET(request('/properties?ownerUID=owner','owner')));assert.equal(data.count,5);assert.equal(data.properties.find(p=>p.id==='C').userRole,'tenant');
 const search=route(app,'properties/search');data=await body(await search.GET(request('/properties/search/?q=3bhk&listingType=rent')));assert.equal(data.count,1);assert.equal(data.query,'3bhk');assert.equal(data.properties[0].status,'');
 data=await body(await search.GET(request('/properties/search?q=missing')));assert.equal(data.properties,null);
 const detail=await body(await route(app,'properties/[id]').GET(request('/properties/A'),context('A')));assert.equal(detail.property.status,'active');
 assert.equal((await route(app,'properties/[id]').GET(request('/properties/none'),context('none'))).status,404);
 assert.equal((await r.GET(request('/properties/'))).status,400);
});
test('tenant lookup matches active UID/email, retains header precedence and rejects spoofed identity',async()=>{
 const app=isolated({users,properties:{A:{...defaults,id:'A',tenants:[{userUID:'tenant',email:'ALIAS@test.invalid',isActive:true}]},B:{...defaults,id:'B',tenants:[{email:'TENANT@test.invalid',isActive:true}]},C:{...defaults,id:'C',tenants:[{userUID:'tenant',isActive:false}]}}});
 const r=route(app,'properties/tenant');
 const data=await body(await r.GET(request('/properties/tenant/?tenantUID=tenant&userEmail=tenant@test.invalid','tenant')));assert.equal(data.count,2);assert.ok(data.properties.every(p=>p.userRole==='tenant'));
 assert.equal((await r.GET(request('/properties/tenant/?tenantUID=owner','tenant'))).status,403);
 assert.equal((await r.GET(request('/properties/tenant/?userEmail=owner@test.invalid','tenant'))).status,403);
 app.state.users.tenant.email='owner@test.invalid';
 assert.equal((await r.GET(request('/properties/tenant/?userEmail=owner@test.invalid','tenant'))).status,403);
 assert.equal((await r.GET(request('/properties/tenant/','tenant'))).status,400);
 const req=request('/properties/tenant/?userEmail=owner@test.invalid','tenant');req.headers.set('X-User-ID','tenant');assert.equal((await body(await r.GET(req))).count,1);
});
test('browser API transport refreshes Firebase identity, overrides Go JWT and does not leak tokens to other origins',async()=>{
 const calls=[];
 let currentUser={getIdToken:async()=>{calls.push('token');return 'firebase-id-token';}};
 const auth={authStateReady:async()=>calls.push('ready'),get currentUser(){return currentUser;}};
 const exports={};
 const source=ts.transpileModule(fs.readFileSync('src/lib/api-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,URL,Headers,Request,Response,window:{location:{origin:'http://local'}},require:name=>{assert.equal(name,'@/firebase');return {auth};},fetch:async(input,init)=>{calls.push({input,init});return new Response('{}');}});
 await exports.apiFetch('/api/users/owner',{method:'PUT',headers:{Authorization:'Bearer go-jwt','X-User-ID':'owner','Content-Type':'application/json'},body:'{"name":"Owner"}'});
 let sent=calls.at(-1);assert.equal(sent.init.headers.get('Authorization'),'Bearer firebase-id-token');assert.equal(sent.init.headers.get('X-User-ID'),'owner');assert.equal(sent.init.body,'{"name":"Owner"}');
 const before=calls.length;await exports.apiFetch('https://existing-r2.example/object');assert.equal(calls.length,before+1);assert.equal(calls.at(-1).init,undefined);
 currentUser=null;await exports.apiFetch('/api/properties',{headers:{Authorization:'Bearer stale-go-jwt'}});sent=calls.at(-1);assert.equal(sent.init.headers.get('Authorization'),null);
 const incoming=new Request('http://local/api/users/owner',{headers:{'X-User-ID':'original','Accept':'application/json'}});currentUser={getIdToken:async()=> 'new-id-token'};
 await exports.apiFetch(incoming,{headers:{'X-User-ID':'overridden'}});sent=calls.at(-1);assert.equal(sent.init.headers.get('Accept'),'application/json');assert.equal(sent.init.headers.get('X-User-ID'),'overridden');assert.equal(sent.init.headers.get('Authorization'),'Bearer new-id-token');
});
test('property creation writes the original schema, preserves URLs, links tenant and emits original side effects',async()=>{
 const app=isolated({users});const r=route(app,'properties');
 const input={propertyTitle:'Native fixture',propertyType:'Residential',location:'Fixture',ownerUID:'owner',rentalStatus:'rented',listingType:'rent',monthlyRent:'10000',tenantEmail:'tenant@test.invalid',tenantName:'First Last',rentSchedule:[{year:'1st',amount:'10000'}],images:['https://existing-r2.example/properties/old/object.webp'],isSold:true,buyerFirstName:'Buyer'};
 assert.equal((await r.POST(request('/properties','tenant','POST',input))).status,403);
 assert.equal((await r.POST(request('/properties','owner','POST',{...input,monthlyRent:123}))).status,400);
 const response=await r.POST(request('/properties','owner','POST',input));assert.equal(response.status,200);
 const data=await body(response),id=data.property.id;assert.match(id,/^[A-Z]{4}[0-9]{4}$/);
 const saved=app.state.properties[id];assert.equal(saved.ownerPhone,'+91123');assert.equal(saved.images[0],input.images[0]);assert.equal(saved.rentSchedule,null);assert.equal(saved.tenants[0].userUID,'tenant');assert.equal(saved.tenants[0].firstName,'First');assert.equal(saved.buyers[0].firstName,'Buyer');assert.ok(saved.createdAt instanceof Date);
 assert.equal(data.property.ownerPhone,'');assert.equal(data.property.price,0);assert.equal(data.property.isPreLeased,false);
 assert.equal(app.state.users.tenant.rentedPropertyId,id);assert.equal(Object.values(app.state.admin_notifications)[0].type,'property_added');
 await app.flush();assert.equal(app.emails.length,2);assert.ok(app.emails.every(mail=>mail.from==='Propbank <connect@propbank.shop>'));
 assert.ok(!app.writes.some(w=>w.kind==='storage'));
});
test('property update validates ownership, retains Go boolean/image semantics and triggers transitions once',async()=>{
 const app=isolated({users,properties:{A:{...defaults,id:'A',title:'Home',location:'Fixture',ownerUID:'owner',ownerName:'Owner',ownerEmail:'owner@test.invalid',monthlyRent:'100',listingType:'rent',images:['https://old/image'],tenants:[{id:'T',userUID:'tenant',firstName:'First',email:'tenant@test.invalid',isActive:true,paymentDueDate:'5'}]}}});
 const r=route(app,'properties/[id]');
 assert.equal((await r.PATCH(request('/properties/A','tenant','PATCH',{monthlyRent:'200'}),context('A'))).status,403);
 assert.equal((await r.PATCH(request('/properties/A','owner','PATCH',{ownerUID:'tenant'}),context('A'))).status,403);
 const response=await r.PATCH(request('/properties/A','owner','PATCH',{id:'rewrite',createdAt:'rewrite',isActive:false,isSold:'false',status:'inactive',images:[],monthlyRent:'200',wantToSell:true,tenants:[{firstName:' '},{id:'T',userUID:'tenant',firstName:'First',email:'tenant@test.invalid',isActive:true,paymentDueDate:'10'}]}),context('A'));
 assert.equal(response.status,200);assert.equal(app.state.properties.A.id,'A');assert.equal(app.state.properties.A.isActive,true);assert.equal(app.state.properties.A.status,'inactive');assert.deepEqual(app.state.properties.A.images,['https://old/image']);assert.equal(app.state.properties.A.tenants.length,1);assert.ok(app.state.properties.A.tenants[0].createdAt instanceof Date);
 assert.equal(app.state.users.tenant.rentedPropertyId,'A');assert.equal(Object.values(app.state.admin_notifications)[0].type,'want_to_sell');
 await app.flush();assert.equal(app.emails.length,2);assert.match(app.emails[0].subject,/Rent Update/);assert.match(app.emails[1].subject,/Payment Due/);
 await r.PUT(request('/properties/A','owner','PUT',{wantToSell:true}),context('A'));assert.equal(Object.keys(app.state.admin_notifications).length,1);
 await r.PUT(request('/properties/A','admin','PUT',{wantToSell:false}),context('A'));assert.equal(Object.keys(app.state.admin_notifications).length,2);
 const empty=await r.PUT(request('/properties/A','owner','PUT',{tenants:[]}),context('A'));assert.equal(empty.status,200);assert.equal(app.state.properties.A.tenants,null);
});
test('Go GCS image dependency retains original path/content type and skips malformed images',async()=>{
 const app=isolated();const images=app.load('@/lib/server/services/property-images');
 const urls=await images.uploadPropertyImages(['https://unchanged/path','bad','data:image/png;base64,AQID'],'ABCD1234');
 assert.equal(urls[0],'https://unchanged/path');assert.match(urls[1],/^https:\/\/storage.googleapis.com\/existing-bucket\/properties\/ABCD1234\/image_3_\d+\.png$/);
 assert.equal(app.writes[0].options.metadata.contentType,'image/png');assert.equal(app.writes[0].options.metadata.cacheControl,'public, max-age=86400');assert.deepEqual([...app.writes[0].bytes],[1,2,3]);
});
test('infrastructure errors never create/upsert records or fall back after a native request',async()=>{
 const app=isolated({users});app.outage();
 const result=await route(app,'users/[id]').PUT(request('/users/owner','owner','PUT',{name:'Unsafe'}),context('owner'));
 assert.equal(result.status,500);assert.equal(app.writes.length,0);
});

let binary;
function goReference(kind,data) {
 if(!binary) {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'propbank-group1-'));binary=path.join(dir,process.platform==='win32'?'reference.exe':'reference');execFileSync('go',['build','-o',binary,'.'],{cwd:path.resolve('tests/go-reference'),stdio:'pipe'});process.on('exit',()=>fs.rmSync(dir,{recursive:true,force:true}));}
 return JSON.parse(execFileSync(binary,[],{input:JSON.stringify({Kind:kind,Data:data}),encoding:'utf8'}));
}
test('normal property response and user/request schemas match compiled original Go code',()=>{
 const app=isolated(),contracts=app.load('@/lib/server/services/contracts');
 for(const input of [{},{id:'LEGACY',title:'Legacy',listingType:'rent',monthlyRent:'₹12,500',internalImages:['hidden'],isPreLeased:true,rentSchedule:[],tenants:[{firstName:'First',createdAt:'2025-01-01T00:00:00Z'}]},{listingType:'other',sellingPrice:'5000',price:0,buyers:[]}]) {
  assert.deepEqual(JSON.parse(JSON.stringify(contracts.propertyResponse(contracts.model('Property',input)))),goReference('property',input));
 }
 for(const input of [{},{...users.owner,createdAt:users.owner.createdAt.toISOString(),updatedAt:users.owner.updatedAt.toISOString(),rentedPropertyId:'OLD'}]) {
  assert.deepEqual(JSON.parse(JSON.stringify(contracts.wireModel('User',contracts.model('User',input)))),goReference('user',input));
 }
 for(const input of [{},{propertyTitle:'Fixture',rentSchedule:[{year:'1',amount:'3'}],tenantSpouse:{firstName:'Spouse'}}]) {
  assert.deepEqual(JSON.parse(JSON.stringify(contracts.wireModel('CreatePropertyRequest',contracts.model('CreatePropertyRequest',input,true)))),goReference('request',input));
 }
});
