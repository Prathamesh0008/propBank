const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');

test('approval persists and both public surfaces expose the same safe record and detail ID',async()=>{
  const app=isolated({users,properties:{}});
  const created=await route(app,'properties').POST(request('/properties','owner','POST',{
    propertyTitle:'Discovery Home',propertyType:'residential',configuration:'2 BHK',location:'Pune',
    ownerUID:'owner',listingType:'sell_rent',sellingPrice:'9000000',monthlyRent:'30000',
  }));
  assert.equal(created.status,200,await created.clone().text());
  const property=(await created.json()).property;
  const lists=async()=>Promise.all(['properties','properties/search'].map(async name=>
    (await route(app,name).GET(request('/'+name))).json()));
  for(const body of await lists()) assert.equal(body.count,0);
  const approved=await route(app,'properties/[id]').PATCH(request('/properties/'+property.id,'admin','PATCH',{
    moderationAction:'approve',expectedRevision:1,
  }),context(property.id));
  assert.equal(approved.status,200);
  assert.equal(app.state.properties[property.id].moderationStatus,'approved');
  // Document identity must work even for older records without a stored ID field.
  delete app.state.properties[property.id].id;
  for(let refresh=0;refresh<2;refresh++) for(const body of await lists()) {
    assert.equal(body.count,1);
    assert.equal(body.properties[0].id,property.id);
    for(const privateKey of ['moderationStatus','moderationHistory','ownerUID','reportedOwner'])
      assert.ok(!(privateKey in body.properties[0]));
    assert.equal(body.properties[0].ownerEmail,'');
  }
  assert.equal((await route(app,'properties/[id]').GET(request('/properties/'+property.id),context(property.id))).status,200);
});

test('all approved matches remain accessible; search counts exclude unpublished records',async()=>{
  const seed={};
  for(let i=0;i<31;i++) seed['PUBLIC'+i]={...properties.P,id:'stale',title:'Pune '+i,
    tenants:[],moderationStatus:'approved',rentalStatus:'available',listingType:i%2?'sell':'rent',
    projectCondition:'Ready Project',isActive:true,status:'active'};
  for(const [id,override] of Object.entries({PENDING:{moderationStatus:'pending_review'},REJECTED:{moderationStatus:'rejected'},
    ARCHIVED:{isActive:false},INACTIVE:{status:'inactive'},SOLD:{isSold:true},RENTED:{isRented:true},TENANT:{createdAs:'tenant'},MANAGED:{listingType:'manage'}}))
    seed[id]={...seed.PUBLIC0,...override};
  const app=isolated({users,properties:seed});
  for(const name of ['properties','properties/search']) {
    const body=await(await route(app,name).GET(request('/'+name))).json();
    assert.equal(body.count,31);
    assert.equal(new Set(body.properties.map(p=>p.id)).size,31);
    assert.ok(body.properties.every(p=>p.id.startsWith('PUBLIC')));
  }
  const search=async query=>(await route(app,'properties/search').GET(request('/properties/search?'+query))).json();
  assert.equal((await search('q=Pune&listingType=rent&projectCondition=Ready%20Project')).count,16);
  assert.equal((await search('q=NoSuchLocation')).count,0);
  assert.equal((await search('projectCondition=New%20Project')).count,0);
});

test('homepage buy and rent filters retain mixed-purpose listings and accurate budgets',()=>{
  const app=isolated();
  const {filterProperties}=app.load('@/features/landing-page/landingUtils');
  const rows=[{id:'mixed',listingType:'sell_rent',propertyType:'residential',configuration:'2 BHK',title:'Pune home',price:5000000,status:'active',isActive:true}];
  for(const type of ['all','buy','rent']) {
    assert.equal(filterProperties(rows,' Pune ',type,[],[],'',{min:0,max:0}).length,1);
    assert.equal(filterProperties(rows,'',type,[],[],'',{min:0,max:100}).length,0);
  }
  assert.equal(filterProperties(rows,'','all',['rent'],['residential'],'',{min:0,max:0}).length,1);
});
