import 'server-only';
import { Timestamp, type Query } from 'firebase-admin/firestore';
import { COLLECTIONS, getDatabase } from '../firestore';
import { AccessError, requireUser, type AuthenticatedUser } from '../auth';
import { requirePropertyMember } from '../permissions';
import { model, isRecord, stringValue, type RecordData } from './contracts';
import { getProperty } from './properties';

export async function readObject(request:Request,maxBytes?:number):Promise<RecordData> {
  const reader=request.body?.getReader();
  const chunks:Uint8Array[]=[];
  let length=0;
  if(reader) {
    for (;;) {
      const next=await reader.read();
      if(next.done) break;
      length+=next.value.byteLength;
      if(maxBytes && length>maxBytes) {await reader.cancel();throw new Error('http: request body too large');}
      chunks.push(next.value);
    }
  }
  if(!length) throw new Error('EOF');
  const text=Buffer.concat(chunks).toString('utf8').trimStart();
  if(!text)throw new Error('EOF');
  // Go json.Decoder.Decode consumes the first value, without an EOF check.
  let end=text.length;
  if(text[0]==='{'||text[0]==='[') {
    let depth=0,quoted=false,escaped=false,complete=false;
    for(let index=0;index<text.length;index++) {
      const char=text[index];
      if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
      if(char==='"')quoted=true;
      else if(char==='{'||char==='[')depth++;
      else if(char==='}'||char===']'){depth--;if(depth===0){end=index+1;complete=true;break;}}
    }
    if(!complete)throw new Error('unexpected EOF');
  } else if(text.startsWith('null'))end=4;
  const value:unknown=JSON.parse(text.slice(0,end));
  if(value===null) return {};
  if(!isRecord(value)) throw new Error('json: expected object');
  return value;
}
export async function readModel(request:Request,name:string,maxBytes?:number) {return model(name,await readObject(request,maxBytes),true);}
export function knownFields(input:RecordData,fields:string[]):RecordData {
  const result:RecordData={};
  // Go JSON struct fields are case insensitive and ignore unknown fields.
  for(const [key,value]of Object.entries(input)){const field=fields.find(f=>f.toLowerCase()===key.toLowerCase());if(field)result[field]=value;}
  return result;
}
export async function getRecord(collection:string,id:string,name:string):Promise<RecordData|null> {
  if(!id) return null;
  const doc=await getDatabase().collection(collection).doc(id).get();
  return doc.exists?model(name,doc.data() || {}):null;
}
export async function getRecords(query:Query,name:string,fillID=false):Promise<RecordData[]> {
  const snapshot=await query.get();
  const results:RecordData[]=[];
  for(const doc of snapshot.docs) {
    try {const value=model(name,doc.data());if(fillID)value.id=doc.id;results.push(value);}catch{/* Go skips invalid documents. */}
  }
  return results;
}
export function epoch(value:unknown) {
  if(value instanceof Date) return value.getTime();
  if(isRecord(value)&&typeof value.toDate==='function') return (value.toDate() as Date).getTime();
  return Date.parse(stringValue(value));
}
export function parseRFC3339(value:unknown):Date|null {
  const text=stringValue(value);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(text))return null;
  const date=new Date(text);
  if(!Number.isFinite(date.getTime()))return null;
  // JS normalizes invalid dates such as Feb 30; Go rejects them.
  const [year,month,day]=text.slice(0,10).split('-').map(Number);
  const calendar=new Date(Date.UTC(year,month,0));
  if(month<1||month>12||day<1||day>calendar.getUTCDate())return null;
  return date;
}
export function firestoreTime(value:unknown):Date|Timestamp|null {
  const date=parseRFC3339(value);if(!date)return null;
  const fraction=/\.(\d+)/.exec(stringValue(value))?.[1]||'';
  return fraction.length>3?new Timestamp(Math.floor(date.getTime()/1000),Number(fraction.slice(0,9).padEnd(9,'0'))):date;
}
export function goTimeString(value:unknown) {
  return stringValue(value).replace(/\.(\d*?)0+(Z|[+-]\d{2}:\d{2})$/,(_,fraction:string,zone:string)=>`${fraction?'.'+fraction:''}${zone}`).replace(/\+00:00$/,'Z');
}
export async function identity(request:Request,queryFallback=false):Promise<AuthenticatedUser> {
  const user=await requireUser(request);
  const supplied=request.headers.get('X-User-ID') || (queryFallback?new URL(request.url).searchParams.get('userId'):'');
  if(supplied&&supplied!==user.uid) throw new AccessError(403,'Access denied');
  return user;
}
export async function propertyMember(user:AuthenticatedUser,id:string) {
  const property=await getProperty(id);
  if(!property) return null;
  // Reuse existing permissions, including Go's historical root tenant fields.
  const tenants=Array.isArray(property.tenants)?property.tenants:[];
  const legacy={email:stringValue(property.tenantEmail),phone:stringValue(property.mobileNumber),isActive:property.rentalStatus==='rented'};
  requirePropertyMember({...user,email:user.token.email||user.email},{ownerUID:stringValue(property.ownerUID),tenants:[...tenants,legacy] as Parameters<typeof requirePropertyMember>[1]['tenants']});
  return property;
}
export const collections=COLLECTIONS;
