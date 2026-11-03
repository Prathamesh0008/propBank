// Authorized diagnostics only. Routine development must use npm run dev.
const {resolve}=require('node:path'),{spawn}=require('node:child_process');
const {firebaseEnvironment}=require('../src/lib/firebase-environment.cjs');
function liveChildEnv(env,args){
  if(!args.includes('--allow-live-firebase'))throw new Error('Live development can consume production quota and write real records. Explicit --allow-live-firebase authorization is required.');
  const child={...env,NODE_ENV:'development',PROPBANK_FIREBASE_MODE:'live',NEXT_PUBLIC_PROPBANK_FIREBASE_MODE:'live',PROPBANK_ALLOW_LIVE_FIREBASE:'1'};
  if(firebaseEnvironment(child).mode!=='live')throw new Error('Remove emulator settings from this separate live-diagnostics shell.');
  return child;
}
function main(){
  const args=process.argv.slice(2);liveChildEnv({},args);
  require('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
  const childEnv=liveChildEnv(process.env,args);
  console.warn('AUTHORIZED LIVE FIREBASE DEVELOPMENT: real reads/writes and configured email/storage providers are enabled.');
  const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--port','8080'],{env:childEnv,stdio:'inherit',windowsHide:true});
  child.on('error',()=>{console.error('Unable to launch Next.js.');process.exitCode=1;});
  child.on('exit',(code,signal)=>{process.exitCode=signal?1:(code||0);});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
}
module.exports={liveChildEnv};
if(require.main===module)try{main();}catch(error){console.error(error.message);process.exitCode=1;}
