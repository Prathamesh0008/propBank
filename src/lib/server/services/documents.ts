import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { AccessError } from '../auth';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, wireValue, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readObject, getRecord, getRecords, epoch, parseRFC3339 } from './domain-contracts';
import { getUser } from './users';
import { getProperty } from './properties';
import { bestEffort } from './property-effects';
import {prepareFile,saveMediaRecord,deleteDocumentMedia,filePropertyRelationships,cleanupMedia} from './media';
import {requirePropertyMember} from '../permissions';
import {mediaId} from '../file-projection';
const collection=()=>getDatabase().collection(COLLECTIONS.documents);
const supportingTypes=['rental_agreement','rent_receipt','property_supporting_document'];
const supportingMimeTypes=['application/pdf','image/jpeg','image/png','image/webp'];
const failure=(message:string,status:number)=>jsonResponse({success:false,message},status);
export async function createDocument(request:Request) {
  const user=await identity(request,true);let req:RecordData;let idempotencyKey='';
  try{const body=await readObject(request,20<<20);req={...model('CreateDocumentRequest',body,true)};for(const key of ['financialYear','period','amount','status','receiptDate'])if(key in body){if(typeof body[key]!=='string')throw new Error();req[key]=body[key];}if('idempotencyKey'in body){if(typeof body.idempotencyKey!=='string')throw new Error();idempotencyKey=body.idempotencyKey;}}catch{return failure('Invalid request body',400);}
  for(const [key,label]of [['propertyId','PropertyID'],['documentName','DocumentName'],['documentType','DocumentType'],['fileUrl','FileURL']])if(!req[key])return failure(`${label} is required`,400);
  if(s(req.documentName).trim().length>150||s(req.description).length>1000)return failure('Document name or description exceeds the allowed length',400);
  if(s(req.documentType).length>80||!/^[A-Za-z0-9 _-]+$/.test(s(req.documentType)))return failure('Document type is invalid',400);
  if(idempotencyKey&&!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey))return failure('Document request key is invalid',400);
  const hasReportMetadata=['financialYear','period','amount','receiptDate'].some(key=>key in req);
  const reportType=['tds_report','payment_receipt'].includes(s(req.documentType));
  if(hasReportMetadata&&!reportType)return failure('Report metadata is not valid for this document type',400);
  if(reportType) {
    if(s(req.financialYear).length>80||s(req.period).length>80)return failure('Report metadata exceeds the allowed length',400);
    if(req.amount&&(!/^\d+(?:\.\d{1,2})?$/.test(s(req.amount))||Number(req.amount)<0))return failure('Reported amount is invalid',400);
    if(req.receiptDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(s(req.receiptDate))||!parseRFC3339(`${s(req.receiptDate)}T00:00:00Z`)))return failure('Receipt date is invalid',400);
  }
  const profile=await getUser(user.uid);if(!profile)return failure('User not found: user not found',404);
  const property=await propertyMember(user,s(req.propertyId));if(!property)return failure('Property not found: property not found',404);
  if(req.status&&!['submitted','verified','rejected'].includes(s(req.status)))return failure('Invalid document status',400);
  if(user.role!=='admin')req.status='submitted';
  const documentId=idempotencyKey?createHash('sha256').update(`${user.uid}:${s(req.propertyId)}:${idempotencyKey}`).digest('hex'):randomUUID();
  const prior=await collection().doc(documentId).get();
  if(prior.exists){
    const existing:RecordData={...prior.data(),id:prior.id};
    if(existing.userId!==user.uid||existing.propertyId!==req.propertyId)throw new AccessError(403,'Document request does not belong to this account');
    const staged=mediaId(req.fileUrl);if(staged&&req.fileUrl!==existing.fileUrl)try{await cleanupMedia(staged,user,true);}catch{/* Durable cleanup state remains available to reconciliation. */}
    return jsonResponse({success:true,message:'Document already uploaded',document:wireValue(existing)},200);
  }
  let url=s(req.fileUrl);
  url=await prepareFile(url,user,s(req.propertyId),s(req.documentName));
  const now=new Date();const document=model('Document',{...req,id:documentId,fileUrl:url,userId:user.uid,userName:profile.name,propertyTitle:property.title,createdAt:now,updatedAt:now});
  const asset=await getDatabase().collection('storage_objects').doc(mediaId(url)!).get();
  if(!asset.exists)return failure('Uploaded file is unavailable',400);
  const contentType=s(asset.data()?.contentType),size=Number(asset.data()?.size||0);
  if(supportingTypes.includes(s(req.documentType))){
    if(!supportingMimeTypes.includes(contentType)||size<=0||size>5*1024*1024){const staged=mediaId(url);if(staged)try{await cleanupMedia(staged,user,true);}catch{}return failure('Supporting documents must be PDF, JPG, PNG or WebP files no larger than 5 MB',400);}
    const existing=await collection().where('propertyId','==',s(req.propertyId)).get(),supporting=existing.docs.filter(doc=>supportingTypes.includes(s(doc.data().documentType)));
    const total=supporting.reduce((sum,doc)=>sum+Number(doc.data().size||0),0)+size;
    if(supporting.length>=5||total>20*1024*1024){const staged=mediaId(url);if(staged)try{await cleanupMedia(staged,user,true);}catch{}return failure(supporting.length>=5?'A property can have up to 5 supporting documents':'Supporting documents must total 20 MB or less',400);}
  }
  const metadata:RecordData={contentType,size,...(idempotencyKey?{idempotencyKey}:{}),...Object.fromEntries(['financialYear','period','amount','status','receiptDate'].filter(key=>key in req).map(key=>[key,req[key]]))};
  await saveMediaRecord(COLLECTIONS.documents,s(document.id),{...storeModel('Document',document),...metadata},user,true);
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
  if(Object.keys(req).some(key=>!['status','comment'].includes(key))||!['submitted','verified','rejected'].includes(s(req.status))||req.comment!==undefined&&(typeof req.comment!=='string'||req.comment.length>2000))throw new ApiError(400,'Invalid document status/comment');
  const ref=collection().doc(id);
  await getDatabase().runTransaction(async tx=>{const snapshot=await tx.get(ref);if(!snapshot.exists)throw new ApiError(404,'Document not found');const before=snapshot.data()!,now=new Date();tx.update(ref,{status:req.status,adminComment:s(req.comment),updatedAt:now,statusHistory:[...(Array.isArray(before.statusHistory)?before.statusHistory:[]),{status:req.status,comment:s(req.comment),actorUID:user.uid,at:now}]});});
  return jsonResponse({success:true,message:'Document report updated successfully'});
}
export async function deleteDocument(request:Request,id:string) {
  const user=await identity(request);const document=await getRecord(COLLECTIONS.documents,id,'Document');if(!document)return failure('Document not found: document not found',404);
  const property=await getProperty(s(document.propertyId));
  if(!await propertyMember(user,s(document.propertyId)))throw new AccessError(403,'Property access required');
  if(user.role!=='admin'&&user.uid!==document.userId&&user.uid!==property?.ownerUID)throw new AccessError(403,'Document access required');
  const managed=mediaId(document.fileUrl);
  if(managed){await deleteDocumentMedia(managed,id,user);return jsonResponse({success:true,message:'Document and stored file deleted successfully'});}
  // Historical files require an approved migration, never arbitrary URL-based deletion.
  await getDatabase().runTransaction(async tx=>{
    const ref=collection().doc(id),fresh=await tx.get(ref);if(!fresh.exists)return;
    const current=fresh.data()!,property=await tx.get(getDatabase().collection(COLLECTIONS.properties).doc(s(current.propertyId)));
    if(!property.exists)throw new AccessError(403,'Property access required');
    requirePropertyMember(user,filePropertyRelationships(property.data()!));
    if(user.role!=='admin'&&user.uid!==current.userId&&user.uid!==property.data()?.ownerUID)throw new AccessError(403,'Document deletion access required');
    tx.create(getDatabase().collection('legacy_storage_cleanup').doc(id),{documentId:id,propertyId:current.propertyId,fileUrl:current.fileUrl||'',status:'approval_required',requestedBy:user.uid,createdAt:new Date()});
    tx.delete(ref);
  });
  return jsonResponse({success:true,message:'Document metadata removed',warning:'Historical object revocation is pending an approved storage migration'});
}
