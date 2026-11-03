import 'server-only';
import {mkdir,open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';

// Reserve before contacting Resend. Failures count too; restarts don't reset the cap.
export async function reserveDevelopmentEmailAttempt(){
  if(process.env.PROPBANK_FIREBASE_MODE!=='firebase'||process.env.FIREBASE_DEV_PROJECT_ID!=='propbanktest'||process.env.PROPBANK_EMAIL_MODE!=='resend-test')throw new Error('Development email reservation requires propbanktest resend-test mode.');
  const folder=resolve('.cache/firebase-dev-email');await mkdir(folder,{recursive:true});
  const lockPath=resolve(folder,'send-budget.lock'),statePath=resolve(folder,'send-budget.json');
  let lock;try{lock=await open(lockPath,'wx',0o600);}catch{throw new Error('Development email send budget is locked; no email was sent.');}
  try{
    let attempts:unknown=[];
    try{attempts=JSON.parse(await readFile(statePath,'utf8'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Development email budget is unreadable; no email was sent.');}
    if(!Array.isArray(attempts)||attempts.some(value=>typeof value!=='number'||!Number.isFinite(value)))throw new Error('Development email budget is invalid; no email was sent.');
    const now=Date.now(),recent=(attempts as number[]).filter(value=>value>now-3600000);
    if(recent.length>=5)throw new Error('Development email limit reached: 5 provider attempts per hour.');
    await writeFile(statePath+'.tmp',JSON.stringify([...recent,now]),{mode:0o600});await rename(statePath+'.tmp',statePath);
  }finally{await lock.close();await unlink(lockPath);}
}
