const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isolated,users,properties,request,route}=require('./fixtures/native-server.cjs');
const {newestPropertySubmissions}=isolated().load('@/lib/property-submission-order');
const ids=rows=>newestPropertySubmissions(rows).map(row=>row.id);
const submissions=[
 {id:'old',createdAt:'2026-10-01T10:00:00Z'},
 {id:'new',createdAt:'2026-10-03T10:00:00Z'},
 {id:'middle',createdAt:'2026-10-02T10:00:00Z'},
];

test('admin submissions are newest first without mutating shared query data',()=>{
 const rows=Object.freeze(submissions.map(row=>Object.freeze({...row})));
 assert.deepEqual(ids(rows),['new','middle','old']);
 assert.deepEqual(rows.map(row=>row.id),['old','new','middle']);
});

for(const status of ['pending_review','approved','rejected'])test(`${status} retains newest-first submission order`,()=>{
 const rows=submissions.map(row=>({...row,moderationStatus:status}));
 rows.push({id:'different-status',createdAt:'2026-11-01T00:00:00Z',moderationStatus:'changes_requested'});
 assert.deepEqual(newestPropertySubmissions(rows).filter(row=>row.moderationStatus===status).map(row=>row.id),['new','middle','old']);
});

test('later edits and approval timestamps do not promote older submissions',()=>{
 assert.deepEqual(ids(submissions.map(row=>({...row,updatedAt:'2099-01-01T00:00:00Z',approvedAt:'2099-01-01T00:00:00Z',moderationStatus:'approved'}))),['new','middle','old']);
});

test('missing and invalid dates follow valid submissions with deterministic ID order',()=>{
 assert.deepEqual(ids([{id:'z',createdAt:null},{id:'b',createdAt:'invalid'},{id:'a'},{id:'c',createdAt:''},...submissions]),['new','middle','old','a','b','c','z']);
});

test('equal instants use persisted ID regardless of input order or timezone spelling',()=>{
 const rows=[{id:'z',createdAt:'2026-10-01T10:00:00Z'},{id:'a',createdAt:'2026-10-01T15:30:00+05:30'}];
 assert.deepEqual(ids(rows),['a','z']);assert.deepEqual(ids([...rows].reverse()),['a','z']);
});

test('normal refresh includes a newer submission at the top',()=>{
 assert.deepEqual(ids([...submissions,{id:'latest',createdAt:'2026-11-04T00:00:00Z'}]),['latest','new','middle','old']);
});

test('admin list supplies the complete result set including legacy dates and retains authorization',async()=>{
 const seeded=Object.fromEntries(submissions.map(row=>[row.id,{...properties.P,...row}]));
 seeded.legacy={...properties.P,id:'legacy'};delete seeded.legacy.createdAt;
 const app=isolated({users,properties:seeded});const api=route(app,'properties');
 const response=await api.GET(request('/properties?admin=true','admin'));assert.equal(response.status,200);
 const rows=(await response.json()).properties;assert.equal(rows.length,4);
 assert.deepEqual(ids(rows),['new','middle','old','legacy']);
 assert.equal((await api.GET(request('/properties?admin=true','owner'))).status,403);
});
