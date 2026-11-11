const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const pdf='data:application/pdf;base64,JVBERi0xLjQK';
function setup(){return isolated({users:{...users,agent:{...users.other,uid:'agent',email:'agent@test.invalid',role:'agent'},buyer:{...users.other,uid:'buyer',email:'buyer@test.invalid'}},properties:{P:{...properties.P,listingType:'pre_leased',submittedByUID:'agent'},Q:{...properties.P,id:'Q',ownerUID:'other',tenants:[]}},negotiations:{N:{id:'N',propertyId:'P',customerUID:'buyer',brokerUID:'agent',ownerUID:'owner',status:'owner_approved'}}});}
const list=(a,uid)=>route(a,'documents/property/[propertyId]').GET(request('/documents/property/P',uid),context('P','propertyId'));
const detail=(a,id,uid)=>route(a,'documents/[id]').GET(request('/documents/'+id,uid),context(id));
const media=(a,doc,uid)=>route(a,'media/[id]').GET(request(doc.fileUrl.split('#')[0].replace('/api',''),uid),context(doc.fileUrl.split('/').at(-1).split('#')[0]));
async function document(a,documentType='rental_agreement',uid='owner'){
 const r=await route(a,'documents').POST(request('/documents',uid,'POST',{propertyId:'P',documentName:'Private lease evidence',documentType,fileUrl:pdf}));assert.equal(r.status,201,await r.clone().text());return (await r.json()).document;
}
for(const uid of ['owner','admin'])test(`${uid} can list, inspect and download authoritative Pre-Leased evidence`,async()=>{
 const a=setup(),doc=await document(a);assert.equal((await list(a,uid)).status,200);assert.equal((await detail(a,doc.id,uid)).status,200);const response=await media(a,doc,uid);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok((await response.arrayBuffer()).byteLength>0);
});
for(const [uid,status] of [['tenant',403],['agent',403],['buyer',403],['other',403],[null,401]])test(`${uid||'anonymous'} cannot list/detail/download Pre-Leased evidence`,async()=>{
 const a=setup(),doc=await document(a),before=a.objects.length;
 for(const response of [await list(a,uid),await detail(a,doc.id,uid),await media(a,doc,uid)])assert.equal(response.status,status,await response.clone().text());assert.equal(a.objects.length,before);
});
test('client document type does not grant evidence access or permit tenant evidence creation',async()=>{
 for(const type of ['Agreement','occupancy_verification','rental_income','unclassified_private_evidence']){const a=setup(),doc=await document(a,type);assert.equal(a.state.documents[doc.id].accessScope,'pre_leased_evidence');assert.equal((await detail(a,doc.id,'tenant')).status,403);assert.equal((await media(a,doc,'tenant')).status,403);
  const response=await route(a,'documents').POST(request('/documents','tenant','POST',{propertyId:'P',documentName:'Disguised evidence',documentType:'Agreement',fileUrl:pdf,accessScope:'public'}));assert.equal(response.status,403);
 }
});
test('Property Hub removes evidence metadata and document-derived history for linked tenants',async()=>{
 const a=setup(),doc=await document(a);const endpoint=route(a,'property-hub');
 for(const uid of ['owner','admin']){const r=await endpoint.GET(request('/property-hub?propertyId=P',uid));assert.equal(r.status,200);assert.ok(JSON.stringify(await r.json()).includes(doc.id));}
 const r=await endpoint.GET(request('/property-hub?propertyId=P','tenant'));assert.equal(r.status,200);const text=JSON.stringify(await r.json());assert.equal(text.includes(doc.id),false);assert.equal(text.includes('Private lease evidence'),false);
});
test('cross-property IDs, route parameters and forged media bindings do not grant access',async()=>{
 const a=setup(),doc=await document(a),id=doc.fileUrl.split('/').at(-1).split('#')[0];
 assert.equal((await route(a,'documents/[id]').GET(request('/documents/'+doc.id+'?propertyId=Q','other'),context(doc.id))).status,403);
 const asset=a.state.storage_objects[id];asset.bindings[0].propertyId='Q';assert.equal((await media(a,doc,'other')).status,403);assert.equal((await media(a,doc,'owner')).status,403);
});
test('a less-restricted alias cannot bypass a private evidence binding',async()=>{
 const a=setup(),doc=await document(a),id=doc.fileUrl.split('/').at(-1).split('#')[0];a.state.properties.P.internalImages=[doc.fileUrl];a.state.storage_objects[id].bindings.unshift({collection:'properties',id:'P',propertyId:'P',field:'internalImages'});assert.equal((await media(a,doc,'tenant')).status,403);assert.equal((await media(a,doc,'owner')).status,200);
});
test('server-stamped document and asset scope survives a later property-purpose change',async()=>{
 const a=setup(),doc=await document(a),id=doc.fileUrl.split('/').at(-1).split('#')[0];a.state.properties.P.listingType='rent';assert.equal((await detail(a,doc.id,'tenant')).status,403);assert.equal((await media(a,doc,'tenant')).status,403);const response=await list(a,'tenant');assert.equal(response.status,200);assert.equal(JSON.stringify(await response.json()).includes(doc.id),false);
 a.state.storage_objects[id].bindings=[];assert.equal(a.state.storage_objects[id].accessScope,'pre_leased_evidence');assert.equal((await media(a,doc,'tenant')).status,403);
});
test('legacy evidence is guarded through the alternate download endpoint',async()=>{
 const a=setup();a.state.documents={D:{id:'D',propertyId:'P',userId:'owner',documentName:'Legacy lease',documentType:'Agreement',fileUrl:'https://existing-r2.test/documents/P/old.pdf'}};a.storage.set('propbank/documents/P/old.pdf',{bytes:Buffer.from('%PDF-old'),type:'application/pdf'});
 const response=await detail(a,'D','owner'),url=(await response.json()).document.fileUrl.replace('/api','');for(const uid of ['tenant','agent','buyer','other'])assert.equal((await route(a,'media/legacy').GET(request(url,uid))).status,403);for(const uid of ['owner','admin'])assert.equal((await route(a,'media/legacy').GET(request(url,uid))).status,200);
});
test('media session cookies are reauthorized against evidence scope on every download',async()=>{
 const a=setup(),doc=await document(a);const response=await route(a,'media/session').POST(request('/media/session','tenant','POST'));assert.equal(response.status,204);const cookie=response.headers.get('set-cookie');assert.equal((await route(a,'media/[id]').GET(new Request('http://local'+doc.fileUrl.split('#')[0],{headers:{cookie}}),context(doc.fileUrl.split('/').at(-1).split('#')[0]))).status,403);
});
test('ordinary tenancy document permissions stay unchanged',async()=>{
 const a=setup();a.state.properties.P.listingType='rent';const doc=await document(a,'Agreement','tenant');assert.equal(a.state.documents[doc.id].accessScope,undefined);for(const uid of ['owner','tenant','admin']){assert.equal((await list(a,uid)).status,200);assert.equal((await detail(a,doc.id,uid)).status,200);assert.equal((await media(a,doc,uid)).status,200);}assert.equal((await media(a,doc,'other')).status,403);
});
test('approved public listings never return private evidence metadata',async()=>{
 const a=setup(),doc=await document(a);Object.assign(a.state.properties.P,{moderationStatus:'approved',isActive:true,isRented:false,isSold:false,preLeased:{tenantOccupied:true,monthlyRentalIncome:'20000',leaseEndDate:'2099-12-31',verificationStatus:'pending'}});const response=await route(a,'properties/[id]').GET(request('/properties/P'),context('P'));assert.equal(response.status,200);const text=JSON.stringify(await response.json());assert.equal(text.includes(doc.id),false);assert.equal(text.includes('Private lease evidence'),false);
});

test('authorized purpose change atomically retains scope on historical untagged evidence',async()=>{
 const a=setup();a.state.documents={D:{id:'D',propertyId:'P',userId:'owner',documentName:'Legacy private evidence',documentType:'Agreement',fileUrl:'https://existing-r2.test/documents/P/old.pdf'}};const response=await route(a,'properties/[id]').PUT(request('/properties/P','owner','PUT',{listingType:'rent',rentalStatus:'rented',monthlyRent:'30000',securityDeposit:'0'}),context('P'));assert.equal(response.status,200,await response.clone().text());assert.equal(a.state.documents.D.accessScope,'pre_leased_evidence');assert.equal((await detail(a,'D','tenant')).status,403);assert.equal((await detail(a,'D','owner')).status,200);
});
