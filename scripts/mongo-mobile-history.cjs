// Offline only: accepts an authorized local snapshot, never loads credentials,
// imports a database SDK, opens a socket, writes a plan, or activates a registry.
// The exported importPrepared function needs caller-supplied clients AND explicit
// approval evidence; the CLI exposes planning only, never this write operation.
const {createHash}=require('node:crypto');
const {policy}=require('./mobile-registry-migration.cjs');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function prepareHistorical(profiles,identities,{enforceAuditedCounts=true}={}){
 if(!Array.isArray(profiles)||!Array.isArray(identities))throw new Error('SNAPSHOT_ARRAYS_REQUIRED');
 if(profiles.some(row=>!row.uid)||identities.some(row=>!row.uid)||new Set(profiles.map(row=>row.uid)).size!==profiles.length||new Set(identities.map(row=>row.uid)).size!==identities.length)throw new Error('INVALID_SNAPSHOT_IDENTITIES');
 const groups=new Map(),accounts=[],now=new Date();
 const fingerprint=hash([profiles.slice().sort((a,b)=>a.uid.localeCompare(b.uid)),identities.slice().sort((a,b)=>a.uid.localeCompare(b.uid))]);
 for(const profile of profiles){
  const phone=policy.registryPhone(profile.phoneNumber),raw=profile.phoneNumber;
  const account={_id:profile.uid,state:phone?'owned':raw==null||raw===''?'missing':'invalid',phone,createdAt:now,updatedAt:now};accounts.push(account);
  if(phone){const group=groups.get(phone)||[];group.push(account);groups.set(phone,group);}
 }
 // Auth phone identities cannot be allocated to an unrelated profile or ignored.
 // The historical audit had zero Auth phones; any new ones require review.
 if(identities.some(identity=>identity.phoneNumber))throw new Error('AUTH_PHONE_INVENTORY_CHANGED_REVIEW_REQUIRED');
 const claims=[...groups].map(([phone,members])=>{
  const blocked=members.length>1;if(blocked)members.forEach(account=>account.state='conflicted');
  return {_id:hash(phone),normalizedNumber:phone,status:blocked?'blocked':'owned',...(blocked?{memberCount:members.length,membersFingerprint:hash(members.map(member=>member._id).sort())}:{firebaseUID:members[0]._id}),idempotencyId:hash(['historical',fingerprint,phone]),createdAt:now,updatedAt:now};
 });
 const summary={profiles:accounts.length,ownedClaims:claims.filter(row=>row.status==='owned').length,blockedClaims:claims.filter(row=>row.status==='blocked').length,conflictedAccounts:accounts.filter(row=>row.state==='conflicted').length,missing:accounts.filter(row=>row.state==='missing').length,invalid:accounts.filter(row=>row.state==='invalid').length,authIdentities:identities.length,unmatchedAuth:identities.filter(row=>!accounts.some(account=>account._id===row.uid)).length};
 if(enforceAuditedCounts&&(summary.profiles!==42||summary.ownedClaims!==25||summary.blockedClaims!==2||summary.conflictedAccounts!==4||summary.missing!==12||summary.invalid!==1||summary.authIdentities!==43||summary.unmatchedAuth<1))throw new Error('HISTORICAL_AUDIT_COUNTS_CHANGED_REAUDIT_REQUIRED');
 return {version:1,policy:'firebase-mobile-claims-v1',fingerprint,claims,accounts,summary,preservedAuthFingerprint:hash(identities.slice().sort((a,b)=>a.uid.localeCompare(b.uid)))};
}
function verifyHistorical(plan,claims,accounts){
 const same=(actual,expected)=>{
  if(actual.length!==expected.length||new Set(actual.map(row=>row._id)).size!==actual.length)return false;
  return expected.every(row=>{
   const found=actual.find(value=>value._id===row._id);if(!found)return false;
   const fields=Object.keys(row).filter(key=>!['createdAt','updatedAt'].includes(key));
   const dates=['createdAt','updatedAt'].every(key=>found[key] instanceof Date&&Number.isFinite(found[key].getTime()));
   return fields.every(key=>found[key]===row[key])&&Object.keys(found).every(key=>key in row)&&dates;
  });
 };
 if(!same(claims,plan.claims)||!same(accounts,plan.accounts))throw new Error('HISTORICAL_IMPORT_MISMATCH');
 return true;
}
async function importPrepared(client,db,plan,approval){
 if(approval?.approved!==true||approval.writersPaused!==true||approval.firebaseFrozen!==true||!approval.database||approval.database!==db.databaseName||approval.fingerprint!==plan.fingerprint)throw new Error('EXPLICIT_IMPORT_APPROVAL_REQUIRED');
 const counts=plan.summary;
 if(counts.profiles!==42||counts.ownedClaims!==25||counts.blockedClaims!==2||counts.authIdentities!==43)throw new Error('HISTORICAL_AUDIT_COUNTS_CHANGED_REAUDIT_REQUIRED');
 // The provisioning policy is pure TS (type-only driver import); do not import
 // the runtime store or either live database SDK from this maintenance helper.
 const fs=require('node:fs'),ts=require('typescript'),exports={};
 const compiled=ts.transpileModule(fs.readFileSync('src/lib/server/mongo-mobile-policy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('exports',compiled)(exports);
 const indexes=await db.collection('mobile_claims').listIndexes().toArray();
 for(const expected of exports.MOBILE_CLAIM_INDEXES)if(!indexes.some(row=>row.name===expected.name&&row.unique===true&&JSON.stringify(row.key)===JSON.stringify(expected.key)&&JSON.stringify(row.partialFilterExpression)===JSON.stringify(expected.partialFilterExpression)))throw new Error('PROVISIONED_INDEXES_REQUIRED');
 if(!(await db.collection('mobile_accounts').listIndexes().toArray()).some(row=>row.name==='_id_'))throw new Error('PROVISIONED_ACCOUNTS_REQUIRED');
 const session=client.startSession();
 try{return await session.withTransaction(async()=>{
  const options={session},control=db.collection('mobile_claims_control');
  const current=await control.findOne({_id:'main'},options);
  if(current?.status!=='maintenance'||current.version!==plan.version||current.policy!==plan.policy||current.fingerprint!==plan.fingerprint||current.verifiedImport!==false)throw new Error('MAINTENANCE_MANIFEST_REQUIRED');
  for(const [name,expected] of [['mobile_claims',plan.claims],['mobile_accounts',plan.accounts]]){
   const collection=db.collection(name),actual=await collection.find({},options).toArray();
   const subset=expected.filter(row=>actual.some(value=>value._id===row._id));
   if(name==='mobile_claims')verifyHistorical({...plan,claims:subset,accounts:[]},actual,[]);
   else verifyHistorical({...plan,claims:[],accounts:subset},[],actual);
   for(const row of expected)if(!actual.some(value=>value._id===row._id))await collection.insertOne(row,options);
  }
  verifyHistorical(plan,await db.collection('mobile_claims').find({},options).toArray(),await db.collection('mobile_accounts').find({},options).toArray());
  await control.updateOne({_id:'main'},{$set:{importedFingerprint:plan.fingerprint,importedCounts:plan.summary,updatedAt:new Date()}},options);
  return {imported:true,activated:false,...plan.summary};
 },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary'});}finally{await session.endSession();}
}
if(require.main===module){
 try{
  if(process.argv.length!==3)throw new Error('LOCAL_SNAPSHOT_PATH_REQUIRED');
  const snapshot=JSON.parse(require('node:fs').readFileSync(process.argv[2],'utf8'));
  const plan=prepareHistorical(snapshot.profiles,snapshot.identities);
  console.log(JSON.stringify({offline:true,activated:false,fingerprint:plan.fingerprint,...plan.summary}));
 }catch{console.error('Offline historical plan refused: snapshot missing, invalid, or differs from audited inventory.');process.exitCode=1;}
}
module.exports={prepareHistorical,verifyHistorical,importPrepared};
