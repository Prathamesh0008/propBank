// Offline maintenance only. Default is read-only; never loads .env files itself.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');

// Load only the two pure policy modules; use the same normalization/key algorithm
// as the app without bootstrapping Next, Firebase or executing domain services.
function loadPolicy(file) {
  const filename = path.resolve(file), module = {exports:{}};
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},
  }).outputText;
  const localRequire = name => {
    if(name === 'node:crypto') return crypto;
    if(name === '../indian-phone') return loadPolicy('src/lib/indian-phone.ts');
    throw new Error('Unexpected migration policy dependency');
  };
  new Function('exports','require','module',compiled)(module.exports,localRequire,module);
  return module.exports;
}
const policy = loadPolicy('src/lib/server/mobile-registry-policy.ts');
const {registryPhone,mobileKey,MOBILE_REGISTRY,MOBILE_REGISTRY_STATE,MOBILE_REGISTRY_ACCOUNTS,MOBILE_RESERVATION_POLICY:reservationPolicy,MOBILE_REGISTRY_VERSION:version} = policy;
const reference = value => crypto.createHash('sha256').update(value).digest('hex');

class DiagnosticError extends Error {
  constructor(code) {super(code);this.diagnosticCode=code;}
}
// Never log SDK messages, stack traces, credential paths or arbitrary error codes.
// Even malformed JSON errors can contain fragments of a private credential.
function diagnostic(error, stage) {
  const allowed = new Set(['INVALID_ARGUMENTS','PROJECT_SELECTION_MISMATCH','WRITE_APPROVAL_REQUIRED','RULES_VERIFICATION_REQUIRED','CONFIG_CHECK_DRY_RUN_ONLY','DATA_CREDENTIAL_FILE_UNREADABLE','DATA_CREDENTIAL_JSON_INVALID','DATA_CREDENTIAL_PROJECT_MISMATCH','DATA_CREDENTIAL_INVALID','LEGACY_RESERVATION_POLICY_ACK_REQUIRED']);
  const sdk = new Map([
    ['app/invalid-credential','FIREBASE_CREDENTIAL_INVALID'],
    ['app/invalid-app-options','FIREBASE_INITIALIZATION_FAILED'],
    ['7','FIRESTORE_PERMISSION_DENIED'],['PERMISSION_DENIED','FIRESTORE_PERMISSION_DENIED'],
    ['16','FIRESTORE_UNAUTHENTICATED'],['UNAUTHENTICATED','FIRESTORE_UNAUTHENTICATED'],
    ['5','FIRESTORE_DATABASE_NOT_FOUND'],['NOT_FOUND','FIRESTORE_DATABASE_NOT_FOUND'],
    ['14','FIRESTORE_UNAVAILABLE'],['UNAVAILABLE','FIRESTORE_UNAVAILABLE'],
    ['4','FIRESTORE_TIMEOUT'],['DEADLINE_EXCEEDED','FIRESTORE_TIMEOUT'],
  ]);
  let code = allowed.has(error?.diagnosticCode) ? error.diagnosticCode : sdk.get(String(error?.code));
  if(!code && /could not load (?:the )?default credentials|default credentials.*not (?:found|available)|unable to detect.*credentials/i.test(String(error?.message || ''))) code='ADC_UNAVAILABLE';
  return {code:code || 'MOBILE_REGISTRY_OPERATION_FAILED',stage};
}

async function* pages(db, after = '') {
  for (;;) {
    let query = db.collection('users').orderBy('__name__').limit(250);
    if(after) query = query.startAfter(after);
    const page = await query.get();
    if(!page.docs.length) return;
    yield page.docs;
    after = page.docs.at(-1).id;
    if(page.docs.length < 250) return;
  }
}

/** Paginated, read-only planning. Raw phones/UID membership exist in memory only;
 * the returned public report contains counts/hashes, never contacts or UID lists. */
async function inventoryFor(db) {
  const groups = new Map(), records = new Map(), digest = crypto.createHash('sha256');
  const report = {users:0,missing:0,invalid:0,duplicateNumbers:0,duplicateAccounts:0,uniqueValidNumbers:0,validMobileNumbers:0,conflicts:[],invalidAccounts:[]};
  for await(const docs of pages(db)) for(const doc of docs) {
    const data=doc.data(),raw=data.phoneNumber,phone=registryPhone(raw),present='phoneNumber' in data;
    report.users++;
    digest.update(JSON.stringify([doc.id,present,raw ?? null])+'\n');
    const record={uid:doc.id,raw,present,state:phone?'owned':raw===undefined||raw===null||raw===''?'missing':'invalid'};
    records.set(doc.id,record);
    if(!phone) {
      report[record.state]++;
      if(report.invalidAccounts.length<100)report.invalidAccounts.push({accountReference:reference(doc.id),kind:record.state});
      continue;
    }
    record.phoneKey=mobileKey(phone);
    const group=groups.get(record.phoneKey)||{uids:[]};group.uids.push(doc.id);groups.set(record.phoneKey,group);
  }
  for(const [key,group] of groups) {
    group.membersFingerprint=reference(JSON.stringify([...group.uids].sort()));
    if(group.uids.length>1) {
      report.duplicateNumbers++;report.duplicateAccounts+=group.uids.length;
      for(const uid of group.uids)records.get(uid).state='conflicted';
      if(report.conflicts.length<100)report.conflicts.push({numberReference:reference(key),count:group.uids.length,accounts:group.uids.slice(0,2).map(reference)});
    } else report.uniqueValidNumbers++;
  }
  report.validMobileNumbers=groups.size;
  return {records,groups,report:{...report,fingerprint:digest.digest('hex'),detailsLimited:report.invalid+report.missing>100||report.duplicateNumbers>100}};
}
async function inspect(db) {return (await inventoryFor(db)).report;}
function sameAccount(value,record) {
  return value?.version===version&&value.state===record.state&&(record.phoneKey?value.phoneKey===record.phoneKey:!('phoneKey' in value));
}
function sameClaim(value,group) {
  if(value?.version!==version)return false;
  if(group.uids.length===1)return value.status==='owned'&&value.ownerUID===group.uids[0];
  return value.status==='blocked'&&!('ownerUID' in value)&&value.memberCount===group.uids.length&&value.membersFingerprint===group.membersFingerprint;
}
function maintenance(state) {return state?.version===version&&state.reservationPolicy===reservationPolicy&&state.status==='maintenance';}

async function begin(db) {
  const ref=db.collection(MOBILE_REGISTRY_STATE).doc('main');
  await db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref);
    if(snapshot.exists&&!maintenance(snapshot.data()))throw new Error('Existing registry state requires separate version/maintenance review');
    if(!snapshot.exists)tx.create(ref,{version,reservationPolicy,status:'maintenance',cursor:'',updatedAt:new Date()});
  });
}

async function backfill(db,report) {
  // Rebuild a complete grouping before ANY claim write. Duplicates are blocked,
  // not resolved; missing/invalid profiles get a separate locked account state.
  const plan=await inventoryFor(db);
  if(plan.report.fingerprint!==report.fingerprint)throw new Error('Inventory changed before reservation');
  const control=db.collection(MOBILE_REGISTRY_STATE).doc('main');let cursor='',complete=false;
  await db.runTransaction(async tx=>{
    const state=(await tx.get(control)).data();
    if(state?.version===version&&state.reservationPolicy===reservationPolicy&&state.status==='backfilled'&&state.fingerprint===report.fingerprint&&state.users===report.users){complete=true;return;}
    if(!maintenance(state))throw new Error('Begin versioned maintenance first');
    if(state.fingerprint&&state.fingerprint!==report.fingerprint)throw new Error('Inventory changed; stop before resuming');
    cursor=state.cursor||'';
    tx.update(control,{fingerprint:report.fingerprint,users:report.users,updatedAt:new Date()});
  });
  if(complete)return;
  for await(const docs of pages(db,cursor))for(const doc of docs){
    const planned=plan.records.get(doc.id);if(!planned)throw new Error('Inventory changed during reservation');
    await db.runTransaction(async tx=>{
      const state=(await tx.get(control)).data();
      if(!maintenance(state)||state.fingerprint!==report.fingerprint)throw new Error('Maintenance state changed');
      if(state.cursor&&Buffer.compare(Buffer.from(state.cursor),Buffer.from(doc.id))>=0)return;
      const user=await tx.get(doc.ref),raw=user.data()?.phoneNumber;
      if(!user.exists||('phoneNumber' in user.data())!==planned.present||JSON.stringify(raw)!==JSON.stringify(planned.raw))throw new Error('Historical profile changed');
      const accountRef=db.collection(MOBILE_REGISTRY_ACCOUNTS).doc(doc.id),account=await tx.get(accountRef);
      if(account.exists&&!sameAccount(account.data(),planned))throw new Error('Account reservation state conflicts; separate resolution required');
      const group=planned.phoneKey?plan.groups.get(planned.phoneKey):null;
      const claimRef=group?db.collection(MOBILE_REGISTRY).doc(planned.phoneKey):null;
      const claim=claimRef?await tx.get(claimRef):null;
      if(claim?.exists&&!sameClaim(claim.data(),group)){
        // Only safe upgrade of a v1 partial reservation. Never unblock a claim,
        // overwrite an unrelated owner, or resolve a version-2 quarantine.
        const old=claim.data();
        if(old.status==='blocked'||![undefined,1].includes(old.version)||!group.uids.includes(old.ownerUID))throw new Error('Existing claim conflicts; no automatic reassignment');
      }
      const now=new Date();
      if(claimRef){
        const desired=group.uids.length===1?{status:'owned',ownerUID:doc.id}:{status:'blocked',memberCount:group.uids.length,membersFingerprint:group.membersFingerprint};
        if(!claim.exists||!sameClaim(claim.data(),group))tx.set(claimRef,{version,...desired,createdAt:claim.data()?.createdAt||now,updatedAt:now});
      }
      if(!account.exists)tx.create(accountRef,{version,state:planned.state,...(planned.phoneKey?{phoneKey:planned.phoneKey}:{}),createdAt:now,updatedAt:now});
      // Historical user documents and every related collection remain untouched.
      tx.update(control,{cursor:doc.id,updatedAt:now});
    });
  }
  const verified=await inspect(db);
  if(verified.fingerprint!==report.fingerprint)throw new Error('Inventory changed; activation refused');
  await db.runTransaction(async tx=>{
    const state=(await tx.get(control)).data();
    if(!maintenance(state)||state.fingerprint!==report.fingerprint)throw new Error('Maintenance state changed');
    tx.update(control,{status:'backfilled',updatedAt:new Date()});
  });
}

async function activate(db,report) {
  const plan=await inventoryFor(db),control=db.collection(MOBILE_REGISTRY_STATE).doc('main');
  if(plan.report.fingerprint!==report.fingerprint)throw new Error('Inventory changed; activation refused');
  // ALL historical UIDs must have a matching state, and EVERY valid phone must
  // be either uniquely owned or blocked for the complete duplicate membership.
  // Invalid/missing profiles are explicitly locked, never silently skipped.
  for(const record of plan.records.values()){
    const account=await db.collection(MOBILE_REGISTRY_ACCOUNTS).doc(record.uid).get();
    if(!sameAccount(account.data(),record))throw new Error('Missing/conflicting account reservation state');
  }
  for(const [key,group]of plan.groups){
    const claim=await db.collection(MOBILE_REGISTRY).doc(key).get();
    if(!sameClaim(claim.data(),group))throw new Error('Unreserved historical number or mismatched blocked group');
  }
  if((await inspect(db)).fingerprint!==report.fingerprint)throw new Error('Inventory changed during verification');
  await db.runTransaction(async tx=>{
    const state=(await tx.get(control)).data();
    if(!['backfilled','active'].includes(state?.status)||state.version!==version||state.reservationPolicy!==reservationPolicy||state.fingerprint!==report.fingerprint||state.users!==report.users)throw new Error('Unverified inventory; activation refused');
    if(state.status!=='active')tx.update(control,{status:'active',activatedAt:new Date(),updatedAt:new Date()});
  });
}

async function main() {
  let stage='arguments';
  try {
  const args = process.argv.slice(2), modes = args.filter(x=>['--dry-run','--begin','--backfill','--activate'].includes(x));
  if(modes.length > 1 || args.some(x=>!['--dry-run','--begin','--backfill','--activate','--check-config','--reserve-legacy-conflicts','--approve-registry-writes','--writers-paused','--rules-verified'].includes(x) && !x.startsWith('--project='))) throw new DiagnosticError('INVALID_ARGUMENTS');
  const mode = modes[0] || '--dry-run', project = args.find(x=>x.startsWith('--project='))?.slice(10);
  if(!project || project !== process.env.FIREBASE_DATA_PROJECT_ID) throw new DiagnosticError('PROJECT_SELECTION_MISMATCH');
  if(mode !== '--dry-run' && args.includes('--check-config')) throw new DiagnosticError('CONFIG_CHECK_DRY_RUN_ONLY');
  if(mode !== '--dry-run' && (!args.includes('--approve-registry-writes') || !args.includes('--writers-paused'))) throw new DiagnosticError('WRITE_APPROVAL_REQUIRED');
  if(mode === '--activate' && !args.includes('--rules-verified')) throw new DiagnosticError('RULES_VERIFICATION_REQUIRED');
  if(mode !== '--dry-run' && !args.includes('--reserve-legacy-conflicts')) throw new DiagnosticError('LEGACY_RESERVATION_POLICY_ACK_REQUIRED');
  stage='firebase_dependencies';
  const {initializeApp,cert,applicationDefault} = require('firebase-admin/app');
  const {getFirestore} = require('firebase-admin/firestore');
  stage='credentials';
  const source = process.env.FIREBASE_DATA_CREDENTIALS?.trim();
  let credential;
  if(source) {
    let raw=source,serviceAccount;
    if(!source.startsWith('{')) {try {raw=fs.readFileSync(path.resolve(source),'utf8');}catch {throw new DiagnosticError('DATA_CREDENTIAL_FILE_UNREADABLE');}}
    try {serviceAccount=JSON.parse(raw);}catch {throw new DiagnosticError('DATA_CREDENTIAL_JSON_INVALID');}
    if(!serviceAccount || typeof serviceAccount!=='object' || Array.isArray(serviceAccount)) throw new DiagnosticError('DATA_CREDENTIAL_JSON_INVALID');
    if((serviceAccount.project_id || serviceAccount.projectId) !== project) throw new DiagnosticError('DATA_CREDENTIAL_PROJECT_MISMATCH');
    try {credential = cert(serviceAccount);}catch {throw new DiagnosticError('DATA_CREDENTIAL_INVALID');}
  } else credential=applicationDefault();
  stage='firebase_initialization';
  const db = getFirestore(initializeApp({projectId:project,credential},'mobile-registry-maintenance'));
  if(args.includes('--check-config')) {
    console.log(JSON.stringify({code:'FIREBASE_LOCAL_INITIALIZATION_OK',credentialSource:source?'FIREBASE_DATA_CREDENTIALS':'ADC',credentialAvailabilityVerified:!!source,productionReadsPerformed:false,readPermissionVerified:false}));
    return; // No token fetch, Firestore RPC, inventory or migration operation.
  }
  stage=mode === '--dry-run'?'inventory':mode.slice(2);
  if(mode === '--begin') {await begin(db);console.log(JSON.stringify({mode,status:'maintenance'}));return;}
  const report = await inspect(db);
  console.log(JSON.stringify({mode,...report})); // No raw phones, emails, UIDs or credentials.
  if(mode === '--backfill') await backfill(db,report);
  if(mode === '--activate') await activate(db,report);
  } catch(error) {
    // Whitelist the stage/code once, before the top-level output boundary.
    const safe=diagnostic(error,stage);
    const failure=new Error('Mobile registry operation refused or failed');
    failure.safeDiagnostic=safe;
    throw failure;
  }
}
if(require.main === module) main().catch(error=>{console.error(JSON.stringify({operation:'mobile_registry',...(error.safeDiagnostic || {code:'MOBILE_REGISTRY_OPERATION_FAILED',stage:'startup'})}));process.exitCode=1;});
module.exports={inspect,begin,backfill,activate,pages,policy,diagnostic,main};
