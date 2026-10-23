const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route}=require('./fixtures/native-server.cjs');
function seed(){const app=isolated({users,properties:{P:{...properties.P,createdAs:'tenant',submittedByUID:'tenant',ownerUID:'',ownershipVerification:'pending'}},documents:{D:{id:'D',propertyId:'P'}},tenants:{T:{id:'T',propertyId:'P',userUID:'tenant',ownerUID:'',isActive:true}}});app.claims.owner={emailVerified:true};return app;}
const body={propertyId:'P',ownerUID:'owner',evidenceDocumentId:'D',reviewNote:'Ownership evidence independently checked'};
test('owner verification requires admin and verified existing identity with same-property evidence',async()=>{
 const app=seed(),api=route(app,'owner-verification');
 assert.equal((await api.POST(request('/owner-verification','tenant','POST',body))).status,403);
 assert.equal((await api.POST(request('/owner-verification','owner','POST',body))).status,403);
 assert.equal((await api.POST(request('/owner-verification','admin','POST',{...body,ownerUID:'missing'}))).status,400);
 assert.equal((await api.POST(request('/owner-verification','admin','POST',{...body,evidenceDocumentId:'missing'}))).status,400);
 app.claims.owner.emailVerified=false;assert.equal((await api.POST(request('/owner-verification','admin','POST',body))).status,400);
 assert.equal(app.state.properties.P.ownerUID,'');
});
test('admin linking is atomic, preserves tenancy, uses Firebase email and prevents relinking',async()=>{
 const app=seed(),api=route(app,'owner-verification');app.state.users.owner.email='forged@invalid.test';
 assert.equal((await api.POST(request('/owner-verification','admin','POST',body))).status,200);
 assert.equal(app.state.properties.P.ownerUID,'owner');assert.equal(app.state.properties.P.ownerEmail,'owner@test.invalid');assert.equal(app.state.properties.P.ownershipVerification,'verified');assert.equal(app.state.properties.P.ownershipVerificationAudit.actorUID,'admin');assert.equal(app.state.tenants.T.ownerUID,'owner');assert.equal(app.state.tenants.T.userUID,'tenant');
 const deliveries=Object.values(app.state.email_deliveries).filter(row=>row.eventType==='owner_verification.approve');assert.equal(deliveries.length,3);assert.deepEqual(new Set(deliveries.map(row=>row.recipientUID)),new Set(['tenant','owner','admin']));assert.ok(deliveries.every(row=>row.html.includes('verified')));
 assert.equal((await api.POST(request('/owner-verification','admin','POST',body))).status,409);
});
test('verification rejects active tenant as owner and evidence from another property',async()=>{
 const app=seed(),api=route(app,'owner-verification');app.claims.tenant={emailVerified:true};
 assert.equal((await api.POST(request('/owner-verification','admin','POST',{...body,ownerUID:'tenant'}))).status,400);
 app.state.documents.D.propertyId='elsewhere';assert.equal((await api.POST(request('/owner-verification','admin','POST',body))).status,400);
});
