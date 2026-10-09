// Diagnose read configuration without printing credentials or document contents.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
require('@next/env').loadEnvConfig(process.cwd(),false,{info:()=>{},error:()=>{}});
const root=path.resolve('src'),cache=new Map();
function load(file) {
 let resolved=file.startsWith('@/')?path.join(root,file.slice(2)):path.resolve(file);if(!resolved.endsWith('.ts'))resolved+='.ts';
 if(cache.has(resolved))return cache.get(resolved);const exports={};cache.set(resolved,exports);
 const code=ts.transpileModule(fs.readFileSync(resolved,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports,Date,Buffer,URL,Headers,Request,Response,process,require:name=>name==='server-only'?{}:name.startsWith('.')?load(path.resolve(path.dirname(resolved),name)):name.startsWith('@/')?load(name):require(name)});return exports;
}
(async()=>{
 let stage='configuration';try{
  const db=load('@/lib/server/firestore').getDatabase();stage='site-settings-read';
  const doc=await db.collection('siteSettings').doc('main_settings').get();stage='site-settings-model';
  const {model,wireModel}=load('@/lib/server/services/contracts');wireModel('SiteSettings',model('SiteSettings',{...doc.data(),id:doc.id}));
  console.log(JSON.stringify({stage:'complete',siteSettingsExists:doc.exists,jwtSecretConfigured:!!process.env.JWT_SECRET}));
 }catch(error){console.log(JSON.stringify({stage,errorCode:error.code||null,errorType:error.name,configurationMessage:stage==='configuration'?error.message:undefined,modelMessage:stage==='site-settings-model'?error.message:undefined}));process.exitCode=1;}
})();
