// Read-only acceptance; no tokens, private keys, profiles or property bodies logged.
const {loadEnvConfig}=require('@next/env');loadEnvConfig(process.cwd(),true, {info:()=>{},error:()=>{}});
const origin=process.env.PROPBANK_READONLY_NEXT_ORIGIN||'http://localhost:8080';
(async()=>{
 const response=await fetch(origin+'/api/properties',{signal:AbortSignal.timeout(60000)});
 const data=await response.json();const properties=Array.isArray(data.properties)?data.properties:[];
 const railwayHeaders=[...response.headers.keys()].filter(name=>name.includes('railway'));
 if(response.status!==200||!data.success||railwayHeaders.length)throw new Error(`Native property acceptance failed (HTTP ${response.status}, Railway headers: ${railwayHeaders.length}).`);
 const storage=new Map();
 const inspect=value=>{if(Array.isArray(value)){value.forEach(inspect);return;}if(value&&typeof value==='object'){Object.values(value).forEach(inspect);return;}if(typeof value!=='string'||!/^https?:\/\//.test(value))return;try{const url=new URL(value);const label=url.hostname==='storage.googleapis.com'?`${url.hostname}/${url.pathname.split('/')[1]}`:url.hostname;storage.set(label,(storage.get(label)||0)+1);}catch{}};
 properties.forEach(inspect);
 console.log(JSON.stringify({endpoint:'/api/properties',status:response.status,propertyCount:properties.length,railwayHeaders,storageOrigins:Object.fromEntries(storage)}));
 const tokenFile=process.env.PROPBANK_ACCEPTANCE_TOKEN_FILE;
 if(!tokenFile){console.log('Signed-in acceptance pending: provide PROPBANK_ACCEPTANCE_TOKEN_FILE containing a current browser Firebase ID token; no token will be logged.');return;}
 const {readFileSync}=require('node:fs');const token=readFileSync(tokenFile,'utf8').trim();
 const parts=token.split('.');if(parts.length!==3)throw new Error('Acceptance token must be a Firebase ID token.');
 // Untrusted payload only selects the route; the server must verify the token.
 const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));if(typeof claims.sub!=='string'||claims.aud!=='propbank-7601b')throw new Error('Acceptance token is not from the existing browser Auth project.');
 for(const path of [`/users/${encodeURIComponent(claims.sub)}`,`/properties?ownerUID=${encodeURIComponent(claims.sub)}`,`/visits?userId=${encodeURIComponent(claims.sub)}`]){
  const result=await fetch(origin+'/api'+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(60000)});const body=await result.json();
  if(result.status!==200||body.success!==true||[...result.headers.keys()].some(name=>name.includes('railway')))throw new Error(`Authenticated acceptance failed for ${path.split('?')[0].replace(claims.sub,'<uid>')} (HTTP ${result.status}).`);
  if(path.startsWith('/users/')&&body.user?.uid!==claims.sub)throw new Error('DATA user UID did not match verified browser UID.');
  console.log(JSON.stringify({endpoint:path.split('?')[0].replace(claims.sub,'<uid>'),status:result.status,verifiedAuthProject:'propbank-7601b',dataProject:'propbank-944fc'}));
 }
})().catch(()=>{console.error('Dual-Firebase read-only acceptance failed; inspect local server configuration without logging credentials.');process.exitCode=1;});
