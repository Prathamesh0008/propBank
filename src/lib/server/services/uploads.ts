import 'server-only';
import { requireUser } from '../auth';
import { requireAdmin, requireOwnerOrAdmin } from '../permissions';
import { jsonResponse } from '../http';
import { getProperty } from './properties';
import { identity, propertyMember, readObject, knownFields } from './domain-contracts';
import { stringValue as s } from './contracts';
import { uploadFile, uploadBase64, deleteR2File, extractR2Key } from './r2-storage';

const imageTypes=['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'];
const documentTypes=['application/pdf','image/jpeg','image/png','image/gif','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain'];
const response=(success:boolean,message:string,url?:string,urls?:string[]|null)=>jsonResponse({success,message,...(url?{url}:{}),...(urls?.length?{urls}:{})},success?200:400);
function errorText(error:unknown) {return error instanceof Error?error.message:'storage failure';}
async function existingPropertyUpload(user:Awaited<ReturnType<typeof requireUser>>,id:string,member=false) {
  const property=await getProperty(id);
  // Go supports uploads before property creation; no ownership record exists yet.
  if(!property)return;
  if(member)await propertyMember(user,id);else requireOwnerOrAdmin(user,{ownerUID:s(property.ownerUID)});
}
export async function multipartUpload(request:Request,document=false) {
  const user=await identity(request);
  let form:FormData;
  try {form=await request.formData();}catch{return response(false,'Failed to parse form: invalid multipart form');}
  const field=document?'document':'image';
  const file=form.get(field);
  if(!(file instanceof File))return response(false,`Failed to get ${field} file: http: no such file`);
  const folder=s(form.get('folder'))||'uploads';
  const propertyId=s(form.get('propertyId'));
  const docType=s(form.get('docType'))||'general';
  if(document&&!propertyId)return response(false,'Property ID is required');
  const types=document?documentTypes:imageTypes;
  if(!types.some(type=>file.type.startsWith(type)))return response(false,document?'Invalid file type. Only PDF, images, and common document formats are allowed.':'Invalid file type. Only images are allowed.');
  if(document)await existingPropertyUpload(user,propertyId,true);
  else {const match=/^properties\/([^/]+)(?:\/|$)/.exec(folder);if(match)await existingPropertyUpload(user,match[1]);}
  try {return response(true,document?'Document uploaded successfully':'Image uploaded successfully',await uploadFile(file,document?`documents/${propertyId}/${docType}`:folder));}
  catch(error){return response(false,`Failed to upload ${field}: ${errorText(error)}`);}
}
async function uploadBody(request:Request,fields:string[]) {
  const req=knownFields(await readObject(request),fields);
  for(const key of fields.filter(f=>f!=='images'))if(req[key]!=null&&typeof req[key]!=='string')throw new Error(`json: invalid ${key}`);
  if(req.images!=null&&(!Array.isArray(req.images)||req.images.some(image=>image!==null&&typeof image!=='string')))throw new Error('json: invalid images');
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
    const urls:string[]=[];
    for(const [index,image] of images.entries()) {
      if(!image)continue;
      if(image.startsWith('http://')||image.startsWith('https://')){urls.push(image);continue;}
      try {urls.push(await uploadBase64(image,`properties/${s(req.propertyId)}`,`image_${index+1}`));}catch{/* Go skips individual failures. */}
    }
    return response(true,`Successfully uploaded ${urls.length} images`,undefined,urls);
  }
  if(!req.image)return response(false,'Image data is required');
  const image=s(req.image);
  if(kind==='service-request-image') {
    if(image.startsWith('http://')||image.startsWith('https://'))return response(true,'Image uploaded successfully',image);
    try {return response(true,'Image uploaded successfully',await uploadBase64(image,`service-requests/${s(req.requestId)||'request_1000000000'}`,'image'));}catch(error){return response(false,`Failed to upload image: ${errorText(error)}`);}
  }
  const folder=s(req.folder)||'uploads',identifier=s(req.identifier)||'image';
  const property=/^properties\/([^/]+)(?:\/|$)/.exec(folder);
  if(property)await existingPropertyUpload(user,property[1]);
  try {return response(true,'Image uploaded successfully',await uploadBase64(image,folder,identifier));}catch(error){return response(false,`Failed to upload image: ${errorText(error)}`);}
}
export async function deleteFile(request:Request) {
  const user=await identity(request);
  let req:Awaited<ReturnType<typeof uploadBody>>;
  try {req=await uploadBody(request,['url']);}catch(error){return response(false,`Invalid request body: ${errorText(error)}`);}
  if(!req.url)return response(false,'File URL is required');
  let key:string;
  try {key=extractR2Key(s(req.url));}catch(error){return response(false,`Failed to delete file: ${errorText(error)}`);}
  const match=/^(?:properties|documents)\/([^/]+)\//.exec(key);
  if(match) {
    const property=await getProperty(match[1]);
    if(property)requireOwnerOrAdmin(user,{ownerUID:s(property.ownerUID)});else requireAdmin(user);
  }else requireAdmin(user); // Go has no uploader ownership metadata for generic keys.
  try {await deleteR2File(s(req.url));return response(true,'File deleted successfully');}catch(error){return response(false,`Failed to delete file: ${errorText(error)}`);}
}
