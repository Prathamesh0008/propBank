const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request}=require('./fixtures/native-server.cjs');
const seed={users,properties:{P:{...properties.P,isActive:true,moderationStatus:'approved',rentalStatus:'available',tenants:[],unitNumber:'PRIVATE-704',listingType:'rent'}},siteSettings:{}};
test('public first-page settings read starts while bounded property query is pending',async()=>{
 const app=isolated(seed),service=app.load('@/lib/server/services/properties'),db=app.load('@/lib/server/firestore').getDatabase();
 const prototype=Object.getPrototypeOf(db.collection('properties')),original=prototype.get;let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 prototype.get=async function(...args){if(this.collection==='properties'){started();await gate;}return original.apply(this,args)};
 const pending=service.listProperties(request('/properties',null));await ready;await new Promise(resolve=>setImmediate(resolve));const concurrent=app.reads.some(read=>read.collection==='siteSettings');release();const response=await pending;const body=await response.json();
 assert.equal(response.status,200);assert.equal(concurrent,true);assert.equal(app.reads.filter(read=>read.collection==='siteSettings').length,1);assert.doesNotMatch(JSON.stringify(body),/PRIVATE-704/);assert.equal(app.writes.length,0);assert.equal(app.emails.length,0);
 const control=isolated(seed),expected=await control.load('@/lib/server/services/properties').listProperties(request('/properties',null));assert.deepEqual(body,await expected.json());
});
test('continuation and invalid requests do not add settings reads',async()=>{for(const url of ['/properties?cursor=P','/properties?pageSize=0','/properties?categories=invalid','/properties?admin=true']){const app=isolated(seed),service=app.load('@/lib/server/services/properties');try{await service.listProperties(request(url,null));}catch{}assert.equal(app.reads.filter(read=>read.collection==='siteSettings').length,0);assert.equal(app.writes.length,0);assert.equal(app.emails.length,0);}});
