// Shared, side-effect-free policy for Next runtime and local launchers.
const loopback=/^(127\.0\.0\.1|localhost|\[::1\]):([0-9]+)$/i;
function emulatorAddress(value,label){
  const match=loopback.exec(value||'');
  if(!match||Number(match[2])<1||Number(match[2])>65535)throw new Error(`${label} must be a loopback host:port (no protocol).`);
  return {host:match[1].replace(/^\[|\]$/g,''),port:Number(match[2])};
}
function firebaseEnvironment(env){
  const selected=env.PROPBANK_FIREBASE_MODE||'';
  if(selected&&!['firebase','emulator','live'].includes(selected))throw new Error('PROPBANK_FIREBASE_MODE must be firebase, emulator or live.');
  if(selected&&env.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE&&selected!==env.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE)throw new Error('Server and browser Firebase modes must match.');
  const emulator=selected==='emulator'||env.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE==='emulator'||!!env.FIRESTORE_EMULATOR_HOST||!!env.FIREBASE_AUTH_EMULATOR_HOST||!!env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if(selected==='firebase'){
    if(emulator)throw new Error('Development Firebase cannot contain emulator settings.');
    const project=env.FIREBASE_DEV_PROJECT_ID;
    if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project||'')||project.startsWith('demo-')||['propbank-7601b','propbank-944fc'].includes(project))throw new Error('Configure a dedicated non-production FIREBASE_DEV_PROJECT_ID.');
    for(const key of ['NEXT_PUBLIC_FIREBASE_PROJECT_ID','FIREBASE_AUTH_PROJECT_ID','FIREBASE_DATA_PROJECT_ID','FIREBASE_PROJECT_ID'])if(env[key]!==project)throw new Error(`${key} must match FIREBASE_DEV_PROJECT_ID.`);
    if(env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID!==project)throw new Error('Browser development project expectation must match FIREBASE_DEV_PROJECT_ID.');
    if(env.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE!=='firebase')throw new Error('Browser must select firebase development mode.');
    if(!env.NEXT_PUBLIC_FIREBASE_API_KEY||!env.NEXT_PUBLIC_FIREBASE_APP_ID||env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!==`${project}.firebaseapp.com`)throw new Error('Complete the development Firebase web app configuration (including its project auth domain).');
    if(env.FIRESTORE_DATABASE_ID!=='(default)')throw new Error('Development Firestore requires explicit FIRESTORE_DATABASE_ID=(default).');
    if(!env.FIREBASE_AUTH_CREDENTIALS||!env.FIREBASE_DATA_CREDENTIALS||env.FIREBASE_AUTH_CREDENTIALS!==env.FIREBASE_DATA_CREDENTIALS)throw new Error('Development Auth and Data require the same explicit development service account.');
    if(env.GOOGLE_APPLICATION_CREDENTIALS||env.FIREBASE_CREDENTIALS)throw new Error('Remove fallback credentials in development Firebase mode.');
    return {mode:'firebase',authProjectId:project,dataProjectId:project};
  }
  if(emulator){
    if(env.NODE_ENV==='production')throw new Error('Firebase emulators are forbidden in production deployment environments.');
    if(selected==='live'||env.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE==='live')throw new Error('Live Firebase mode cannot contain emulator settings.');
    const firestore=emulatorAddress(env.FIRESTORE_EMULATOR_HOST,'FIRESTORE_EMULATOR_HOST');
    const auth=emulatorAddress(env.FIREBASE_AUTH_EMULATOR_HOST,'FIREBASE_AUTH_EMULATOR_HOST');
    const project=env.FIREBASE_TEST_PROJECT_ID;
    // demo- projects cannot refer to provisioned Firebase production resources.
    if(!/^demo-[a-z0-9-]+$/.test(project||''))throw new Error('Emulator mode requires a demo- FIREBASE_TEST_PROJECT_ID.');
    if([env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,env.FIREBASE_AUTH_PROJECT_ID,env.FIREBASE_DATA_PROJECT_ID].some(value=>value!==project)||env.FIREBASE_PROJECT_ID&&env.FIREBASE_PROJECT_ID!==project)throw new Error('Browser, Auth Admin and Data Admin must use the same demo emulator project.');
    let browser;
    try{browser=new URL(env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL);}catch{throw new Error('NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL must match the local Auth emulator.');}
    if(browser.protocol!=='http:'||browser.host!==env.FIREBASE_AUTH_EMULATOR_HOST||browser.username||browser.password||browser.search||browser.hash||browser.pathname!=='/')throw new Error('NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL must match the local Auth emulator.');
    return {mode:'emulator',authProjectId:project,dataProjectId:project,firestore,auth};
  }
  if(env.NODE_ENV==='development'&&(selected!=='live'||env.PROPBANK_ALLOW_LIVE_FIREBASE!=='1'))throw new Error('Local Firebase access blocked. Configure .env.firebase-dev.local and run npm run dev, or use npm run dev:emulator. Authorized live diagnostics require npm run dev:live -- --allow-live-firebase.');
  return {mode:'live',authProjectId:env.FIREBASE_AUTH_PROJECT_ID||env.NEXT_PUBLIC_FIREBASE_PROJECT_ID||'propbank-7601b',dataProjectId:env.FIREBASE_DATA_PROJECT_ID||env.FIREBASE_PROJECT_ID||'propbank-944fc'};
}
module.exports={firebaseEnvironment,emulatorAddress};
