import 'server-only';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';

// Implements only the managed-file operations used by PropBank. No network SDK.
// HTTP access still passes through the existing authenticated media routes.
export async function sendLocalStorageCommand(command:{constructor:{name:string};input:{Bucket?:string;Key?:string;Body?:unknown;ContentType?:string}}){
  if(process.env.PROPBANK_FIREBASE_MODE!=='firebase')throw new Error('Local storage requires Firebase development mode.');
  if(command.input.Bucket!=='propbank-development-private')throw new Error('Local mock refuses non-development buckets.');
  const project=process.env.FIREBASE_DEV_PROJECT_ID||'';
  if(!project||['propbank-7601b','propbank-944fc'].includes(project))throw new Error('Local mock requires an isolated development project.');
  const folder=resolve('.cache/firebase-dev-files',createHash('sha256').update(project).digest('hex'));
  const file=join(folder,createHash('sha256').update(command.input.Key||'').digest('hex')+'.json');
  switch(command.constructor.name){
    case 'PutObjectCommand':{
      if(!Buffer.isBuffer(command.input.Body))throw new Error('Local file mock supports buffered uploads only.');
      await mkdir(folder,{recursive:true});
      await writeFile(file,JSON.stringify({bytes:command.input.Body.toString('base64'),contentType:command.input.ContentType}),{mode:0o600});
      return {};
    }
    case 'GetObjectCommand':{
      const saved=JSON.parse(await readFile(file,'utf8')),bytes=Buffer.from(saved.bytes,'base64');
      return {Body:{transformToByteArray:async()=>bytes},ContentLength:bytes.length,ContentType:saved.contentType};
    }
    case 'DeleteObjectCommand':await rm(file,{force:true});return {};
    default:throw new Error(`Unsupported local storage mock operation: ${command.constructor.name}. No R2 request was made.`);
  }
}
