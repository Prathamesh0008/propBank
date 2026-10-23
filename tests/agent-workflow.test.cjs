const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,defaults,request,route,context}=require('./fixtures/native-server.cjs');
const seed=()=>({users:{...structuredClone(users),agent:{...defaults,uid:'agent',name:'Listing Agent',email:'agent@test.invalid',role:'agent',isActive:true}},properties:{}});

test('initial registration permits individual or agent but never admin or later role replacement',async()=>{
 const app=isolated(seed()),service=app.load('@/lib/server/services/users');app.claims.newagent={email:'newagent@test.invalid',email_verified:false,emailVerified:false,providerData:[{providerId:'password'}]};
 const response=await service.createUser(request('/auth/user','newagent','POST',{uid:'newagent',email:'newagent@test.invalid',name:'New Agent',role:'agent'}),true);assert.equal(response.status,200);assert.equal(app.state.users.newagent.role,'agent');
 assert.equal(Object.values(app.state.email_deliveries).filter(row=>row.eventType==='agent.registration').length,2);
 app.claims.newadmin={email:'newadmin@test.invalid',email_verified:false,emailVerified:false};await assert.rejects(()=>service.createUser(request('/auth/user','newadmin','POST',{uid:'newadmin',email:'newadmin@test.invalid',name:'No Admin',role:'admin'}),true),error=>error.status===403);
 app.claims.owner={email:'owner@test.invalid',email_verified:true,emailVerified:true,providerData:[{providerId:'google.com'}]};await service.createUser(request('/auth/user','owner','POST',{uid:'owner',email:'owner@test.invalid',name:'Owner',role:'agent'}),true);assert.equal(app.state.users.owner.role,'individual');
});

test('agent listing resolves a separate verified owner, remains private, and supports agent resubmission',async()=>{
 const app=isolated(seed());app.claims.owner={email:'owner@test.invalid',emailVerified:true,email_verified:true};app.claims.agent={email:'agent@test.invalid',emailVerified:true,email_verified:true};
 const response=await route(app,'properties').POST(request('/properties','agent','POST',{propertyTitle:'Agent Listed Home',propertyType:'residential',location:'Test district',ownerUID:'agent',agentOwnerEmail:'owner@test.invalid',listingType:'sell',sellingPrice:'7000000'}));assert.equal(response.status,200,await response.clone().text());const property=(await response.json()).property,stored=app.state.properties[property.id];
 assert.equal(stored.ownerUID,'owner');assert.equal(stored.submittingAgentUID,'agent');assert.equal(stored.moderationStatus,'pending_review');assert.equal((await route(app,'properties/[id]').GET(request('/properties/'+property.id),context(property.id))).status,404);
 const mine=await(await route(app,'properties').GET(request('/properties?ownerUID=agent','agent'))).json();assert.ok(mine.properties.some(row=>row.id===property.id));
 assert.equal((await route(app,'properties/[id]').PATCH(request('/properties/'+property.id,'agent','PATCH',{title:'Agent Listed Home Revised'}),context(property.id))).status,200);
 assert.equal((await route(app,'properties/[id]').PATCH(request('/properties/'+property.id,'agent','PATCH',{tenants:[]} ),context(property.id))).status,403);
 const revision=app.state.properties[property.id].moderationRevision;assert.equal((await route(app,'properties/[id]').PATCH(request('/properties/'+property.id,'admin','PATCH',{moderationAction:'approve',expectedRevision:revision}),context(property.id))).status,200);
 const publicRow=(await(await route(app,'properties/[id]').GET(request('/properties/'+property.id),context(property.id))).json()).property;assert.equal(publicRow.ownerUID,undefined);assert.equal(publicRow.ownerName,undefined);assert.equal(publicRow.submittingAgentUID,undefined);
 const offer=await route(app,'negotiations').POST(request('/negotiations','other','POST',{propertyId:property.id,amount:6500000}));assert.equal(offer.status,201);assert.equal((await offer.json()).negotiation.brokerUID,'agent');
});

test('commission allocation is admin-only, precise, unique and visible only to its agent',async()=>{
 const data=seed();data.properties.P={...properties.P,moderationStatus:'approved',rentalStatus:'available',submittedByUID:'agent',submittingAgentUID:'agent'};data.negotiations={N:{id:'N',propertyId:'P',status:'completed',version:5}};const app=isolated(data),api=route(app,'commissions');
 assert.equal((await api.POST(request('/commissions','agent','POST',{negotiationId:'N',totalCommission:'1000.00',shareType:'percentage',agentShareValue:'12.50'}))).status,403);
 let response=await api.POST(request('/commissions','admin','POST',{negotiationId:'N',totalCommission:'1000.00',shareType:'percentage',agentShareValue:'12.50'}));assert.equal(response.status,201);let row=(await response.json()).commission;assert.equal(row.agentShareCents,12500);assert.equal(row.propBankShareCents,87500);assert.equal(row.outstandingCents,12500);
 assert.equal((await api.POST(request('/commissions','admin','POST',{negotiationId:'N',totalCommission:'1000',shareType:'fixed',agentShareValue:'200'}))).status,409);
 assert.equal((await api.GET(request('/commissions','other'))).status,403);const agentRows=await(await api.GET(request('/commissions','agent'))).json();assert.equal(agentRows.commissions.length,1);
 response=await route(app,'commissions/[id]').PATCH(request('/commissions/N','admin','PATCH',{action:'record_payment',amount:'25.25',expectedVersion:1}),context('N'));assert.equal(response.status,200);row=(await response.json()).commission;assert.equal(row.paidCents,2525);assert.equal(row.outstandingCents,9975);assert.equal(row.paymentStatus,'partially_paid');assert.equal(row.history.length,2);
 response=await route(app,'commissions/[id]').PATCH(request('/commissions/N','admin','PATCH',{action:'update_allocation',totalCommission:'1000',shareType:'fixed',agentShareValue:'200',expectedVersion:2}),context('N'));assert.equal(response.status,200);row=(await response.json()).commission;assert.equal(row.agentShareCents,20000);assert.equal(row.propBankShareCents,80000);assert.equal(row.outstandingCents,17475);assert.equal(row.version,3);
 assert.equal((await route(app,'commissions/[id]').PATCH(request('/commissions/N','agent','PATCH',{action:'record_payment',amount:'1',expectedVersion:2}),context('N'))).status,403);
 assert.equal((await route(app,'commissions/[id]').PATCH(request('/commissions/N','admin','PATCH',{action:'record_payment',amount:'1',expectedVersion:1}),context('N'))).status,409);
 const notifications=Object.values(app.state.email_deliveries).filter(row=>row.eventType.startsWith('commission.'));assert.deepEqual(new Set(notifications.map(row=>row.recipientRole)),new Set(['agent','admin']));
});

