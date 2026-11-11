const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
const {registrySeed}=require('./fixtures/mobile-registry.cjs');
function setup(){
 const a=isolated(registrySeed(users));a.env.TEST_STRICT_TRANSACTIONS='1';
 const db=a.load('@/lib/server/firestore').getDatabase(),collection=db.collection.bind(db);const wrap=q=>new Proxy(q,{get(t,k){if(k==='count')return()=>({get:async()=>{const result=await t.get();return {data:()=>({count:result.docs.length})};}});if(['where','orderBy','limit','startAfter'].includes(k))return(...args)=>wrap(t[k](...args));return typeof t[k]==='function'?t[k].bind(t):t[k];}});db.collection=(...args)=>wrap(collection(...args));
 const rent=a.load('@/lib/rent-resolution'),lib=a.load('@/lib/rent-schedule'),rows=lib.initializeRentSchedule([],'2026-01-01','2027-12-31','30000').map((r,i)=>({...r,amount:i?'35000':'30000'}));
 const t={...properties.P.tenants[0],propertyId:'P',ownerUID:'owner',monthlyRent:'30000',paymentDueDate:'5',leaseStartDate:'2026-01-01',leaseEndDate:'2027-12-31',rentSchedule:rows,rentTermsVersion:0};
 const p={...properties.P,monthlyRent:'30000',securityDeposit:'0',agreementPeriod:'24',agreementStartDate:'2026-01-01',agreementEndDate:'2027-12-31',agreementStatus:'active',paymentDueDate:'5',rentSchedule:rows,rentTermsVersion:0,tenants:[t],rentLedger:{'2026-01':{month:'2026-01',status:'paid',expectedRent:29000}}};
 a.state.properties={P:p};a.state.tenants={T:t};return {a,rent,rows,p,t};
}
const patch=(a,body,uid='owner')=>route(a,'properties/[id]').PATCH(request('/properties/P',uid,'PATCH',body),context('P'));
const changed=rows=>rows.map((r,i)=>({...r,amount:i?'45000':r.amount}));
const termsIntents=a=>Object.values(a.state.email_deliveries||{}).filter(v=>v.kind==='notification_intent'&&v.sourceEventType==='tenancy.rental_terms_updated');

test('5A rent: schedule-only PATCH atomically synchronizes canonical and embedded terms and downstream billing',async()=>{
 const {a,rent,rows}=setup(),ledger=JSON.stringify(a.state.properties.P.rentLedger);
 assert.equal((await patch(a,{rentSchedule:changed(rows),expectedRentTermsVersion:0})).status,200);
 const p=a.state.properties.P,t=a.state.tenants.T;
 for(const date of ['2026-02-05','2026-12-05','2027-02-05'])assert.equal(rent.resolveRent(p,date).amount,rent.resolveRent(p,date,t).amount);
 assert.equal(rent.resolveRent(p,'2027-02-05',t).amount,'45000');assert.equal(rent.rentForBillingPeriod(p,'2027-02',t).amount,'45000');
 assert.equal(rent.sameRentSchedule(p.tenants[0].rentSchedule,t.rentSchedule),true);assert.equal(p.rentTermsVersion,1);assert.equal(t.rentTermsVersion,1);assert.equal(t.id,'T');assert.equal(JSON.stringify(p.rentLedger),ledger);
 const hub=await route(a,'property-hub').GET(request('/property-hub?propertyId=P&billingMonth=2027-02','owner'));assert.equal(hub.status,200);assert.equal((await hub.json()).hubs[0].rentSuggestion.amount,'45000');
});
test('5A rent: canonical write failure rolls back property, tenant, history and all notifications',async()=>{
 const {a,rows}=setup(),before=JSON.stringify(a.state);a.env.TEST_DB_WRITE_COLLECTION='tenants';const response=await patch(a,{rentSchedule:changed(rows),expectedRentTermsVersion:0});assert.ok(response.status>=400);assert.equal(JSON.stringify(a.state),before);assert.equal(a.emails.length,0);
});
test('5A rent: stale concurrent property versions allow exactly one committed schedule',async()=>{
 const {a,rows}=setup(),results=await Promise.all(['45000','47000'].map(amount=>patch(a,{rentSchedule:rows.map((r,i)=>({...r,amount:i?amount:r.amount})),expectedRentTermsVersion:0})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(termsIntents(a).length,1);
});
test('5A rent: current changes retain past effective rent in immutable snapshots',async()=>{
 const {a,rows,rent}=setup(),before=rent.resolveRent(a.state.properties.P,'2026-02-05').amount;
 assert.equal((await patch(a,{monthlyRent:'45000',rentSchedule:rows.map(r=>({...r,amount:'45000'})),expectedRentTermsVersion:0})).status,200);
 assert.equal(rent.resolveRent(a.state.properties.P,'2026-02-05').amount,before);assert.equal(rent.resolveRent(a.state.properties.P,'2027-02-05',a.state.tenants.T).amount,'45000');
});
for(const field of ['agreementStatus','agreementFinalizedAt'])test(`5A rent: finalized canonical ${field} refuses a property-wide edit`,async()=>{
 const {a,rows}=setup();a.state.tenants.T[field]=field==='agreementStatus'?'signed':new Date();assert.equal((await patch(a,{rentSchedule:changed(rows),expectedRentTermsVersion:0})).status,409);assert.equal(a.state.properties.P.rentTermsVersion,0);assert.equal(termsIntents(a).length,0);
});
test('5A rent: independent tenancy schedules and missing canonical records fail closed',async()=>{
 for(const mode of ['independent','missing','foreign']){const {a,rows}=setup();if(mode==='independent')a.state.tenants.T.rentSchedule=changed(rows);if(mode==='missing')delete a.state.tenants.T;if(mode==='foreign')a.state.tenants.T.propertyId='OTHER';assert.equal((await patch(a,{rentSchedule:changed(rows),expectedRentTermsVersion:0})).status,409);assert.equal(a.state.properties.P.rentTermsVersion,0);}
});
test('5A rent: legacy property without canonical tenancy retains schedule and monthly fallback support',async()=>{
 const {a,rows,rent}=setup();a.state.properties.P.tenants=[];a.state.tenants={};delete a.state.properties.P.rentSchedule;
 assert.equal(rent.resolveRent(a.state.properties.P,'2027-02-05').source,'legacy');assert.equal((await patch(a,{rentSchedule:changed(rows),expectedRentTermsVersion:0})).status,200);assert.equal(rent.resolveRent(a.state.properties.P,'2027-02-05').amount,'45000');
});
test('5A rent: unrelated owner cannot edit or stage notices',async()=>{
 const {a,rows}=setup();assert.equal((await patch(a,{rentSchedule:changed(rows)},'other')).status,403);assert.equal(termsIntents(a).length,0);
});
test('5A notices: schedule-only edit stages owner/tenant and admin events with effective date; retry/no-op deduplicates',async()=>{
 const {a,rows}=setup(),newRows=changed(rows);assert.equal((await patch(a,{rentSchedule:newRows,expectedRentTermsVersion:0})).status,200);
 const intent=termsIntents(a)[0];assert.equal(termsIntents(a).length,1);assert.deepEqual(new Set(intent.event.recipients.map(v=>v.uid)),new Set(['owner','tenant']));assert.match(intent.event.bodyText,/take effect from \d{4}-\d{2}-\d{2}/);
 assert.equal(Object.values(a.state.admin_notifications).filter(n=>n.type==='rental_terms_changed').length,1);
 assert.equal((await patch(a,{rentSchedule:newRows,expectedRentTermsVersion:1})).status,200);assert.equal(termsIntents(a).length,1);
 assert.equal((await patch(a,{rentSchedule:newRows.map(r=>({amount:r.amount,toDate:r.toDate,months:r.months,year:r.year,fromDate:r.fromDate})),expectedRentTermsVersion:1})).status,200);assert.equal(termsIntents(a).length,1);
 await a.flush();const mails=Object.values(a.state.email_deliveries).filter(v=>v.eventType==='tenancy.rental_terms_updated');assert.equal(mails.length,2);assert.deepEqual(new Set(mails.map(v=>v.recipientUID)),new Set(['owner','tenant']));
});
test('5A notices: outbox failure rolls back terms; provider failure preserves committed terms and recoverable mail',async()=>{
 const {a,rows}=setup();a.env.TEST_DB_WRITE_COLLECTION='email_deliveries';assert.ok((await patch(a,{rentSchedule:changed(rows)})).status>=400);assert.equal(a.state.properties.P.rentTermsVersion,0);
 const next=setup();next.a.env.TEST_MAIL_FAIL='1';assert.equal((await patch(next.a,{rentSchedule:changed(next.rows)})).status,200);await next.a.flush();assert.equal(next.a.state.tenants.T.rentSchedule[1].amount,'45000');assert.ok(Object.values(next.a.state.email_deliveries).some(v=>v.eventType==='tenancy.rental_terms_updated'&&v.status==='failed'&&v.recoveryAt));
});
function emailSetup(){const a=isolated(registrySeed(users));a.env.TEST_STRICT_TRANSACTIONS='1';
 const db=a.load('@/lib/server/firestore').getDatabase(),collection=db.collection.bind(db);const wrap=q=>new Proxy(q,{get(t,k){if(k==='count')return()=>({get:async()=>{const result=await t.get();return {data:()=>({count:result.docs.length})};}});if(['where','orderBy','limit','startAfter'].includes(k))return(...args)=>wrap(t[k](...args));return typeof t[k]==='function'?t[k].bind(t):t[k];}});db.collection=(...args)=>wrap(collection(...args));a.claims.owner={email:'new-owner@test.invalid',emailVerified:true,email_verified:true};return a;}
const account=a=>a.load('@/lib/server/services/account').readMyAccount(request('/account','owner'));
test('5A email: verified account read atomically reconciles email, audit and exactly two address notices',async()=>{
 const a=emailSetup(),mobile=JSON.stringify([a.state.mobile_number_registry,a.state.mobile_number_registry_accounts]);assert.equal((await account(a)).status,200);assert.equal(a.state.users.owner.email,'new-owner@test.invalid');
 const notices=Object.values(a.state.email_deliveries).filter(v=>v.eventType==='user.email_changed');assert.equal(notices.length,2);assert.deepEqual(new Set(notices.map(v=>v.recipientEmail)),new Set(['owner@test.invalid','new-owner@test.invalid']));assert.equal(Object.values(a.state.auth_activity).filter(v=>v.eventType==='email_changed').length,1);assert.equal(JSON.stringify([a.state.mobile_number_registry,a.state.mobile_number_registry_accounts]),mobile);
 await account(a);assert.equal(Object.values(a.state.email_deliveries).filter(v=>v.eventType==='user.email_changed').length,2);
});
test('5A email: bootstrap repairs verified mismatch without weakening unrelated route checks',async()=>{
 const a=emailSetup(),auth=a.load('@/lib/server/auth');await assert.rejects(()=>auth.requireUser(request('/private','owner')),e=>e.code==='ACCOUNT_PROFILE_REQUIRED');
 const response=await a.load('@/lib/server/services/users').registrationProfile(request('/auth/profile','owner'));assert.equal((await response.json()).profileComplete,true);assert.equal((await auth.requireUser(request('/private','owner'))).uid,'owner');
});
for(const mode of ['unverified','disabled','missing','invalid'])test(`5A email: ${mode} identity/profile cannot reconcile`,async()=>{
 const a=emailSetup();if(mode==='unverified')a.claims.owner.emailVerified=false;if(mode==='disabled')a.claims.owner.disabled=true;if(mode==='missing')delete a.state.users.owner;if(mode==='invalid')a.state.users.owner.phoneNumber='123';
 await assert.rejects(()=>account(a),e=>e.status===403);assert.equal(Object.keys(a.state.email_deliveries||{}).length,0);if(a.state.users.owner)assert.equal(a.state.users.owner.email,'owner@test.invalid');
});
test('5A email: stale token requires refresh; client cannot choose target UID or email',async()=>{
 const a=emailSetup(),firebase=a.load('@/lib/server/firebase-admin'),base=firebase.getFirebaseAdminAuth;firebase.getFirebaseAdminAuth=()=>({...base(),verifyIdToken:async()=>({uid:'owner',email:'owner@test.invalid',email_verified:true})});await assert.rejects(()=>account(a),e=>e.status===401&&e.code==='TOKEN_REFRESH_REQUIRED');assert.equal(a.state.users.owner.email,'owner@test.invalid');
 const b=emailSetup();await b.load('@/lib/server/services/account').readMyAccount(request('/account?uid=owner&email=hijack@test.invalid','other'));assert.equal(b.state.users.owner.email,'owner@test.invalid');assert.equal(b.state.users.other.email,'other@test.invalid');
});
test('5A email: concurrent reconciliation emits one pair; event persistence failure rolls back all state',async()=>{
 const a=emailSetup();await Promise.all([account(a),account(a)]);assert.equal(Object.values(a.state.email_deliveries).filter(v=>v.eventType==='user.email_changed').length,2);
 for(const collection of ['email_deliveries','auth_activity']){const b=emailSetup();b.env.TEST_DB_WRITE_COLLECTION=collection;await assert.rejects(()=>account(b));assert.equal(b.state.users.owner.email,'owner@test.invalid');assert.equal(Object.keys(b.state.email_deliveries||{}).length,0);assert.equal(Object.keys(b.state.auth_activity||{}).length,0);}
});
const adminEvent={type:'rental_terms_changed',propertyId:'P',tenantId:'T',actorUID:'owner',eventId:'fixed-event',title:'Rental terms changed',message:'Review authorized rental terms.'};
async function stage(a,event=adminEvent){const service=a.load('@/lib/server/services/admin-lifecycle');let emails=[];await a.load('@/lib/server/firestore').getDatabase().runTransaction(async tx=>{const staged=await service.stageAdminLifecycle(tx,[event]);emails=staged.events;staged.write();});return emails;}
test('5A admin: one policy controls queued status, eligible recipient and idempotent delivery',async()=>{
 const {a}=setup();await stage(a);const n=Object.values(a.state.admin_notifications)[0],rows=Object.values(a.state.email_deliveries);assert.equal(n.emailStatus,'queued');assert.equal(rows.length,1);assert.equal(n.emailDeliveryId,rows[0].id);assert.equal(rows[0].recipientEmail,'admin@test.invalid');await stage(a);assert.equal(Object.keys(a.state.email_deliveries).length,1);assert.equal(Object.keys(a.state.admin_notifications).length,1);
});
test('5A admin: absent policy and absent recipient are reported distinctly',async()=>{
 const {a}=setup();await stage(a,{...adminEvent,type:'property_pending_approval'});assert.equal(Object.values(a.state.admin_notifications)[0].emailStatus,'not_requested');assert.equal(Object.keys(a.state.email_deliveries||{}).length,0);
 const {a:b}=setup();delete b.env.ADMIN_EMAIL;await stage(b);assert.equal(Object.values(b.state.admin_notifications)[0].emailStatus,'unconfigured');assert.equal(Object.keys(b.state.email_deliveries||{}).length,0);
});
test('5A admin: feed reports authoritative provider/retry/permanent states independently of read state',async()=>{
 const {a}=setup();await stage(a);const n=Object.values(a.state.admin_notifications)[0],mail=a.state.email_deliveries[n.emailDeliveryId];
 for(const [status,expected]of [['pending','queued'],['sending','processing'],['failed','retryable_failure'],['exhausted','exhausted'],['permanent_failure','permanent_failure'],['sent','provider_accepted']]){mail.status=status;const response=await route(a,'admin/notifications/feed').GET(request('/admin/notifications/feed','admin'));const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.equal(data.items[0].emailStatus,expected);assert.equal(data.items[0].isRead,false);}
});
test('5A admin: successful dispatch and provider failure update authoritative delivery without losing notification',async()=>{
 for(const fail of [false,true]){const {a}=setup();if(fail)a.env.TEST_MAIL_FAIL='1';const events=await stage(a);a.load('@/lib/server/services/transactional-email').dispatchEmailOutbox(events);await a.flush();const n=Object.values(a.state.admin_notifications)[0],mail=a.state.email_deliveries[n.emailDeliveryId];assert.equal(mail.status,fail?'failed':'sent');assert.equal(Object.keys(a.state.admin_notifications).length,1);assert.equal(n.readByUIDs.length,0);}
});

test('5A rent: inherited legacy tenancy terms preserve the pre-edit effective contract',async()=>{
 const {a,rows,rent}=setup();delete a.state.tenants.T.rentSchedule;delete a.state.properties.P.tenants[0].rentSchedule;
 a.state.tenants.T.monthlyRent='27000';a.state.properties.P.tenants[0].monthlyRent='27000';
 const prior=rent.resolveRent(a.state.properties.P,'2026-02-05',a.state.tenants.T).amount;
 assert.equal((await patch(a,{rentSchedule:changed(rows),expectedRentTermsVersion:0})).status,200);
 assert.equal(rent.resolveRent(a.state.properties.P,'2026-02-05',a.state.tenants.T).amount,prior);assert.equal(rent.resolveRent(a.state.properties.P,'2027-02-05',a.state.tenants.T).amount,'45000');
});
test('5A admin: property-submission notification links its existing atomic admin outbox without a duplicate',async()=>{
 const {a}=setup(),response=await route(a,'properties').POST(request('/properties','owner','POST',{propertyTitle:'Atomic submission',propertyType:'residential',configuration:'2 BHK',location:'Isolated',ownerUID:'owner',listingType:'sell',sellingPrice:'5000000'}));assert.equal(response.status,200,await response.clone().text());
 const notices=Object.values(a.state.admin_notifications),n=notices.find(v=>v.type==='property_added');assert.equal(n.emailStatus,'queued');assert.equal(a.state.email_deliveries[n.emailDeliveryId].recipientRole,'admin');assert.equal(Object.values(a.state.email_deliveries).filter(v=>v.recipientRole==='admin'&&v.propertyId===n.propertyId).length,1);
});
