const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const base={propertyTitle:'Purpose fixture',propertyType:'residential',structure:'Apartment',configuration:'2 BHK',location:'Test location',ownerUID:'owner'};
const lease={existingTenant:{type:'individual',name:'Fixture Tenant',mobile:'9123456782',email:'tenant@example.invalid',occupancyStartDate:'2020-01-01'},tenantOccupied:true,monthlyRentalIncome:'20000',leaseStartDate:'2020-01-01',leaseEndDate:'2099-01-01',leaseType:'registered',verificationStatus:'verified'};
async function create(app,extra){const r=await route(app,'properties').POST(request('/properties','owner','POST',{...base,...extra}));return {r,body:await r.json()};}
test('pre-leased creates separate pending evidence, computes yield and never creates tenants',async()=>{
 const app=isolated({users}),{r,body}=await create(app,{listingType:'pre_leased',sellingPrice:'4000000',rentalStatus:'rented',mobileNumber:'bad stale contact',tenants:[{firstName:'Hidden'}],preLeased:lease});
 assert.equal(r.status,200,JSON.stringify(body));const p=app.state.properties[body.property.id];assert.equal(p.listingType,'pre_leased');assert.equal(p.preLeased.verificationStatus,'pending');assert.equal((p.tenants||[]).length,0);assert.equal(Object.keys(app.state.tenants||{}).length,0);assert.equal(body.property.investment.annualRentalIncome,240000);assert.equal(body.property.investment.grossYield,6);
 const patch=await route(app,'properties/[id]').PATCH(request('/properties/'+p.id,'owner','PATCH',{moderationAction:'approve',expectedRevision:1}),context(p.id));assert.equal(patch.status,403);
 const approval=await route(app,'properties/[id]').PATCH(request('/properties/'+p.id,'admin','PATCH',{moderationAction:'approve',expectedRevision:1}),context(p.id));assert.equal(approval.status,200,await approval.clone().text());
 const sale=await route(app,'properties').GET(request('/properties?listingType=sell'));const publicRow=(await sale.json()).properties[0];assert.equal(publicRow.listingType,'pre_leased');assert.equal(publicRow.preLeased,undefined);assert.equal(publicRow.investment.grossYield,6);assert.equal(publicRow.ownerPhone,'');
 const rent=await route(app,'properties').GET(request('/properties?listingType=rent'));assert.equal((await rent.json()).count,0);
});
test('pre-leased validation rejects inactive leases, invalid dates/prices, occupancy and forged payloads',async()=>{
 for(const extra of [{sellingPrice:'0'},{preLeased:{...lease,tenantOccupied:false}},{preLeased:{...lease,monthlyRentalIncome:'-1'}},{preLeased:{...lease,leaseEndDate:'2001-01-01'}},{preLeased:{...lease,leaseStartDate:'2098-01-01'}},{preLeased:{...lease,leaseEndDate:'2099-02-30'}},{preLeased:{...lease,tenantName:'private'}}]){
  const app=isolated({users}),{r}=await create(app,{listingType:'pre_leased',sellingPrice:'4000000',preLeased:lease,...extra});assert.equal(r.status,400);assert.equal(Object.keys(app.state.properties||{}).length,0);
 }
});
test('management registration clears stale marketing fields and stays owner/admin only even if approved',async()=>{
 const app=isolated({users}),{r,body}=await create(app,{listingType:'manage',sellingPrice:'5000000',monthlyRent:'20000',rentalStatus:'rented',tenantEmail:'stale@test.invalid',managementServices:['Plumbing','Cleaning'],managementDescription:'Optional future repairs'});assert.equal(r.status,200,JSON.stringify(body));const id=body.property.id,p=app.state.properties[id];assert.equal(p.sellingPrice,'');assert.equal(p.monthlyRent,'');assert.equal((p.tenants||[]).length,0);assert.equal(Object.keys(app.state.service_requests||{}).length,0);p.moderationStatus='approved';
 for(const path of ['/properties','/properties?listingType=manage','/properties/search?q=Purpose']){const response=await route(app,path.includes('/search')?'properties/search':'properties').GET(request(path));assert.equal((await response.json()).count,0);}
 for(const uid of ['', 'other','tenant']){const response=await route(app,'properties/[id]').GET(request('/properties/'+id,uid),context(id));assert.ok([403,404].includes(response.status),uid+': '+response.status);}
 const own=await route(app,'properties/[id]').GET(request('/properties/'+id,'owner'),context(id));assert.equal(own.status,200);assert.equal((await own.json()).property.managementDescription,undefined);assert.equal(p.managementServices,undefined);assert.equal(p.managementDescription,undefined);
 const portfolio=await route(app,'properties').GET(request('/properties?ownerUID=owner','owner'));assert.ok((await portfolio.json()).properties.some(row=>row.id===id));
 const denied=await route(app,'service-requests').POST(request('/service-requests','other','POST',{userUID:'other',propertyId:id,serviceId:'plumbing',message:'Test repair'}));assert.equal(denied.status,403);
 const created=await route(app,'service-requests').POST(request('/service-requests','owner','POST',{userUID:'owner',propertyId:id,serviceId:'cleaning',message:'Test cleaning'}));assert.equal(created.status,201,await created.clone().text());
});
test('expiry flags owner review and removes previously approved investment from discovery',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,listingType:'pre_leased',sellingPrice:'4000000',preLeased:{...lease,leaseEndDate:'2001-01-01'},moderationStatus:'approved',isRented:false}}});
 const read=await route(app,'properties/[id]').GET(request('/properties/P','owner'),context('P'));assert.equal((await read.json()).property.leaseReviewRequired,true);
 const listing=await route(app,'properties').GET(request('/properties?listingType=sell'));assert.equal((await listing.json()).count,0);
});
test('existing rent/sale and legacy combined payloads retain their behavior',async()=>{
 for(const listingType of ['rent','sell','sell_rent']){const app=isolated({users}),{r,body}=await create(app,{listingType,rentalStatus:'available',monthlyRent:'20000',sellingPrice:'4000000'});assert.equal(r.status,200,JSON.stringify(body));assert.equal(app.state.properties[body.property.id].listingType,listingType);}
});
test('investment cover publishes only after moderation; management photos never publish',async()=>{
 for(const listingType of ['pre_leased','manage']){
  const app=isolated({users}),{r,body}=await create(app,{listingType,sellingPrice:'4000000',preLeased:lease,images:['data:image/png;base64,AQID']});assert.equal(r.status,200,JSON.stringify(body));const p=app.state.properties[body.property.id],id=p.images[0].split('/').at(-1),media=route(app,'media/[id]');
  assert.equal((await media.GET(request('/media/'+id),context(id))).status,401);
  p.moderationStatus='approved';
  assert.equal((await media.GET(request('/media/'+id),context(id))).status,listingType==='manage'?401:200);
  assert.equal((await media.GET(request('/media/'+id,'owner'),context(id))).status,200);
 }
});
test('lease evidence remains private and submitted even when administrator supplies verified status',async()=>{
 const app=isolated({users}),{body}=await create(app,{listingType:'pre_leased',sellingPrice:'4000000',preLeased:lease});const id=body.property.id;
 const response=await route(app,'documents').POST(request('/documents','admin','POST',{propertyId:id,documentName:'Lease evidence',documentType:'rental_agreement',fileUrl:'data:application/pdf;base64,AQID',status:'verified'}));assert.equal(response.status,201,await response.clone().text());const doc=(await response.json()).document;assert.equal(doc.status,'submitted');
 app.state.properties[id].moderationStatus='approved';const mediaId=Object.keys(app.state.storage_objects).at(-1);
 assert.equal((await route(app,'media/[id]').GET(request('/media/'+mediaId),context(mediaId))).status,401);
 assert.equal((await route(app,'media/[id]').GET(request('/media/'+mediaId,'owner'),context(mediaId))).status,200);
 assert.equal((await route(app,'documents/[id]').GET(request('/documents/'+doc.id,'other'),context(doc.id))).status,403);
});
test('purpose switching never rewrites historical tenant relationships; purpose edits require review',async()=>{
 const app=isolated({users}),{body}=await create(app,{listingType:'pre_leased',sellingPrice:'4000000',preLeased:lease});const id=body.property.id;app.state.properties[id].moderationStatus='approved';
 const changed=await route(app,'properties/[id]').PATCH(request('/properties/'+id,'owner','PATCH',{preLeased:{...lease,monthlyRentalIncome:'21000',verificationStatus:'verified'},tenants:[{firstName:'Injected'}]}),context(id));assert.equal(changed.status,200,await changed.clone().text());const p=app.state.properties[id];assert.equal(p.preLeased.verificationStatus,'pending');assert.equal(p.moderationStatus,'pending_review');assert.equal((p.tenants||[]).length,0);
 const managed=await route(app,'properties/[id]').PATCH(request('/properties/'+id,'owner','PATCH',{listingType:'manage',preLeased:lease}),context(id));assert.equal(managed.status,200);assert.equal(app.state.properties[id].preLeased,null);
});

test('retired management registration inputs are ignored while historical metadata survives edits',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,listingType:'manage',managementServices:['Plumbing'],managementDescription:'Historical note'}}});
 const response=await route(app,'properties/[id]').PATCH(request('/properties/P','owner','PATCH',{title:'Updated private property',managementServices:'obsolete invalid draft',managementDescription:'x'.repeat(5000)}),context('P'));assert.equal(response.status,200,await response.clone().text());assert.equal(app.state.properties.P.managementDescription,'Historical note');assert.equal(app.state.properties.P.managementServices[0],'Plumbing');
});
test('property registration offers To Manage without maintenance intake and retains Request Services',()=>{
 const fs=require('node:fs'),fields=fs.readFileSync('src/features/properties/PropertyPurposeFields.tsx','utf8');
 assert.doesNotMatch(fields,/Private property management|managementServices|managementDescription|MAINTENANCE_CATEGORIES|Management notes/);
 assert.match(fs.readFileSync('src/features/properties/AddPropertyForm.tsx','utf8'),/<SelectItem value="manage">To Manage<\/SelectItem>/);
 const dashboard=fs.readFileSync('src/features/properties/ManageProperty.tsx','utf8');assert.match(dashboard,/Request Services/);assert.match(dashboard,/request-services/);
});
test('existing investment tenant requires valid individual/company details without account linking',async()=>{
 for(const tenant of [undefined,{}, {...lease.existingTenant,type:'agent'},{...lease.existingTenant,name:' '},{...lease.existingTenant,mobile:'12345'},{...lease.existingTenant,email:'invalid'},{...lease.existingTenant,occupancyStartDate:'2099-01-01'},{...lease.existingTenant,occupancyStartDate:'2020-02-30'}]){
  const app=isolated({users}),{r}=await create(app,{listingType:'pre_leased',sellingPrice:'4000000',preLeased:{...lease,existingTenant:tenant}});assert.equal(r.status,400);assert.equal(Object.keys(app.state.properties||{}).length,0);
 }
 const app=isolated({users}),{r,body}=await create(app,{listingType:'pre_leased',sellingPrice:'4000000',preLeased:{...lease,existingTenant:{...lease.existingTenant,type:'company',name:'Fixture Company',email:''}}});assert.equal(r.status,200);const p=app.state.properties[body.property.id];assert.equal(p.preLeased.existingTenant.mobile,'+919123456782');assert.equal(p.preLeased.existingTenant.type,'company');assert.equal(Object.keys(app.state.users).length,Object.keys(users).length);assert.equal(Object.keys(app.state.relationship_links||{}).length,0);assert.equal(Object.keys(app.state.tenants||{}).length,0);
});
test('existing tenant is owner/admin private, editable, and absent from public and related-user responses',async()=>{
 const app=isolated({users:{...users,agent:{...users.other,uid:'agent',email:'agent@test.invalid',role:'agent'}}}),{body}=await create(app,{listingType:'pre_leased',sellingPrice:'4000000',preLeased:lease});const id=body.property.id,p=app.state.properties[id];p.moderationStatus='approved';p.submittedByUID='agent';p.tenants=[{id:'historical',userUID:'tenant',isActive:true}];
 for(const uid of ['owner','admin']){const response=await route(app,'properties/[id]').GET(request('/properties/'+id,uid),context(id));assert.equal((await response.json()).property.preLeased.existingTenant.name,'Fixture Tenant');}
 for(const uid of ['', 'other','tenant','agent']){const response=await route(app,'properties/[id]').GET(request('/properties/'+id,uid),context(id));assert.equal(response.status,200,uid+': '+await response.clone().text());const data=await response.json();assert.equal(data.property.preLeased?.existingTenant,undefined);assert.ok(!JSON.stringify(data).includes('Fixture Tenant'));assert.ok(!JSON.stringify(data).includes('tenant@example.invalid'));}
 for(const path of ['/properties?listingType=sell','/properties/search?listingType=sell']){const data=await (await route(app,path.includes('search')?'properties/search':'properties').GET(request(path))).json();assert.ok(!JSON.stringify(data).includes('Fixture Tenant'));assert.ok(!JSON.stringify(data).includes('tenant@example.invalid'));}
 const update={preLeased:{...lease,existingTenant:{...lease.existingTenant,name:'Updated Tenant'}}};
 assert.equal((await route(app,'properties/[id]').PATCH(request('/properties/'+id,'agent','PATCH',update),context(id))).status,403);
 assert.equal((await route(app,'properties/[id]').PATCH(request('/properties/'+id,'other','PATCH',update),context(id))).status,403);
 const saved=await route(app,'properties/[id]').PATCH(request('/properties/'+id,'owner','PATCH',update),context(id));assert.equal(saved.status,200,await saved.clone().text());assert.equal(app.state.properties[id].preLeased.existingTenant.name,'Updated Tenant');assert.equal(app.state.properties[id].tenants.length,1);assert.equal(app.state.properties[id].tenants[0].id,'historical');
 const admin=await route(app,'properties/[id]').PATCH(request('/properties/'+id,'admin','PATCH',{preLeased:{...lease,existingTenant:{...lease.existingTenant,name:'Admin Reviewed Tenant'}}}),context(id));assert.equal(admin.status,200);assert.equal(app.state.properties[id].preLeased.existingTenant.name,'Admin Reviewed Tenant');
});
