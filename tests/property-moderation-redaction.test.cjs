const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const feedback={moderationStatus:'approved',moderationRevision:4,moderationReason:'Owner-facing feedback',moderationSubmittedAt:new Date('2026-10-01T00:00:00Z'),moderationReviewedAt:new Date('2026-10-02T00:00:00Z')};
const internal={moderationReviewerUID:'private-reviewer-sentinel',moderationHistory:[{action:'approve',note:'private-audit-sentinel'}],internalReviewNotes:'private-note-sentinel'};
function setup(extra={}){return isolated({users:{...users,agent:{...users.other,uid:'agent',role:'agent',email:'agent@test.invalid'},buyer:{...users.other,uid:'buyer',email:'buyer@test.invalid'}},properties:{P:{...properties.P,...feedback,...internal,submittedByUID:'agent',rentalStatus:'available',monthlyRent:'30000',paymentDueDate:'5',agreementStartDate:'2026-01-01',agreementEndDate:'2027-12-31',...extra}}});}
const detail=(a,uid,path='/properties/P')=>route(a,'properties/[id]').GET(request(path,uid),context('P'));
const noInternal=value=>{const text=JSON.stringify(value);for(const marker of ['private-reviewer-sentinel','private-audit-sentinel','private-note-sentinel'])assert.equal(text.includes(marker),false,marker);for(const key of Object.keys(internal))assert.equal(key in value,false,key);};
for(const uid of ['admin','owner','tenant','agent','buyer',undefined])test(`detail moderation visibility for ${uid||'anonymous'} follows the server role`,async()=>{
 const a=setup(),response=await detail(a,uid);assert.equal(response.status,200);const p=(await response.json()).property;
 assert.equal(p.title,'Existing Home');if(uid==='admin'){assert.equal(p.moderationReviewerUID,internal.moderationReviewerUID);assert.equal(p.moderationHistory[0].note,'private-audit-sentinel');}else noInternal(p);
 if(['admin','owner'].includes(uid)){for(const key of Object.keys(feedback))assert.ok(key in p,key);assert.equal(p.moderationReason,feedback.moderationReason);}else for(const key of Object.keys(feedback))assert.equal(key in p,false,key);
});
test('detail cannot elevate a linked tenant with client role parameters',async()=>{
 const a=setup(),response=await detail(a,'tenant','/properties/P?role=admin&userRole=admin&ownerUID=tenant');assert.equal(response.status,200);const p=(await response.json()).property;noInternal(p);assert.equal(p.userRole,'tenant');assert.equal('moderationReason'in p,false);
});
test('Property Hub single-property and relationship pages use the same owner/admin/non-owner policy',async()=>{
 for(const uid of ['tenant','owner','admin'])for(const suffix of ['?propertyId=P','']){const a=setup(),response=await route(a,'property-hub').GET(request('/property-hub'+suffix,uid));assert.equal(response.status,200,await response.clone().text());const body=await response.json();assert.equal(body.hubs.length,1);const p=body.hubs[0].property;
 if(uid==='admin'){assert.equal(p.moderationReviewerUID,internal.moderationReviewerUID);assert.ok(p.moderationHistory.length);}else{noInternal(p);for(const marker of ['private-reviewer-sentinel','private-audit-sentinel','private-note-sentinel'])assert.equal(JSON.stringify(body).includes(marker),false);}
 if(uid==='owner')assert.equal(p.moderationReason,feedback.moderationReason);if(uid==='tenant')assert.equal('moderationReason'in p,false);
 }
});
test('owner/tenant/agent directories retain appropriate review visibility and ordinary relationships',async()=>{
 for(const uid of ['owner','tenant','agent']){const a=setup(),response=await route(a,'properties').GET(request('/properties?ownerUID='+uid,uid));assert.equal(response.status,200);const p=(await response.json()).properties.find(p=>p.id==='P');assert.ok(p);noInternal(p);if(uid==='owner')assert.equal(p.moderationReason,feedback.moderationReason);else for(const key of Object.keys(feedback))assert.equal(key in p,false,key);}
 const a=setup(),response=await route(a,'properties/tenant').GET(request('/properties/tenant?tenantUID=tenant','tenant'));assert.equal(response.status,200);noInternal((await response.json()).properties[0]);
});
test('private listing and To Manage authorization cannot be bypassed for moderation data',async()=>{
 for(const listingType of ['rent','manage']){const a=setup({listingType,moderationStatus:'pending_review'});for(const uid of ['other','buyer',undefined])assert.ok([403,404].includes((await detail(a,uid)).status));
 if(listingType==='manage')for(const uid of ['tenant','agent'])assert.equal((await detail(a,uid)).status,403);
 const hub=await route(a,'property-hub').GET(request('/property-hub?propertyId=P','other'));assert.ok([403,404].includes(hub.status));
 }
});
test('public listing and search never include private moderation fields',async()=>{
 const a=setup();for(const path of ['/properties','/properties/search?q=Existing']){const name=path.includes('/search')?'properties/search':'properties',response=await route(a,name).GET(request(path));assert.equal(response.status,200);const body=await response.json();assert.equal(body.properties.length,1);noInternal(body.properties[0]);for(const key of Object.keys(feedback))assert.equal(key in body.properties[0],false,key);}
});
test('serialization redaction adds no Firestore reads and never erases stored audit history',async()=>{
 async function inspect(include){const a=setup();if(!include)for(const key of [...Object.keys(internal),...Object.keys(feedback)])delete a.state.properties.P[key];const stored=JSON.stringify(a.state.properties.P);assert.equal((await detail(a,'tenant')).status,200);assert.equal(JSON.stringify(a.state.properties.P),stored);assert.equal(a.writes.length,0);return a.reads.map(r=>({collection:r.collection,id:r.id,filters:r.filters}));}
 assert.deepEqual(await inspect(true),await inspect(false));
});
