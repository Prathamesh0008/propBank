const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const review={moderationStatus:'pending_review',moderationRevision:3,moderationReason:'Supply clearer listing photos',moderationSubmittedAt:new Date('2026-10-01T00:00:00Z'),moderationReviewedAt:new Date('2026-10-02T00:00:00Z'),moderationReviewerUID:'private-reviewer',moderationHistory:[{privateNotes:'internal-audit-sentinel'}],internalReviewNotes:'private-note-sentinel'};
const allowed=['moderationStatus','moderationRevision','moderationReason','moderationSubmittedAt','moderationReviewedAt'];
function setup(overrides={}){return isolated({users:{...users,agent:{...users.other,uid:'agent',role:'agent',email:'agent@test.invalid'},buyer:{...users.other,uid:'buyer',email:'buyer@test.invalid'}},properties:{P:{...properties.P,...review,...overrides}}});}
const directory=(a,uid='owner',owner=uid)=>route(a,'properties').GET(request('/properties?ownerUID='+owner,uid));
const detail=(a,uid)=>route(a,'properties/[id]').GET(request('/properties/P',uid),context('P'));
const noReview=row=>{for(const key of Object.keys(review))assert.equal(key in row,false,key);};
for(const state of ['pending_review','approved','rejected','changes_requested'])test(`owner directory preserves permitted ${state} review metadata consistently with detail`,async()=>{
 const a=setup({moderationStatus:state}),response=await directory(a);assert.equal(response.status,200);const row=(await response.json()).properties[0],full=(await (await detail(a,'owner')).json()).property;
 for(const key of allowed)assert.deepEqual(row[key],full[key]);assert.equal(row.moderationStatus,state);assert.equal(row.moderationReason,review.moderationReason);
 for(const key of ['moderationReviewerUID','moderationHistory','internalReviewNotes'])assert.equal(key in row,false,key);
});
test('owner directory reflects committed moderation decisions without changing their lifecycle',async()=>{
 const a=setup(),response=await route(a,'properties/[id]').PATCH(request('/properties/P','admin','PATCH',{moderationAction:'request_changes',reason:'Correct location information',expectedRevision:3}),context('P'));assert.equal(response.status,200);
 const row=(await (await directory(a)).json()).properties[0];assert.equal(row.moderationStatus,'changes_requested');assert.equal(row.moderationReason,'Correct location information');assert.equal(row.moderationRevision,4);assert.equal(new Date(row.moderationReviewedAt).getTime(),a.state.properties.P.moderationReviewedAt.getTime());
});
test('legacy owner directory does not fabricate missing moderation values',async()=>{
 const a=isolated({users,properties});const row=(await (await directory(a)).json()).properties[0];for(const key of allowed)assert.equal(key in row,false,key);assert.equal(row.id,'P');
});
test('anonymous, unrelated, tenant, agent and buyer directory access does not gain owner review information',async()=>{
 const a=setup({submittedByUID:'agent',buyers:[{userUID:'buyer',isActive:true}]});assert.equal((await route(a,'properties').GET(request('/properties?ownerUID=owner'))).status,401);for(const uid of ['other','tenant','agent','buyer'])assert.equal((await directory(a,uid,'owner')).status,403);
 for(const uid of ['tenant','agent']){const response=await directory(a,uid);assert.equal(response.status,200);for(const row of (await response.json()).properties||[])noReview(row);}
 const dedicated=await route(a,'properties/tenant').GET(request('/properties/tenant?tenantUID=tenant','tenant'));assert.equal(dedicated.status,200);for(const row of (await dedicated.json()).properties||[])noReview(row);
 assert.equal((await detail(a,'other')).status,404);
});
test('public listing stays redacted while admin directory retains its authorized review access',async()=>{
 const a=setup({moderationStatus:'approved',rentalStatus:'available'});
 for(const uid of [undefined,'buyer','other']){const response=await detail(a,uid);assert.equal(response.status,200);noReview((await response.json()).property);}
 const publicRows=(await (await route(a,'properties').GET(request('/properties'))).json()).properties;assert.equal(publicRows.length,1);noReview(publicRows[0]);
 const admin=await route(a,'properties').GET(request('/properties?admin=true','admin'));assert.equal(admin.status,200);const row=(await admin.json()).properties[0];assert.equal(row.moderationStatus,'approved');assert.equal(row.moderationReviewerUID,'private-reviewer');
});
test('To Manage privacy remains enforced independently of owner review serialization',async()=>{
 const a=setup({listingType:'manage',moderationStatus:'approved',tenants:[]});assert.equal((await directory(a)).status,200);for(const uid of [undefined,'tenant','other','agent','buyer'])assert.ok([403,404].includes((await detail(a,uid)).status));
 assert.equal((await (await route(a,'properties').GET(request('/properties'))).json()).count,0);
});
test('owner cursor pages remain complete, unique and bounded with identical metadata-free query budgets',async()=>{
 async function collect(includeMetadata){const records=Object.fromEntries(Array.from({length:83},(_,i)=>{const id='P'+String(i).padStart(3,'0');return [id,{...properties.P,...(includeMetadata?review:{}),id,tenants:[]}];})),a=isolated({users,properties:records}),ids=[];let cursor='',pages=0;
 do{const response=await route(a,'properties').GET(request('/properties?ownerUID=owner&cursor='+encodeURIComponent(cursor),'owner'));assert.equal(response.status,200);const body=await response.json();ids.push(...(body.properties||[]).map(p=>p.id));cursor=body.nextCursor||'';assert.ok(++pages<=4);}while(cursor);
 assert.equal(ids.length,83);assert.equal(new Set(ids).size,83);assert.deepEqual(ids,[...ids].sort());const queries=a.reads.filter(r=>!r.id);assert.ok(queries.every(r=>r.returnedDocuments<=26));return {ids,queries:queries.map(r=>({collection:r.collection,filters:r.filters,order:r.order,returned:r.returnedDocuments}))};}
 const plain=await collect(false),reviewed=await collect(true);assert.deepEqual(reviewed,plain);
});
