// Explicitly authorized, one-shot Resend transport test. Never targets Firebase.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {isolated}=require('../tests/fixtures/native-server.cjs');
require('@next/env').loadEnvConfig(process.cwd(),true,{info:()=>{},error:()=>{}});

const PREFIX='[PROPBANK TEST — NO ACTION REQUIRED]';
const USER='rushikeshandhale1010@gmail.com';
const ADMIN='upasanapatilofficial@gmail.com';
const FROM='connect@propbank.shop';
const JOURNAL=path.resolve('.notification-live-test-business-20261023.json');
const PROPERTY_ID='PB-TEST-BUSINESS-20261023';
const PROPERTY='Aster Court Test Residence';
const LOCATION='Fictional Test District';

function fail(message){throw new Error(message);}
function writeJournal(value){const temporary=`${JOURNAL}.tmp`;fs.writeFileSync(temporary,JSON.stringify(value,null,2));fs.renameSync(temporary,JOURNAL);}
function prefixed(subject){return `${PREFIX} ${subject}`;}

async function verifySender(){
 const response=await fetch('https://api.resend.com/domains',{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`},signal:AbortSignal.timeout(15000)});
 if(!response.ok)fail(`Sender verification lookup failed with HTTP ${response.status}`);
 const data=await response.json();
 const domains=Array.isArray(data.data)?data.data:Array.isArray(data)?data:[];
 const domain=domains.find(value=>value?.name==='propbank.shop');
 if(!domain||String(domain.status).toLowerCase()!=='verified')fail('Sender domain is not verified');
 return {domain:'propbank.shop',status:'verified'};
}

function buildPlan(){
 const app=isolated();
 Object.assign(app.env,{APP_URL:process.env.APP_URL||'https://propbank.shop',ADMIN_EMAIL:'synthetic-admin@test.invalid'});
 const transactional=app.load(path.resolve('src/lib/server/services/transactional-email.ts'));
 const effects=app.load(path.resolve('src/lib/server/services/property-effects.ts'));
 const property={id:PROPERTY_ID,title:PROPERTY,location:LOCATION,ownerName:'Test Owner',ownerEmail:'test-owner@test.invalid',moderationRevision:1,createdAt:'2026-10-23T00:00:00.000Z'};
 const submitter={uid:'test-owner',email:'test-owner@test.invalid',name:'Test Owner',phoneNumber:'+910000000000'};
 const submitted=effects.propertyNotificationEvents(property,submitter,'pending_review');
 const approved=effects.propertyNotificationEvents({...property,moderationRevision:2},submitter,'approved')[0];
 const render=(title,bodyHtml,bodyText,action)=>transactional.brandedEmail(title,bodyHtml,bodyText,action);
 const tenantBody=`A tenant was assigned to ${PROPERTY}. Monthly rent: ₹32,500.`;
 const visitText=`${PROPERTY} — scheduled: 15 November 2026, 11:00 AM IST`;
 const expiryText=`${PROPERTY}: the current rental agreement expires on 30 November 2026. Review renewal or move-out arrangements in PropBank.`;
 const rows=[
  {event:'Registration welcome',role:'Registered user',to:USER,subject:'Welcome to PropBank',...render('Welcome to PropBank','<p>Your PropBank account is ready. You can now manage property and rental activity from your secure account.</p>','Your PropBank account is ready. You can now manage property and rental activity from your secure account.',{label:'Open your account',path:'/manage-property'})},
  {event:'Property submitted',role:'Owner',to:USER,...submitted[0]},
  {event:'Property submitted',role:'Administrator',to:ADMIN,...submitted[1]},
  {event:'Property approved',role:'Owner',to:USER,...approved},
  {event:'Tenant assigned',role:'Owner',to:USER,subject:'Tenant assignment confirmed — Owner copy',...render('Tenant relationship updated',`<p>A tenant was assigned to <strong>${PROPERTY}</strong>.</p><p>Monthly rent: ₹32,500</p>`,tenantBody,{label:'View rental details',path:`/manage-property/${PROPERTY_ID}`})},
  {event:'Tenant assigned',role:'Tenant',to:USER,subject:'Tenant assignment confirmed — Tenant copy',...render('Tenant relationship updated',`<p>A tenant was assigned to <strong>${PROPERTY}</strong>.</p><p>Monthly rent: ₹32,500</p>`,tenantBody,{label:'View rental details',path:`/manage-property/${PROPERTY_ID}`})},
  {event:'Visit scheduled',role:'Requester',to:USER,subject:'Property visit updated — Requester copy',...render('Property visit updated',`<p><strong>${PROPERTY}</strong></p><p>scheduled: 15 November 2026, 11:00 AM IST</p>`,visitText,{label:'View visit',path:`/manage-property/${PROPERTY_ID}`})},
  {event:'Visit scheduled',role:'Owner',to:USER,subject:'Property visit updated — Owner copy',...render('Property visit updated',`<p><strong>${PROPERTY}</strong></p><p>scheduled: 15 November 2026, 11:00 AM IST</p>`,visitText,{label:'View visit',path:`/manage-property/${PROPERTY_ID}`})},
  {event:'Agreement expiry — 30 days',role:'Tenant',to:USER,subject:'Rental agreement expires in 30 days — Tenant copy',...render('Rental agreement expires in 30 days',`<p><strong>${PROPERTY}</strong></p><p>The current rental agreement expires on 30 November 2026. Review renewal or move-out arrangements in PropBank.</p>`,expiryText,{label:'View agreement',path:`/manage-property/${PROPERTY_ID}`})},
  {event:'Agreement expiry — 30 days',role:'Owner',to:USER,subject:'Rental agreement expires in 30 days — Owner copy',...render('Rental agreement expires in 30 days',`<p><strong>${PROPERTY}</strong></p><p>The current rental agreement expires on 30 November 2026. Review renewal or move-out arrangements in PropBank.</p>`,expiryText,{label:'View agreement',path:`/manage-property/${PROPERTY_ID}`})},
 ];
 return rows.map((row,index)=>({...row,number:index+1,subject:prefixed(row.subject),idempotencyKey:`propbank-business-test-20261023-${String(index+1).padStart(2,'0')}-${crypto.createHash('sha256').update(`${row.event}:${row.role}`).digest('hex').slice(0,16)}`}));
}

function validate(plan){
 if(process.argv[2]!=='--send-live')fail('Explicit --send-live argument is required');
 if(fs.existsSync(JOURNAL))fail(`Attempt journal already exists: ${JOURNAL}`);
 if(!process.env.RESEND_API_KEY?.trim())fail('RESEND_API_KEY is missing');
 if(process.env.FROM_EMAIL?.trim().toLowerCase()!==FROM)fail('FROM_EMAIL is not the approved verified sender');
 if(plan.length!==10)fail('Plan must contain exactly 10 messages');
 if(plan.filter(row=>row.to===USER).length!==9||plan.filter(row=>row.to===ADMIN).length!==1)fail('Recipient limits do not match the approved 9/1 plan');
 const allowed=new Set([USER,ADMIN]);
 const ids=new Set();
 for(const row of plan){
  if(!allowed.has(row.to)||row.to==='connectpropbank@gmail.com')fail(`Unexpected recipient in message ${row.number}`);
  if(!row.subject.startsWith(PREFIX))fail(`Missing required subject prefix in message ${row.number}`);
  if(!row.html?.includes('PropBank')||!row.text?.trim())fail(`Invalid HTML or plaintext template in message ${row.number}`);
  if(row.number>1&&!row.html.includes(PROPERTY))fail(`Fictional property is missing from message ${row.number}`);
  if(ids.has(row.idempotencyKey))fail('Duplicate idempotency key');ids.add(row.idempotencyKey);
  if('cc' in row||'bcc' in row)fail('CC/BCC fields are prohibited');
 }
}

async function send(row){
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':row.idempotencyKey},body:JSON.stringify({from:`PropBank <${FROM}>`,to:[row.to],subject:row.subject,html:row.html,text:row.text}),signal:AbortSignal.timeout(30000)});
 const data=await response.json().catch(()=>null);
 return {httpStatus:response.status,accepted:response.ok,providerId:data?.id||null,errorType:response.ok?null:data?.name||'provider_error'};
}

(async()=>{
 const plan=buildPlan();validate(plan);const sender=await verifySender();
 const journal={batch:'business-notification-20261023',createdAt:new Date().toISOString(),sender,approvedAttempts:10,attempts:[]};writeJournal(journal);
 for(const row of plan){
  const record={number:row.number,event:row.event,role:row.role,recipient:row.to,subject:row.subject,idempotencyKey:row.idempotencyKey,state:'attempting',startedAt:new Date().toISOString(),provider:null};
  journal.attempts.push(record);writeJournal(journal);
  let provider;
  try{provider=await send(row);}catch(error){record.state='ambiguous';record.completedAt=new Date().toISOString();record.error='Provider request did not return a definitive response';writeJournal(journal);fail(`Message ${row.number} produced an ambiguous result; stopped`);}
  record.provider=provider;record.completedAt=new Date().toISOString();record.state=provider.accepted&&provider.providerId?'accepted':'failed';writeJournal(journal);
  console.log(JSON.stringify({number:row.number,event:row.event,role:row.role,recipient:row.to,httpStatus:provider.httpStatus,accepted:provider.accepted,providerId:provider.providerId}));
  if(record.state!=='accepted')fail(`Message ${row.number} was rejected; stopped`);
 }
 await new Promise(resolve=>setTimeout(resolve,5000));
 for(const record of journal.attempts){
  const response=await fetch(`https://api.resend.com/emails/${encodeURIComponent(record.provider.providerId)}`,{headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`},signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>null);
  record.providerStatus=response.ok?(data?.last_event||'not reported'):`lookup_failed_http_${response.status}`;
  record.statusCheckedAt=new Date().toISOString();writeJournal(journal);
  console.log(JSON.stringify({number:record.number,providerId:record.provider.providerId,providerStatus:record.providerStatus}));
 }
 journal.completedAt=new Date().toISOString();writeJournal(journal);
 console.log(JSON.stringify({complete:true,attempts:journal.attempts.length,accepted:journal.attempts.filter(row=>row.state==='accepted').length,journal:JOURNAL}));
})().catch(error=>{console.error(`CONTROLLED TEST STOPPED: ${error.message}`);process.exitCode=1;});
