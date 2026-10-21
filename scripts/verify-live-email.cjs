// Explicit opt-in: real Resend delivery, isolated in-memory database/auth records.
const path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {isolated}=require('../tests/fixtures/native-server.cjs');
require('@next/env').loadEnvConfig(process.cwd(),true,{info:()=>{},error:()=>{}});
const recipient=process.argv[2];
if(process.argv[3]!=='--send-live'||!recipient||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw new Error('Usage: node scripts/verify-live-email.cjs controlled-recipient --send-live');
for(const name of ['RESEND_API_KEY','FROM_EMAIL','CRON_SECRET'])if(!process.env[name]?.trim())throw new Error(`${name} is missing`);
if(process.env.CRON_SECRET.length<32)throw new Error('Cron secret is too short');
const run=crypto.randomUUID(),now=new Date(),local=new Date(now.getTime()+19800000),day=local.getUTCDate();
const calls=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let queue=Promise.resolve();
const app=isolated({users:{tenant:{uid:'tenant',email:recipient,name:'Controlled email test',isActive:true,role:'individual'}},visits:{},properties:{}});
Object.assign(app.env,{RESEND_API_KEY:process.env.RESEND_API_KEY,FROM_EMAIL:process.env.FROM_EMAIL,CRON_SECRET:process.env.CRON_SECRET});
app.claims.tenant={email:recipient,email_verified:true};
const effects=app.load(path.resolve('src/lib/server/services/property-effects.ts'));
const transport=async(url,init)=>{
 if(url!=='https://api.resend.com/emails')throw new Error('Unexpected provider endpoint');
 const payload=JSON.parse(init.body);
 if(payload.to.length!==1||payload.to[0]!==recipient)throw new Error('Recipient is not the authorized test inbox');
 const previous=queue;let release;queue=new Promise(resolve=>{release=resolve;});await previous;
 try {
  const response=await fetch(url,init),data=await response.clone().json().catch(()=>({}));
  calls.push({recipient,subject:payload.subject,httpStatus:response.status,accepted:response.ok,providerId:data.id||null,errorType:data.name||null,idempotencyKey:init.headers['Idempotency-Key']||null});
  await sleep(700);return response;
 }finally{release();}
};
const realSend=vm.runInNewContext('('+effects.sendEmail.toString()+')',{process:{env:{RESEND_API_KEY:process.env.RESEND_API_KEY,FROM_EMAIL:process.env.FROM_EMAIL}},fetch:transport,AbortSignal});
// Existing reminder service imports this cached export; only email transport is real.
effects.sendEmail=realSend;
async function cron(authorized=true){
 const endpoint=app.load(path.resolve('src/app/api/cron/reminders/route.ts'));
 const before=calls.length;
 const response=await endpoint.POST(new Request('http://isolated.test/api/cron/reminders',{method:'POST',headers:authorized?{Authorization:`Bearer ${process.env.CRON_SECRET}`}:{}}));
 return {httpStatus:response.status,body:await response.json(),providerCalls:calls.length-before};
}
(async()=>{
 console.log(JSON.stringify({configuration:{RESEND_API_KEY:'configured',FROM_EMAIL:'configured',CRON_SECRET:'configured'},recipient,mode:'Real Resend; actual POST route handler with isolated Firestore/auth; not deployed cron or production Firestore',run}));
 try{await realSend({to:recipient,subject:'PropBank controlled transactional email verification',html:'<p>This is an authorized PropBank email delivery test. No customer records were changed.</p>'},`live-direct-${run}`);}catch{console.log(JSON.stringify({direct:calls,stopped:'Provider rejected transactional email; reminders not attempted'}));return;}
 console.log(JSON.stringify({direct:calls[0]}));
 app.state.visits[`live-visit-${run}`]={id:`live-visit-${run}`,userId:'tenant',title:'PropBank controlled test visit',visitDate:new Date(Date.now()+15*60000),createdAt:now,updatedAt:now,isCompleted:false,status:'scheduled',reminderType:'email',reminderTime:30,description:'Controlled live email verification only.'};
 const base={isActive:true,status:'active',rentalStatus:'rented',listingType:'rent',ownerUID:'',ownerEmail:'',tenants:[{userUID:'tenant',email:recipient,isActive:true}],createdAt:now};
 app.state.properties[`live-rent-${run}`]={...base,title:'PropBank controlled rent test',monthlyRent:'15000',paymentDueDate:String(day),agreementEndDate:new Date(now.getTime()+180*86400000).toISOString()};
 app.state.properties[`live-expiry-${run}`]={...base,title:'PropBank controlled expiry test',agreementEndDate:new Date(now.getTime()+90*86400000).toISOString()};
 console.log(JSON.stringify({unauthorizedCron:await cron(false)}));
 console.log(JSON.stringify({firstCron:await cron()}));
 console.log(JSON.stringify({repeatCron:await cron()}));
 // Advance only the controlled expiry record to its second phase; no customer data.
 app.state.properties[`live-expiry-${run}`].agreementEndDate=new Date(now.getTime()+60*86400000).toISOString();
 console.log(JSON.stringify({expiry60Phase:await cron()}));
 console.log(JSON.stringify({repeatExpiry60Phase:await cron()}));
 // Resubmit an identical accepted provider payload/key to check Resend itself.
 const visit=app.state.visits[`live-visit-${run}`],visitCall=calls.find(c=>c.subject.startsWith('Visit reminder:')&&c.accepted);
 if(visitCall){await realSend(visit.reminderDelivery.mail,visitCall.idempotencyKey);console.log(JSON.stringify({providerReplaySameId:calls.at(-1).providerId===visitCall.providerId}));}
 await sleep(5000);
 const deliveries=[];
 for(const id of new Set(calls.filter(c=>c.accepted).map(c=>c.providerId))){
  const response=await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`},signal:AbortSignal.timeout(15000)}),data=await response.json().catch(()=>({}));
  deliveries.push({providerId:id,httpStatus:response.status,lastEvent:response.ok?data.last_event||'not reported':null});await sleep(700);
 }
 console.log(JSON.stringify({calls,deliveries,sendEmailCalls:calls.length,uniqueAcceptedProviderIds:new Set(calls.filter(c=>c.accepted).map(c=>c.providerId)).size,productionFirestoreWrites:0,isolatedWrites:app.writes.length,inboxAndSpamPlacement:'Not observable from Resend delivery status'}));
})().catch(()=>{console.log('Live verification interrupted; no secret values logged. Review prior sanitized provider results before retrying.');process.exitCode=1;});
