import {publicListing} from '../../listing-policy';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {GetObjectCommand,PutObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
import type {Transaction} from 'firebase-admin/firestore';
import {getDatabase} from '../firestore';
import {getR2Client,getR2Configuration} from '../r2';
import {getFirebaseAdminAuth,getFirebaseAdminStorage} from '../firebase-admin';
import {requireUser,userFromToken,AccessError,type AuthenticatedUser} from '../auth';
import {ApiError,jsonResponse} from '../http';
import {requireAdmin,requirePropertyMember} from '../permissions';
import {fileFields,mediaId,restoreFileReferences} from '../file-projection';
import {parseBase64,extractR2Key} from './r2-storage';

export const MEDIA_COLLECTION='storage_objects';
type RecordData=FirebaseFirestore.DocumentData;
export interface Binding {collection:string;id:string;propertyId:string;field:string}
const files=()=>getDatabase().collection(MEDIA_COLLECTION);
const maxBytes=20*1024*1024;
export function privateBucket() {
  const bucket=process.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME;
  if(!bucket||bucket===getR2Configuration().bucketName)throw new ApiError(503,'A separate private file bucket must be configured before uploading files');
  return bucket;
}
export function fileUrl(id:string,contentType=''){return `/api/media/${id}${contentType==='application/pdf'?'#file.pdf':''}`;}
export async function stageFile(bytes:Buffer,contentType:string,filename:string,user:AuthenticatedUser,propertyId='',listingCandidate=false) {
  if(!bytes.length||bytes.length>maxBytes)throw new ApiError(400,'File must contain 1 byte to 20 MiB');
  const allowed=['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if(!allowed.includes(contentType))throw new ApiError(400,'Unsupported file type');
  const bucket=privateBucket(),ref=files().doc(randomUUID()),key=`managed/${ref.id}`;
  const record={id:ref.id,bucket,key,uploadedBy:user.uid,propertyId,filename:filename.replace(/[^a-zA-Z0-9_. -]/g,'_').slice(0,150)||'file',contentType,size:bytes.length,createdAt:new Date(),updatedAt:new Date(),status:'uploading',privateOnly:!listingCandidate||!contentType.startsWith('image/'),bindings:[]};
  // Durable intent precedes the external write. Even a crash after Put leaves a reconcilable entry.
  await ref.create(record);
  try {
    await getR2Client().send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:contentType,CacheControl:'private, no-store',Metadata:{uploadedBy:user.uid,mediaId:ref.id}}),{abortSignal:AbortSignal.timeout(30000)});
    await ref.update({status:'pending',updatedAt:new Date()});
  }catch {
    try{await ref.update({status:'cleanup_pending',updatedAt:new Date(),lastError:'Upload did not complete'});}catch{/* Original durable intent remains for reconciliation. */}
    throw new ApiError(502,'File upload failed; no business record was saved. Please retry');
  }
  return fileUrl(ref.id,contentType);
}
export async function stageBase64(data:string,user:AuthenticatedUser,propertyId='',filename='file',listingCandidate=false) {
  if(!/^data:(?:image\/(?:jpeg|png|gif|webp)|application\/pdf);base64,/.test(data))throw new ApiError(400,'Invalid image or PDF encoding');
  let parsed;try{parsed=parseBase64(data);}catch{throw new ApiError(400,'Invalid base64 file');}
  return stageFile(parsed.bytes,parsed.contentType,`${filename}${parsed.extension}`,user,propertyId,listingCandidate);
}
export async function prepareFile(value:string,user:AuthenticatedUser,propertyId='',filename='file',previous?:string,listingCandidate=false) {
  if(!value)return '';
  if(value.startsWith('data:'))return stageBase64(value,user,propertyId,filename,listingCandidate);
  if(mediaId(value))return value;
  if(value===previous)return value; // Keep only the same existing legacy reference, never import arbitrary URLs.
  throw new ApiError(400,'Upload the file before attaching it; external private file links are not accepted');
}
function values(data:RecordData,field:string):string[]{return (Array.isArray(data[field])?data[field]:[data[field]]).filter((v:unknown)=>typeof v==='string'&&v);}
function references(data:RecordData,fields:string[]){return fields.flatMap(field=>values(data,field).map(url=>({field,url,id:mediaId(url)}))).filter(v=>v.id);}

// All reads are performed before the returned write closure (Firestore read-before-write requirement).
export async function prepareMediaBindings(tx:Transaction,user:AuthenticatedUser,collection:string,id:string,propertyId:string,next:RecordData,before:RecordData={}) {
  const fields=fileFields[collection]||[],after=references(next,fields),old=references(before,fields);
  const ids=[...new Set([...after,...old].map(v=>v.id!))];
  const snapshots=await Promise.all(ids.map(key=>tx.get(files().doc(key))));
  const changes:Array<{ref:FirebaseFirestore.DocumentReference;data:RecordData}>=[];
  for(const snapshot of snapshots){
    const data=snapshot.data();if(!data){if(after.some(v=>v.id===snapshot.id))throw new ApiError(400,'Attached file no longer exists');continue;}
    const used=after.filter(v=>v.id===snapshot.id),bindings=(data.bindings||[]) as Binding[];
    // A concurrent reference removal must never undo a cleanup lease/tombstone.
    if(!used.length&&!['pending','attached'].includes(data.status))continue;
    const kept=bindings.filter(b=>b.collection!==collection||b.id!==id);
    if(used.length){
      if(!['pending','attached'].includes(data.status))throw new ApiError(409,'File is unavailable or being cleaned up');
      const alreadyHere=bindings.some(b=>b.collection===collection&&b.id===id);
      if(!alreadyHere&&user.role!=='admin'&&data.uploadedBy!==user.uid)throw new AccessError(403,'Only your own uploaded files can be attached');
      if(data.propertyId&&data.propertyId!==propertyId)throw new AccessError(403,'File belongs to another property');
      if(bindings.some(b=>b.propertyId!==propertyId))throw new AccessError(403,'File cannot be shared across properties');
      for(const use of used)kept.push({collection,id,propertyId,field:use.field});
      if(kept.length>50)throw new ApiError(400,'File reference limit reached');
    }
    const privateUse=used.some(use=>!(collection==='properties'&&use.field==='images'&&next.createdAs!=='tenant'&&['rent','sell','sell_rent'].includes(next.listingType)||collection==='siteSettings'&&use.field==='bannerImages'));
    changes.push({ref:files().doc(snapshot.id),data:{privateOnly:data.privateOnly===true||privateUse,propertyId:data.propertyId||propertyId,bindings:kept,status:kept.length?'attached':'pending',updatedAt:new Date()}});
  }
  return ()=>{for(const change of changes)tx.update(change.ref,change.data);};
}
export async function saveMediaRecord(collection:string,id:string,data:RecordData,user:AuthenticatedUser,create=false) {
  const db=getDatabase(),ref=db.collection(collection).doc(id);
  await db.runTransaction(async tx=>{
    const existing=await tx.get(ref),before=existing.data()||{};
    if(create&&existing.exists)throw new ApiError(409,'Record already exists');
    const bind=await prepareMediaBindings(tx,user,collection,id,String(data.propertyId||before.propertyId||''),data,before);
    bind();if(create)tx.create(ref,data);else tx.set(ref,data);
  });
}

const cookieName='propbank_media';
export async function mediaSession(request:Request) {
  const secure=process.env.NODE_ENV==='production'||new URL(request.url).protocol==='https:'?'; Secure':'';
  if(request.method==='DELETE')return new Response(null,{status:204,headers:{'Set-Cookie':`${cookieName}=; Path=/api/media; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,'Cache-Control':'no-store'}});
  let stage='authenticate';
  try{
    const user=await requireUser(request);
    if(request.method==='GET'){
      stage='verify_cookie';
      const cookie=request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if(!cookie)return jsonResponse({success:false,code:'FILE_SESSION_COOKIE_MISSING',message:'Secure file session cookie was not retained'},401);
      try{const session=await getFirebaseAdminAuth().verifySessionCookie(cookie,true);if(session.uid!==user.uid)return jsonResponse({success:false,code:'FILE_SESSION_COOKIE_MISMATCH',message:'Secure file session must be renewed'},401);}
      catch(error){if(['auth/session-cookie-expired','auth/session-cookie-revoked','auth/invalid-session-cookie','auth/argument-error','auth/user-disabled','auth/user-not-found'].includes((error as {code?:string}).code||''))return jsonResponse({success:false,code:'FILE_SESSION_COOKIE_INVALID',message:'Secure file session must be renewed'},401);throw error;}
      return new Response(null,{status:204,headers:{'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
    }
    stage='create_cookie';
    const token=request.headers.get('authorization')!.replace(/^Bearer\s+/i,'');
    const cookie=await getFirebaseAdminAuth().createSessionCookie(token,{expiresIn:20*60*1000});
    return new Response(null,{status:204,headers:{'Set-Cookie':`${cookieName}=${cookie}; Path=/api/media; HttpOnly; SameSite=Strict; Max-Age=1200${secure}`,'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'}});
  }catch(error){
    if(error instanceof AccessError)throw error;
    const rawCode=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'unknown';
    const code=/^[a-z0-9/_.-]{1,80}$/.test(rawCode)?rawCode:'unknown',reference=randomUUID();
    console.error(`private_file_session_failed ${JSON.stringify({reference,stage,code})}`);
    if(code==='auth/user-disabled')return jsonResponse({success:false,code:'ACCOUNT_DISABLED',message:'Private file access is not permitted for this account',reference},403);
    if(['auth/id-token-expired','auth/id-token-revoked','auth/user-token-expired','auth/invalid-id-token','auth/session-cookie-revoked','auth/user-not-found'].includes(code))return jsonResponse({success:false,code:'FILE_SESSION_AUTHENTICATION',message:'Sign in again to prepare secure file access',reference},401);
    const configuration=['auth/insufficient-permission','auth/invalid-credential','auth/invalid-argument','app/invalid-credential','7','permission-denied'].includes(code)||error instanceof Error&&/service.account|default credentials|project.*match|project changed/i.test(error.message);
    const temporary=['auth/network-request-failed','14','4','unavailable','deadline-exceeded'].includes(code);
    const limited=code==='auth/too-many-requests';
    return jsonResponse({success:false,code:configuration?'FILE_SESSION_CONFIGURATION':limited?'FILE_SESSION_RATE_LIMIT':temporary?'FILE_SESSION_TEMPORARY':'FILE_SESSION_UNAVAILABLE',message:'Secure file access is unavailable. Please try again or contact support.',reference},limited?429:configuration||temporary?503:500);
  }
}
async function mediaUser(request:Request) {
  if(request.headers.has('authorization'))return requireUser(request);
  const cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!cookie)throw new AccessError(401,'Sign in to download this file');
  let token;try{token=await getFirebaseAdminAuth().verifySessionCookie(cookie,true);}catch{throw new AccessError(401,'File session expired; sign in again');}
  return userFromToken(token);
}
const published=publicListing;
async function member(user:AuthenticatedUser,id:string) {
  const doc=await getDatabase().collection('properties').doc(id).get();
  if(!doc.exists)throw new ApiError(404,'Related property no longer exists');
  const p=doc.data()!;
  requirePropertyMember(user,filePropertyRelationships(p));
  return p;
}
export function filePropertyRelationships(p:RecordData) {
  return {ownerUID:p.ownerUID,tenants:(p.tenants||[]).length?p.tenants:[{email:p.tenantEmail,isActive:p.rentalStatus==='rented'}]};
}
async function canReadBinding(user:AuthenticatedUser,binding:Binding,data:RecordData) {
  if(binding.collection==='siteSettings'){requireAdmin(user);return;}
  const propertyId=binding.collection==='properties'?binding.id:String(data.propertyId||'');
  if(propertyId!==binding.propertyId)throw new AccessError(403,'File relationship changed');
  const p=propertyId?await member(user,propertyId):null;
  if(binding.collection==='admin_notifications'||binding.collection==='service_requests') {
    const requester=data.userUID||data.userId;
    if(user.role!=='admin'&&user.uid!==p?.ownerUID&&user.uid!==requester)throw new AccessError(403,'Request file access required');
  }else if(!p)throw new AccessError(403,'Property file access required');
}
async function liveBindings(data:RecordData,url:string) {
  const result:Array<{binding:Binding;data:RecordData}>=[];
  for(const b of (data.bindings||[]) as Binding[]){
    if(!fileFields[b.collection]?.includes(b.field))continue;
    const doc=await getDatabase().collection(b.collection).doc(b.id).get();
    if(doc.exists&&values(doc.data()!,b.field).some(value=>mediaId(value)===mediaId(url)))result.push({binding:b,data:doc.data()!});
  }
  return result;
}
async function bytesFromBody(body:unknown) {
  const chunks:Buffer[]=[];let size=0;
  if(!body)throw new ApiError(502,'Stored file is empty');
  for await(const chunk of body as AsyncIterable<Uint8Array>){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>maxBytes)throw new ApiError(413,'Stored file exceeds download limit');chunks.push(bytes);}
  return Buffer.concat(chunks);
}
function download(bytes:Buffer,type:string,filename:string) {
  const inline=['image/jpeg','image/png','image/gif','image/webp','application/pdf'].includes(type);
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':inline?type:'application/octet-stream','Content-Length':String(bytes.length),'Content-Disposition':`${inline?'inline':'attachment'}; filename="${filename.replace(/[^a-zA-Z0-9_. -]/g,'_')}"`,'Cache-Control':'private, no-store','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
export async function deliverMedia(request:Request,id:string) {
  if(!/^[a-f0-9-]{36}$/.test(id))throw new ApiError(404,'File not found');
  const snapshot=await files().doc(id).get(),data=snapshot.data();
  if(!data||!['pending','attached'].includes(data.status))throw new ApiError(404,'File not found');
  const bindings=await liveBindings(data,fileUrl(id));
  // A private reference vetoes public delivery, even when the same asset is also a cover/banner.
  const publicFile=data.privateOnly!==true&&bindings.length>0&&bindings.every(({binding:b,data:p})=>b.collection==='siteSettings'&&b.field==='bannerImages'||b.collection==='properties'&&b.field==='images'&&p.images?.[0]===fileUrl(id)&&published(p));
  if(!publicFile){
    const user=await mediaUser(request);
    if(!data.bindings?.length){if(user.uid!==data.uploadedBy&&user.role!=='admin')throw new AccessError(403,'Upload access required');if(data.propertyId)await member(user,data.propertyId);}
    else {let allowed=false;for(const item of bindings){try{await canReadBinding(user,item.binding,item.data);allowed=true;break;}catch(error){if(!(error instanceof AccessError))throw error;}}if(!allowed)throw new AccessError(403,'File access required');}
  }
  if(data.bucket!==privateBucket()||data.key!==`managed/${id}`)throw new ApiError(409,'Invalid managed file location');
  let object;try{object=await getR2Client().send(new GetObjectCommand({Bucket:data.bucket,Key:data.key}),{abortSignal:AbortSignal.timeout(30000)});}catch{throw new ApiError(502,'Stored file could not be downloaded');}
  if(Number(object.ContentLength)>maxBytes)throw new ApiError(413,'Stored file exceeds download limit');
  return download(await bytesFromBody(object.Body),data.contentType,data.filename);
}
export async function deliverLegacy(request:Request) {
  const user=await mediaUser(request),params=new URL(request.url).searchParams;
  const collection=params.get('resource')||'',id=params.get('id')||'',field=params.get('field')||'',index=params.get('index');
  if(!fileFields[collection]?.includes(field)||!id||id.includes('/')||index!==null&&!/^\d{1,3}$/.test(index))throw new ApiError(400,'Invalid file reference');
  const doc=await getDatabase().collection(collection).doc(id).get();if(!doc.exists)throw new ApiError(404,'File record not found');
  const data=doc.data()!,propertyId=collection==='properties'?id:String(data.propertyId||'');
  await canReadBinding(user,{collection,id,field,propertyId},data);
  const value=index===null?data[field]:data[field]?.[Number(index)];
  if(typeof value!=='string'||!value)throw new ApiError(404,'File not found');
  if(value.startsWith('data:')){const parsed=parseBase64(value);if(parsed.bytes.length>maxBytes)throw new ApiError(413,'File too large');return download(parsed.bytes,parsed.contentType,'legacy-file'+parsed.extension);}
  let key='',bucket='',gcs=false;
  try{key=extractR2Key(value);bucket=getR2Configuration().bucketName;}catch{
    let url;try{url=new URL(value);}catch{throw new ApiError(400,'Legacy file needs migration');}
    const configured=[process.env.FIREBASE_DATA_STORAGE_BUCKET,process.env.STORAGE_BUCKET,process.env.FIREBASE_STORAGE_BUCKET].filter(Boolean);
    if(url.protocol==='https:'&&url.hostname==='storage.googleapis.com'){const parts=url.pathname.slice(1).split('/');bucket=parts.shift()||'';key=parts.join('/');}
    else if(url.protocol==='https:'&&url.hostname==='firebasestorage.googleapis.com'){const match=/^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);if(match){bucket=match[1];key=decodeURIComponent(match[2]);}}
    if(!configured.includes(bucket))throw new ApiError(409,'Legacy file host is not approved; migration required');gcs=true;
  }
  if(!key||/[\\?#]/.test(key)||key.split('/').some(p=>!p||p==='.'||p==='..')||/^(?:documents|properties)\//.test(key)&&key.split('/')[1]!==propertyId)throw new AccessError(403,'Stored object belongs to another property');
  if(key.startsWith('uploads/')) {
    const uploader=key.split('/')[1],expected=collection==='properties'?(data.createdAs==='tenant'?data.submittedByUID:data.ownerUID):(data.userId||data.userUID);
    if(uploader!==expected){const profile=field==='adminImage'?await getDatabase().collection('users').doc(uploader).get():null;if(!profile?.exists||profile.data()?.role!=='admin'||profile.data()?.isActive===false)throw new AccessError(403,'Historical uploader scope does not match this record; migration review required');}
  }else if(!/^(?:documents|properties)\//.test(key))throw new AccessError(403,'Historical object has no trusted property scope; migration review required');
  try{
    if(gcs){const object=getFirebaseAdminStorage().bucket(bucket).file(key),[metadata]=await object.getMetadata();if(Number(metadata.size)>maxBytes)throw new ApiError(413,'File too large');const bytes=await bytesFromBody(object.createReadStream());return download(bytes,String(metadata.contentType||''),'legacy-file');}
    const object=await getR2Client().send(new GetObjectCommand({Bucket:bucket,Key:key}),{abortSignal:AbortSignal.timeout(30000)});if(Number(object.ContentLength)>maxBytes)throw new ApiError(413,'File too large');return download(await bytesFromBody(object.Body),String(object.ContentType||''),'legacy-file');
  }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(502,'Legacy file could not be downloaded');}
}

// Only app-created managed objects are eligible. Never delete legacy URLs or enumerate buckets.
export async function cleanupMedia(id:string,user:AuthenticatedUser,explicit=false) {
  const db=getDatabase(),ref=files().doc(id);
  const lease=randomUUID();
  const claim=await db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref),data=snapshot.data();if(!data||data.status==='deleted')return null;
    if(data.status==='deleting'&&Number(data.leaseUntil)>Date.now())throw new ApiError(409,'File cleanup is already running');
    if(user.role!=='admin'&&user.uid!==data.uploadedBy)throw new AccessError(403,'Upload deletion access required');
    const linked=await Promise.all((data.bindings||[]).map(async(b:Binding)=>({b,doc:await tx.get(db.collection(b.collection).doc(b.id))})));
    if(linked.some(({b,doc})=>doc.exists&&values(doc.data(),b.field).some(value=>mediaId(value)===id)&&!(data.deleteDocumentId&&(b.collection==='admin_notifications'||b.collection==='documents'&&b.id===data.deleteDocumentId&&doc.data().deletionStatus==='pending'))))throw new ApiError(409,'File is still attached; remove its record reference before cleanup');
    const age=Date.now()-new Date(data.updatedAt).getTime();
    if(!explicit&&age<24*3600000&&!['cleanup_pending','deleting'].includes(data.status))throw new ApiError(409,'Upload is still inside its grace period');
    if(data.bucket!==privateBucket()||data.key!==`managed/${id}`)throw new ApiError(409,'Invalid cleanup location');
    tx.update(ref,{status:'deleting',bindings:[],cleanupLease:lease,leaseUntil:Date.now()+120000,updatedAt:new Date()});return data;
  });
  if(!claim)return;
  try{await getR2Client().send(new DeleteObjectCommand({Bucket:claim.bucket,Key:claim.key}));await db.runTransaction(async tx=>{const fresh=await tx.get(ref);if(fresh.data()?.status!=='deleting'||fresh.data()?.cleanupLease!==lease)throw new ApiError(409,'Cleanup state changed');if(claim.deleteDocumentId){const dref=db.collection('documents').doc(claim.deleteDocumentId),doc=await tx.get(dref);if(doc.exists&&mediaId(doc.data()?.fileUrl)===id&&doc.data()?.deletionStatus==='pending')tx.delete(dref);}tx.update(ref,{status:'deleted',updatedAt:new Date(),lastError:''});});}
  catch{try{await db.runTransaction(async tx=>{const fresh=await tx.get(ref);if(fresh.data()?.status==='deleting'&&fresh.data()?.cleanupLease===lease)tx.update(ref,{status:'cleanup_pending',lastError:'Storage deletion pending',updatedAt:new Date()});});}catch{/* Durable deleting state remains retriable. */}throw new ApiError(502,'Storage deletion failed and is queued for reconciliation');}
}
export async function deleteDocumentMedia(id:string,documentId:string,user:AuthenticatedUser) {
  const db=getDatabase(),ref=files().doc(id),dref=db.collection('documents').doc(documentId);
  await db.runTransaction(async tx=>{
    const doc=await tx.get(dref),asset=await tx.get(ref);
    if(!doc.exists||!asset.exists)throw new ApiError(404,'Document file not found');
    const d=doc.data()!,a=asset.data()!;
    if(a.status==='deleting'&&Number(a.leaseUntil)>Date.now())throw new ApiError(409,'Document cleanup is already running');
    const property=await tx.get(db.collection('properties').doc(d.propertyId));if(!property.exists)throw new AccessError(403,'Property access required');
    requirePropertyMember(user,filePropertyRelationships(property.data()!));
    if(user.role!=='admin'&&user.uid!==d.userId&&user.uid!==property.data()?.ownerUID)throw new AccessError(403,'Document deletion access required');
    if(mediaId(d.fileUrl)!==id||a.propertyId!==d.propertyId)throw new AccessError(403,'File belongs to another property');
    if((a.bindings||[]).some((b:Binding)=>b.collection!=='admin_notifications'&&(b.collection!=='documents'||b.id!==documentId)))throw new ApiError(409,'File has another active record; resolve references before deleting');
    tx.update(dref,{deletionStatus:'pending',updatedAt:new Date()});
    tx.update(ref,{status:'cleanup_pending',deleteDocumentId:documentId,updatedAt:new Date()});
  });
  // Retryable cleanup runs under a trusted internal admin role, after the transaction's
  // explicit document/property permission check. It can delete only this exact managed ID.
  await cleanupMedia(id,{...user,role:'admin'},true);
}
export async function reconcileMedia(request:Request) {
  const user=await requireUser(request);requireAdmin(user);
  const cursor=new URL(request.url).searchParams.get('cursor')||'';
  if(cursor&&!/^[a-f0-9-]{36}$/.test(cursor))throw new ApiError(400,'Invalid reconciliation cursor');
  const base=files().orderBy('__name__').limit(100);
  const candidates=await (cursor?base.startAfter(cursor):base).get();
  const pending=candidates.docs.filter(doc=>{const d=doc.data();return d.status!=='deleted'&&(!d.bindings?.length||['cleanup_pending','deleting','uploading'].includes(d.status));}).map(doc=>({id:doc.id,status:doc.data().status,updatedAt:doc.data().updatedAt}));
  if(request.method==='GET')return jsonResponse({success:true,dryRun:true,candidates:pending,limited:candidates.docs.length===100,nextCursor:candidates.docs.length===100?candidates.docs.at(-1)!.id:null});
  let body;try{body=await request.json();}catch{throw new ApiError(400,'Invalid reconciliation request');}if(!body||!Array.isArray(body.ids)||body.ids.length>20||body.ids.some((id:unknown)=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id)))throw new ApiError(400,'Supply at most 20 managed file IDs');
  const results=[];for(const id of body.ids){try{await cleanupMedia(id,user);results.push({id,status:'deleted'});}catch(error){results.push({id,status:'retained',message:error instanceof ApiError?error.message:'Reconciliation failed'});}}
  return jsonResponse({success:results.every(r=>r.status==='deleted'),results});
}
export {restoreFileReferences};
