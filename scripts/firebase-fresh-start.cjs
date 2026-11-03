// One-time maintenance tool. Default is READ ONLY. Never exports document/user data.
// Execution requires separate scope approval AND confirmed shutdown of all writers/triggers.
const fs = require('node:fs');
const {parseEnv} = require('node:util');
const {initializeApp, cert} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore} = require('firebase-admin/firestore');
const expected = {admin_notifications:70, auth_activity:126, documents:6,
  email_deliveries:177, email_invitation_limits:28, enquiry_assignments:1,
  enquiry_controls:15, properties:32, property_submissions:32,
  relationship_link_limits:817, relationship_links:13, reviews:1,
  service_requests:1, siteSettings:1, storage_objects:56, tenants:15,
  users:35, visits:20};
const approval = 'DELETE-13-AUTH-USERS-1446-PROPBANK-DOCUMENTS';
function credential(value, project) {
  if (!value?.trim()) throw Error('Explicit service-account credential required');
  const account = JSON.parse(value.trim().startsWith('{') ? value : fs.readFileSync(value, 'utf8'));
  if ((account.project_id || account.projectId) !== project) throw Error('Credential project mismatch');
  return cert(account);
}
async function main() {
  const args = process.argv.slice(2), execute = args.includes('--execute');
  if (args.some(x => !['--inventory', '--execute', '--writers-and-triggers-paused', '--approve='+approval].includes(x))) throw Error('Unknown argument');
  if (execute && (!args.includes('--approve='+approval) || !args.includes('--writers-and-triggers-paused'))) throw Error('Separate explicit scope approval and writer/trigger shutdown confirmation required');
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw Error('Emulator override forbidden');
  const env = parseEnv(fs.readFileSync('.env.local', 'utf8'));
  if ((env.FIREBASE_AUTH_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) !== 'propbank-7601b' ||
      (env.FIREBASE_DATA_PROJECT_ID || env.FIREBASE_PROJECT_ID) !== 'propbank-944fc' ||
      env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'propbank-7601b') throw Error('Target project mismatch');
  const auth = getAuth(initializeApp({projectId:'propbank-7601b', credential:credential(env.FIREBASE_AUTH_CREDENTIALS, 'propbank-7601b')}, 'fresh-start-auth'));
  const db = getFirestore(initializeApp({projectId:'propbank-944fc', credential:credential(env.FIREBASE_DATA_CREDENTIALS || env.FIREBASE_CREDENTIALS, 'propbank-944fc')}, 'fresh-start-data'), '(default)');
  db.settings({preferRest:true});
  async function authCount() {
    let count=0, pageToken;
    do { const page=await auth.listUsers(1000,pageToken); count+=page.users.length; pageToken=page.pageToken; } while(pageToken);
    return count;
  }
  async function inventory() {
    const rows={};
    async function visit(collection, pattern) {
      rows[pattern]=(rows[pattern]||0)+(await collection.count().get()).data().count;
      // listDocuments includes missing parent documents, so orphaned subcollections are inspected.
      for(const ref of await collection.listDocuments()) for(const child of await ref.listCollections()) await visit(child, pattern+'/{document}/'+child.id);
    }
    for(const collection of await db.listCollections()) await visit(collection,collection.id);
    return rows;
  }
  try {
    const users=await authCount(), rows=await inventory();
    console.log(JSON.stringify({mode:execute?'approved-cleanup-preflight':'read-only',authProject:'propbank-7601b',firestoreProject:'propbank-944fc',database:'(default)',authenticationUsers:users,collections:rows}));
    if(!execute) return;
    if(users!==13 || Object.keys(rows).length!==Object.keys(expected).length || Object.entries(expected).some(([key,n])=>rows[key]!==n)) throw Error('Scope changed; obtain a new inventory and approval');
    // No application routes, email adapters, storage clients, migrations or backup exports.
    // Auth bulk deletion is paginated by repeatedly taking the first page after deletion.
    while(true) {
      const page=await auth.listUsers(1000); if(!page.users.length)break;
      const result=await auth.deleteUsers(page.users.map(user=>user.uid));
      if(result.failureCount)throw Error('Partial Auth deletion; stop and review before resuming');
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    const writer=db.bulkWriter({throttling:{initialOpsPerSecond:10,maxOpsPerSecond:20}});
    writer.onWriteError(error=>[4,8,10,14].includes(error.code)&&error.failedAttempts<5);
    try { for(const name of Object.keys(expected)) await db.recursiveDelete(db.collection(name),writer); }
    finally { await writer.close(); }
    const remaining=await inventory(), remainingUsers=await authCount();
    const empty=remainingUsers===0&&Object.values(remaining).every(n=>n===0);
    console.log(JSON.stringify({verificationPassed:empty,authenticationUsers:remainingUsers,collections:remaining,storageObjectDeletionRequested:false}));
    if(!empty)throw Error('Post-cleanup state is not empty; stop and investigate');
  } finally { await db.terminate(); }
}
main().catch(()=>{console.error('Maintenance stopped. No secrets logged. If execution was requested, partial deletion may have occurred; inspect before retrying.');process.exitCode=1;});
