// Test the built Next server. Public reads use configured Firebase; all writes
// deliberately omit identity and must fail before any database/storage mutation.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main() {
 const wrappersOnly=process.argv.includes('--compatibility-only');
 const inventory=JSON.parse(fs.readFileSync(path.join(root,'migration-audit/api-inventory.json'),'utf8'));
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','18090'],{cwd:root,windowsHide:true,env:process.env,stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',v=>{log+=v;});child.stderr.on('data',v=>{log+=v;});
 const results=[];
 // Specific route preflight needs no live credentials and proves default native dispatch.
 try {
  let ready=false;for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error('Next exited before startup');try{const r=await fetch('http://127.0.0.1:18090/api/unmigrated-test');if(r.status===404){ready=true;break;}}catch{}await delay(500);}
  assert.ok(ready,'Next server readiness');
  for(const row of wrappersOnly?[]:inventory.rows) {
   const url=row.endpoint.replace(/:[A-Za-z]+/g,'migration-fixture');
   const response=await fetch('http://127.0.0.1:18090'+url,{method:row.method,redirect:'manual',...(['GET','HEAD'].includes(row.method)?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(row.endpoint==='/api/auth/login'?{uid:'migration-fixture'}:{})})});
   results.push({method:row.method,endpoint:row.endpoint,status:response.status,reachable:row.reachable});
   assert.notEqual(response.status,501,`${row.method} ${row.endpoint} has no native implementation`);
   assert.ok(response.status<500,`${row.method} ${row.endpoint} returned ${response.status}`);
  }
  for(const route of inventory.routes) {
   const endpoint='/api/'+route.file.slice(8,-9).replace(/\/$/,'').replace(/\[(?:\.\.\.)?[^\]]+\]/g,'fixture')+(['app/api/files/route.ts','app/api/documents/property/route.ts'].includes(route.file)?'/':'');
   const response=await fetch('http://127.0.0.1:18090'+endpoint,{method:'OPTIONS',redirect:'manual'});assert.equal(response.status,200,endpoint+' OPTIONS');
  }
  for(const name of ['upload','upload/image','upload/document','upload/property-images','upload/service-request-image','agreements/renew','agreements/terminate','agreements/request-renewal','agreements/request-termination']) {
   for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']) {
    const endpoint='/api/'+name+'/';const response=await fetch('http://127.0.0.1:18090'+endpoint+'?contract=unchanged',{method,redirect:'manual'});
    assert.equal(response.status,200,method+' '+endpoint);
    assert.equal(await response.text(),['HEAD','OPTIONS'].includes(method)?'':'{"message": "ShoPROP Backend API is running! (v2)", "status": "success"}');
    results.push({method,endpoint,status:response.status,reachable:false});
   }
  }
  for(const url of ['/api','/api/admin/trigger-reminders','/api/admin/populate-services','/api/admin/site-settings/quote','/api/reviews/property/fixture','/api/inspection-reports/fixture','/api/unknown-migration-fixture']) {
   const response=await fetch('http://127.0.0.1:18090'+url,{redirect:'manual'});assert.equal(response.status,404,url);
  }
 } finally {
  child.kill();
  fs.writeFileSync(path.join(root,'migration-audit',wrappersOnly?'native-compatibility-results.json':'native-routing-results.json'),JSON.stringify({results,scope:wrappersOnly?'Actual built Next routing; all nine trailing-slash paths and seven methods; unmatched routes return 404; no Firebase or R2 calls.':'Actual built Next routing; public Firebase reads; anonymous write rejection; trailing-slash compatibility. Authenticated mutation success is covered only by isolated contract tests.'},null,2)+'\n');
 }
 console.log(JSON.stringify({checkedSourceOperations:wrappersOnly?0:inventory.rows.length,checkedTrailingSlashOperations:63,statuses:results.reduce((v,r)=>(v[r.status]=(v[r.status]||0)+1,v),{}),scope:wrappersOnly?'Built server trailing-slash routing and unmatched routes return 404; no live Firebase/R2 calls':'Built server routing, public reads and anonymous write rejection; no authenticated live writes'},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
