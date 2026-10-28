const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const json=response=>response.json();
const tenantProperty={...properties.P,createdAs:'tenant',submittedByUID:'tenant',ownerUID:'',ownerName:'',ownershipVerification:'pending',ownershipVerificationVersion:0,tenants:[{id:'T',userUID:'tenant',email:'tenant@test.invalid',isActive:true}]};
function documentForm(file,type='rental_agreement'){const form=new FormData();form.set('document',file);form.set('propertyId','P');form.set('docType',type);return form;}

test('tenant supporting evidence uses private multipart storage, property binding and idempotent document records',async()=>{
 const app=isolated({users,properties:{P:tenantProperty}}),upload=route(app,'upload/document'),documents=route(app,'documents'),list=route(app,'documents/property/[propertyId]');
 const first=await upload.POST(request('/upload/document','tenant','POST',documentForm(new File(['lease'],'lease.pdf',{type:'application/pdf'}))));assert.equal(first.status,200);const firstUrl=(await json(first)).url;
 const payload={propertyId:'P',documentName:'lease.pdf',documentType:'rental_agreement',fileUrl:firstUrl,description:'Tenant evidence',idempotencyKey:'supporting-request-0001'};
 const created=await documents.POST(request('/documents','tenant','POST',payload));assert.equal(created.status,201);const saved=(await json(created)).document;assert.equal(app.state.documents[saved.id].propertyId,'P');assert.equal(app.state.documents[saved.id].status,'submitted');assert.equal(app.state.documents[saved.id].contentType,'application/pdf');
 const retryUpload=await upload.POST(request('/upload/document','tenant','POST',documentForm(new File(['lease'],'lease.pdf',{type:'application/pdf'}))));const retryUrl=(await json(retryUpload)).url;
 const retried=await documents.POST(request('/documents','tenant','POST',{...payload,fileUrl:retryUrl}));assert.equal(retried.status,200);assert.equal(Object.keys(app.state.documents).length,1);assert.ok(app.objects.some(item=>item.operation==='DeleteObjectCommand'));
 const adminView=await json(await list.GET(request('/documents/property/P','admin'),context('P','propertyId')));assert.equal(adminView.documents.length,1);assert.equal(adminView.documents[0].documentType,'rental_agreement');
});

test('supporting evidence rejects unsafe files and unauthorized property access',async()=>{
 const app=isolated({users,properties:{P:tenantProperty}}),upload=route(app,'upload/document');
 assert.equal((await upload.POST(request('/upload/document','tenant','POST',documentForm(new File(['gif'],'proof.gif',{type:'image/gif'}))))).status,400);
 assert.equal((await upload.POST(request('/upload/document','tenant','POST',documentForm(new File([Buffer.alloc(5*1024*1024+1)],'large.pdf',{type:'application/pdf'}))))).status,400);
 assert.equal((await upload.POST(request('/upload/document','other','POST',documentForm(new File(['pdf'],'other.pdf',{type:'application/pdf'}))))).status,403);
 assert.equal(Object.keys(app.state.documents||{}).length,0);
});

test('tenant intake and pending verification UI expose supporting uploads without changing verification state',()=>{
 const intake=fs.readFileSync('src/features/properties/TenantPropertyForm.tsx','utf8'),hub=fs.readFileSync('src/features/properties/PropertyHub.tsx','utf8'),admin=fs.readFileSync('src/features/admin/OwnerVerification.tsx','utf8');
 assert.match(intake,/Property Supporting Documents/);assert.match(intake,/uploadSupportingDocument/);assert.ok(intake.indexOf("apiFetch('/api/properties'")<intake.indexOf('uploadSupportingDocument(propertyId'));
 assert.match(hub,/Documents submitted — Awaiting review/);assert.match(hub,/Upload Supporting Documents/);assert.match(hub,/!p\.ownershipVerification \|\| p\.ownershipVerification === "pending"/);
 const manage=fs.readFileSync('src/features/properties/ManageProperty.tsx','utf8');assert.match(manage,/DropdownMenuItem[\s\S]{0,300}Upload Supporting Documents/);assert.match(manage,/!property\.ownershipVerification\|\|property\.ownershipVerification==='pending'/);
 assert.match(admin,/evidenceDocuments/);assert.match(admin,/Select reviewed evidence/);
});
