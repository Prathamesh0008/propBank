const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');

const item={id:'bed',name:'Bed',checked:true,quantity:1,category:'bedroom'};

test('furnishing applicability covers default, conditions, transitions and plots',()=>{
  const furnishing=isolated().load('@/lib/property-furnishing');
  assert.equal(furnishing.supportsFurnishedChecklist('','Flat'),false);
  assert.equal(furnishing.supportsFurnishedChecklist('unfurnished','Flat'),false);
  assert.equal(furnishing.supportsFurnishedChecklist('semi-furnished','Flat'),true);
  assert.equal(furnishing.supportsFurnishedChecklist('furnished','Flat'),true);
  assert.equal(furnishing.supportsFurnishedChecklist('furnished','Commercial Plot'),false);
  assert.equal(furnishing.supportsFurnishedChecklist('semi-furnished','Land'),false);
  assert.equal(JSON.stringify(furnishing.activeFurnishedItems([item,{...item,id:'unchecked',checked:false}],'furnished','Flat')),JSON.stringify([item]));
  assert.equal(furnishing.activeFurnishedItems([item],'unfurnished','Flat').length,0);
});

test('owner and tenant creation never persist hidden furnished items',async()=>{
  const ownerApp=isolated({users,properties});
  const ownerResponse=await route(ownerApp,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Unfurnished home',propertyType:'residential',propertyCategory:'residential',structure:'Flat',configuration:'2 BHK',location:'Pune',ownerUID:'owner',listingType:'manage',unitCondition:'unfurnished',furnishedChecklist:[item]}));
  assert.equal(ownerResponse.status,200);const ownerId=(await ownerResponse.json()).property.id;assert.equal(ownerApp.state.properties[ownerId].furnishedChecklist.length,0);

  const tenantApp=isolated({users,properties});
  const tenantResponse=await route(tenantApp,'properties').POST(request('/properties','tenant','POST',{propertyTitle:'Tenant land',propertyType:'industrial',propertyCategory:'industrial',structure:'Land',location:'Pune',createdAs:'tenant',unitCondition:'furnished',monthlyRent:'10000',paymentDueDate:'5',agreementPeriod:'11',agreementStartDate:'2026-01-01',agreementEndDate:'2026-11-30',reportedOwner:{personName:'Owner',phone:'9876543210'},furnishedChecklist:[item]}));
  assert.equal(tenantResponse.status,200);const tenantId=(await tenantResponse.json()).property.id;assert.equal(tenantApp.state.properties[tenantId].furnishedChecklist.length,0);
});

test('edit preserves untouched legacy items but clears them after an explicit condition or plot change',async()=>{
  const legacy={...properties.P,structure:'Flat',unitCondition:'unfurnished',furnishedChecklist:[item]};
  const app=isolated({users,properties:{P:legacy}}),api=route(app,'properties/[id]');
  assert.equal((await api.PUT(request('/properties/P','owner','PUT',{title:'Renamed',furnishedChecklist:[item]}),context('P'))).status,200);
  assert.equal(JSON.stringify(app.state.properties.P.furnishedChecklist),JSON.stringify([item]));
  assert.equal((await api.PUT(request('/properties/P','owner','PUT',{unitCondition:'furnished',furnishedChecklist:[item]}),context('P'))).status,200);
  assert.equal(JSON.stringify(app.state.properties.P.furnishedChecklist),JSON.stringify([item]));
  assert.equal((await api.PUT(request('/properties/P','owner','PUT',{unitCondition:'unfurnished',furnishedChecklist:[item]}),context('P'))).status,200);
  assert.equal(app.state.properties.P.furnishedChecklist.length,0);
  assert.equal((await api.PUT(request('/properties/P','owner','PUT',{unitCondition:'furnished',structure:'Land',furnishedChecklist:[item]}),context('P'))).status,200);
  assert.equal(app.state.properties.P.furnishedChecklist.length,0);
});
