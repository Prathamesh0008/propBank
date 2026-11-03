const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {spawn}=require('node:child_process');

const file=resolve('.env.test-accounts.local');
let source;
try{source=readFileSync(file,'utf8');}catch{console.error('Missing gitignored .env.test-accounts.local. See DEVELOPMENT_TESTING_GUIDE.md.');process.exit(1);}
const configured={};
for(const raw of source.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const separator=line.indexOf('=');if(separator<1)continue;configured[line.slice(0,separator).trim()]=line.slice(separator+1);}
const local=/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/i;
if(!local.test(configured.FIREBASE_AUTH_EMULATOR_HOST||'')||!local.test(configured.FIRESTORE_EMULATOR_HOST||'')||!/^(demo-|test-)/i.test(configured.FIREBASE_TEST_PROJECT_ID||'')){console.error('Refusing to start: local emulator hosts and a demo-/test- project are required.');process.exit(1);}
if(configured.NEXT_PUBLIC_FIREBASE_PROJECT_ID!==configured.FIREBASE_TEST_PROJECT_ID||configured.FIREBASE_AUTH_PROJECT_ID!==configured.FIREBASE_TEST_PROJECT_ID||configured.FIREBASE_DATA_PROJECT_ID!==configured.FIREBASE_TEST_PROJECT_ID){console.error('Refusing to start: browser, Auth Admin and Firestore Admin must use the same emulator project.');process.exit(1);}
const childEnv={...process.env,...configured,RESEND_API_KEY:'',FROM_EMAIL:'',TWILIO_ACCOUNT_SID:'',TWILIO_AUTH_TOKEN:'',TWILIO_PHONE_NUMBER:'',FIREBASE_AUTH_CREDENTIALS:'',FIREBASE_DATA_CREDENTIALS:'',FIREBASE_CREDENTIALS:'',GOOGLE_APPLICATION_CREDENTIALS:''};
for(const name of ['PROPBANK_TEST_USER_EMAIL','PROPBANK_TEST_USER_PASSWORD','PROPBANK_TEST_ADMIN_EMAIL','PROPBANK_TEST_ADMIN_PASSWORD'])delete childEnv[name];
const port=/^\d+$/.test(process.env.PROPBANK_DEV_PORT||'')?process.env.PROPBANK_DEV_PORT:'8080';
const args=[resolve('node_modules/next/dist/bin/next'),'dev','--port',port];if(process.env.PROPBANK_DEV_WEBPACK==='1')args.push('--webpack');
const child=spawn(process.execPath,args,{cwd:process.cwd(),env:childEnv,stdio:'inherit'});
child.on('exit',(code,signal)=>process.exitCode=signal?1:(code||0));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
