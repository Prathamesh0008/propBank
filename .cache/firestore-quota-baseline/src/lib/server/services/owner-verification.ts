import 'server-only';
import {requireUser} from '../auth';
import {requireAdmin} from '../permissions';
import {getFirebaseAdminAuth} from '../firebase-admin';
import {COLLECTIONS,getDatabase} from '../firestore';
import {ApiError,jsonResponse} from '../http';
import {readObject} from './domain-contracts';
import {stringValue as s,wireValue,type RecordData} from './contracts';
import {persistUserEvent} from './transactional-email';
import {currentConnectionState} from '@/lib/relationship-link-state';
import {LINK_COLLECTION,connectionAccountMatches} from './relationship-links';
import {bestEffort,escapeHtml} from './property-effects';
import {normalizeEmailAddress} from '@/lib/email-address';

export async function verifyPropertyOwner(request:Request) {
 const actor=await requireUser(request);requireAdmin(actor);
 let raw:RecordData;try{raw=await readObject(request,8192);}catch{throw new ApiError(400,'Invalid verification request');}
 const action=raw.action===undefined?'approve':s(raw.action);
 if(!['approve','reject','reconsider'].includes(action)||!s(raw.propertyId).trim()||s(raw.propertyId).includes('/')||s(raw.propertyId).length>2000)throw new ApiError(400,'Valid property and decision required');
 if(raw.expectedVersion!==undefined&&(!Number.isInteger(raw.expectedVersion)||Number(raw.expectedVersion)<0))throw new ApiError(400,'Invalid verification version');
 if(action!=='approve'&&raw.expectedVersion===undefined)throw new ApiError(400,'Verification version required');
 const reason=s(raw.reason).trim();
 if(('reason' in raw&&typeof raw.reason!=='string')||reason.length>2000||action==='reject'&&!reason)throw new ApiError(400,'A rejection reason is required (up to 2000 characters)');
 let identity:Awaited<ReturnType<ReturnType<typeof getFirebaseAdminAuth>['getUser']>>|undefined;
 if(action==='approve') {
  for(const key of ['ownerUID','evidenceDocumentId','reviewNote'])if(typeof raw[key]!=='string'||!s(raw[key]).trim()||s(raw[key]).length>2000)throw new ApiError(400,'Property, owner UID, evidence document and review note are required');
  if([s(raw.ownerUID),s(raw.evidenceDocumentId)].some(value=>value.includes('/')))throw new ApiError(400,'Invalid identifier');
  try{identity=await getFirebaseAdminAuth().getUser(s(raw.ownerUID));}catch(error){if((error as {code?:string}).code==='auth/user-not-found')throw new ApiError(400,'Owner account does not exist');throw error;}
  if(identity.disabled||!identity.email||!identity.emailVerified)throw new ApiError(400,'Owner requires an active account with verified Firebase email');
 }
 const db=getDatabase(),ref=db.collection(COLLECTIONS.properties).doc(s(raw.propertyId));let verification:RecordData={},notify:RecordData={};
 await db.runTransaction(async tx=>{
  if(action==='approve') {
   identity=await getFirebaseAdminAuth().getUser(s(raw.ownerUID));
   if(identity.disabled||!identity.emailVerified||!identity.email)throw new ApiError(409,'Owner identity changed; sign in and verify again');
  }
  const property=await tx.get(ref);if(!property.exists)throw new ApiError(404,'Property not found');const p=property.data()!;
  const reviewer=await tx.get(db.collection(COLLECTIONS.users).doc(actor.uid));
  if(reviewer.data()?.role!=='admin'||reviewer.data()?.isActive===false)throw new ApiError(403,'Active administrator required');
  const version=Number(p.ownershipVerificationVersion||0);
  // Preserve the original approval payload for the first legacy pending review.
  // Once any decision exists, every caller must provide its observed version.
  if((raw.expectedVersion===undefined?version!==0:raw.expectedVersion!==version))throw new ApiError(409,'Verification changed; refresh and retry');
  const requiredState=action==='reconsider'?'rejected':'pending';
  if(p.createdAs!=='tenant'||p.ownershipVerification!==requiredState||p.ownerUID)throw new ApiError(409,'Property is not awaiting this verification decision');
  const relationships=await tx.get(db.collection(LINK_COLLECTION).where('propertyId','==',s(raw.propertyId)).where('relationship','==','owner'));
  const ownershipRequests=relationships.docs.filter(doc=>doc.data().relationship==='owner');
  if(action==='approve'&&identity)for(const claim of ownershipRequests)if(currentConnectionState(claim.data())==='pending_admin_verification'&&(claim.data().candidateUID!==identity.uid||!connectionAccountMatches(claim.data(),identity)||claim.data().recipientEmailNormalized&&normalizeEmailAddress(p.reportedOwner?.email)!==claim.data().recipientEmailNormalized))throw new ApiError(409,'Claimant identity changed; review the ownership request again');
  const history=Array.isArray(p.ownershipVerificationHistory)?p.ownershipVerificationHistory:[];
  if(history.length>=200)throw new ApiError(409,'Verification history limit reached');
  const now=new Date(),status=action==='approve'?'verified':action==='reject'?'rejected':'pending';
  const event:RecordData={action,actorUID:actor.uid,at:now,reason:action==='approve'?s(raw.reviewNote).trim():reason,previousStatus:p.ownershipVerification,status,version:version+1};
  const updates:RecordData={ownershipVerification:status,ownershipVerificationVersion:version+1,ownershipVerificationReviewerUID:actor.uid,ownershipVerificationReviewedAt:now,ownershipVerificationReason:action==='reject'?reason:'',ownershipVerificationHistory:[...history,event],updatedAt:now};
  if(action==='approve'&&identity) {
   if(p.submittedByUID===identity.uid||(p.tenants||[]).some((t:{userUID?:string;isActive?:boolean})=>t.isActive===true&&t.userUID===identity!.uid))throw new ApiError(400,'An active tenant cannot be linked as this property owner');
   const profile=await tx.get(db.collection(COLLECTIONS.users).doc(identity.uid));if(!profile.exists||profile.data()?.isActive===false)throw new ApiError(400,'Owner must have an active platform profile');
   const evidence=await tx.get(db.collection(COLLECTIONS.documents).doc(s(raw.evidenceDocumentId)));
   if(!evidence.exists||evidence.data()?.propertyId!==raw.propertyId||evidence.data()?.status==='rejected'||evidence.data()?.deletionStatus==='pending')throw new ApiError(400,'Evidence document must be available and belong to this property');
   const tenants=await tx.get(db.collection(COLLECTIONS.tenants).where('propertyId','==',raw.propertyId)),owner=profile.data()!;
   Object.assign(updates,{ownerUID:identity.uid,ownerEmail:identity.email,ownerName:owner.name||identity.displayName||'',ownerPhone:owner.phoneNumber||'',ownerRole:owner.role||'',ownershipVerificationAudit:{actorUID:actor.uid,ownerUID:identity.uid,evidenceDocumentId:raw.evidenceDocumentId,reviewNote:s(raw.reviewNote).trim(),verifiedAt:now}});
   Object.assign(event,{ownerUID:identity.uid,evidenceDocumentId:raw.evidenceDocumentId});
   for(const tenant of tenants.docs)tx.update(tenant.ref,{ownerUID:identity.uid,updatedAt:now});
  }
  for(const claim of ownershipRequests)tx.update(claim.ref,{version:Number(claim.data().version||0)+1,status:['expired','rejected'].includes(currentConnectionState(claim.data()))?currentConnectionState(claim.data()):action==='approve'?(claim.data().candidateUID&&claim.data().candidateUID!==identity?.uid?'rejected':'linked'):action==='reject'?'rejected':'verification_required',...(action==='approve'&&identity&&(!claim.data().candidateUID||claim.data().candidateUID===identity.uid)?{candidateUID:identity.uid}:{}),...(action==='approve'&&identity?{approvedOwnerUID:identity.uid}:{}),reviewerUID:actor.uid,reviewedAt:now,verificationVersion:version+1,updatedAt:now});
  tx.update(ref,updates);verification={status,version:version+1,reason:updates.ownershipVerificationReason,history:updates.ownershipVerificationHistory};notify={title:p.title,submittedByUID:p.submittedByUID,ownerUID:updates.ownerUID||p.ownerUID,version:version+1};
 });
 await bestEffort(()=>persistUserEvent({eventType:`owner_verification.${action}`,eventId:`${s(raw.propertyId)}:${s(notify.version)}:${action}`,recipients:[...(notify.submittedByUID?[{uid:s(notify.submittedByUID),role:'tenant'}]:[]),...(notify.ownerUID?[{uid:s(notify.ownerUID),role:'owner'}]:[]),{uid:actor.uid,role:'admin'}],propertyId:s(raw.propertyId),recordId:s(raw.propertyId),templateId:'owner-verification-decision',subject:'Owner verification updated',title:'Owner verification updated',bodyHtml:`<p><strong>${escapeHtml(s(notify.title))}</strong>: ${escapeHtml(s(verification.status))}.</p>${verification.reason?`<p>Reason: ${escapeHtml(s(verification.reason))}</p>`:''}`,bodyText:`${s(notify.title)}: ${s(verification.status)}.${verification.reason?` Reason: ${s(verification.reason)}`:''}`,action:{label:'View property',path:`/manage-property/${s(raw.propertyId)}`}}));
 const message=action==='approve'?'Owner verified and linked. Tenant relationships preserved.':action==='reject'?'Owner verification rejected. Ownership and tenancy unchanged.':'Owner verification reopened for review. No owner has been linked.';
 return jsonResponse({success:true,message,verification:wireValue(verification)});
}
