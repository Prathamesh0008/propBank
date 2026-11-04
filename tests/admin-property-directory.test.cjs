const {test}=require('node:test');
const assert=require('node:assert/strict');
const {QueryClient}=require('@tanstack/react-query');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const {adminPropertyDirectory,visibleAdminProperties,replaceReviewedProperty}=isolated().load('@/lib/admin-property-directory');
const rows=[
 {id:'old',createdAt:'2026-10-01T00:00:00Z',moderationStatus:'pending_review'},
 {id:'approved',createdAt:'2026-11-01T00:00:00Z',moderationStatus:'approved'},
 {id:'new',createdAt:'2026-10-30T00:00:00Z',moderationStatus:'pending_review'},
 {id:'rejected',createdAt:'2026-11-02T00:00:00Z',moderationStatus:'rejected'},
 {id:'changes',createdAt:'2026-11-03T00:00:00Z',moderationStatus:'changes_requested'},
 {id:'legacy'},
];
const ids=rows=>Array.from(rows,row=>row.id);

test('both tab counts cover the full unique set; only submitted pending records enter the queue',()=>{
 const directory=adminPropertyDirectory([...rows,rows[0]]);
 assert.equal(directory.all.length,6);assert.equal(directory.pending.length,2);
 assert.deepEqual(ids(directory.pending),['new','old']);
 assert.deepEqual(ids(directory.all),['changes','rejected','approved','new','old','legacy']);
});

test('pending tab ignores the all-tab status filter; returning to all preserves its filter',()=>{
 const directory=adminPropertyDirectory(rows);
 assert.deepEqual(ids(visibleAdminProperties(directory,'all','approved')),['approved']);
 assert.deepEqual(ids(visibleAdminProperties(directory,'pending','approved')),['new','old']);
 assert.deepEqual(ids(visibleAdminProperties(directory,'all','rejected')),['rejected']);
 assert.equal(visibleAdminProperties(directory,'all','all').length,6);
});

test('pending submission ties and missing dates retain deterministic order',()=>{
 const pending=adminPropertyDirectory([
  {id:'missing',moderationStatus:'pending_review'},
  {id:'b',createdAt:'2026-11-01T00:00:00Z',moderationStatus:'pending_review'},
  {id:'a',createdAt:'2026-11-01T00:00:00Z',moderationStatus:'pending_review'},
 ]).pending;
 assert.deepEqual(ids(pending),['a','b','missing']);
 assert.equal(adminPropertyDirectory(rows.filter(row=>row.moderationStatus!=='pending_review')).pending.length,0);
});

for(const action of ['approve','reject'])test(`persisted ${action} updates cached tabs immediately and preserves original submission order`,async()=>{
 const seeded=Object.fromEntries(rows.map(row=>[row.id,{...properties.P,...row,moderationRevision:1}]));
 const app=isolated({users,properties:seeded}),query=new QueryClient();
 const key=['allProperties','admin'];query.setQueryData(key,rows);
 try{
  const response=await route(app,'properties/[id]').PATCH(request('/properties/old','admin','PATCH',{moderationAction:action,reason:action==='reject'?'Fictional review reason':'',expectedRevision:1}),context('old'));
  assert.equal(response.status,200,await response.clone().text());const result=await response.json();
  query.setQueriesData({queryKey:['allProperties']},existing=>replaceReviewedProperty(existing,result.property));
  const directory=adminPropertyDirectory(query.getQueryData(key));
  assert.equal(directory.all.length,6);assert.equal(directory.pending.length,1);
  assert.deepEqual(ids(directory.pending),['new']);
  assert.deepEqual(ids(directory.all),['changes','rejected','approved','new','old','legacy']);
  assert.equal(directory.all.find(row=>row.id==='old').moderationStatus,action==='approve'?'approved':'rejected');
  const fresh=await(await route(app,'properties').GET(request('/properties?admin=true','admin'))).json();
  assert.deepEqual(ids(adminPropertyDirectory(fresh.properties).pending),['new']);
 }finally{query.clear();}
});

test('unauthorized or failed moderation leaves records and pending counts intact',async()=>{
 const app=isolated({users,properties:{P:{...properties.P,moderationStatus:'pending_review',moderationRevision:1}}});
 const patch=(uid,reason)=>route(app,'properties/[id]').PATCH(request('/properties/P',uid,'PATCH',{moderationAction:'reject',reason,expectedRevision:1}),context('P'));
 assert.equal((await patch('owner','Review')).status,403);
 assert.equal((await patch('admin','')).status,400);
 assert.equal(app.state.properties.P.moderationStatus,'pending_review');
 assert.equal(adminPropertyDirectory(Object.values(app.state.properties)).pending.length,1);
 assert.equal((await route(app,'properties').GET(request('/properties?admin=true','owner'))).status,403);
 assert.equal((await route(app,'properties').GET(request('/properties?admin=true'))).status,401);
});
