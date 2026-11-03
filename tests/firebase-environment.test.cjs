const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {EventEmitter}=require('node:events');
const {spawnSync}=require('node:child_process');
const {firebaseEnvironment}=require('../src/lib/firebase-environment.cjs');
const {emulatorChildEnv,checkEmulators,readConfig}=require('../scripts/start-emulator-dev.cjs');
const {liveChildEnv}=require('../scripts/start-live-dev.cjs');
function moduleAt(file,env,dependencies={},globals={}){
 const filename=path.resolve(file),exports={};
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,process:{env},URL,globalThis:{},...globals,require:name=>{
  if(name==='server-only')return {};
  if(name==='../../email-development.cjs')return require('../src/lib/email-development.cjs');
  if(name==='../firebase-environment.cjs')return {firebaseEnvironment};
  if(Object.hasOwn(dependencies,name))return dependencies[name];
  throw new Error('Unexpected isolated dependency: '+name);
 }},{filename});return exports;
}
function admin(env){
 const apps=[],calls=[];let credentials=0,files=0;
 const sdk={getApps:()=>apps,initializeApp:(options,name)=>{const app={options,name};apps.push(app);return app;},cert:account=>{credentials++;return account;},applicationDefault:()=>{credentials++;return {adc:true};}};
 const output=moduleAt('src/lib/server/firebase-admin.ts',env,{
  'node:fs':{readFileSync:()=>{files++;throw new Error('Credential files must not be read');}},'node:path':path,
  'firebase-admin/app':sdk,'firebase-admin/auth':{getAuth:app=>{calls.push(['auth',app.options.projectId]);return app;}},
  'firebase-admin/firestore':{getFirestore:app=>{calls.push(['firestore',app.options.projectId,env.FIRESTORE_EMULATOR_HOST]);return app;}},
  'firebase-admin/storage':{getStorage:app=>{calls.push(['storage',app.options.projectId]);return app;}},
 });return {output,apps,calls,credentials:()=>credentials,files:()=>files};
}
test('optional emulator launcher selects one demo project and loopback emulators',()=>{
 const env=emulatorChildEnv({},{}),selected=firebaseEnvironment(env);
 assert.equal(selected.mode,'emulator');assert.equal(selected.dataProjectId,'demo-propbank');assert.equal(selected.authProjectId,'demo-propbank');
 assert.deepEqual(selected.firestore,{host:'127.0.0.1',port:8081});assert.deepEqual(selected.auth,{host:'127.0.0.1',port:9099});
});
test('launcher strips external credentials without mutating shell or local configuration',()=>{
 const shell={RESEND_API_KEY:'sentinel',CLOUDFLARE_R2_ACCESS_KEY_ID:'sentinel',FIREBASE_DATA_CREDENTIALS:'sentinel',GOOGLE_APPLICATION_CREDENTIALS:'sentinel'};
 const file={RESEND_API_KEY:'file-sentinel',CLOUDFLARE_R2_PRIVATE_BUCKET_NAME:'live-bucket'};
 const env=emulatorChildEnv(shell,file);
 for(const name of ['RESEND_API_KEY','FROM_EMAIL','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_PRIVATE_BUCKET_NAME','FIREBASE_DATA_CREDENTIALS','GOOGLE_APPLICATION_CREDENTIALS','STORAGE_BUCKET'])assert.equal(env[name],'');
 assert.equal(shell.RESEND_API_KEY,'sentinel');assert.equal(file.RESEND_API_KEY,'file-sentinel');assert.equal(env.ADMIN_EMAIL,'admin@example.invalid');
});
test('missing required emulator setting fails before any SDK initialization',()=>{
 for(const name of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL','FIREBASE_TEST_PROJECT_ID']){
  const env=emulatorChildEnv({},{});delete env[name];const isolated=admin(env);
  assert.throws(()=>isolated.output.getFirebaseAdminFirestore());assert.equal(isolated.apps.length,0);assert.equal(isolated.credentials(),0);
 }
});
test('remote endpoints, invalid ports, mixed projects and mismatched browser Auth are rejected',()=>{
 for(const patch of [{FIRESTORE_EMULATOR_HOST:'firestore.googleapis.com:443'},{FIRESTORE_EMULATOR_HOST:'http://127.0.0.1:8081'},
  {FIRESTORE_EMULATOR_HOST:'127.0.0.1:0'},{FIRESTORE_EMULATOR_HOST:'127.0.0.1:65536'},
  {FIREBASE_DATA_PROJECT_ID:'propbank-944fc'},{FIREBASE_AUTH_PROJECT_ID:'propbank-7601b'},
  {NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9999'},
  {NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099/other'},
  {FIREBASE_TEST_PROJECT_ID:'test-real-project'},{FIREBASE_PROJECT_ID:'propbank-944fc'}]){
  assert.throws(()=>firebaseEnvironment({...emulatorChildEnv({},{}),...patch}));
 }
 assert.throws(()=>emulatorChildEnv({FIREBASE_DATA_PROJECT_ID:'propbank-944fc'},{}),/same demo/);
 assert.throws(()=>emulatorChildEnv({}, {FIRESTORE_EMULATOR_HOST:'production.example:443'}),/loopback/);
});
test('emulator Admin passes demo app settings without loading configured credentials',()=>{
 const env={...emulatorChildEnv({},{}),FIREBASE_DATA_CREDENTIALS:'live-data.json',FIREBASE_AUTH_CREDENTIALS:'live-auth.json'};
 const isolated=admin(env);assert.equal(isolated.apps.length,0);
 isolated.output.getFirebaseAdminFirestore();isolated.output.getFirebaseAdminAuth();
 assert.equal(isolated.credentials(),0);assert.equal(isolated.files(),0);
 assert.deepEqual(isolated.calls,[['firestore','demo-propbank','127.0.0.1:8081'],['auth','demo-propbank']]);
 assert.ok(isolated.apps.every(app=>!Object.hasOwn(app.options,'credential')));
 assert.throws(()=>isolated.output.getFirebaseAdminStorage(),/disabled in emulator/);
});
test('production mode keeps separate existing Auth and Data projects and credentials',()=>{
 const isolated=admin({NODE_ENV:'production',FIREBASE_AUTH_CREDENTIALS:JSON.stringify({project_id:'propbank-7601b'}),FIREBASE_DATA_CREDENTIALS:JSON.stringify({project_id:'propbank-944fc'}),FIREBASE_DATA_STORAGE_BUCKET:'existing-bucket'});
 const data=isolated.output.getFirebaseAdminFirestore(),auth=isolated.output.getFirebaseAdminAuth();
 assert.equal(data.options.projectId,'propbank-944fc');assert.equal(auth.options.projectId,'propbank-7601b');assert.notEqual(data,auth);
 assert.equal(data.options.storageBucket,'existing-bucket');assert.equal(isolated.credentials(),2);
});
test('direct Next development cannot silently use live Firebase, and production rejects emulator auth',()=>{
 assert.throws(()=>firebaseEnvironment({NODE_ENV:'development'}),/Local Firebase access blocked/);
 assert.equal(firebaseEnvironment({NODE_ENV:'production'}).dataProjectId,'propbank-944fc');
 assert.throws(()=>firebaseEnvironment({...emulatorChildEnv({},{}),NODE_ENV:'production'}),/forbidden in production/);
});
test('Next configuration itself enforces isolation before serving local development',()=>{
 const config=env=>moduleAt('next.config.ts',env,{'./src/lib/firebase-environment.cjs':{firebaseEnvironment},'node:os':{networkInterfaces:()=>({})}},{process:{env,cwd:()=>process.cwd()}});
 assert.throws(()=>config({NODE_ENV:'development'}),/Local Firebase access blocked/);
 assert.equal(config({NODE_ENV:'production'}).default.distDir,'.next');
 assert.equal(config(emulatorChildEnv({},{})).default.distDir,'.next-emulator');
});
test('live diagnostics require explicit flag and reject mixed emulator settings',()=>{
 assert.throws(()=>liveChildEnv({},[]),/authorization is required/);
 const env=liveChildEnv({},['--allow-live-firebase']);assert.equal(firebaseEnvironment(env).mode,'live');
 assert.throws(()=>liveChildEnv(emulatorChildEnv({},{}),['--allow-live-firebase']),/Live Firebase mode/);
});
test('startup checks both loopback ports and fails closed if either is absent',async()=>{
 const seen=[],sockets=[];
 const connect=fail=>address=>{seen.push(address);const socket=new EventEmitter();socket.setTimeout=()=>{};socket.destroy=()=>{socket.closed=true;};sockets.push(socket);queueMicrotask(()=>socket.emit(fail&&address.port===8081?'error':'connect',new Error('offline')));return socket;};
 await checkEmulators(firebaseEnvironment(emulatorChildEnv({},{})),connect(false));assert.equal(seen.length,2);
 await assert.rejects(checkEmulators(firebaseEnvironment(emulatorChildEnv({},{})),connect(true)),/Firestore emulator is unavailable.*fallback is disabled/);
 assert.ok(sockets.every(socket=>socket.closed));
});
test('lost emulator host after initialization is blocked rather than falling back',()=>{
 const env=emulatorChildEnv({},{}),isolated=admin(env);isolated.output.getFirebaseAdminFirestore();delete env.FIRESTORE_EMULATOR_HOST;
 assert.throws(()=>isolated.output.getFirebaseAdminFirestore(),/FIRESTORE_EMULATOR_HOST/);assert.equal(isolated.calls.length,1);
});
test('emulator email and R2 are blocked even if live secrets leak into the environment',async()=>{
 const env={...emulatorChildEnv({},{}),RESEND_API_KEY:'sentinel',CLOUDFLARE_R2_ACCESS_KEY_ID:'sentinel'};
 const resend=moduleAt('src/lib/server/services/resend.ts',env,{'@/lib/email-address':{normalizeEmailAddress:value=>value}},{fetch:()=>{throw new Error('External fetch must never execute');}});
 await assert.rejects(resend.sendEmail({to:'user@example.invalid',subject:'test',html:'test'}),/disabled in emulator/);
 const r2=moduleAt('src/lib/server/r2.ts',env,{'@aws-sdk/client-s3':{S3Client:class{constructor(){throw new Error('External client must never initialize');}}}},{globalThis:{propbankR2Client:{send(){throw new Error('Cached external client must not be used');}}}});
 assert.throws(()=>r2.getR2Configuration(),/disabled in emulator/);assert.throws(()=>r2.getR2Client(),/disabled in emulator/);
});
function browser(env){
 const calls=[];
 const output=moduleAt('src/firebase.ts',env,{'firebase/app':{getApps:()=>[],initializeApp:config=>{calls.push(['initialize',config.projectId]);return {}; }},'firebase/auth':{
  getAuth:()=>({}),GoogleAuthProvider:class{addScope(){}},connectAuthEmulator:(_auth,url)=>calls.push(['connect',url]),
 } });return {output,calls};
}
test('browser emulator mode connects before use; missing and remote URLs fail closed',()=>{
 const env=emulatorChildEnv({},{}),result=browser(env);
 assert.deepEqual(result.calls,[['initialize','demo-propbank'],['connect','http://127.0.0.1:9099']]);
 for(const patch of [{NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL:''},{NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL:'https://production.example:9099'},{NEXT_PUBLIC_FIREBASE_PROJECT_ID:'propbank-7601b'},{NODE_ENV:'production'}])assert.throws(()=>browser({...env,...patch}));
 assert.deepEqual(browser({NODE_ENV:'production',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'propbank-7601b'}).calls,[['initialize','propbank-7601b']]);
});
test('live-capable diagnostics reject ordinary invocations before any provider call',()=>{
 for(const file of ['scripts/start-live-dev.cjs','scripts/check-migration-readonly.cjs','scripts/audit-providers-readonly.cjs','scripts/test-native-routing.cjs']){
  const result=spawnSync(process.execPath,[file],{cwd:process.cwd(),encoding:'utf8',timeout:5000,windowsHide:true});
  assert.equal(result.status,1,file);assert.match(result.stderr,/Explicit .*required/);
 }
});
test('optional emulator file absence is safe and .env.local cannot rehydrate provider credentials',()=>{
 const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'propbank-emulator-config-'));
 try{
  assert.deepEqual(readConfig(path.join(temp,'missing.local')),{});
  fs.writeFileSync(path.join(temp,'.env.local'),'FIREBASE_DATA_PROJECT_ID=propbank-944fc\nRESEND_API_KEY=live-sentinel\nCLOUDFLARE_R2_ACCESS_KEY_ID=live-sentinel\n');
  const nextEnv=path.resolve('node_modules/@next/env');
  const result=spawnSync(process.execPath,['-e',`require(process.argv[1]).loadEnvConfig(process.argv[2],true,{info(){},error(){}});if(process.env.FIREBASE_DATA_PROJECT_ID!=='demo-propbank'||process.env.RESEND_API_KEY!==''||process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!=='')process.exit(2);`,nextEnv,temp],{env:emulatorChildEnv({},{}),timeout:5000,windowsHide:true});
  assert.equal(result.status,0);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('property ownership and tenant authorization still exclude unrelated and anonymous callers',async()=>{
 const {isolated,users,properties,request,route,context}=require('./fixtures/native-server.cjs');
 const app=isolated({users,properties});
 for(const uid of ['owner','tenant'])assert.equal((await route(app,'properties/[id]').GET(request('/properties/P',uid),context('P'))).status,200);
 for(const uid of ['other',null])assert.equal((await route(app,'properties/[id]').GET(request('/properties/P',uid),context('P'))).status,404);
});

const {firebaseChildEnv,validateCredentials}=require('../scripts/start-firebase-dev.cjs');
const devProject='propbank-isolated-test';
const testPrivateKey=require('node:crypto').generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
function devConfig(){const account=JSON.stringify({type:'service_account',project_id:devProject,client_email:`test@${devProject}.iam.gserviceaccount.com`,private_key:testPrivateKey});return {PROPBANK_FIREBASE_MODE:'firebase',FIREBASE_DEV_PROJECT_ID:devProject,NEXT_PUBLIC_FIREBASE_PROJECT_ID:devProject,NEXT_PUBLIC_FIREBASE_API_KEY:'isolated-key',NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:`${devProject}.firebaseapp.com`,NEXT_PUBLIC_FIREBASE_APP_ID:'isolated-app',FIREBASE_AUTH_PROJECT_ID:devProject,FIREBASE_DATA_PROJECT_ID:devProject,FIREBASE_PROJECT_ID:devProject,FIREBASE_AUTH_CREDENTIALS:account,FIREBASE_DATA_CREDENTIALS:account,FIRESTORE_DATABASE_ID:'(default)'};}
test('ordinary launcher selects isolated real development and masks inherited production configuration',()=>{
 const env=firebaseChildEnv({FIREBASE_CREDENTIALS:'production',GOOGLE_APPLICATION_CREDENTIALS:'production',RESEND_API_KEY:'production',CLOUDFLARE_R2_ACCESS_KEY_ID:'production',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'propbank-7601b'},devConfig());
 assert.equal(firebaseEnvironment(env).mode,'firebase');assert.equal(env.FIREBASE_CREDENTIALS,'');assert.equal(env.GOOGLE_APPLICATION_CREDENTIALS,'');assert.equal(env.RESEND_API_KEY,'');assert.equal(env.CLOUDFLARE_R2_ACCESS_KEY_ID,'');assert.equal(env.APP_URL,'http://localhost:8080');
 const isolated=admin(env);assert.equal(isolated.output.getFirebaseAdminAuth().options.projectId,devProject);assert.equal(isolated.output.getFirebaseAdminFirestore().options.projectId,devProject);
 assert.deepEqual(browser(env).calls,[['initialize',devProject]]);assert.throws(()=>isolated.output.getFirebaseAdminStorage(),/disabled/);
});
test('ordinary launcher fails closed on missing, production, mixed and invalid credentials',()=>{
 assert.throws(()=>firebaseChildEnv({},{}));
 for(const patch of [{FIREBASE_DEV_PROJECT_ID:'propbank-7601b'},{FIREBASE_DEV_PROJECT_ID:'propbank-944fc'},{FIREBASE_DATA_PROJECT_ID:'propbank-944fc'},{NEXT_PUBLIC_FIREBASE_PROJECT_ID:'propbank-7601b'},{FIRESTORE_DATABASE_ID:'other'},{FIREBASE_AUTH_CREDENTIALS:''},{PROPBANK_FIREBASE_MODE:'live'},{RESEND_API_KEY:'unexpected'}])assert.throws(()=>firebaseChildEnv({},{...devConfig(),...patch}));
 const config=devConfig(),wrong=JSON.stringify({type:'service_account',project_id:'propbank-7601b',client_email:'test@propbank-7601b.iam.gserviceaccount.com',private_key:testPrivateKey});
 assert.throws(()=>firebaseChildEnv({},{...config,FIREBASE_AUTH_CREDENTIALS:wrong,FIREBASE_DATA_CREDENTIALS:wrong}),/identity/);
 const forged=JSON.stringify({type:'service_account',project_id:devProject,client_email:'test@propbank-944fc.iam.gserviceaccount.com',private_key:testPrivateKey});
 assert.throws(()=>validateCredentials({...config,FIREBASE_AUTH_CREDENTIALS:forged}),/identity/);
 assert.throws(()=>firebaseEnvironment({...firebaseChildEnv({},config),FIRESTORE_EMULATOR_HOST:'127.0.0.1:8081'}),/emulator settings/);
 assert.throws(()=>browser({...firebaseChildEnv({},config),NEXT_PUBLIC_FIREBASE_PROJECT_ID:'propbank-7601b'}),/Invalid isolated/);
});
test('development captures email without dispatch or sent acknowledgement and bypasses cached R2 clients',async()=>{
 const env=firebaseChildEnv({},devConfig()),captured=[];
 const resend=moduleAt('src/lib/server/services/resend.ts',env,{'@/lib/email-address':{normalizeEmailAddress:value=>value},'node:fs/promises':{mkdir:async()=>{},appendFile:async(_file,value)=>captured.push(JSON.parse(value))},'node:path':path},{fetch:()=>{throw new Error('No network allowed');}});
 await assert.rejects(resend.sendEmail({to:'fictional@example.invalid',subject:'test',html:'test'}),/captured locally/);assert.equal(captured.length,1);
 const r2=moduleAt('src/lib/server/r2.ts',env,{'@aws-sdk/client-s3':{S3Client:class{constructor(){throw new Error('No provider allowed');}}}},{globalThis:{propbankR2Client:{}}});
 assert.equal(r2.getR2Configuration().accountId,'local-mock');assert.notEqual(r2.getR2Client(),r2.getR2Client());
 await assert.rejects(r2.getR2Client().send({constructor:{name:'ListBucketsCommand'},input:{}}),/Unexpected isolated dependency/);
});
test('real development cannot invoke emulator fixture seeding',()=>{
 const result=spawnSync(process.execPath,['scripts/auth-emulator-fixtures.cjs','--seed'],{env:firebaseChildEnv({},devConfig()),encoding:'utf8',timeout:5000,windowsHide:true});assert.equal(result.status,1);assert.match(result.stderr,/Refusing to run/);
});

test('local storage mock round-trips only development buckets and never traverses file paths',async()=>{
 const env=firebaseChildEnv({},devConfig()),disk=new Map();
 const local=moduleAt('src/lib/server/local-development-storage.ts',env,{'node:crypto':require('node:crypto'),'node:path':path,'node:fs/promises':{mkdir:async()=>{},writeFile:async(file,value)=>disk.set(file,value),readFile:async file=>disk.get(file),rm:async file=>disk.delete(file)}},{Buffer});
 const command=(name,input)=>({constructor:{name},input}),input={Bucket:'propbank-development-private',Key:'../../fixture'};
 await local.sendLocalStorageCommand(command('PutObjectCommand',{...input,Body:Buffer.from('fictional'),ContentType:'text/plain'}));
 const found=await local.sendLocalStorageCommand(command('GetObjectCommand',input));assert.equal((await found.Body.transformToByteArray()).toString(),'fictional');assert.equal(found.ContentType,'text/plain');
 await assert.rejects(local.sendLocalStorageCommand(command('GetObjectCommand',{...input,Bucket:'production'})),/refuses/);
 await assert.rejects(local.sendLocalStorageCommand(command('ListBucketsCommand',input)),/Unsupported/);
 await local.sendLocalStorageCommand(command('DeleteObjectCommand',input));assert.equal(disk.size,0);
});

test('Next dotenv cannot rehydrate production credentials in the real development child',()=>{
 const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'propbank-firebase-dev-'));
 try{
  fs.writeFileSync(path.join(temp,'.env.local'),'FIREBASE_DATA_PROJECT_ID=propbank-944fc\nRESEND_API_KEY=sentinel\nCLOUDFLARE_R2_ACCESS_KEY_ID=sentinel\nGOOGLE_APPLICATION_CREDENTIALS=production.json\n');
  const env=firebaseChildEnv({},devConfig());
  const result=spawnSync(process.execPath,['-e',`require(process.argv[1]).loadEnvConfig(process.argv[2],true,{info(){},error(){}});if(process.env.FIREBASE_DATA_PROJECT_ID!=='${devProject}'||process.env.RESEND_API_KEY!==''||process.env.GOOGLE_APPLICATION_CREDENTIALS!==''||process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!=='')process.exit(2);`,path.resolve('node_modules/@next/env'),temp],{env,timeout:5000,windowsHide:true});assert.equal(result.status,0);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
