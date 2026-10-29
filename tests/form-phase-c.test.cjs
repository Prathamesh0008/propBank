const assert=require('node:assert/strict');
const {test}=require('node:test');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');

test('public enquiry requires an Indian mobile and retains visit preferences as an enquiry',async()=>{
 const app=isolated({users,properties}),api=route(app,'admin/notifications');
 const base={type:'general_inquiry',inquiryType:'rent',propertyType:'residential',userName:'Guest',userEmail:'guest@test.invalid',userPhone:'9999999999'};
 assert.equal((await api.POST(request('/admin/notifications',null,'POST',{...base,userPhone:'1234567890'}))).status,400);
 const response=await api.POST(request('/admin/notifications',null,'POST',{...base,requestVisit:true,visitDate:'2035-02-20',visitTime:'10:00 AM'}));
 assert.equal(response.status,201);assert.equal(Object.keys(app.state.visits||{}).length,0);
});

test('document metadata is accepted only for report document types',async()=>{
 const app=isolated({users,properties}),api=route(app,'documents'),file='data:application/pdf;base64,AQID';
 assert.equal((await api.POST(request('/documents','owner','POST',{propertyId:'P',documentName:'Lease',documentType:'Agreement',fileUrl:file,amount:'100'}))).status,400);
 assert.equal((await api.POST(request('/documents','owner','POST',{propertyId:'P',documentName:'Receipt',documentType:'payment_receipt',fileUrl:file,amount:'100.25',receiptDate:'2030-01-02'}))).status,201);
});

test('service limits and archive operations reject mixed stale resolution state',async()=>{
 const app=isolated({users,properties}),create=route(app,'service-requests');
 assert.equal((await create.POST(request('/service-requests','owner','POST',{userUID:'owner',serviceId:'plumbing',propertyId:'P',message:'x'.repeat(2001)}))).status,400);
 const created=await create.POST(request('/service-requests','owner','POST',{userUID:'owner',serviceId:'plumbing',propertyId:'P',message:'Repair the kitchen tap'}));assert.equal(created.status,201);
 const id=(await created.json()).serviceRequest.id,update=route(app,'service-requests/[id]');
 assert.equal((await update.PUT(request(`/service-requests/${id}`,'admin','PUT',{action:'archive',adminNotes:'stale'}),context(id))).status,400);
 assert.equal((await update.PUT(request(`/service-requests/${id}`,'admin','PUT',{action:'archive'}),context(id))).status,200);
});

test('visit title and detail lengths are enforced by the API',async()=>{
 const app=isolated({users,properties}),api=route(app,'visits');
 assert.equal((await api.POST(request('/visits','other','POST',{title:'x'.repeat(121),description:'Details',visitDate:'2035-01-01T10:00:00Z'}))).status,400);
 assert.equal((await api.POST(request('/visits','other','POST',{title:'General reminder',description:'x'.repeat(1001),visitDate:'2035-01-01T10:00:00Z'}))).status,400);
});
