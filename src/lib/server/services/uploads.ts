import 'server-only';
import { requireUser } from '../auth';
import { requireAdmin, requireOwnerOrAdmin } from '../permissions';
import { ApiError, jsonResponse } from '../http';
import { getDatabase, COLLECTIONS } from '../firestore';
import { getProperty } from './properties';
import { identity, propertyMember, readObject, knownFields } from './domain-contracts';
import { stringValue as s } from './contracts';
import {stageFile,stageBase64,prepareFile,cleanupMedia} from './media';
import {mediaId} from '../file-projection';

const imageTypes=['image/jpeg','image/png','image/gif','image/webp'];
const documentTypes=['application/pdf','image/jpeg','image/png','image/gif','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'];
const supportingDocumentTypes=['rental_agreement','rent_receipt','property_supporting_document'];
const supportingMimeTypes=['application/pdf','image/jpeg','image/png','image/webp'];
const response=(success:boolean,message:string,url?:string,urls?:string[]|null)=>jsonResponse({success,message,...(url?{url}:{}),...(urls?.length?{urls}:{})},success?200:400);
function errorText(_error:unknown) {return 'Invalid data or storage operation failed';}
function safePath(path:string) {
  if(!path || path.length>512 || /[\\%?#]/.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new ApiError(400,'Invalid upload path');
  return path;
}
async function existingPropertyUpload(user:Awaited<ReturnType<typeof requireUser>>,id:string,member=false) {
  const property=await getProperty(id);
  safePath(id);
  if(!property)throw new ApiError(404,'Property not found; use a personal upload folder before creating a property');
  if(member)await propertyMember(user,id);else requireOwnerOrAdmin(user,{ownerUID:s(property.ownerUID)});
}
async function uploadFolder(user:Awaited<ReturnType<typeof identity>>,folder:string) {
  safePath(folder);const [namespace,id]=folder.split('/');
  if(namespace==='properties'&&!id)return `uploads/${user.uid}/properties`;
  if(namespace==='properties'||namespace==='documents') {if(!id)throw new ApiError(400,'Property ID required in upload folder');await existingPropertyUpload(user,id,namespace==='documents');return folder;}
  if(namespace==='banners'){requireAdmin(user);return folder;}
  if(namespace==='service-requests'&&id) {
    const doc=await getDatabase().collection(COLLECTIONS.serviceRequests).doc(id).get();
    if(!doc.exists||user.role!=='admin'&&doc.data()?.userUID!==user.uid)throw new ApiError(403,'Service request upload access required');return folder;
  }
  if(namespace==='uploads'&&id===user.uid)return folder;
  // Generic pre-creation uploads are isolated under the authenticated uploader.
  return `uploads/${user.uid}/${folder}`;
}
export async function multipartUpload(request:Request,document=false) {
  const user=await identity(request);
  let form:FormData;
  try {
    const chunks:Uint8Array[]=[];let length=0;const reader=request.body?.getReader();
    if(reader)for(;;){const next=await reader.read();if(next.done)break;length+=next.value.byteLength;if(length>21*1024*1024){await reader.cancel();throw new ApiError(413,'Multipart upload exceeds 21 MiB');}chunks.push(next.value);}
    form=await new Request(request.url,{method:'POST',headers:request.headers,body:Buffer.concat(chunks)}).formData();
  }catch(error){if(error instanceof ApiError)throw error;return response(false,'Failed to parse form: invalid multipart form');}
  const field=document?'document':'image';
  const file=form.get(field);
  if(!(file instanceof File))return response(false,`Failed to get ${field} file: http: no such file`);
  const folder=s(form.get('folder'))||'uploads';
  const propertyId=s(form.get('propertyId'));
  const docType=s(form.get('docType'))||'general';
  if(document&&!propertyId)return response(false,'Property ID is required');
  const types=document?documentTypes:imageTypes;
  if(!types.includes(file.type))return response(false,document?'Invalid file type. Only PDF, images, and common document formats are allowed.':'Invalid file type. Only images are allowed.');
  if(file.size>(20<<20))return response(false,'File exceeds 20 MiB');
  if(document&&supportingDocumentTypes.includes(docType)&&(!supportingMimeTypes.includes(file.type)||file.size>5*1024*1024))return response(false,'Supporting documents must be PDF, JPG, PNG or WebP files no larger than 5 MB.');
  if(document)await existingPropertyUpload(user,propertyId,true);
  safePath(docType);
  const target=document?`documents/${propertyId}/${docType}`:await uploadFolder(user,folder);
  try {return response(true,document?'Document uploaded successfully':'Image uploaded successfully',await stageFile(Buffer.from(await file.arrayBuffer()),file.type,file.name,user,document?propertyId:(target.match(/^(?:documents|properties)\/([^/]+)/)?.[1]||''),!document&&(folder==='properties'||folder.startsWith('properties/')||folder==='banners')));}
  catch(error){if(error instanceof ApiError)throw error;return response(false,`Failed to upload ${field}: ${errorText(error)}`);}
}
async function uploadBody(request:Request,fields:string[]) {
  const req=knownFields(await readObject(request),fields);
  for(const key of fields.filter(f=>f!=='images'))if(req[key]!=null&&typeof req[key]!=='string')throw new Error(`json: invalid ${key}`);
  if(req.images!=null&&(!Array.isArray(req.images)||req.images.length>50||req.images.some(image=>image!==null&&typeof image!=='string')))throw new Error('json: invalid images');
  return req;
}
export async function base64Upload(request:Request,kind:'image'|'property-images'|'service-request-image') {
  const user=await identity(request);
  let req:Awaited<ReturnType<typeof uploadBody>>;
  try {req=await uploadBody(request,kind==='image'?['image','folder','identifier']:kind==='property-images'?['images','propertyId']:['image','requestId']);}catch(error){return response(false,`Invalid request body: ${errorText(error)}`);}
  if(kind==='property-images') {
    if(!req.propertyId)return response(false,'Property ID is required');
    const images=(req.images as Array<string|null>|null)||[];
    if(!images.length)return response(false,'At least one image is required');
    await existingPropertyUpload(user,s(req.propertyId));
    const urls:string[]=[],staged:string[]=[],failures:number[]=[];
    for(const [index,image] of images.entries()) {
      try {if(!image)throw new Error('Empty image');const url=await prepareFile(image,user,s(req.propertyId),`image_${index+1}`,undefined,true);urls.push(url);if(image.startsWith('data:'))staged.push(url);}catch{failures.push(index);}
    }
    if(failures.length){for(const url of staged){const id=mediaId(url);if(id)try{await cleanupMedia(id,user,true);}catch{/* Durable cleanup intent is retained. */}}return jsonResponse({success:false,message:`${failures.length} of ${images.length} images failed. No images were attached; please retry.`,failedIndices:failures,urls:[]},502);}
    return response(true,`Successfully uploaded ${urls.length} images`,undefined,urls);
  }
  if(!req.image)return response(false,'Image data is required');
  const image=s(req.image);
  if(kind==='service-request-image') {

    const folder=req.requestId?await uploadFolder(user,`service-requests/${s(req.requestId)}`):`uploads/${user.uid}/service-requests`;
    try {return response(true,'Image uploaded successfully',await prepareFile(image,user,'','image'));}catch(error){if(error instanceof ApiError)throw error;return response(false,`Failed to upload image: ${errorText(error)}`);}
  }
  const folder=await uploadFolder(user,s(req.folder)||'uploads'),identifier=s(req.identifier)||'image';
  try {return response(true,'Image uploaded successfully',await stageBase64(image,user,folder.match(/^(?:documents|properties)\/([^/]+)/)?.[1]||'',identifier,(s(req.folder)==='properties'||s(req.folder).startsWith('properties/')||s(req.folder)==='banners')&&identifier!=='internal'));}catch(error){if(error instanceof ApiError)throw error;return response(false,`Failed to upload image: ${errorText(error)}`);}
}
export async function deleteFile(request:Request) {
  const user=await identity(request);
  let req:Awaited<ReturnType<typeof uploadBody>>;
  try {req=await uploadBody(request,['url']);}catch(error){return response(false,`Invalid request body: ${errorText(error)}`);}
  if(!req.url)return response(false,'File URL is required');
  const id=mediaId(req.url);
  if(!id)throw new ApiError(409,'Legacy file removal requires the approved migration process');
  await cleanupMedia(id,user,true);
  return response(true,'File deleted successfully');
}
