// One temporary object; real R2 transport, isolated auth/database fixtures.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript');
const sdk=require('@aws-sdk/client-s3');
const {isolated,users,request,route}=require('../tests/fixtures/native-server.cjs');
require('@next/env').loadEnvConfig(process.cwd(),true,{info:()=>{},error:()=>{}});
if(process.argv[2]!=='--live-one-file')throw new Error('Explicit --live-one-file is required');
const names=['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_R2_ACCESS_KEY_ID','CLOUDFLARE_R2_SECRET_ACCESS_KEY','CLOUDFLARE_R2_BUCKET_NAME','CLOUDFLARE_R2_PUBLIC_URL'];
for(const n of names)if(!process.env[n]?.trim())throw new Error(`${n} missing`);
if(process.env.CLOUDFLARE_R2_BUCKET_NAME!=='propbank')throw new Error('Only existing propbank bucket is permitted');
if(!/^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_ACCOUNT_ID))throw new Error('CLOUDFLARE_ACCOUNT_ID must be the 32-character account ID, not a URL');
const exportsObject={},source=ts.transpileModule(fs.readFileSync('src/lib/server/r2.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(source,{exports:exportsObject,process:{env:Object.fromEntries(names.map(n=>[n,process.env[n]]))},require:n=>n==='server-only'?{}:n==='@aws-sdk/client-s3'?sdk:(()=>{throw new Error('Unexpected dependency');})()});
const realClient=exportsObject.getR2Client(),run=crypto.randomUUID(),folder=`uploads/owner/live-r2-verification-${run}`;
const app=isolated({users,properties:{P:{id:'P',ownerUID:'other',tenants:[]}}});
for(const n of names)app.env[n]=process.env[n];
const calls=[];let key=null,url=null,uploaded=false,deleted=false;
const status=error=>({httpStatus:error?.$metadata?.httpStatusCode||null,errorType:error?.name||'StorageError'});
const head=async target=>{try{const response=await realClient.send(new sdk.HeadObjectCommand({Bucket:'propbank',Key:target}));return {httpStatus:response.$metadata.httpStatusCode,size:response.ContentLength,uploadedBy:response.Metadata?.uploadedby||response.Metadata?.uploadedBy};}catch(error){return status(error);}};
app.load(path.resolve('src/lib/server/r2.ts')).getR2Client=()=>({send:async command=>{
 const operation=command.constructor.name,input=command.input;
 if(input.Bucket!=='propbank'||!['PutObjectCommand','DeleteObjectCommand'].includes(operation))throw new Error('Unexpected live operation');
 if(operation==='PutObjectCommand'){
  if(key||!input.Key.startsWith(folder+'/')||input.Body.length>1024)throw new Error('Only one small uniquely scoped object may be uploaded');
  key=input.Key;const initial=await head(key);console.log(JSON.stringify({initialTestKeyHead:initial}));if(initial.httpStatus!==404)throw new Error('Cannot establish that temporary key does not exist');
 }else if(!uploaded||input.Key!==key)throw new Error('Delete must target only the successfully uploaded test object');
 try{const response=await realClient.send(new sdk[operation](input));calls.push({operation,key:input.Key,httpStatus:response.$metadata.httpStatusCode});if(operation==='PutObjectCommand')uploaded=true;else deleted=true;return response;}catch(error){calls.push({operation,key:input.Key,...status(error)});throw error;}
}});
const fetchFile=async target=>{try{const response=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(15000)});const bytes=Buffer.from(await response.arrayBuffer());return {httpStatus:response.status,bytes:bytes.length,matchesTestFile:response.ok&&bytes.equals(png)};}catch{return {httpStatus:null,errorType:'PublicFetchFailed'};}};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=','base64');
(async()=>{
 console.log(JSON.stringify({configuration:Object.fromEntries(names.map(n=>[n,'configured'])),bucket:'propbank',mode:'Existing upload/delete API handlers and R2 helper; isolated auth/database; actual R2 transport',run}));
 try{
  const upload=await route(app,'upload/image').POST(request('/upload/image','owner','POST',{image:`data:image/png;base64,${png.toString('base64')}`,folder,identifier:'temporary-pixel'}));
  const body=await upload.json();url=body.url||null;
  console.log(JSON.stringify({upload:{httpStatus:upload.status,success:body.success},objectKey:key,uniqueNamespace:!!key&&key.startsWith(folder+'/')&&/_[0-9a-f-]{36}\.png$/.test(key)}));
  if(!uploaded||!url)throw new Error('Upload did not succeed');
  console.log(JSON.stringify({objectHead:await head(key),publicFetch:await fetchFile(url)}));
  const before=calls.length,del=route(app,'files/[...path]');
  const traversalUpload=await route(app,'upload/image').POST(request('/upload/image','owner','POST',{image:`data:image/png;base64,${png.toString('base64')}`,folder:'uploads/owner/../other',identifier:'blocked'}));
  const crossUser=await del.DELETE(request('/files/delete','other','DELETE',{url}));
  const prefix=app.load(path.resolve('src/lib/server/r2.ts')).getR2PublicUrl('');
  const traversalDelete=await del.DELETE(request('/files/delete','owner','DELETE',{url:prefix+'uploads/owner/%2e%2e/other/test.png'}));
  const crossNamespace=await del.DELETE(request('/files/delete','owner','DELETE',{url:prefix+'properties/P/never-created.png'}));
  console.log(JSON.stringify({security:{traversalUpload:traversalUpload.status,traversalDelete:traversalDelete.status,crossUserDelete:crossUser.status,crossPropertyDelete:crossNamespace.status,liveOperationsDuringRejectedRequests:calls.length-before}}));
 }catch(error){console.log(JSON.stringify({verificationError:'Controlled verification could not complete',...status(error)}));process.exitCode=1;}
 finally{
  if(uploaded&&!deleted){
   try{
    if(!url)url=exportsObject.getR2PublicUrl(key);
    const response=await route(app,'files/[...path]').DELETE(request('/files/delete','owner','DELETE',{url}));const body=await response.json();
    console.log(JSON.stringify({delete:{httpStatus:response.status,success:body.success},postDeleteObject:await head(key),postDeletePublic:await fetchFile(url),postDeleteFreshPublic:await fetchFile(url+'?verification='+run)}));
   }catch(error){console.log(JSON.stringify({cleanupFailed:true,exactTemporaryKey:key,...status(error)}));process.exitCode=1;}
  }
  console.log(JSON.stringify({calls,uploaded,deleted,productionFirestoreWrites:0,isolatedWrites:app.writes.length}));realClient.destroy();
 }
})();
