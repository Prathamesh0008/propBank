import 'server-only';
import sharp from 'sharp';
import {createHash, randomUUID} from 'node:crypto';
import {GetObjectCommand, PutObjectCommand, DeleteObjectCommand} from '@aws-sdk/client-s3';
import {requireUser} from '../auth';
import {requireAdmin} from '../permissions';
import {getDatabase} from '../firestore';
import {getR2Client, getR2Configuration} from '../r2';
import {ApiError, jsonResponse} from '../http';
import {advertisementDestination, ADVERTISEMENT_LIMIT, ACTIVE_ADVERTISEMENT_LIMIT, ADVERTISEMENT_MAX_BYTES, ADVERTISEMENT_MIME_TYPES} from '@/features/properties/property-advertisement';

export const ADVERTISEMENT_COLLECTION = 'advertisements';
const INVENTORY = '__inventory';
const LEASE_MS = 120000;
type Row = FirebaseFirestore.DocumentData;
const collection = () => getDatabase().collection(ADVERTISEMENT_COLLECTION);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function identifier(id: string) {if (!uuid.test(id)) throw new ApiError(400,'Invalid advertisement reference'); return id;}
async function admin(request: Request) {const user = await requireUser(request); requireAdmin(user); return user;}
function bucket() {
  const value = process.env.CLOUDFLARE_R2_PRIVATE_BUCKET_NAME;
  if (!value || value === getR2Configuration().bucketName) throw new ApiError(503,'A separate private R2 bucket is required for advertisements');
  return value;
}
function storageKey(id: string, key: string) {if (!new RegExp(`^advertisements/${identifier(id)}/[a-f0-9-]{36}\\.webp$`).test(key)) throw new ApiError(409,'Invalid advertisement image binding'); return key;}
function date(value: unknown) {const input = value as {toDate?:()=>Date};return input?.toDate ? input.toDate().toISOString() : value instanceof Date ? value.toISOString() : '';}
function display(row: Row) {
  return {id: row.id, imageUrl: row.image ? `/api/advertisements/${row.id}/image?v=${row.version}` : '', width: row.image?.width || 0, height: row.image?.height || 0, destinationUrl: row.destinationUrl || ''};
}
function management(row: Row) {return {...display(row),active:row.active === true,version:row.version,createdAt:date(row.createdAt),updatedAt:date(row.updatedAt),deleted:row.deleted === true,pending:!!row.pending,needsCleanup:!!row.pending || !!row.garbage?.length};}
function inventory(value: Row | undefined) {return {ids:Array.isArray(value?.ids)?value.ids as string[]:[],activeIds:Array.isArray(value?.activeIds)?value.activeIds as string[]:[]};}
async function body(request: Request, limit: number) {
  const reader = request.body?.getReader(); let total=0;const chunks:Uint8Array[]=[];
  if(reader)for(;;){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>limit){await reader.cancel();throw new ApiError(413,'Advertisement request is too large');}chunks.push(part.value);}
  return Buffer.concat(chunks);
}
async function formInput(request: Request, create: boolean) {
  let form:FormData;try{form=await new Request(request.url,{method:'POST',headers:request.headers,body:new Uint8Array(await body(request,ADVERTISEMENT_MAX_BYTES+65536))}).formData();}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,'Invalid advertisement upload');}
  for(const key of form.keys())if(!['image','active','destinationUrl','version'].includes(key)||form.getAll(key).length!==1)throw new ApiError(400,'Unexpected or duplicated advertisement field');
  let destinationUrl:string;try{destinationUrl=advertisementDestination(form.get('destinationUrl')??'');}catch(error){throw new ApiError(400,(error as Error).message);}
  const active=form.get('active');if(active!=='true'&&active!=='false')throw new ApiError(400,'Choose an active status');
  const version=Number(form.get('version'));if(!create&&(!Number.isSafeInteger(version)||version<1))throw new ApiError(400,'Advertisement version is required');
  const file=form.get('image');if(file!==null&&!(file instanceof File))throw new ApiError(400,'Choose an image file');if(create&&!file)throw new ApiError(400,'An advertisement image is required');
  let image:{bytes:Buffer;width:number;height:number;fingerprint:string}|undefined;
  if(file instanceof File){
    if(!ADVERTISEMENT_MIME_TYPES.includes(file.type as typeof ADVERTISEMENT_MIME_TYPES[number])||!file.size||file.size>ADVERTISEMENT_MAX_BYTES)throw new ApiError(400,'Choose a JPEG, PNG or WebP image up to 4 MB');
    const bytes=Buffer.from(await file.arrayBuffer());
    try{
      const metadata=await sharp(bytes,{limitInputPixels:24000000}).metadata();
      const expected={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'}[file.type];
      if(metadata.format!==expected||(metadata.pages||1)>1)throw Error('Unsupported image content');
      // Decode and re-encode; remove EXIF/GPS metadata, preserve aspect ratio.
      const output=await sharp(bytes,{limitInputPixels:24000000}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer({resolveWithObject:true});
      if(output.data.length>ADVERTISEMENT_MAX_BYTES)throw Error('Output too large');
      image={bytes:output.data,width:output.info.width,height:output.info.height,fingerprint:createHash('sha256').update(bytes).digest('hex')};
    }catch{throw new ApiError(400,'The file content must be a valid, single-frame JPEG, PNG or WebP image (maximum 24 megapixels)');}
  }
  return {destinationUrl,active:active==='true',version,image};
}

export async function listAdvertisements(request: Request, privateView=false) {
  if(privateView){
    await admin(request);const control=inventory((await collection().doc(INVENTORY).get()).data());
    const rows=await Promise.all(control.ids.slice(0,ADVERTISEMENT_LIMIT).map(id=>collection().doc(identifier(id)).get()));
    return jsonResponse({success:true,items:rows.filter(row=>row.exists).map(row=>management(row.data()!)),limit:ADVERTISEMENT_LIMIT,activeLimit:ACTIVE_ADVERTISEMENT_LIMIT});
  }
  const rows=await collection().where('active','==',true).limit(ACTIVE_ADVERTISEMENT_LIMIT).get();
  return jsonResponse({success:true,items:rows.docs.map(row=>row.data()).filter(row=>!row.deleted&&row.image).map(display)});
}

export async function saveAdvertisement(request: Request, id?: string) {
  const user=await admin(request),create=!id;
  id=identifier(id||request.headers.get('Idempotency-Key')||'');
  const input=await formInput(request,create),db=getDatabase(),ref=collection().doc(id),controlRef=collection().doc(INVENTORY);
  const fingerprint=createHash('sha256').update(JSON.stringify([input.image?.fingerprint,input.destinationUrl,input.active])).digest('hex');
  const operation=randomUUID(),key=input.image?`advertisements/${id}/${operation}.webp`:'',targetBucket=input.image?bucket():'';
  const staged=await db.runTransaction(async tx=>{
    const before=await tx.get(ref),control=inventory((await tx.get(controlRef)).data()),row=before.data();
    if(create&&row){if(row.deleted||row.createFingerprint!==fingerprint)throw new ApiError(409,'This upload request was already used; refresh before creating another advertisement');if(row.pending)throw new ApiError(409,'Upload is still pending. Refresh, or recover an interrupted upload after two minutes.');return {done:true,row};}
    if(!create&&(!row||row.deleted))throw new ApiError(404,'Advertisement not found');
    if(row?.pending)throw new ApiError(409,'An advertisement update is already pending');
    if(!create&&row!.version!==input.version)throw new ApiError(409,'Advertisement changed; refresh before saving');
    if((row?.garbage?.length||0)>=8)throw new ApiError(409,'Retry pending file cleanup before replacing this image');
    if(create&&control.ids.length>=ADVERTISEMENT_LIMIT)throw new ApiError(409,`Manage at most ${ADVERTISEMENT_LIMIT} advertisements; finish pending deletions first`);
    if(input.active&&!control.activeIds.includes(id!)&&control.activeIds.length>=ACTIVE_ADVERTISEMENT_LIMIT)throw new ApiError(409,`At most ${ACTIVE_ADVERTISEMENT_LIMIT} advertisements can be active`);
    const now=new Date();
    if(!input.image){
      const next={...row!,destinationUrl:input.destinationUrl,active:input.active,version:row!.version+1,updatedAt:now};
      tx.update(ref,{destinationUrl:next.destinationUrl,active:next.active,version:next.version,updatedAt:now});
      tx.set(controlRef,{...control,activeIds:input.active?[...new Set([...control.activeIds,id!])]:control.activeIds.filter(item=>item!==id)});return {done:true,row:next};
    }
    const pending={operation,key,bucket:targetBucket,width:input.image.width,height:input.image.height,expiresAt:now.getTime()+LEASE_MS,destinationUrl:input.destinationUrl,active:input.active};
    if(create){tx.create(ref,{id,active:false,destinationUrl:'',version:0,createdAt:now,updatedAt:now,createFingerprint:fingerprint,deleted:false,garbage:[],pending});tx.set(controlRef,{...control,ids:[...control.ids,id!]});}
    else tx.update(ref,{pending,updatedAt:now});
    return {done:false,row:row||{}};
  });
  if(staged.done)return jsonResponse({success:true,advertisement:management(staged.row)});
  try{
    await getR2Client().send(new PutObjectCommand({Bucket:targetBucket,Key:key,Body:input.image!.bytes,ContentType:'image/webp',CacheControl:'private, no-store',Metadata:{advertisementId:id,uploadedBy:user.uid}}),{abortSignal:AbortSignal.timeout(30000)});
    const result=await db.runTransaction(async tx=>{
      const row=(await tx.get(ref)).data(),control=inventory((await tx.get(controlRef)).data());
      if(!row||row.pending?.operation!==operation||row.deleted)throw new ApiError(409,'Upload was superseded; refresh the advertisements');
      if(input.active&&!control.activeIds.includes(id!)&&control.activeIds.length>=ACTIVE_ADVERTISEMENT_LIMIT)throw new ApiError(409,'Active advertisement limit reached; refresh and retry');
      const garbage=[...(row.garbage||[]),...(row.image?[{key:row.image.key,bucket:row.image.bucket,after:Date.now()}]:[])];
      const next={...row,image:{key,bucket:targetBucket,width:input.image!.width,height:input.image!.height},destinationUrl:input.destinationUrl,active:input.active,version:row.version+1,updatedAt:new Date(),pending:null,garbage};
      tx.update(ref,{image:next.image,destinationUrl:next.destinationUrl,active:next.active,version:next.version,updatedAt:next.updatedAt,pending:null,garbage});
      tx.set(controlRef,{...control,activeIds:input.active?[...new Set([...control.activeIds,id!])]:control.activeIds.filter(item=>item!==id)});return next;
    });
    await cleanup(id,false);return jsonResponse({success:true,advertisement:management((await ref.get()).data()||result)});
  }catch(error){
    // Intent was persisted before R2. A lost DB response keeps a recoverable
    // pending operation; never delete a key that might have become current.
    try{await db.runTransaction(async tx=>{const row=(await tx.get(ref)).data();if(row?.pending?.operation===operation)tx.update(ref,{pending:null,deleted:!row.image,garbage:[...(row.garbage||[]),{key,bucket:targetBucket,after:Date.now()+LEASE_MS}],updatedAt:new Date()});});}catch{/* Admin recovery retains the durable pending intent. */}
    if(error instanceof ApiError)throw error;throw new ApiError(502,'Advertisement image could not be saved. Refresh and retry pending cleanup; existing images are preserved.');
  }
}

async function cleanup(id: string, recover: boolean) {
  const db=getDatabase(),ref=collection().doc(identifier(id)),controlRef=collection().doc(INVENTORY);
  if(recover)await db.runTransaction(async tx=>{
    const row=(await tx.get(ref)).data();if(!row)throw new ApiError(404,'Advertisement not found');
    if(row.pending){if(row.pending.expiresAt>Date.now())throw new ApiError(409,'Upload is still in progress; recover it after two minutes');tx.update(ref,{pending:null,deleted:!row.image,garbage:[...(row.garbage||[]),{key:row.pending.key,bucket:row.pending.bucket,after:Date.now()}],updatedAt:new Date()});}
  });
  const row=(await ref.get()).data();if(!row)return;
  for(const object of (row.garbage||[]) as Array<{key:string;bucket:string;after:number}>){
    if(object.after>Date.now())continue;
    if(object.key===row.image?.key&&!row.deleted||object.key===row.pending?.key)continue;
    storageKey(id,object.key);if(object.bucket!==bucket())throw new ApiError(409,'Advertisement bucket binding changed');
    try{await getR2Client().send(new DeleteObjectCommand({Bucket:object.bucket,Key:object.key}),{abortSignal:AbortSignal.timeout(30000)});}catch{continue;}
    await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data();if(current)tx.update(ref,{garbage:(current.garbage||[]).filter((item:{key:string})=>item.key!==object.key)});});
  }
  await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data(),control=inventory((await tx.get(controlRef)).data());if(current?.deleted&&!current.pending&&!current.garbage?.length)tx.set(controlRef,{ids:control.ids.filter(value=>value!==id),activeIds:control.activeIds.filter(value=>value!==id)});});
}
export async function recoverAdvertisement(request: Request,id: string){await admin(request);await cleanup(identifier(id),true);const row=(await collection().doc(id).get()).data();return jsonResponse({success:true,advertisement:row?management(row):null});}
export async function deleteAdvertisement(request: Request,id: string){
  await admin(request);identifier(id);let version:number;try{version=Number(JSON.parse((await body(request,4096)).toString()).version);}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,'Advertisement version is required');}
  if(!Number.isSafeInteger(version)||version<1)throw new ApiError(400,'Advertisement version is required');
  const ref=collection().doc(id),controlRef=collection().doc(INVENTORY);
  await getDatabase().runTransaction(async tx=>{const row=(await tx.get(ref)).data(),control=inventory((await tx.get(controlRef)).data());if(!row)throw new ApiError(404,'Advertisement not found');if(row.deleted)return;if(row.pending||row.version!==version)throw new ApiError(409,'Advertisement changed or is uploading; refresh before deleting');
    tx.update(ref,{active:false,deleted:true,version:row.version+1,updatedAt:new Date(),garbage:[...(row.garbage||[]),...(row.image?[{...row.image,after:Date.now()}]:[])]});tx.set(controlRef,{...control,activeIds:control.activeIds.filter(value=>value!==id)});
  });await cleanup(id,false);return jsonResponse({success:true,advertisement:management((await ref.get()).data()!)});
}
export async function advertisementImage(request:Request,id:string){
  identifier(id);const row=(await collection().doc(id).get()).data();if(!row||row.deleted||!row.image)throw new ApiError(404,'Advertisement image unavailable');
  if(!row.active){try{await admin(request);}catch{throw new ApiError(404,'Advertisement image unavailable');}}
  const key=storageKey(id,row.image.key);if(row.image.bucket!==bucket())throw new ApiError(404,'Advertisement image unavailable');
  const object=await getR2Client().send(new GetObjectCommand({Bucket:row.image.bucket,Key:key}),{abortSignal:AbortSignal.timeout(30000)});
  if(!object.Body)throw new ApiError(404,'Advertisement image unavailable');
  const chunks:Buffer[]=[];let size=0;for await(const chunk of object.Body as AsyncIterable<Uint8Array>){size+=chunk.length;if(size>ADVERTISEMENT_MAX_BYTES)throw new ApiError(502,'Advertisement image is too large');chunks.push(Buffer.from(chunk));}
  return new Response(new Uint8Array(Buffer.concat(chunks)),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="advertisement.webp"'}});
}
