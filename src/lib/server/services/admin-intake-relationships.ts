import 'server-only';
import type {Transaction,DocumentReference} from 'firebase-admin/firestore';
import type {AuthenticatedUser} from '../auth';
import {getDatabase,COLLECTIONS} from '../firestore';
import {getFirebaseAdminAuth} from '../firebase-admin';
import {ApiError} from '../http';
import {adminInvitationEligible} from '@/lib/admin-property-intake';
import {currentConnectionState} from '@/lib/relationship-link-state';
import {normalizeEmailAddress} from '@/lib/email-address';
import {stageAdminLifecycle} from './admin-lifecycle';
import {stageUserEvent} from './transactional-email';
type Data=Record<string,any>;

/** Called only after the shared fresh candidate/identity/version checks. All reads precede writes. */
export async function applyAdminIntakeDecision(tx:Transaction,user:AuthenticatedUser,ref:DocumentReference,claim:Data,property:Data,action:string){
  const db=getDatabase(),propertyRef=db.collection(COLLECTIONS.properties).doc(claim.propertyId);
  const snapshot=await tx.get(db.collection('relationship_links').where('propertyId','==',claim.propertyId).limit(101));
  if(snapshot.docs.length>100)throw new ApiError(409,'Invitation history requires administrator review');
  const claims=snapshot.docs.map(d=>({...d.data(),id:d.id})) as Data[];
  const embedded:Data[]=Array.isArray(property.tenants)?property.tenants:[];
  const tenantClaim=claim.relationship==='tenant'?claim:claims.find(c=>c.relationship==='tenant'&&!['linked','expired','rejected'].includes(currentConnectionState(c)));
  const tenant=tenantClaim?(await tx.get(db.collection(COLLECTIONS.tenants).doc(tenantClaim.tenantId))).data():undefined;
  if(!adminInvitationEligible(claim,property,claim.relationship==='tenant'?tenant:undefined))throw new ApiError(409,'Invitation relationship changed');
  if(action!=='reject'&&action!=='accept_admin_invitation')throw new ApiError(400,'Review and accept or reject this administrator invitation');
  const now=new Date(),version=Number(claim.version||0)+1;
  const history=Array.isArray(property.relationshipHistory)?property.relationshipHistory:[];
  if(history.length>=200)throw new ApiError(409,'Relationship audit history requires review');
  let outcome='rejected',targetUID='',targetProfile:Data|undefined;
  const ownerAccepted=property.ownershipVerification==='verified'&&!!property.ownerUID;
  if(action!=='reject'){
    outcome=claim.relationship==='owner'||ownerAccepted?'linked':'pending_owner_authorization';
    targetUID=claim.relationship==='tenant'?user.uid:tenantClaim?.confirmedByUID||'';
    if(claim.relationship==='owner'&&tenantClaim?.confirmedByUID&&(Number(tenantClaim.acceptedTenancyRevision||0)!==Number(property.tenancyRevision||0)||Number(tenantClaim.acceptedRentTermsVersion||0)!==Number(property.rentTermsVersion||0)))targetUID='';
    if(targetUID&&tenantClaim&&tenant&&adminInvitationEligible(tenantClaim,property,tenant)&&currentConnectionState(tenantClaim)!=='expired'){
      const account=await getFirebaseAdminAuth().getUser(targetUID);
      targetProfile=(await tx.get(db.collection(COLLECTIONS.users).doc(targetUID))).data();
      if(account.disabled||!account.emailVerified||normalizeEmailAddress(account.email)!==tenantClaim.recipientEmailNormalized||!targetProfile||targetProfile.isActive===false)throw new ApiError(409,'Tenant identity changed; replace the invitation after review');
    }else targetUID='';
  }
  const ownerProfile=claim.relationship==='owner'&&action!=='reject'?(await tx.get(db.collection(COLLECTIONS.users).doc(user.uid))).data():undefined;
  const canLink=action!=='reject'&&!!targetUID&&(claim.relationship==='owner'||ownerAccepted);
  const lifecycle=await stageAdminLifecycle(tx,[{property,propertyId:claim.propertyId,actorUID:user.uid,eventId:`admin-intake:${claim.id}:${version}`,type:canLink?'tenant_confirmed':'property_updated',title:action==='reject'?'Property invitation rejected':'Property invitation accepted',message:`The ${claim.relationship} invitation was ${action==='reject'?'rejected':'accepted'}.`}]);
  const participant=outcome==='linked'?await stageUserEvent(tx,{eventType:'relationship.admin_linked',eventId:claim.id+':'+version,actorUID:user.uid,recipients:[{uid:claim.relationship==='owner'?user.uid:property.ownerUID,role:'owner'},...(canLink?[{uid:targetUID,role:'tenant'}]:[])],propertyId:claim.propertyId,recordId:claim.tenantId||claim.propertyId,templateId:'relationship-confirmed',subject:'Property relationship confirmed',title:'Property relationship confirmed',bodyHtml:'<p>Your property relationship has been confirmed.</p>',bodyText:'Your property relationship has been confirmed.',action:{label:'View property',path:'/manage-property/'+claim.propertyId}}):null;
  const patch:Data={updatedAt:now,relationshipHistory:[...history,{action:action==='reject'?'invitation_rejected':'invitation_accepted',relationship:claim.relationship,claimId:claim.id,actorUID:user.uid,at:now}]};
  if(action==='reject'){
    patch.relationshipNeedsAttention=true;
    if(claim.relationship==='owner')patch.ownershipVerification='rejected';
  }else if(claim.relationship==='owner'){
    Object.assign(patch,{ownerUID:user.uid,ownerName:ownerProfile?.name||property.reportedOwner.personName,ownerEmail:claim.recipientEmailNormalized,ownerPhone:ownerProfile?.phoneNumber||claim.contactE164,ownerRole:ownerProfile?.role||'individual',ownershipVerification:'verified'});
    patch.tenants=embedded.map(t=>({...t,ownerUID:user.uid}));
    // Canonical and embedded contacts remain pending unless both parties accepted.
    for(const item of embedded)tx.set(db.collection(COLLECTIONS.tenants).doc(item.id),{ownerUID:user.uid},{merge:true});
    for(const c of claims.filter(c=>c.relationship==='tenant'&&!['linked','rejected','expired'].includes(currentConnectionState(c))))tx.update(db.collection('relationship_links').doc(c.id),{ownerUID:user.uid,updatedAt:now});
  }
  if(canLink&&tenantClaim&&tenant){
    if(!embedded.some(t=>t.id===tenantClaim.tenantId&&t.linkConfirmationRequired===true&&!t.userUID)||embedded.some(t=>t.id!==tenantClaim.tenantId&&t.userUID===targetUID&&t.isActive===true))throw new ApiError(409,'Tenancy relationship changed');
    const updates={ownerUID:claim.relationship==='owner'?user.uid:property.ownerUID,userUID:targetUID,linkConfirmationRequired:false,linkedAt:now,linkedByUID:user.uid};
    patch.tenants=embedded.map(t=>t.id===tenantClaim.tenantId?{...t,...updates}:t);
    patch.tenancyRevision=Number(property.tenancyRevision||0)+1;
    tx.set(db.collection(COLLECTIONS.tenants).doc(tenantClaim.tenantId),updates,{merge:true});
    if(tenantClaim.id!==claim.id)tx.update(db.collection('relationship_links').doc(tenantClaim.id),{status:'linked',version:Number(tenantClaim.version||0)+1,linkedAt:now,ownerUID:user.uid,updatedAt:now});
  }
  if(action!=='reject'&&claim.relationship==='owner'&&tenantClaim?.confirmedByUID&&!targetUID)tx.update(db.collection('relationship_links').doc(tenantClaim.id),{status:'pending_tenant_acceptance',confirmedByUID:'',confirmedAt:null,version:Number(tenantClaim.version||0)+1,updatedAt:now});
  tx.update(ref,{status:outcome,version,updatedAt:now,...(action==='reject'?{rejectedByUID:user.uid,rejectedAt:now}:{confirmedByUID:user.uid,confirmedAt:now,acceptedTenancyRevision:Number(property.tenancyRevision||0),acceptedRentTermsVersion:Number(property.rentTermsVersion||0),...(outcome==='linked'?{linkedAt:now}:{})})});
  tx.update(propertyRef,patch);lifecycle.write();participant?.write();
  return {status:outcome,events:lifecycle.events,intentIds:participant?[participant.id]:[]};
}
