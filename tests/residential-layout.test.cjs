const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');

const payload=configuration=>({propertyTitle:'Layout home',propertyType:'residential',propertyCategory:'residential',structure:'Flat',configuration,location:'Pune',ownerUID:'owner',listingType:'manage'});

test('new residential intake accepts supported BHK layouts and rejects Studio',async()=>{
 for(const configuration of ['1 BHK','2 BHK','3 BHK','4 BHK','5+ BHK']){const app=isolated({users}),response=await route(app,'properties').POST(request('/properties','owner','POST',payload(configuration)));assert.equal(response.status,200,configuration);assert.equal(Object.values(app.state.properties)[0].configuration,configuration);}
 const app=isolated({users}),response=await route(app,'properties').POST(request('/properties','owner','POST',payload('Studio')));assert.equal(response.status,400);assert.equal(Object.keys(app.state.properties||{}).length,0);
});

test('legacy Studio properties remain readable and editable without conversion',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,propertyType:'residential',propertyCategory:'residential',structure:'Flat',configuration:'Studio'}}}),detail=route(app,'properties/[id]');
 const read=await detail.GET(request('/properties/P','owner'),context('P'));assert.equal(read.status,200);assert.equal((await read.json()).property.configuration,'Studio');
 const update=await detail.PUT(request('/properties/P','owner','PUT',{title:'Legacy Studio renamed'}),context('P'));assert.equal(update.status,200);assert.equal(app.state.properties.P.configuration,'Studio');
});
