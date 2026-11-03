const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {isolated,users,properties,request,route}=require('./fixtures/native-server.cjs');
const {developmentEmailConfiguration,authorizeDevelopmentEmail}=require('../src/lib/email-development.cjs');
const {firebaseChildEnv}=require('../scripts/start-firebase-dev.cjs');
const project='propbanktest';
function env(){return {NODE_ENV:'development',PROPBANK_FIREBASE_MODE:'firebase',NEXT_PUBLIC_PROPBANK_FIREBASE_MODE:'firebase',NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID:project,FIREBASE_DEV_PROJECT_ID:project,NEXT_PUBLIC_FIREBASE_PROJECT_ID:project,FIREBASE_AUTH_PROJECT_ID:project,FIREBASE_DATA_PROJECT_ID:project,FIREBASE_PROJECT_ID:project,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:project+'.firebaseapp.com',NEXT_PUBLIC_FIREBASE_API_KEY:'fixture-web',NEXT_PUBLIC_FIREBASE_APP_ID:'fixture-app',FIRESTORE_DATABASE_ID:'(default)',FIREBASE_AUTH_CREDENTIALS:'fixture.json',FIREBASE_DATA_CREDENTIALS:'fixture.json',PROPBANK_EMAIL_MODE:'resend-test',PROPBANK_EMAIL_ALLOWLIST:'owner@test.invalid,tenant@test.invalid,admin@test.invalid',FROM_EMAIL:'connect@propbank.care',PROPBANK_EMAIL_SENDER_VERIFIED:'1',RESEND_API_KEY:'isolated-mail-key',ADMIN_EMAIL:'admin@test.invalid'};}
function app(options){const a=isolated({users,properties},options);Object.assign(a.env,env());return a;}
const mail={to:'owner@test.invalid',subject:'Controlled fixture',html:'<p>Original template fixture</p>'};
test('capture remains default and strips inherited/provider secrets from launcher',()=>{
 const key=require('node:crypto').generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
 const config=env();config.FIREBASE_AUTH_CREDENTIALS=config.FIREBASE_DATA_CREDENTIALS=JSON.stringify({type:'service_account',project_id:project,client_email:'fixture@propbanktest.iam.gserviceaccount.com',private_key:key});
 const file=Object.fromEntries(Object.entries(config).filter(([k])=>!['NODE_ENV','NEXT_PUBLIC_PROPBANK_FIREBASE_MODE','NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID','PROPBANK_EMAIL_MODE','PROPBANK_EMAIL_ALLOWLIST','PROPBANK_EMAIL_SENDER_VERIFIED','RESEND_API_KEY','FROM_EMAIL','ADMIN_EMAIL'].includes(k)));
 const child=firebaseChildEnv({RESEND_API_KEY:'inherited-key',PROPBANK_EMAIL_MODE:'resend-test'},file);
 assert.equal(child.PROPBANK_EMAIL_MODE,'capture');assert.equal(child.RESEND_API_KEY,'');assert.equal(child.CLOUDFLARE_R2_ACCESS_KEY_ID,'');
 assert.throws(()=>firebaseChildEnv({},file,{PROPBANK_EMAIL_MODE:'resend-test'}),/allowlist/i);
 const selected=firebaseChildEnv({},file,{PROPBANK_EMAIL_MODE:'resend-test',PROPBANK_EMAIL_ALLOWLIST:env().PROPBANK_EMAIL_ALLOWLIST,PROPBANK_EMAIL_SENDER_VERIFIED:'1',RESEND_API_KEY:'explicit-test-key',FROM_EMAIL:'connect@propbank.care',ADMIN_EMAIL:'admin@test.invalid'});assert.equal(selected.PROPBANK_FIREBASE_MODE,'firebase');assert.equal(selected.PROPBANK_EMAIL_MODE,'resend-test');assert.equal(selected.CRON_SECRET,'');assert.equal(selected.CLOUDFLARE_R2_ACCESS_KEY_ID,'');
 assert.throws(()=>firebaseChildEnv({},file,{PROPBANK_FIREBASE_MODE:'live'}),/email-only/);
});
test('missing key, missing allowlist, unconfirmed sender, wildcard and production targets fail closed',()=>{
 for(const patch of [{RESEND_API_KEY:''},{PROPBANK_EMAIL_ALLOWLIST:''},{PROPBANK_EMAIL_ALLOWLIST:'*@test.invalid',ADMIN_EMAIL:''},{PROPBANK_EMAIL_SENDER_VERIFIED:''},{FROM_EMAIL:''},{PROPBANK_EMAIL_MODE:'live'},{FIREBASE_DEV_PROJECT_ID:'propbank-7601b'},{FIREBASE_DATA_PROJECT_ID:'propbank-944fc'},{ADMIN_EMAIL:'customer@customer.example'}])assert.throws(()=>developmentEmailConfiguration({...env(),...patch}));
});
test('To CC and BCC are all normalized and exact-allowlisted; malformed, injected and bulk envelopes reject',()=>{
 const allowed=authorizeDevelopmentEmail(env(),{...mail,to:'OWNER@test.invalid',cc:['tenant@test.invalid'],bcc:'admin@test.invalid'});assert.deepEqual(allowed.to,['owner@test.invalid']);
 for(const field of ['to','cc','bcc'])for(const bad of ['customer@customer.example','Name <owner@test.invalid>','owner@test.invalid,customer@customer.example','owner@test.invalid\r\nBcc:customer@customer.example','owner@test.invalid.evil'])assert.throws(()=>authorizeDevelopmentEmail(env(),{...mail,[field]:bad}));
 assert.throws(()=>authorizeDevelopmentEmail(env(),{...mail,to:[mail.to,mail.to,mail.to,mail.to]}),/bulk/);assert.throws(()=>authorizeDevelopmentEmail(env(),[mail]),/batch/);assert.throws(()=>authorizeDevelopmentEmail(env(),{...mail,scheduled_at:'2099-01-01'}),/Scheduled/);
});
test('capture records all envelope fields, never calls provider and never reports sent',async()=>{
 const a=app();a.env.PROPBANK_EMAIL_MODE='capture';delete a.env.RESEND_API_KEY;
 await assert.rejects(a.load('@/lib/server/services/resend').sendEmail({...mail,cc:'customer@customer.example',bcc:'another@customer.example'}),/captured locally/);assert.equal(a.emails.length,0);assert.equal(a.captures.length,1);assert.equal(a.captures[0].bcc,'another@customer.example');
});
test('resend-test preserves sender/template/idempotency and permits only approved To/CC/BCC',async()=>{
 const a=app();const result=await a.load('@/lib/server/services/resend').sendEmail({...mail,cc:['tenant@test.invalid'],bcc:'admin@test.invalid'},'fixture-idempotency');
 assert.equal(result.id,'mock-resend-message');assert.equal(a.emails.length,1);assert.equal(a.emails[0].from,'PropBank <connect@propbank.care>');assert.equal(a.emails[0].html,mail.html);assert.deepEqual(a.emails[0].bcc,['admin@test.invalid']);assert.equal(a.emailKeys[0],'fixture-idempotency');assert.equal(a.emailReservations(),1);
});
test('blocked To/CC/BCC and batch calls never reserve budget or call Resend',async()=>{
 const a=app(),transport=a.load('@/lib/server/services/resend');
 for(const field of ['to','cc','bcc'])await assert.rejects(transport.sendEmail({...mail,[field]:'customer@customer.example'}),/allowlist/);
 await assert.rejects(transport.sendEmailBatch([mail,mail]),/Batch/);await assert.rejects(transport.sendEmail([mail]),/batch/);assert.equal(a.emails.length,0);assert.equal(a.emailReservations(),0);
});
test('provider rejection, timeout and absent acknowledgement remain failures',async()=>{
 for(const fetch of [async()=>new Response('{"name":"restricted_api_key"}',{status:403}),async()=>{throw new Error('fixture timeout');},async()=>new Response('{}',{status:200})]){
  const a=app({fetch});await assert.rejects(a.load('@/lib/server/services/resend').sendEmail(mail));
 }
});
test('queued property enquiry validates at delivery time; a changed allowlist records failed, not sent',async()=>{
 const a=app(),api=route(a,'admin/notifications');const response=await api.POST(request('/admin/notifications','tenant','POST',{type:'property_enquiry',propertyId:'P'}));assert.equal(response.status,201);
 a.env.PROPBANK_EMAIL_ALLOWLIST='owner@test.invalid';a.env.ADMIN_EMAIL='owner@test.invalid';await a.flush();assert.equal(a.emails.length,0);const delivery=Object.values(a.state.email_deliveries)[0];assert.equal(delivery.status,'failed');assert.match(delivery.errorSummary,/allowlist/);
});
test('local outbox succeeds only after provider acknowledgement and reports provider rejection as failed',async()=>{
 for(const failed of [false,true]){const a=app();if(failed)a.env.TEST_MAIL_FAIL='1';await route(a,'admin/notifications').POST(request('/admin/notifications','tenant','POST',{type:'property_enquiry',propertyId:'P'}));await a.flush();assert.equal(Object.values(a.state.email_deliveries)[0].status,failed?'failed':'sent');}
});
test('legacy next.after queue also enforces allowlist rather than bypassing transport',async()=>{
 const a=app();a.load('@/lib/server/services/property-effects').queueEmail({...mail,to:'customer@customer.example'});await a.flush();assert.equal(a.emails.length,0);
});
test('local cron and direct visit/rent reminder runners are blocked before reads or deliveries',async()=>{
 const a=app();a.env.CRON_SECRET='fixture-only-secret'.repeat(3);const reminders=a.load('@/lib/server/services/reminders');
 assert.throws(()=>reminders.requireCron(new Request('http://localhost/api/cron/reminders',{headers:{Authorization:'Bearer '+a.env.CRON_SECRET}})),/disabled in local/);
 await assert.rejects(reminders.runPropertyReminders(),/disabled in local/);await assert.rejects(reminders.runVisitReminders(),/disabled in local/);assert.equal(a.reads.length,0);assert.equal(a.emails.length,0);
});
function budget(files=new Map()){
 const locks=new Set();const mockfs={mkdir:async()=>{},open:async file=>{if(locks.has(file))throw new Error('locked');locks.add(file);return {close:async()=>{}};},readFile:async file=>{if(!files.has(file))throw Object.assign(new Error('missing'),{code:'ENOENT'});return files.get(file);},writeFile:async(file,value)=>files.set(file,value),rename:async(from,to)=>{files.set(to,files.get(from));files.delete(from);},unlink:async file=>locks.delete(file)};
 const exports={};const code=ts.transpileModule(fs.readFileSync('src/lib/server/development-email-budget.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,process:{env:env()},Error,Date,require:name=>name==='server-only'?{}:name==='node:fs/promises'?mockfs:path});return {files,exports,locks};
}
test('durable budget allows five attempts, survives module reload and fails closed on concurrent lock/corrupt state',async()=>{
 const b=budget();for(let i=0;i<5;i++)await b.exports.reserveDevelopmentEmailAttempt();await assert.rejects(b.exports.reserveDevelopmentEmailAttempt(),/5 provider attempts/);const reloaded=budget(b.files);await assert.rejects(reloaded.exports.reserveDevelopmentEmailAttempt(),/5 provider attempts/);assert.equal(b.locks.size,0);
 const state=[...b.files.keys()].find(k=>k.endsWith('send-budget.json'));b.files.set(state,'broken');await assert.rejects(b.exports.reserveDevelopmentEmailAttempt(),/unreadable/);
 const concurrent=budget();const results=await Promise.allSettled([concurrent.exports.reserveDevelopmentEmailAttempt(),concurrent.exports.reserveDevelopmentEmailAttempt()]);assert.equal(results.filter(r=>r.status==='rejected').length,1);
});
test('legacy direct-provider bulk scripts refuse this development worktree before sending',()=>{
 for(const file of ['verify-live-email.cjs','run-business-notification-live-test.cjs','run-visit-notification-live-test.cjs','run-final-notification-live-test.cjs']){
  const result=require('node:child_process').spawnSync(process.execPath,['scripts/'+file,'--send-live'],{encoding:'utf8',timeout:5000,windowsHide:true});assert.equal(result.status,1);assert.match(result.stderr,/blocked in development worktrees/);
 }
});
test('Windows filesystem budget persists across transport reloads without any provider call',async()=>{
 const cache=path.resolve('.cache');fs.mkdirSync(cache,{recursive:true});const temp=fs.mkdtempSync(path.join(cache,'email-budget-test-'));
 try{
  const code=ts.transpileModule(fs.readFileSync('src/lib/server/development-email-budget.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const load=()=>{const exports={};vm.runInNewContext(code,{exports,process:{env:env()},Error,Date,require:name=>name==='server-only'?{}:name==='node:fs/promises'?require('node:fs/promises'):{resolve:(...parts)=>parts[0]==='.cache/firebase-dev-email'?temp:path.resolve(...parts)}});return exports;};
  const first=load();for(let i=0;i<5;i++)await first.reserveDevelopmentEmailAttempt();await assert.rejects(load().reserveDevelopmentEmailAttempt(),/5 provider attempts/);assert.equal(JSON.parse(fs.readFileSync(path.join(temp,'send-budget.json'),'utf8')).length,5);
 }finally{assert.equal(path.dirname(temp),cache);fs.rmSync(temp,{recursive:true,force:true});}
});
