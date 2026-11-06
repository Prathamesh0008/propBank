const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {diagnostic}=require('../scripts/mobile-registry-migration.cjs');

test('diagnostics whitelist codes without disclosing SDK messages, paths or arbitrary codes',()=>{
 for(const [error,code] of [
  [{code:7,message:'sensitive provider details'},'FIRESTORE_PERMISSION_DENIED'],
  [{code:16,message:'sensitive token details'},'FIRESTORE_UNAUTHENTICATED'],
  [{message:'Could not load the default credentials. private filesystem detail'},'ADC_UNAVAILABLE'],
  [{code:'untrusted-value',message:'sensitive credential content'},'MOBILE_REGISTRY_OPERATION_FAILED'],
 ]){
  assert.deepEqual(diagnostic(error,'inventory'),{code,stage:'inventory'});
 }
});

function config(overrides={}){
 const env={...process.env,FIREBASE_DATA_PROJECT_ID:'test-mobile-diagnostics',FIREBASE_DATA_CREDENTIALS:'',GOOGLE_APPLICATION_CREDENTIALS:'',...overrides};
 // Disable networking before loading the script or Firebase SDK. Check-config
 // must never fetch a token or issue a Firestore RPC, even with an ADC fallback.
 const bootstrap=`for(const mod of ['node:http','node:https'])require(mod).request=()=>{throw new Error('NETWORK_BLOCKED')};require('node:net').Socket.prototype.connect=()=>{throw new Error('NETWORK_BLOCKED')};global.fetch=()=>{throw new Error('NETWORK_BLOCKED')};process.argv=['node','scripts/mobile-registry-migration.cjs','--dry-run','--check-config','--project=test-mobile-diagnostics'];require('./scripts/mobile-registry-migration.cjs').main().catch(e=>{console.error(JSON.stringify(e.safeDiagnostic));process.exitCode=1});`;
 const result=spawnSync(process.execPath,['-e',bootstrap],{env,encoding:'utf8',timeout:15000});
 assert.equal(result.error,undefined);return result;
}
test('explicit project/environment mismatch fails before Firebase initialization',()=>{
 const result=config({FIREBASE_DATA_PROJECT_ID:''});assert.equal(result.status,1);assert.deepEqual(JSON.parse(result.stderr),{code:'PROJECT_SELECTION_MISMATCH',stage:'arguments'});
});
test('credential file, JSON and project failures receive distinct safe local diagnostics',()=>{
 for(const [value,code] of [
  ['missing-mobile-diagnostic-fixture.json','DATA_CREDENTIAL_FILE_UNREADABLE'],
  ['{malformed-private-fixture','DATA_CREDENTIAL_JSON_INVALID'],
  ['{"project_id":"different-project"}','DATA_CREDENTIAL_PROJECT_MISMATCH'],
  ['{"project_id":"test-mobile-diagnostics"}','DATA_CREDENTIAL_INVALID'],
 ]){
  const result=config({FIREBASE_DATA_CREDENTIALS:value});assert.equal(result.status,1);assert.deepEqual(JSON.parse(result.stderr),{code,stage:'credentials'});assert.equal(result.stdout,'');
 }
});
test('configuration-only check initializes locally without resolving ADC or querying Firestore',()=>{
 const result=config();assert.equal(result.status,0);const body=JSON.parse(result.stdout);assert.equal(body.code,'FIREBASE_LOCAL_INITIALIZATION_OK');assert.equal(body.credentialSource,'ADC');assert.equal(body.credentialAvailabilityVerified,false);assert.equal(body.productionReadsPerformed,false);assert.equal(body.readPermissionVerified,false);assert.equal(result.stderr,'');
});
