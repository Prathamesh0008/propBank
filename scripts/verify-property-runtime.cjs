// Real HTTP + Firebase SDK/emulator smoke check. Never target the normal server.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
const project=process.env.FIREBASE_TEST_PROJECT_ID;
const origin=new URL(process.env.PROPBANK_RUNTIME_URL||'http://127.0.0.1:8081');
if(!/^demo-/.test(project||'')||!/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST||'')||!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||'')||origin.hostname!=='127.0.0.1'||origin.port==='8080'||process.env.PROPBANK_RUNTIME_MAIL_BLOCKED!=='1')throw new Error('Requires a separate loopback demo-project server with outbound email explicitly intercepted');
const app=require('firebase-admin').initializeApp({projectId:project},'property-runtime-verification');
const db=app.firestore(),auth=app.auth(),tokens={},results=[];
async function api(path,role,body){const response=await fetch(new URL('/api/'+path,origin),{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+tokens[role],'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await response.json();results.push({path:path.split('?')[0],status:response.status,message:data.message});return {response,data};}
async function main(){
 const run=randomUUID(),password=randomUUID();
 for(const role of ['owner','tenant','admin']){const uid='runtime-'+role,email=role+'@example.invalid';try{await auth.createUser({uid,email,password,emailVerified:true});}catch(error){if(error.code!=='auth/uid-already-exists'&&error.code!=='auth/email-already-exists')throw error;await auth.updateUser(uid,{password,emailVerified:true});}await db.collection('users').doc(uid).set({uid,email,name:'Runtime '+role,role:role==='admin'?'admin':'individual',isActive:true,phoneNumber:role==='owner'?'9876543210':'9123456789',createdAt:new Date(),updatedAt:new Date()});const response=await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});tokens[role]=(await response.json()).idToken;assert.ok(tokens[role]);}
 const base={propertyTitle:'Runtime ordinary '+run,propertyType:'residential',location:'Isolated fixture location',ownerUID:'runtime-owner',listingType:'rent',monthlyRent:'25000',rentalStatus:'available',images:[],internalImages:[]};
 const rent={rentalStatus:'rented',mobileNumber:'9123456789',tenantEmail:'tenant@example.invalid',tenantFirstName:'Runtime',tenantLastName:'Tenant',monthlyRent:'25000',paymentDueDate:'5',agreementPeriod:'12',agreementStartDate:'2026-01-01',agreementEndDate:'2026-12-31'};
 const mediaId=randomUUID();await db.collection('storage_objects').doc(mediaId).create({id:mediaId,bucket:'isolated-no-object-access',key:'managed/'+mediaId,uploadedBy:'runtime-owner',propertyId:'',filename:'fixture.png',contentType:'image/png',size:1,status:'pending',privateOnly:false,bindings:[],createdAt:new Date()});
 const scenarios=[['owner',base],['owner',{...base,...rent,propertyTitle:'Runtime rented '+run}],['tenant',{...base,...rent,createdAs:'tenant',propertyTitle:'Runtime tenant email '+run,reportedOwner:{personName:'Runtime Owner',phone:'9876543210',email:'owner@example.invalid'}}],['tenant',{...base,...rent,createdAs:'tenant',propertyTitle:'Runtime tenant no email '+run,reportedOwner:{personName:'Runtime Owner',phone:'9876543210'}}],['owner',{...base,propertyTitle:'Runtime managed image '+run,images:['/api/media/'+mediaId]}]];
 const ids=[];
 for(const [role,body]of scenarios){const {response,data}=await api('properties',role,body);assert.equal(response.status,200,JSON.stringify(data));assert.ok(data.property.id);ids.push(data.property.id);const stored=await db.collection('properties').doc(data.property.id).get();assert.equal(stored.data().title,body.propertyTitle);}
 const duplicate=await api('properties','owner',base);assert.equal(duplicate.data.property.id,ids[0]);
 const invalid=await api('properties','owner',{...base,tenantEmail:'invalid'});assert.equal(invalid.response.status,400);assert.ok(invalid.data.fieldErrors.tenantEmail);
 const invalidOwner=await api('properties','tenant',{...scenarios[2][1],reportedOwner:{personName:'Owner',phone:'9876543210',email:'invalid'}});assert.equal(invalidOwner.response.status,400);assert.ok(invalidOwner.data.fieldErrors['reportedOwner.email']);
 const claims=(await db.collection('relationship_links').get()).docs.filter(doc=>ids.includes(doc.data().propertyId));assert.equal(claims.length,3);
 const tenantClaim=claims.find(doc=>doc.data().propertyId===ids[1]);
 let rented=await api('properties/tenant?tenantUID=runtime-tenant','tenant');assert.ok(!rented.data.properties.some(property=>property.id===ids[1]));
 assert.equal((await api('relationship-links','tenant',{action:'discover'})).response.status,200);
 const accepted=await api('relationship-links','tenant',{action:'confirm_tenancy',claimId:tenantClaim.id});assert.equal(accepted.response.status,200);assert.equal(accepted.data.status,'linked');
 rented=await api('properties/tenant?tenantUID=runtime-tenant','tenant');assert.ok(rented.data.properties.some(property=>property.id===ids[1]));
 const detailed=(await db.collection('tenants').doc(tenantClaim.data().tenantId).get()).data();assert.equal(detailed.userUID,'runtime-tenant');assert.equal((await db.collection('properties').doc(ids[1]).get()).data().tenants[0].userUID,'runtime-tenant');
 const owned=await api('properties?ownerUID=runtime-owner','owner');assert.ok(owned.data.properties.some(property=>property.id===ids[1]));
 const ownerClaim=claims.find(doc=>doc.data().propertyId===ids[2]);assert.equal((await api('relationship-links','owner',{action:'discover'})).response.status,200);assert.equal((await api('relationship-links','owner',{action:'request_owner_verification',claimId:ownerClaim.id})).response.status,200);assert.equal((await db.collection('properties').doc(ids[2]).get()).data().ownerUID,'');
 for(let attempt=0;attempt<20;attempt++){const rows=(await db.collection('email_deliveries').get()).docs.filter(doc=>ids.includes(doc.data().propertyId));if(rows.every(doc=>!['pending','sending'].includes(doc.data().status)))break;await new Promise(resolve=>setTimeout(resolve,250));}
 const outbox=(await db.collection('email_deliveries').get()).docs.filter(doc=>ids.includes(doc.data().propertyId));
 assert.equal(outbox.filter(doc=>doc.data().eventType==='relationship.owner_invitation').length,1);assert.equal(outbox.filter(doc=>doc.data().eventType==='relationship.tenant_invitation').length,1);assert.ok(outbox.some(doc=>doc.data().status==='failed'&&doc.data().providerStatus===403));
 const failed=outbox.find(doc=>doc.data().eventType==='property.submitted'&&doc.data().status==='failed');assert.ok(failed);assert.equal((await api('admin/email-deliveries/'+failed.id+'/retry','admin',{})).response.status,200);
 assert.equal((await db.collection('storage_objects').doc(mediaId).get()).data().bindings[0].propertyId,ids[4]);
 const report={project,origin:origin.origin,transport:'Resend intercepted; synthetic 403, no real mail',createdProperties:ids.length,claims:claims.length,outboxEvents:outbox.length,outboxStates:outbox.map(doc=>({eventType:doc.data().eventType,status:doc.data().status,providerStatus:doc.data().providerStatus})),http:results};
 fs.mkdirSync('node_modules/.cache/propbank-runtime-repair',{recursive:true});fs.writeFileSync('node_modules/.cache/propbank-runtime-repair/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>app.delete());
