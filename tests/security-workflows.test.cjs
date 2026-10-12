const assert=require('node:assert/strict'),{test}=require('node:test');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');

test('property creation preserves industrial plot area and member rent schedule',async()=>{
 const app=isolated({users,properties});
 const response=await route(app,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Industrial home',propertyType:'industrial',location:'Existing address',ownerUID:'owner',plotArea:'2400',rentSchedule:[{year:'1',amount:'70000'}]}));
 assert.equal(response.status,200);const created=await response.json();const id=created.property.id;
 assert.equal(app.state.properties[id].plotArea,'2400');
 const read=await (await route(app,'properties/[id]').GET(request(`/properties/${id}`,'owner'),context(id))).json();
 assert.equal(read.property.plotArea,'2400');assert.equal(read.property.rentSchedule.length,1);
});

test('public listings and detail clear private contacts, tenant records and selected media',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,rentalStatus:'available',tenants:[{userUID:'tenant',isActive:true,email:'tenant@test.invalid',monthlyIncome:'secret'}],internalImages:['private'],images:['main','second'],ownerPhone:'secret',buyers:[{firstName:'Private'}]}}});
 for(const response of [await route(app,'properties').GET(request('/properties')),await route(app,'properties/[id]').GET(request('/properties/P'),context('P'))]) {
  const body=await response.json(),p=body.property||body.properties[0];
  assert.equal(p.ownerEmail,'');assert.equal(p.ownerPhone,'');assert.equal(p.tenants,null);assert.equal(p.buyers,null);assert.equal(p.internalImages,null);assert.deepEqual(p.images,['main']);
 }
 const member=await (await route(app,'properties/[id]').GET(request('/properties/P','owner'),context('P'))).json();assert.deepEqual(member.property.internalImages,['private']);
});
test('private records reject IDOR; owner also tenant has both relationships without changing global role',async()=>{
 const app=isolated({users,properties:{P:properties.P,Q:{...properties.P,id:'Q',ownerUID:'other',tenants:[{userUID:'owner',isActive:true}]}}});
 const list=route(app,'properties');
 assert.equal((await list.GET(request('/properties?ownerUID=owner','owner'))).status,200);
 assert.equal((await list.GET(request('/properties?ownerUID=owner','other'))).status,403);
 const data=await (await list.GET(request('/properties?ownerUID=owner','owner'))).json();assert.equal(data.properties.length,2);assert.equal(data.properties.find(p=>p.id==='Q').userRole,'tenant');
 assert.equal((await route(app,'properties/[id]').GET(request('/properties/P','other'),context('P'))).status,404);
 for(const [name,url,body] of [['inspection-reports','/inspection-reports',{propertyId:'P',reportType:'on_possession'}],['reviews','/reviews',{propertyId:'P',reviewerType:'owner'}]])assert.equal((await route(app,name).POST(request(url,'other','POST',body))).status,403);
 assert.equal((await route(app,'inspection-reports/property/[propertyId]').GET(request('/inspection-reports/property/P','other'),context('P','propertyId'))).status,403);
});
test('editable profile contacts and unverified email cannot grant tenant access; explicit UID takes precedence',async()=>{
 const app=isolated({users:{...users,other:{...users.other,email:'tenant@test.invalid',phoneNumber:'456'}},properties});
 const documents=route(app,'documents/property/[propertyId]');
 assert.equal((await documents.GET(request('/documents/property/P','other'),context('P','propertyId'))).status,403);
 app.claims.other={email:'tenant@test.invalid',email_verified:false};
 assert.equal((await documents.GET(request('/documents/property/P','other'),context('P','propertyId'))).status,403);
 app.claims.other={email:'tenant@test.invalid',email_verified:true};
 assert.equal((await documents.GET(request('/documents/property/P','other'),context('P','propertyId'))).status,403);
 app.state.properties.P.tenants=[{email:'tenant@test.invalid',isActive:true}];
 assert.equal((await documents.GET(request('/documents/property/P','other'),context('P','propertyId'))).status,200);
});
test('profile changes preserve unknown stored fields and cannot forge Firebase email or admin role',async()=>{
 const app=isolated({users:{...users,owner:{...users.owner,existingMultiRoleMetadata:{keep:true}}}});const r=route(app,'users/[id]');
 assert.equal((await r.PATCH(request('/users/owner','owner','PATCH',{email:'tenant@test.invalid'}),context('owner'))).status,400);
 assert.equal((await r.PATCH(request('/users/owner','owner','PATCH',{role:'admin'}),context('owner'))).status,403);
 assert.equal((await r.PATCH(request('/users/owner','owner','PATCH',{name:'Updated'}),context('owner'))).status,200);assert.deepEqual(app.state.users.owner.existingMultiRoleMetadata,{keep:true});
 const peer=await (await r.GET(request('/users/owner','other'),context('owner'))).json();assert.equal(peer.user.email,undefined);assert.equal(peer.user.phoneNumber,undefined);
});
test('archive/restore, false booleans, field validation and ownership are enforced',async()=>{
 const app=isolated({users,properties});const r=route(app,'properties/[id]');
 assert.equal((await r.PATCH(request('/properties/P','other','PATCH',{monthlyRent:'1'}),context('P'))).status,403);
 assert.equal((await r.PATCH(request('/properties/P','owner','PATCH',{'ownerUID.nested':'other'}),context('P'))).status,400);
 assert.equal((await r.PATCH(request('/properties/P','owner','PATCH',{status:'inactive',isSold:false}),context('P'))).status,200);assert.equal(app.state.properties.P.isActive,false);
 assert.equal((await r.PATCH(request('/properties/P','owner','PATCH',{status:'active'}),context('P'))).status,200);assert.equal(app.state.properties.P.isActive,true);
 assert.equal((await r.PATCH(request('/properties/P','owner','PATCH',{monthlyRent:42}),context('P'))).status,400);
});
test('upload reserved namespaces require property membership and administrator permission',async()=>{
 const app=isolated({users,properties}),r=route(app,'upload/image');
 const image='data:image/png;base64,AQID';
 for(const folder of ['documents/P','properties/P','banners'])assert.equal((await r.POST(request('/upload/image','other','POST',{folder,image}))).status,403);
 assert.equal((await r.POST(request('/upload/image','owner','POST',{folder:'properties/../P',image}))).status,400);
 assert.equal((await r.POST(request('/upload/image','tenant','POST',{folder:'documents/P',image}))).status,200);
});
test('notification intake prevents internal event spoofing, private response leakage and HTML injection',async()=>{
 const app=isolated({users,properties}),r=route(app,'admin/notifications');
 assert.equal((await r.POST(request('/admin/notifications','other','POST',{type:'agreement_renewal',propertyId:'P'}))).status,403);
 const response=await r.POST(request('/admin/notifications','other','POST',{type:'property_enquiry',propertyId:'P',userId:'other',ownerEmail:'forged@test.invalid',isRead:true}));assert.equal(response.status,201);
 const body=await response.json();assert.equal(body.notification.ownerEmail,'');
 const stored=Object.values(app.state.admin_notifications)[0];assert.equal(stored.ownerEmail,users.owner.email);assert.equal(stored.isRead,false);
 const html=app.load('@/lib/server/services/property-effects').formatTemplate('<p>%s</p>',['<script>alert(1)</script>']);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('new uploads have unique keys and uploader metadata; another user cannot delete them',async()=>{
 const app=isolated({users,properties});const r=route(app,'upload/image');const image='data:image/png;base64,AQID';
 const first=await (await r.POST(request('/upload/image','owner','POST',{image,folder:'properties',identifier:'building'}))).json();
 const second=await (await r.POST(request('/upload/image','owner','POST',{image,folder:'properties',identifier:'building'}))).json();
 assert.notEqual(first.url,second.url);assert.equal(app.objects.length,2);assert.ok(app.objects.every(object=>object.Key.startsWith('uploads/owner/')&&object.Metadata.uploadedBy==='owner'));
 const del=route(app,'files/[...path]');assert.equal((await del.DELETE(request('/files/delete','other','DELETE',{url:first.url}))).status,403);
 assert.equal((await del.DELETE(request('/files/delete','owner','DELETE',{url:first.url}))).status,200);
});
