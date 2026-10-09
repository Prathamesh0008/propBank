import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { AccessError } from '../auth';
import { jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readModel, getRecord, getRecords, epoch } from './domain-contracts';
import { getUser } from './users';
import { getProperty } from './properties';
import { bestEffort } from './property-effects';
import { uploadBase64, deleteR2File } from './r2-storage';
const collection=()=>getDatabase().collection(COLLECTIONS.documents);
const failure=(message:string,status:number)=>jsonResponse({success:false,message},status);
export async function createDocument(request:Request) {
  const user=await identity(request,true);let req:RecordData;
  try{req=await readModel(request,'CreateDocumentRequest',20<<20);}catch(error){return failure(`Invalid request body: ${error instanceof Error?error.message:'Invalid JSON'}`,400);}
  for(const [key,label]of [['propertyId','PropertyID'],['documentName','DocumentName'],['documentType','DocumentType'],['fileUrl','FileURL']])if(!req[key])return failure(`${label} is required`,400);
  const profile=await getUser(user.uid);if(!profile)return failure('User not found: user not found',404);
  const property=await propertyMember(user,s(req.propertyId));if(!property)return failure('Property not found: property not found',404);
  let url=s(req.fileUrl);
  if(!/^https?:\/\//.test(url)) {
    const identifier=`${s(req.documentName).replace(/[ /\\]/g,'_')}_${s(req.documentType)}`;
    try{url=await uploadBase64(url,`documents/${s(req.propertyId)}`,identifier);}catch(error){return failure(`Failed to upload file to Storage: ${error instanceof Error?error.message:'failed to upload to R2'}`,500);}
  }
  const now=new Date();const document=model('Document',{...req,id:randomUUID(),fileUrl:url,userId:user.uid,userName:profile.name,propertyTitle:property.title,createdAt:now,updatedAt:now});
  await collection().doc(s(document.id)).set(storeModel('Document',document));
  return jsonResponse({success:true,message:'Document uploaded successfully',document:wireModel('Document',document)},201);
}
export async function listDocuments(request:Request,propertyId:string) {
  if(!propertyId)return failure('Property ID is required',400);
  const user=await identity(request);if(!await propertyMember(user,propertyId))return failure('Property not found: property not found',404);
  let documents:RecordData[];
  try{documents=await getRecords(collection().where('propertyId','==',propertyId),'Document');}catch{return jsonResponse({success:false,message:'Failed to fetch documents: failed to iterate documents',documents:[]},500);}
  documents.sort((a,b)=>epoch(b.createdAt)-epoch(a.createdAt));return jsonResponse({success:true,documents:documents.length?documents.map(d=>wireModel('Document',d)):null});
}
export async function getDocument(request:Request,id:string) {
  const user=await identity(request);const document=await getRecord(COLLECTIONS.documents,id,'Document');if(!document)return plainError('Document not found',404);
  if(!await propertyMember(user,s(document.propertyId)))throw new AccessError(403,'Property access required');
  return jsonResponse({success:true,document:wireModel('Document',document)});
}
export async function deleteDocument(request:Request,id:string) {
  const user=await identity(request);const document=await getRecord(COLLECTIONS.documents,id,'Document');if(!document)return failure('Document not found: document not found',404);
  const property=await getProperty(s(document.propertyId));
  if(user.role!=='admin'&&user.uid!==document.userId&&user.uid!==property?.ownerUID)throw new AccessError(403,'Document access required');
  if(document.fileUrl)await bestEffort(()=>deleteR2File(s(document.fileUrl)));
  await collection().doc(id).delete();return jsonResponse({success:true,message:'Document deleted successfully'});
}
