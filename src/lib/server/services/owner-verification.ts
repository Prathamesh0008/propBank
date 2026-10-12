import 'server-only';
import { requireUser } from '../auth';
import { requireAdmin } from '../permissions';
import { getFirebaseAdminAuth } from '../firebase-admin';
import { COLLECTIONS, getDatabase } from '../firestore';
import { ApiError, jsonResponse } from '../http';
import { readObject } from './domain-contracts';

export async function verifyPropertyOwner(request:Request) {
  const actor=await requireUser(request);requireAdmin(actor);
  const raw=await readObject(request,8192);
  for(const key of ['propertyId','ownerUID','evidenceDocumentId','reviewNote'])
    if(typeof raw[key]!=='string'||!raw[key].trim()||raw[key].length>2000)throw new ApiError(400,'Property, owner UID, evidence document and review note are required');
  const body=raw as Record<string,string>;
  if([body.propertyId,body.ownerUID,body.evidenceDocumentId].some(value=>value.includes('/')))throw new ApiError(400,'Invalid identifier');
  let identity;
  try { identity=await getFirebaseAdminAuth().getUser(body.ownerUID); }
  catch(error) {if((error as {code?:string}).code==='auth/user-not-found')throw new ApiError(400,'Owner account does not exist');throw error;}
  if(identity.disabled||!identity.email||!identity.emailVerified)throw new ApiError(400,'Owner requires an active account with verified Firebase email');
  const db=getDatabase(),ref=db.collection(COLLECTIONS.properties).doc(body.propertyId);
  await db.runTransaction(async tx=>{
    const property=await tx.get(ref);
    if(!property.exists)throw new ApiError(404,'Property not found');
    const p=property.data()!;
    if(p.createdAs!=='tenant'||p.ownershipVerification!=='pending'||p.ownerUID)throw new ApiError(409,'Property is not awaiting owner verification');
    if(p.submittedByUID===identity.uid||(p.tenants||[]).some((t:{userUID?:string;isActive?:boolean})=>t.isActive===true&&t.userUID===identity.uid))throw new ApiError(400,'An active tenant cannot be linked as this property owner');
    const profile=await tx.get(db.collection(COLLECTIONS.users).doc(identity.uid));
    if(!profile.exists||profile.data()?.isActive===false)throw new ApiError(400,'Owner must have an active platform profile');
    const evidence=await tx.get(db.collection(COLLECTIONS.documents).doc(body.evidenceDocumentId));
    if(!evidence.exists||evidence.data()?.propertyId!==body.propertyId)throw new ApiError(400,'Evidence document must belong to this property');
    const tenants=await tx.get(db.collection(COLLECTIONS.tenants).where('propertyId','==',body.propertyId));
    const now=new Date(),owner=profile.data()!;
    tx.update(ref,{ownerUID:identity.uid,ownerEmail:identity.email,ownerName:owner.name||identity.displayName||'',ownerPhone:owner.phoneNumber||'',ownerRole:owner.role||'',ownershipVerification:'verified',ownershipVerificationAudit:{actorUID:actor.uid,ownerUID:identity.uid,evidenceDocumentId:body.evidenceDocumentId,reviewNote:body.reviewNote.trim(),verifiedAt:now},updatedAt:now});
    for(const tenant of tenants.docs)tx.update(tenant.ref,{ownerUID:identity.uid,updatedAt:now});
  });
  return jsonResponse({success:true,message:'Owner verified and linked. Tenant relationships preserved.'});
}
