import 'server-only';
import { getR2Configuration } from '../r2';

const extensions:Record<string,string>={'image/png':'.png','image/gif':'.gif','image/webp':'.webp','application/pdf':'.pdf'};
function validateBase64(encoded:string) {
  const bytes=Buffer.from(encoded,'utf8');let index=0;
  const corrupt=(offset:number)=>{throw new Error(`failed to parse base64 image: failed to decode base64: illegal base64 data at input byte ${offset}`);};
  while(index<bytes.length)for(let quantum=0;quantum<4;quantum++) {
    if(index===bytes.length){if(quantum===0)return;corrupt(index-quantum);}
    const byte=bytes[index++];
    if((byte>=65&&byte<=90)||(byte>=97&&byte<=122)||(byte>=48&&byte<=57)||byte===43||byte===47)continue;
    if(byte===10||byte===13){quantum--;continue;}
    if(byte!==61||quantum<2)corrupt(index-1);
    if(quantum===2){while(index<bytes.length&&(bytes[index]===10||bytes[index]===13))index++;if(index===bytes.length)corrupt(bytes.length);if(bytes[index]!==61)corrupt(index-1);index++;}
    while(index<bytes.length&&(bytes[index]===10||bytes[index]===13))index++;
    if(index<bytes.length)corrupt(index);return;
  }
}
export function parseBase64(data:string) {
  const parts=data.split(',');
  if(parts.length!==2)throw new Error('failed to parse base64 image: invalid base64 format');
  validateBase64(parts[1]);
  const encoded=parts[1].replace(/[\r\n]/g,'');
  const contentType=['image/png','image/gif','image/webp','application/pdf'].find(type=>parts[0].includes(type)) || 'image/jpeg';
  return {bytes:Buffer.from(encoded,'base64'),contentType,extension:extensions[contentType] || '.jpg'};
}
export function originalFilename(name:string,folder:string,seconds=Math.floor(Date.now()/1000)) {
  // Go filepath.Ext on its Linux deployment: last dot in the last slash segment,
  // including leading/trailing dots. Do not lowercase or replace punctuation.
  const slash=name.lastIndexOf('/'),dot=name.lastIndexOf('.');
  const ext=dot>slash?name.slice(dot):'';
  const base=(ext?name.slice(0,-ext.length):name).replaceAll(' ','_');
  return `${folder}/${base}_${seconds}${ext}`;
}
export function extractR2Key(fileURL:string) {
  const config=getR2Configuration();
  const prefixes=[...(config.publicUrl?[config.publicUrl.replace(/\/$/,'')+'/']:[]),`https://${config.bucketName}.r2.dev/`];
  for(const prefix of prefixes) {
    if(!fileURL.startsWith(prefix))continue;
    try {
      if(new URL(fileURL).origin!==new URL(prefix).origin)continue;
      const key=fileURL.slice(prefix.length);
      if(key && !/[?#\\]/.test(key) && !key.split('/').some(part=>!part||['.','..'].includes(decodeURIComponent(part))||decodeURIComponent(part).includes('/')||decodeURIComponent(part).includes('\\'))) return key;
    }catch{/* Reject malformed/lookalike URLs before sending a DeleteObject. */}
  }
  throw new Error('invalid file URL');
}
