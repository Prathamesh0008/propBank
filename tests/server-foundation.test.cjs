const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Test real module logic with isolated SDK boundaries; no live credentials or writes.
function load(name, dependencies = {}, env = {}, globals = {}) {
  const filename = resolve('src/lib/server', `${name}.ts`);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const context = vm.createContext({ exports, process: { env }, URL, Headers, Request, Response,
    AbortSignal, ...globals,
    require: name => {
      if (name === 'server-only') return {};
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  vm.runInContext(compiled, context, { filename });
  return exports;
}


test('HTTP errors preserve ApiError and AccessError statuses without leaking unexpected errors', async () => {
  const auth=load('auth',{'./firebase-admin':{},'./firestore':{}});
  const http=load('http',{'./auth':auth});
  for(const error of [new http.ApiError(409,'Version conflict'),new http.ApiError(400,'Invalid request'),new auth.AccessError(401,'Token required'),new auth.AccessError(403,'Access denied')]) {
    for(const json of [false,true]) {
      const response=await http.handle(async()=>{throw error;},'Safe failure',json)();
      assert.equal(response.status,error.status);
      assert.deepEqual(await response.json(),{success:false,message:error.message});
    }
  }
  const error=new Error('private SDK credential detail');
  for(const json of [false,true]) {
    const response=await http.handle(async()=>{throw error;},'Safe failure',json)();
    assert.equal(response.status,500);
    if(json)assert.deepEqual(await response.json(),{success:false,message:'Safe failure'});
    else assert.equal(await response.text(),'Safe failure\n');
  }
});

test('negotiations collection mapping is additive and has no startup database calls', () => {
  let calls=0;
  const firestore=load('firestore',{'./firebase-admin':{getFirebaseAdminFirestore:()=>{calls++;}}});
  assert.deepEqual(JSON.parse(JSON.stringify(firestore.COLLECTIONS)),{
    users:'users',properties:'properties',negotiations:'negotiations',tenants:'tenants',visits:'visits',services:'services',serviceRequests:'service_requests',documents:'documents',reviews:'reviews',inspectionReports:'inspection_reports',adminNotifications:'admin_notifications',siteSettings:'siteSettings',
  });
  assert.equal(calls,0);
});

test('email helpers escape HTML and add optional provider idempotency without changing delivery payload', async () => {
  const requests=[];
  let ok=true;
  const env={RESEND_API_KEY:'isolated-key',FROM_EMAIL:'sender@test.invalid'};
  const effects=load('services/property-effects',{'node:crypto':{},'next/server':{},'../firestore':{},'./contracts':{},'./users':{},'./property-email-templates':{}},env,{
    fetch:async(url,init)=>{requests.push({url,init});return {ok};},
  });
  assert.equal(effects.escapeHtml('&<>"\''),'&amp;&lt;&gt;&quot;&#39;');
  assert.equal(effects.escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(effects.escapeHtml('Hello, tenant!'),'Hello, tenant!');
  const mail={to:'tenant@test.invalid',subject:'Existing subject',html:'<p>connectpropbank@gmail.com</p>'};
  await effects.sendEmail(mail);
  await effects.sendEmail(mail,'visit-P-generation');
  assert.equal(requests.length,2);
  for(const {url,init} of requests) {
    assert.equal(url,'https://api.resend.com/emails');assert.equal(init.method,'POST');
    assert.equal(init.headers.Authorization,'Bearer isolated-key');
    assert.equal(init.headers['Content-Type'],'application/json');
    assert.deepEqual(JSON.parse(init.body),{from:'Propbank <sender@test.invalid>',to:[mail.to],subject:mail.subject,html:'<p>sender@test.invalid</p>'});
    assert.ok(init.signal instanceof AbortSignal);
  }
  assert.equal(Object.hasOwn(requests[0].init.headers,'Idempotency-Key'),false);
  assert.equal(requests[1].init.headers['Idempotency-Key'],'visit-P-generation');
  ok=false;
  await assert.rejects(effects.sendEmail(mail),/Property email delivery failed/);
  await effects.sendEmail({...mail,to:''},'unused');
  delete env.RESEND_API_KEY;
  await effects.sendEmail(mail,'unused');
  assert.equal(requests.length,3);
});

test('Firebase Auth and Data apps initialize lazily, stay separate and reuse named apps', () => {
  const apps = [];
  let initialized = 0;
  const sdk = {
    getApps: () => apps,
    cert: account => ({ account }), applicationDefault: () => ({ adc: true }),
    initializeApp: (options, name) => { initialized++; const app = { name, options }; apps.push(app); return app; },
  };
  const deps = { 'node:fs': { readFileSync }, 'node:path': { resolve },
    'firebase-admin/app': sdk, 'firebase-admin/auth': { getAuth: app => app },
    'firebase-admin/storage': { getStorage: app => app },'firebase-admin/firestore':{getFirestore:app=>app} };
  const module = load('firebase-admin', deps, {
    FIREBASE_CREDENTIALS: JSON.stringify({ project_id: 'propbank-944fc' }),
    FIREBASE_AUTH_CREDENTIALS: JSON.stringify({ project_id: 'propbank-7601b' }),
    FIREBASE_AUTH_PROJECT_ID:'propbank-7601b',FIREBASE_DATA_PROJECT_ID:'propbank-944fc',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'propbank-7601b', STORAGE_BUCKET: 'existing-bucket',
  });
  assert.equal(initialized, 0);
  const app = module.getFirebaseDataAdminApp();
  assert.equal(module.getFirebaseAdminApp(), app);
  assert.equal(module.getFirebaseAdminFirestore(),app);
  assert.equal(module.getFirebaseAdminStorage(),app);
  assert.equal(app.name,'propbank-data');assert.equal(app.options.projectId,'propbank-944fc');
  assert.equal(app.options.storageBucket,'existing-bucket');
  const auth=module.getFirebaseAdminAuth();assert.equal(auth.name,'propbank-auth');assert.equal(auth.options.projectId,'propbank-7601b');assert.notEqual(auth,app);
  assert.equal(module.getFirebaseAuthAdminApp(),auth);assert.equal(initialized,2);
  apps.length = 0;
  const mismatch = load('firebase-admin', deps, {
    FIREBASE_CREDENTIALS: JSON.stringify({ project_id: 'other-project' }), FIREBASE_DATA_PROJECT_ID: 'propbank-944fc',
  });
  assert.throws(() => mismatch.getFirebaseDataAdminApp(), /does not match/);
  assert.equal(initialized, 2);
  const browserMismatch = load('firebase-admin', deps, {
    FIREBASE_AUTH_PROJECT_ID: 'propbank-7601b', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'different-project',
  });
  assert.throws(() => browserMismatch.getFirebaseAuthAdminApp(), /must match/);
  const wrongAuth=load('firebase-admin',deps,{FIREBASE_AUTH_CREDENTIALS:JSON.stringify({project_id:'propbank-944fc'})});assert.throws(()=>wrongAuth.getFirebaseAdminAuth(),/does not match/);
});

test('Auth credentials support JSON paths and ADC without borrowing DATA credentials or browser bucket',()=>{
 const apps=[];let adc=0;const files=[];
 const deps={'node:fs':{readFileSync:file=>{files.push(file);return JSON.stringify({project_id:'propbank-7601b'});}},'node:path':{resolve},'firebase-admin/app':{getApps:()=>apps,cert:account=>({account}),applicationDefault:()=>{adc++;return {adc:true};},initializeApp:(options,name)=>{const app={name,options};apps.push(app);return app;}},'firebase-admin/auth':{getAuth:app=>app},'firebase-admin/firestore':{getFirestore:app=>app},'firebase-admin/storage':{getStorage:app=>app}};
 const module=load('firebase-admin',deps,{FIREBASE_AUTH_CREDENTIALS:'fixture-auth.json',FIREBASE_DATA_CREDENTIALS:JSON.stringify({project_id:'propbank-944fc'}),FIREBASE_CREDENTIALS:'invalid legacy credential',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'propbank-7601b',NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:'browser-auth-bucket'});
 assert.equal(module.getFirebaseAdminAuth().options.credential.account.project_id,'propbank-7601b');assert.equal(files[0],resolve('fixture-auth.json'));
 assert.equal(module.getFirebaseAdminFirestore().options.credential.account.project_id,'propbank-944fc');assert.equal(module.getFirebaseDataAdminApp().options.storageBucket,undefined);assert.throws(()=>module.getFirebaseAdminStorage(),/Configure FIREBASE_DATA_STORAGE_BUCKET/);
 apps.length=0;const fallback=load('firebase-admin',deps,{FIREBASE_CREDENTIALS:JSON.stringify({project_id:'propbank-944fc'})});assert.equal(fallback.getFirebaseAdminAuth().options.credential.adc,true);assert.equal(adc,1);assert.equal(fallback.getFirebaseAdminFirestore().options.credential.account.project_id,'propbank-944fc');
});

test('verified Auth UID selects users/{uid} in the distinct DATA project and uses its persisted role',async()=>{
 const apps=[],calls=[];
 const sdk={getApps:()=>apps,cert:a=>a,applicationDefault:()=>({}),initializeApp:(options,name)=>{const app={name,options};apps.push(app);return app;}};
 const admin=load('firebase-admin',{'node:fs':{readFileSync},'node:path':{resolve},'firebase-admin/app':sdk,'firebase-admin/auth':{getAuth:app=>({verifyIdToken:async(token,revoked)=>{calls.push({operation:'verify',project:app.options.projectId,token,revoked});return {uid:'shared-uid',email:'verified@test.invalid'};}})},'firebase-admin/firestore':{getFirestore:app=>({collection:name=>({doc:uid=>({get:async()=>{calls.push({operation:'read',project:app.options.projectId,name,uid});return {data:()=>({role:'individual',isActive:true})};}})})})},'firebase-admin/storage':{}},{FIREBASE_AUTH_CREDENTIALS:JSON.stringify({project_id:'propbank-7601b'}),FIREBASE_CREDENTIALS:JSON.stringify({project_id:'propbank-944fc'})});
 const firestore=load('firestore',{'./firebase-admin':admin});const auth=load('auth',{'./firebase-admin':admin,'./firestore':firestore});
 const user=await auth.requireUser(new Request('http://local',{headers:{Authorization:'Bearer browser-token'}}));assert.equal(user.uid,'shared-uid');assert.equal(user.role,'individual');assert.deepEqual(calls,[{operation:'verify',project:'propbank-7601b',token:'browser-token',revoked:true},{operation:'read',project:'propbank-944fc',name:'users',uid:'shared-uid'}]);
});

test('native identity verifies Firebase bearer token with revocation and roles come from Firestore', async () => {
  const verified = [];
  const lookups = [];
  let profile = { role: 'individual', email: 'stored@example.com', phoneNumber: '123', isActive: true };
  const auth = load('auth', {
    './firebase-admin': { getFirebaseAdminAuth: () => ({ verifyIdToken: async (token, revoked) => {
      verified.push([token, revoked]); return { uid: 'trusted-uid', role: 'admin', email: 'token@example.com' };
    } }) },
    './firestore': { COLLECTIONS: { users: 'users' }, getDatabase: () => ({ collection: name => ({ doc: uid => {
      lookups.push([name, uid]); return { get: async () => ({ data: () => profile }) };
    } }) }) },
  });
  await assert.rejects(auth.requireUser(new Request('http://local', { headers: { 'X-User-ID': 'spoofed' } })),
    error => error.status === 401);
  const user = await auth.requireUser(new Request('http://local', {
    headers: { Authorization: 'Bearer firebase-token', 'X-User-ID': 'spoofed' },
  }));
  assert.equal(user.uid, 'trusted-uid');
  assert.equal(user.role, 'individual');
  assert.equal(user.email, 'stored@example.com');
  assert.deepEqual(verified, [['firebase-token', true]]);
  assert.deepEqual(lookups, [['users', 'trusted-uid']]);
  profile = { role: 'staff', isActive: true };
  await assert.rejects(auth.requireUser(new Request('http://local', { headers: { Authorization: 'Bearer t' } })),
    error => error.status === 403);
  profile = { role: 'admin', isActive: false };
  await assert.rejects(auth.requireUser(new Request('http://local', { headers: { Authorization: 'Bearer t' } })),
    error => error.status === 403);
});

test('token failures distinguish expired credentials from service/configuration failures', async () => {
  let code = 'auth/id-token-expired';
  const auth = load('auth', {
    './firebase-admin': { getFirebaseAdminAuth: () => ({ verifyIdToken: async () => { throw { code }; } }) },
    './firestore': {},
  });
  const request = new Request('http://local', { headers: { Authorization: 'Bearer token' } });
  await assert.rejects(auth.verifyFirebaseIdentity(request), error => error.status === 401);
  code = 'auth/internal-error';
  await assert.rejects(auth.verifyFirebaseIdentity(request), error => error.code === code && !error.status);
});

test('agent role grants no arbitrary admin or property rights; tenant/owner/admin relationships are checked', () => {
  class AccessError extends Error { constructor(status, message) { super(message); this.status = status; } }
  const permissions = load('permissions', { './auth': { AccessError } });
  const agent = { uid: 'agent-1', role: 'agent', email: 'a@example.com', phoneNumber: '123', token:{email:'a@example.com',email_verified:true} };
  assert.throws(() => permissions.requireAdmin(agent), error => error.status === 403);
  assert.throws(() => permissions.requireOwnerOrAdmin(agent, { ownerUID: 'someone-else' }), error => error.status === 403);
  permissions.requireOwnerOrAdmin(agent, { ownerUID: agent.uid });
  assert.equal(permissions.isPropertyTenant(agent, { tenants: [{ userUID: agent.uid, isActive: false }] }), false);
  assert.equal(permissions.isPropertyTenant(agent, { tenants: [{ email: 'A@EXAMPLE.COM', isActive: true }] }), true);
  permissions.requirePropertyMember(agent, { tenants: [{ userUID: agent.uid, isActive: true }] });
  assert.throws(() => permissions.requireSelfOrAdmin(agent, 'someone-else'), error => error.status === 403);
  permissions.requireAdmin({ ...agent, role: 'admin' });
});

test('R2 client reuses configured account/bucket and public URLs without object operations', () => {
  let clients = 0;
  class S3Client { constructor(options) { clients++; this.options = options; } }
  const env = { CLOUDFLARE_ACCOUNT_ID: 'existing-account', CLOUDFLARE_R2_ACCESS_KEY_ID: 'fake-key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'fake-secret', CLOUDFLARE_R2_BUCKET_NAME: 'propbank',
    CLOUDFLARE_R2_PUBLIC_URL: 'https://existing.example.com/' };
  const r2 = load('r2', { '@aws-sdk/client-s3': { S3Client } }, env);
  assert.equal(clients, 0);
  const client = r2.getR2Client();
  assert.equal(r2.getR2Client(), client);
  assert.equal(clients, 1);
  assert.equal(client.options.endpoint, 'https://existing-account.r2.cloudflarestorage.com');
  assert.equal(r2.getR2PublicUrl('properties/OLD1234/image_1_123.jpg'),
    'https://existing.example.com/properties/OLD1234/image_1_123.jpg');
  env.CLOUDFLARE_R2_PUBLIC_URL = '';
  assert.equal(r2.getR2PublicUrl('documents/old/a.pdf'), 'https://propbank.r2.dev/documents/old/a.pdf');
});

