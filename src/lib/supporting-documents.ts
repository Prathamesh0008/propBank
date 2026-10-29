import {apiFetch} from '@/lib/api-client';

export const SUPPORTING_DOCUMENT_TYPES={
  rental_agreement:'Rental agreement',
  rent_receipt:'Rent receipt',
  property_supporting_document:'Other supporting document',
} as const;
export type SupportingDocumentType=keyof typeof SUPPORTING_DOCUMENT_TYPES;

export const SUPPORTING_DOCUMENT_MIME_TYPES=['application/pdf','image/jpeg','image/png','image/webp'] as const;
export const SUPPORTING_DOCUMENT_MAX_FILES=5;
export const SUPPORTING_DOCUMENT_MAX_BYTES=5*1024*1024;
export const SUPPORTING_DOCUMENT_MAX_TOTAL_BYTES=20*1024*1024;

export function validateSupportingDocuments(files:File[]):string {
  if(files.length>SUPPORTING_DOCUMENT_MAX_FILES)return `Choose up to ${SUPPORTING_DOCUMENT_MAX_FILES} supporting documents.`;
  if(files.some(file=>!SUPPORTING_DOCUMENT_MIME_TYPES.includes(file.type as typeof SUPPORTING_DOCUMENT_MIME_TYPES[number])))return 'Supporting documents must be PDF, JPG, PNG or WebP files.';
  if(files.some(file=>file.size<=0||file.size>SUPPORTING_DOCUMENT_MAX_BYTES))return 'Each supporting document must be between 1 byte and 5 MB.';
  if(files.reduce((total,file)=>total+file.size,0)>SUPPORTING_DOCUMENT_MAX_TOTAL_BYTES)return 'Supporting documents must total 20 MB or less.';
  return '';
}

export async function uploadSupportingDocument(propertyId:string,file:File,documentType:SupportingDocumentType,idempotencyKey:string) {
  const form=new FormData();form.set('document',file);form.set('propertyId',propertyId);form.set('docType',documentType);
  const upload=await apiFetch('/api/upload/document',{method:'POST',body:form});
  const staged=await upload.json().catch(()=>null) as {success?:boolean;message?:string;url?:string}|null;
  if(!upload.ok||!staged?.success||!staged.url)throw new Error(staged?.message||'The file could not be uploaded. Please retry.');
  const response=await apiFetch('/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    propertyId,documentName:file.name.slice(0,150),documentType,fileUrl:staged.url,
    description:'Tenant-submitted supporting evidence for owner verification review.',idempotencyKey,
  })});
  const result=await response.json().catch(()=>null) as {success?:boolean;message?:string;document?:unknown}|null;
  if(!response.ok||!result?.success){
    await apiFetch('/api/files/staged',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:staged.url})}).catch(()=>undefined);
    throw new Error(result?.message||'The document record could not be saved. Please retry.');
  }
  return result.document;
}
