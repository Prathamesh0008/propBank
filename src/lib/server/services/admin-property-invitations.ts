type Data=Record<string,any>;
import 'server-only';
import {createHash} from 'node:crypto';
import {requireUser,AccessError} from '../auth';
import {getDatabase,COLLECTIONS} from '../firestore';
import {ApiError,jsonResponse} from '../http';
import {readObject} from './domain-contracts';
import {isRecord,stringValue as s} from './contracts';
import {prepareLink,throttleRelationshipAction} from './relationship-links';
import {stageInvitationEmails} from './relationship-invitation-email';
import {dispatchEmailOutbox} from './transactional-email';
import {currentConnectionState} from '@/lib/relationship-link-state';
import {normalizeEmailAddress} from '@/lib/email-address';

async function administrator(request:Request){const user=await requireUser(request);if(user.role!=='admin')throw new AccessError(403,'Administrator access required');return user;}
export async function adminPropertyInvitations(request:Request){
  const user=await administrator(request);await throttleRelationshipAction(user.uid,'admin-invitations-read',30);
  const id=new URL(request.url).searchParams.get('propertyId')||'';if(!id||id.includes('/')||id.length>100)throw new ApiError(400,'Select a property');
  const db=getDatabase(),property=(await db.collection(COLLECTIONS.properties).doc(id).get()).data();if(!property?.adminIntake)throw new ApiError(404,'Administrator intake unavailable');
  const claims=await db.collection('relationship_links').where('propertyId','==',id).limit(101).get();
  const items=await Promise.all(claims.docs.slice(0,100).map(async doc=>{const c=doc.data(),mail=await db.collection(COLLECTIONS.emailDeliveries).where('invitationClaimId','==',doc.id).limit(5).get();return {id:doc.id,relationship:c.relationship,email:c.recipientEmailNormalized,status:currentConnectionState(c),accepted:!!c.confirmedByUID,version:Number(c.version||0),registered:!!c.candidateUID,superseded:!!c.replacedBy,expiresAt:c.expiresAt,delivery:mail.docs.map(d=>({status:d.data().status,retryCount:d.data().retryCount||0}))};}));
  return jsonResponse({success:true,items,history:property.relationshipHistory||[],truncated:claims.docs.length>100});
}
export async function replaceAdminPropertyInvitation(request:Request){
  const user=await administrator(request);await throttleRelationshipAction(user.uid,'admin-invitations-send',5);
  const body=await readObject(request,4096);
  if(!isRecord(body)||Object.keys(body).some(k=>!['claimId','expectedVersion','action','email','phone','selectedUID'].includes(k))||!['replace','resend'].includes(s(body.action))||!/^[a-f0-9]{64}$/.test(s(body.claimId))||!Number.isInteger(body.expectedVersion))throw new ApiError(400,'Invalid invitation update');
  const db=getDatabase(),ref=db.collection('relationship_links').doc(s(body.claimId)),snapshot=await ref.get(),old=snapshot.data();if(!old?.adminIntake)throw new ApiError(404,'Invitation unavailable');
  const email=body.action==='resend'?old.recipientEmailNormalized:normalizeEmailAddress(body.email);if(!email)throw new ApiError(400,'Valid recipient email required');
  const candidate=await prepareLink(old.relationship,old.propertyId,body.action==='resend'?old.contactE164:s(body.phone||old.contactE164),old.createdByUID,old.ownerUID||'',old.tenantId||'',email);
  if(body.selectedUID&&candidate.candidateUID!==body.selectedUID)throw new ApiError(409,'Selected account must match the current verified email');
  const id=createHash('sha256').update(JSON.stringify([old.id,old.version,email])).digest('hex');Object.assign(candidate,{id,adminIntake:true,adminAuthorizedByUID:old.adminAuthorizedByUID,replacesClaimId:old.id});
  let events:Parameters<typeof dispatchEmailOutbox>[0]=[];
  await db.runTransaction(async tx=>{
    const current=(await tx.get(ref)).data(),propertyRef=db.collection(COLLECTIONS.properties).doc(old.propertyId),property=(await tx.get(propertyRef)).data(),profile=(await tx.get(db.collection(COLLECTIONS.users).doc(user.uid))).data();
    if(profile?.role!=='admin'||profile.isActive===false)throw new AccessError(403,'Administrator access required');
    if(!current||!property?.adminIntake||current.version!==body.expectedVersion||current.version!==old.version)throw new ApiError(409,'Invitation changed; refresh');
    if(current.replacedBy)throw new ApiError(409,'This invitation was superseded; select the latest invitation');
    if(currentConnectionState(current)==='linked'||current.confirmedByUID&&(body.action!=='resend'||currentConnectionState(current)!=='expired'))throw new ApiError(409,'Accepted relationships cannot be transferred; only expired pending acceptance can be renewed for the same email');
    if(current.relationship==='owner'&&property.ownerUID)throw new ApiError(409,'Existing ownership cannot be transferred here');
    const history=Array.isArray(property.relationshipHistory)?property.relationshipHistory:[];if(history.length>=90)throw new ApiError(409,'Invitation history requires review');
    const tenantRef=current.tenantId?db.collection(COLLECTIONS.tenants).doc(current.tenantId):null,tenant=tenantRef?(await tx.get(tenantRef)).data():null;
    if(tenantRef&&(!tenant||tenant.userUID||tenant.propertyId!==current.propertyId))throw new ApiError(409,'Tenant relationship changed');
    if((current.relationship==='owner'?(property.tenants||[]).some((t:Data)=>normalizeEmailAddress(t.email)===email):normalizeEmailAddress(property.reportedOwner?.email)===email))throw new ApiError(400,'Owner and tenant must be different recipients');
    const mail=await stageInvitationEmails(tx,[candidate],[{claimId:id,email}]);events=mail.events;
    const now=new Date(),patch:Data={updatedAt:now,relationshipHistory:[...history,{action:body.action==='resend'?'invitation_resent':'invitation_replaced',actorUID:user.uid,relationship:current.relationship,oldClaimId:current.id,claimId:id,at:now}]};
    if(current.relationship==='owner')Object.assign(patch,{reportedOwner:{...property.reportedOwner,email,phone:candidate.contactE164,selectedUID:body.selectedUID||''},ownershipVerification:'pending'});
    else {patch.tenants=(property.tenants||[]).map((t:Data)=>t.id===current.tenantId?{...t,email,phone:candidate.contactE164}:t);patch.tenancyRevision=Number(property.tenancyRevision||0)+1;tx.update(tenantRef!,{email,phone:candidate.contactE164,updatedAt:now});}
    tx.update(ref,{status:'rejected',revokedAt:now,revokedByUID:user.uid,replacedBy:id,version:current.version+1,updatedAt:now});
    tx.create(db.collection('relationship_links').doc(id),candidate);tx.update(propertyRef,patch);mail.write();
  });
  dispatchEmailOutbox(events);return jsonResponse({success:true,message:'Invitation saved; delivery is queued or recorded with its delivery state'});
}
