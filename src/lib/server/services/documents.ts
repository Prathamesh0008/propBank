import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { AccessError } from '../auth';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, wireValue, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readObject, getRecord, getRecords, epoch } from './domain-contracts';
import { getUser } from './users';
import { getProperty } from './properties';
import { bestEffort } from './property-effects';
import { uploadBase64, deleteR2File, extractR2Key } from './r2-storage';
const collection=()=>getDatabase().collection(COLLECTIONS.documents);
const failure=(message:string,status:number)=>jsonResponse({success:false,message},status);
export async function createDocument(request:Request) {
  const user=await identity(request,true);let req:RecordData;
  try{const body=await readObject(request,20<<20);req={...model('CreateDocumentRequest',body,true)};for(const key of ['financialYear','period','amount','status','receiptDate'])if(key in body){if(typeof body[key]!=='string')throw new Error();req[key]=body[key];}}catch{return failure('Invalid request body',400);}
  for(const [key,label]of [['propertyId','PropertyID'],['documentName','DocumentName'],['documentType','DocumentType'],['fileUrl','FileURL']])if(!req[key])return failure(`${label} is required`,400);
  const profile=await getUser(user.uid);if(!profile)return failure('User not found: user not found',404);
  const property=await propertyMember(user,s(req.propertyId));if(!property)return failure('Property not found: property not found',404);
  if(req.status&&!['submitted','verified','rejected'].includes(s(req.status)))return failure('Invalid document status',400);
  if(user.role!=='admin')req.status='submitted';
  let url=s(req.fileUrl);
  if(!/^https?:\/\//.test(url)) {
    const identifier=`${s(req.documentName).replace(/[ /\\]/g,'_')}_${s(req.documentType)}`;
    try{url=await uploadBase64(url,`documents/${s(req.propertyId)}`,identifier);}catch{return failure('Failed to upload file to Storage',500);}
  }
  const now=new Date();const document=model('Document',{...req,id:randomUUID(),fileUrl:url,userId:user.uid,userName:profile.name,propertyTitle:property.title,createdAt:now,updatedAt:now});
  const metadata=Object.fromEntries(['financialYear','period','amount','status','receiptDate'].filter(key=>key in req).map(key=>[key,req[key]]));
  await collection().doc(s(document.id)).create({...storeModel('Document',document),...metadata});
  return jsonResponse({success:true,message:'Document uploaded successfully',document:{...wireModel('Document',document),...metadata}},201);
}
export async function listDocuments(request:Request,propertyId:string) {
  if(!propertyId)return failure('Property ID is required',400);
  const user=await identity(request);if(!await propertyMember(user,propertyId))return failure('Property not found: property not found',404);
  let documents:RecordData[];
  try{const snapshot=await collection().where('propertyId','==',propertyId).get();documents=snapshot.docs.map(doc=>({...doc.data(),id:doc.id}));}catch{return jsonResponse({success:false,message:'Failed to fetch documents',documents:[]},500);}
  const type=new URL(request.url).searchParams.get('documentType');if(type)documents=documents.filter(d=>d.documentType===type);
  documents.sort((a,b)=>epoch(b.createdAt)-epoch(a.createdAt));return jsonResponse({success:true,documents:documents.length?documents.map(wireValue):null});
}
export async function getDocument(request:Request,id:string) {
  const user=await identity(request);const snapshot=await collection().doc(id).get();const document:RecordData|null=snapshot.exists?{...snapshot.data(),id}:null;if(!document)return plainError('Document not found',404);
  if(!await propertyMember(user,s(document.propertyId)))throw new AccessError(403,'Property access required');
  return jsonResponse({success:true,document:wireValue(document)});
}
export async function updateDocument(request:Request,id:string) {
  const user=await identity(request);if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
  let req:RecordData;try{req=await readObject(request,8192);}catch{throw new ApiError(400,'Invalid document update');}
  if(!['submitted','verified','rejected'].includes(s(req.status))||req.comment!==undefined&&typeof req.comment!=='string')throw new ApiError(400,'Invalid document status/comment');
  const ref=collection().doc(id);
  await getDatabase().runTransaction(async tx=>{const snapshot=await tx.get(ref);if(!snapshot.exists)throw new ApiError(404,'Document not found');const before=snapshot.data()!,now=new Date();tx.update(ref,{status:req.status,adminComment:s(req.comment),updatedAt:now,statusHistory:[...(Array.isArray(before.statusHistory)?before.statusHistory:[]),{status:req.status,comment:s(req.comment),actorUID:user.uid,at:now}]});});
  return jsonResponse({success:true,message:'Document report updated successfully'});
}
export async function deleteDocument(request:Request,id:string) {
  const user=await identity(request);const document=await getRecord(COLLECTIONS.documents,id,'Document');if(!document)return failure('Document not found: document not found',404);
  const property=await getProperty(s(document.propertyId));
  if(!await propertyMember(user,s(document.propertyId)))throw new AccessError(403,'Property access required');
  if(user.role!=='admin'&&user.uid!==document.userId&&user.uid!==property?.ownerUID)throw new AccessError(403,'Document access required');
  if(document.fileUrl)await bestEffort(async()=>{const key=extractR2Key(s(document.fileUrl));if(key.startsWith(`documents/${s(document.propertyId)}/`)||key.startsWith(`uploads/${s(document.userId)}/`))await deleteR2File(s(document.fileUrl));});
  await collection().doc(id).delete();return jsonResponse({success:true,message:'Document deleted successfully'});
}
