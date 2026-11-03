// Read-only repository exposure audit. Reports paths/rules, never secret values.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {parseEnv}=require('node:util');
const patterns=[
  ['private-key-material',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{80,}?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['resend-token',/\bre_[a-zA-Z0-9]{20,}\b/],
  ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['google-oauth-secret',/GOCSPX-[\w-]{20,}/],
  ['aws-access-key',/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['service-account-private-key',/"type"\s*:\s*"service_account"[\s\S]*?"private_key"\s*:\s*".{80}/],
];
const git=(args,options={})=>execFileSync('git',args,{encoding:'utf8',maxBuffer:256*1024*1024,stdio:['pipe','pipe','pipe'],...options});
function knownLocalSecrets(){
  const values=[];
  for(const file of ['.env','.env.local','.env.firebase-dev.local','.env.email-dev.local','.env.test-accounts.local']){
    if(!fs.existsSync(file))continue;
    const env=parseEnv(fs.readFileSync(file,'utf8'));
    for(const [key,value] of Object.entries(env)){
      if(!value||value.length<12||key.startsWith('NEXT_PUBLIC_'))continue;
      if(/CREDENTIALS/.test(key)){
        try{const account=JSON.parse(value.trim().startsWith('{')?value:fs.readFileSync(value,'utf8'));
          if(account.private_key)values.push(account.private_key,account.private_key.replaceAll('\n','\\n'),account.private_key.split('\n').filter(line=>line&&!line.includes('-----')).join(''));
        }catch{/* Missing optional local credentials do not cause fallback access. */}
      }else if(/SECRET|PASSWORD|TOKEN|API_KEY|ACCESS_KEY/.test(key))values.push(value);
    }
  }
  return [...new Set(values)].filter(Boolean);
}
function inspect(file,content,known=[]){
  const rules=patterns.filter(([,pattern])=>pattern.test(content)).map(([rule])=>rule);
  if(known.some(value=>content.includes(value)))rules.push('matches-existing-local-secret');
  if(/(^|\/)\.env(?:\.|$)/.test(file)){
    const env=parseEnv(content);
    for(const [key,value] of Object.entries(env)){
      if(key.startsWith('NEXT_PUBLIC_')||!value)continue;
      if(/SECRET|PASSWORD|TOKEN|API_KEY|ACCESS_KEY|CREDENTIALS/.test(key)&&!(/^(?:YOUR_|<|PLACEHOLDER|C:\/Users\/YOUR_|C:\/secure\/)/i.test(value)))rules.push('non-placeholder-sensitive-env-value');
    }
  }
  if(/(^|\/)(?:.*service[-_]account.*\.json|.*firebase-adminsdk.*\.json|.*\.(?:pem|key|p12|pfx)|\.env(?:\..*)?\.local)$/.test(file))rules.push('local-credential-file-is-tracked-or-addable');
  return [...new Set(rules)];
}
function audit(){
  const known=knownLocalSecrets(),findings=[];
  const staged=git(['diff','--cached','--name-only','-z']).split('\0').filter(Boolean);
  const entries=git(['ls-files','--stage','-z']).split('\0').filter(Boolean).map(entry=>{
    const tab=entry.indexOf('\t'),[mode,hash,stage]=entry.slice(0,tab).split(' ');return {file:entry.slice(tab+1),hash,stage,mode};
  });
  const hashes=[...new Set(entries.filter(e=>e.mode!=='160000').map(e=>e.hash))];
  const objects=new Map();
  if(hashes.length){
    const batch=git(['cat-file','--batch'],{input:hashes.join('\n')+'\n',encoding:null});let offset=0;
    for(const hash of hashes){const newline=batch.indexOf(10,offset),header=batch.subarray(offset,newline).toString(),size=Number(header.split(' ')[2]);if(!Number.isFinite(size))throw new Error('Unable to read indexed Git object.');objects.set(hash,batch.subarray(newline+1,newline+1+size));offset=newline+size+2;}
  }
  for(const entry of entries){
    if(entry.mode==='160000'){findings.push({file:entry.file,source:'index',rule:'submodule-needs-independent-audit'});continue;}
    for(const rule of inspect(entry.file,objects.get(entry.hash).toString('utf8'),known))findings.push({file:entry.file,source:staged.includes(entry.file)?'staged-index':'tracked-index',rule});
  }
  const candidates=git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
  for(const file of new Set(candidates)){
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
    for(const rule of inspect(file,fs.readFileSync(file,'utf8'),known))findings.push({file,source:'worktree',rule});
  }
  const ignoreProbes=['.env.email-dev.local','.env.firebase-dev.local','.env.local','.env.development','.env.staging','propbanktest-service-account.json','arbitrary.service-account.json','propbanktest-firebase-adminsdk-example.json','.firebase-keys/key.json','private.pem','private.key','.cache/firebase-dev-email/outbox.jsonl','.cache/firebase-dev-files/fixture.json'];
  const ignored=git(['check-ignore','--no-index','--stdin'],{input:ignoreProbes.join('\n')+'\n'}).split(/\r?\n/).filter(Boolean);
  const missingIgnoreRules=ignoreProbes.filter(file=>!ignored.includes(file));
  const examples=['.env.example','.env.firebase-dev.example','.env.emulator.example','.env.email-dev.example'];
  const excludedExamples=examples.filter(file=>{try{git(['check-ignore','--no-index','-q',file]);return true;}catch{return false;}});
  return {trackedFiles:new Set(entries.map(e=>e.file)).size,stagedFiles:staged.length,worktreeFilesScanned:new Set(candidates).size,findings,missingIgnoreRules,excludedExamples,trackedArtifacts:{cacheFiles:entries.filter(e=>e.file.startsWith('.cache/')).length,logFiles:entries.filter(e=>e.file.endsWith('.log')).length},limitations:'Pattern and known-local-secret scan of current Git index and worktree; no exhaustive history, cloud IAM or hosting-secret audit. Firebase web API keys are public configuration, not Admin credentials.'};
}
module.exports={inspect,audit};
if(require.main===module){try{const result=audit();console.log(JSON.stringify(result,null,2));if(result.findings.length||result.missingIgnoreRules.length||result.excludedExamples.length)process.exitCode=1;}catch{console.error('Repository exposure audit could not complete; no secret content was printed.');process.exitCode=1;}}
