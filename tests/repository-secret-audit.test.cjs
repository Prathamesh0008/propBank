const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {inspect}=require('../scripts/audit-repository-secrets.cjs');
const script=path.resolve('scripts/audit-repository-secrets.cjs');
function git(cwd,...args){const result=spawnSync('git',args,{cwd,encoding:'utf8',windowsHide:true});assert.equal(result.status,0);}
function fixture(run){const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'propbank-secret-audit-'));try{git(cwd,'init','--quiet');fs.copyFileSync('.gitignore',path.join(cwd,'.gitignore'));return run(cwd);}finally{fs.rmSync(cwd,{recursive:true,force:true});}}
function scan(cwd){const result=spawnSync(process.execPath,[script],{cwd,encoding:'utf8',windowsHide:true});return {status:result.status,output:result.stdout+result.stderr,result:JSON.parse(result.stdout)};}
test('audit allows blank/public development template and rejects local credential filenames',()=>{
 assert.deepEqual(inspect('.env.firebase-dev.example','NEXT_PUBLIC_FIREBASE_PROJECT_ID=propbanktest\nNEXT_PUBLIC_FIREBASE_API_KEY=public-web-config\nFIREBASE_AUTH_CREDENTIALS=C:/Users/YOUR_WINDOWS_USER/.firebase-keys/test.json'),[]);
 assert.ok(inspect('propbanktest-service-account.json','{}').includes('local-credential-file-is-tracked-or-addable'));
});
test('audit catches a staged-only provider token without revealing its value',()=>fixture(cwd=>{
 const secret='re_'+('x'.repeat(32));fs.writeFileSync(path.join(cwd,'accidental.txt'),secret);git(cwd,'add','accidental.txt');fs.writeFileSync(path.join(cwd,'accidental.txt'),'sanitized worktree');
 const found=scan(cwd);assert.equal(found.status,1);assert.ok(found.result.findings.some(f=>f.source==='staged-index'&&f.rule==='resend-token'));assert.equal(found.output.includes(secret),false);
}));
test('audit catches unknown-format existing local secrets copied into source',()=>fixture(cwd=>{
 const secret='fictional-'+('z'.repeat(28));fs.writeFileSync(path.join(cwd,'.env.local'),'CRON_SECRET='+secret+'\n');fs.writeFileSync(path.join(cwd,'leaked.txt'),secret);
 const found=scan(cwd);assert.equal(found.status,1);assert.ok(found.result.findings.some(f=>f.rule==='matches-existing-local-secret'));assert.equal(found.output.includes(secret),false);
}));
test('ignored local key/config and credential-free examples pass on a fresh clone',()=>fixture(cwd=>{
 fs.writeFileSync(path.join(cwd,'.env.firebase-dev.local'),'FIREBASE_DEV_PROJECT_ID=propbanktest\n');fs.writeFileSync(path.join(cwd,'propbanktest-service-account.json'),'{}');fs.writeFileSync(path.join(cwd,'.env.firebase-dev.example'),'FIREBASE_DEV_PROJECT_ID=propbanktest\nNEXT_PUBLIC_FIREBASE_API_KEY=\n');git(cwd,'add','.gitignore','.env.firebase-dev.example');
 const found=scan(cwd);assert.equal(found.status,0);assert.deepEqual(found.result.findings,[]);assert.deepEqual(found.result.missingIgnoreRules,[]);assert.deepEqual(found.result.excludedExamples,[]);
}));
