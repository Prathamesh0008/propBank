const {readFileSync,existsSync}=require('node:fs');
const {resolve}=require('node:path');
const {spawn}=require('node:child_process');

const net=require('node:net');
const {firebaseEnvironment}=require('../src/lib/firebase-environment.cjs');
const defaults={
  FIREBASE_TEST_PROJECT_ID:'demo-propbank',FIREBASE_AUTH_PROJECT_ID:'demo-propbank',FIREBASE_DATA_PROJECT_ID:'demo-propbank',FIREBASE_PROJECT_ID:'demo-propbank',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:'demo-propbank',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:8081',
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099',NEXT_PUBLIC_FIREBASE_API_KEY:'demo-emulator-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:'demo-propbank.firebaseapp.com',NEXT_PUBLIC_FIREBASE_APP_ID:'demo-propbank-local',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:'',NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:'',
};
const disabled=['PROPBANK_EMAIL_MODE','PROPBANK_EMAIL_ALLOWLIST','PROPBANK_EMAIL_SENDER_VERIFIED','RESEND_API_KEY','FROM_EMAIL','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_PHONE_NUMBER',
  'FIREBASE_AUTH_CREDENTIALS','FIREBASE_DATA_CREDENTIALS','FIREBASE_CREDENTIALS','GOOGLE_APPLICATION_CREDENTIALS',
  'CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_R2_BUCKET_NAME',
  'CLOUDFLARE_R2_PRIVATE_BUCKET_NAME','CLOUDFLARE_R2_PUBLIC_URL','FIREBASE_DATA_STORAGE_BUCKET','FIREBASE_STORAGE_BUCKET','STORAGE_BUCKET',
  'CRON_SECRET','PROPBANK_ALLOW_LIVE_FIREBASE','PROPBANK_TEST_USER_EMAIL','PROPBANK_TEST_USER_PASSWORD','PROPBANK_TEST_ADMIN_EMAIL','PROPBANK_TEST_ADMIN_PASSWORD','PROPBANK_TEST_PASSWORD'];
function emulatorChildEnv(shell=process.env,file={}){
  const child={...shell};
  for(const [key,value] of Object.entries(defaults))child[key]=shell[key]??file[key]??value;
  if(shell.FIREBASE_PROJECT_ID===undefined&&file.FIREBASE_PROJECT_ID===undefined)child.FIREBASE_PROJECT_ID=child.FIREBASE_TEST_PROJECT_ID;
  child.PROPBANK_FIREBASE_MODE='emulator';child.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE='emulator';child.NODE_ENV='development';
  child.PROPBANK_TEST_DIST_DIR=shell.PROPBANK_TEST_DIST_DIR||'.next-emulator';
  child.APP_URL=`http://localhost:${shell.PROPBANK_DEV_PORT||'8080'}`;child.ADMIN_EMAIL='admin@example.invalid';
  for(const key of disabled)child[key]=''; // Block Next dotenv from reloading live credentials.
  firebaseEnvironment(child);
  return child;
}
function readConfig(file=resolve('.env.test-accounts.local')){
  if(!existsSync(file))return {};
  return require('node:util').parseEnv(readFileSync(file,'utf8'));
}
function checkReachable(address,label,connect=net.createConnection){
  return new Promise((resolveCheck,reject)=>{
    const socket=connect(address);let finished=false;
    const finish=error=>{if(finished)return;finished=true;socket.destroy();error?reject(new Error(`${label} is unavailable. Start the local Firebase emulators first; production fallback is disabled.`)):resolveCheck();};
    socket.setTimeout(1500);socket.once('connect',()=>finish());socket.once('error',()=>finish(true));socket.once('timeout',()=>finish(true));
  });
}
async function checkEmulators(environment,connect){
  await Promise.all([checkReachable(environment.auth,'Auth emulator',connect),checkReachable(environment.firestore,'Firestore emulator',connect)]);
}
async function main(){
  const childEnv=emulatorChildEnv(process.env,readConfig()),environment=firebaseEnvironment(childEnv);
  const port=process.env.PROPBANK_DEV_PORT||'8080';
  if(!/^[0-9]+$/.test(port)||Number(port)<1||Number(port)>65535)throw new Error('PROPBANK_DEV_PORT must be a valid TCP port.');
  console.log(JSON.stringify({mode:environment.mode,project:environment.dataProjectId,database:'(default)',firestore:childEnv.FIRESTORE_EMULATOR_HOST,auth:childEnv.FIREBASE_AUTH_EMULATOR_HOST,externalEmail:'disabled',r2:'disabled',legacyStorage:'disabled'}));
  await checkEmulators(environment);
  console.log('Both local emulator ports are reachable. This check made no database reads or writes.');
  if(process.argv.includes('--check'))return;
  const args=[resolve('node_modules/next/dist/bin/next'),'dev','--port',port];if(process.env.PROPBANK_DEV_WEBPACK==='1')args.push('--webpack');
  const child=spawn(process.execPath,args,{cwd:process.cwd(),env:childEnv,stdio:'inherit',windowsHide:true});
  child.on('error',()=>{console.error('Unable to launch Next.js.');process.exitCode=1;});
  child.on('exit',(code,signal)=>{process.exitCode=signal?1:(code||0);});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
}
module.exports={emulatorChildEnv,readConfig,checkReachable,checkEmulators};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
