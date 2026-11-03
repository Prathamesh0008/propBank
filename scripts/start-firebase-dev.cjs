const {readFileSync,existsSync}=require('node:fs');
const {resolve}=require('node:path');
const {parseEnv}=require('node:util');
const {spawn}=require('node:child_process');
const {firebaseEnvironment}=require('../src/lib/firebase-environment.cjs');
const {developmentEmailConfiguration}=require('../src/lib/email-development.cjs');
const {emulatorChildEnv,checkEmulators,readConfig}=require('./start-emulator-dev.cjs');

// Every app-owned variable is explicitly populated before Next reads .env.local.
// Only the dedicated file supplies configuration; inherited credentials are discarded.
function firebaseChildEnv(shell=process.env,file={},emailFile={}){
  const child={...shell};
  const keys=new Set([...Object.keys(shell),...Object.keys(file),'PROPBANK_EMAIL_MODE','PROPBANK_EMAIL_ALLOWLIST','PROPBANK_EMAIL_SENDER_VERIFIED','RESEND_API_KEY','FROM_EMAIL','ADMIN_EMAIL','GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_CLOUD_PROJECT','GCLOUD_PROJECT','FIREBASE_CONFIG','FIREBASE_CREDENTIALS','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL']);
  for(const name of ['.env.example','.env.emulator.example','.env.firebase-dev.example','.env','.env.local','.env.development','.env.development.local']){
    if(existsSync(resolve(name)))for(const key of Object.keys(parseEnv(readFileSync(resolve(name),'utf8'))))keys.add(key);
  }
  for(const key of keys)if(/^(NEXT_PUBLIC_|FIREBASE_|FIRESTORE_|GOOGLE_|GCLOUD_|CLOUDSDK_|CLOUDFLARE_|RESEND_|FROM_EMAIL$|ADMIN_EMAIL$|APP_URL$|JWT_SECRET$|CRON_SECRET$|TWILIO_|PROPBANK_|ENQUIRY_)/.test(key))child[key]='';
  const allowed=new Set(['PROPBANK_FIREBASE_MODE','FIREBASE_DEV_PROJECT_ID','NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_APP_ID','NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','NEXT_PUBLIC_FIREBASE_PROJECT_ID','FIREBASE_AUTH_PROJECT_ID','FIREBASE_DATA_PROJECT_ID','FIREBASE_PROJECT_ID','FIREBASE_AUTH_CREDENTIALS','FIREBASE_DATA_CREDENTIALS','FIRESTORE_DATABASE_ID','APP_URL']);
  for(const [key,value] of Object.entries(file)){
    if(!allowed.has(key)&&value)throw new Error(`Unsupported setting ${key} in .env.firebase-dev.local. Keep production/provider credentials out of this file.`);
    if(allowed.has(key))child[key]=value;
  }
  if(file.PROPBANK_FIREBASE_MODE&&file.PROPBANK_FIREBASE_MODE!=='firebase')throw new Error('Ordinary development only permits firebase mode. Use the separate emulator/live command.');
  child.NODE_ENV='development';child.PROPBANK_FIREBASE_MODE='firebase';child.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE='firebase';
  child.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID=child.FIREBASE_DEV_PROJECT_ID;
  child.PROPBANK_TEST_DIST_DIR='.next-firebase-dev';
  child.APP_URL=child.APP_URL||'http://localhost:8080';
  if(child.APP_URL!=='http://localhost:8080')throw new Error('Development APP_URL must be http://localhost:8080.');
  child.ADMIN_EMAIL='admin@example.invalid';
  child.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME='propbank-development-private';
  const emailAllowed=new Set(['PROPBANK_EMAIL_MODE','PROPBANK_EMAIL_ALLOWLIST','PROPBANK_EMAIL_SENDER_VERIFIED','RESEND_API_KEY','FROM_EMAIL','ADMIN_EMAIL']);
  for(const [key,value] of Object.entries(emailFile)){
    if(!emailAllowed.has(key)&&value)throw new Error(`Unsupported email-only setting ${key} in .env.email-dev.local.`);
    if(emailAllowed.has(key))child[key]=value;
  }
  child.PROPBANK_EMAIL_MODE=child.PROPBANK_EMAIL_MODE||'capture';
  if(child.PROPBANK_EMAIL_MODE==='capture'){child.RESEND_API_KEY='';child.FROM_EMAIL='';child.ADMIN_EMAIL='admin@example.invalid';child.PROPBANK_EMAIL_ALLOWLIST='';child.PROPBANK_EMAIL_SENDER_VERIFIED='';}
  firebaseEnvironment(child);validateCredentials(child);developmentEmailConfiguration(child);
  return child;
}
function validateCredentials(env){
  for(const key of ['FIREBASE_AUTH_CREDENTIALS','FIREBASE_DATA_CREDENTIALS']){
    let account;
    try{const value=env[key];account=JSON.parse(value.trim().startsWith('{')?value:readFileSync(resolve(value),'utf8'));}catch{throw new Error(`${key} requires valid service-account JSON or a readable JSON path.`);}
    if(account.type!=='service_account'||account.project_id!==env.FIREBASE_DEV_PROJECT_ID||!account.client_email?.endsWith(`@${env.FIREBASE_DEV_PROJECT_ID}.iam.gserviceaccount.com`)||!account.private_key)throw new Error(`${key} service-account identity must match the authorized development project.`);
    try{require('node:crypto').createPrivateKey(account.private_key);}catch{throw new Error(`${key} contains an invalid private key.`);}
  }
}
async function main(){
  const file=readConfig(resolve('.env.firebase-dev.local'));
  const check=process.argv.includes('--check');
  const emulator=check&&process.env.PROPBANK_FIREBASE_MODE==='emulator';
  if(process.env.PROPBANK_FIREBASE_MODE==='live')throw new Error('Use the separately guarded dev:live command for live access.');
  const env=emulator?emulatorChildEnv(process.env,readConfig()):firebaseChildEnv(process.env,file,readConfig(resolve('.env.email-dev.local')));
  const selected=firebaseEnvironment(env);
  console.log(JSON.stringify({mode:selected.mode,firebaseProject:selected.authProjectId,firestoreDatabase:'(default)',authProvider:emulator?'loopback emulator':'development Firebase Auth',externalEmail:emulator?'disabled':env.PROPBANK_EMAIL_MODE==='resend-test'?'resend-test; exact recipient allowlist; 5 attempts/hour':'captured locally; never delivered',storage:emulator?'disabled':'local filesystem mock; no R2 access',url:env.APP_URL},null,2));
  if(emulator)await checkEmulators(selected);
  if(process.argv.includes('--verify-connection')){
    if(selected.mode!=='firebase')throw new Error('Connection verification only supports the isolated development project.');
    // SDK transport variables must use the sanitized selection as well.
    process.env=env;
    const {cert,initializeApp,deleteApp}=require('firebase-admin/app');
    const value=env.FIREBASE_AUTH_CREDENTIALS;
    const account=JSON.parse(value.trim().startsWith('{')?value:readFileSync(resolve(value),'utf8'));
    const app=initializeApp({projectId:selected.authProjectId,credential:cert(account)},'propbank-development-connection-check');
    try{
      await require('firebase-admin/auth').getAuth(app).listUsers(1);
      await require('firebase-admin/firestore').getFirestore(app,'(default)').collection('siteSettings').doc('main_settings').get();
      console.log('Verified development Auth and Firestore connection. No records were written. Browser provider sign-in still requires a manual check.');
    }finally{await deleteApp(app);}
    return;
  }
  if(check){console.log('Local configuration validated. No live connection, database reads or writes performed.');return;}
  const args=[resolve('node_modules/next/dist/bin/next'),'dev','--port','8080'];
  if(process.env.PROPBANK_DEV_WEBPACK==='1')args.push('--webpack');
  const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});
  child.on('error',()=>{console.error('Unable to launch Next.js.');process.exitCode=1;});
  child.on('exit',(code,signal)=>{process.exitCode=signal?1:(code||0);});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
}
module.exports={firebaseChildEnv,validateCredentials};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
