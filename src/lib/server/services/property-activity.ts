import {propertyEmailContext} from '@/lib/email-design';
import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {AccessError,type AuthenticatedUser} from '../auth';
import {ApiError} from '../http';
import {COLLECTIONS,getDatabase} from '../firestore';
import {requirePropertyMember} from '../permissions';
import {formatAddress} from '@/lib/address-format';
import {formatDisplayDateTime} from '@/lib/date-format';
import {privateLeaseEvidence} from './document-access';
import {stringValue as s,isRecord,type RecordData} from './contracts';
import {escapeHtml} from './property-effects';
import {stageUserEvent} from './transactional-email';

export function propertyOperationId(request:Request,scope:string,propertyId:string,uid:string){
  const key=request.headers.get('Idempotency-Key');
  if(key&&!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new ApiError(400,'Invalid request key');
  return key?createHash('sha256').update(`${scope}:${propertyId}:${uid}:${key}`).digest('hex'):randomUUID();
}

/** Canonical relationships when available; retain the established embedded legacy schema. */
export async function activePropertyTenants(tx:FirebaseFirestore.Transaction,property:RecordData){
  const snapshot=await tx.get(getDatabase().collection(COLLECTIONS.tenants).where('propertyId','==',s(property.id)).limit(51));
  if(snapshot.docs.length>50)throw new ApiError(409,'Review tenancy relationships before submitting this action');
  const rows:RecordData[]=snapshot.docs.length?snapshot.docs.map(doc=>({...doc.data(),id:doc.id})):
    Array.isArray(property.tenants)?property.tenants.filter(isRecord):[];
  return rows.filter(t=>t.isActive===true&&t.linkConfirmationRequired!==true&&s(t.userUID)&&
    (!t.propertyId||t.propertyId===property.id)&&(!t.ownerUID||t.ownerUID===property.ownerUID));
}

type Activity={notifyAdmin?:boolean;requester?:RecordData;id:string;recordId?:string;eventType:string;type:string;title:string;details:string;status:string;
  notifyOwner?:boolean;tenantScope?:'all'|'requester'|'none';tenantUIDs?:string[];document?:RecordData;adminDetails?:RecordData};

/** Stage in the business transaction; call write only after all transaction reads. */
export async function stagePropertyActivity(tx:FirebaseFirestore.Transaction,user:AuthenticatedUser,property:RecordData,event:Activity){
  requirePropertyMember(user,property);
  const db=getDatabase(),now=new Date();
  const ownerOrAdmin=user.role==='admin'||user.uid===property.ownerUID;
  const tenants=ownerOrAdmin&&(event.tenantScope==='none'||property.listingType==='manage'||event.document&&privateLeaseEvidence(event.document,property))?[]:await activePropertyTenants(tx,property);
  if(user.role!=='admin'&&user.uid!==property.ownerUID&&(property.listingType==='manage'||!tenants.some(t=>t.userUID===user.uid)))throw new AccessError(403,'An active confirmed tenancy is required');
  const eligible=property.listingType==='manage'||event.tenantScope==='none'||event.document&&privateLeaseEvidence(event.document,property)?[]:
    tenants.filter(t=>(event.tenantScope!=='requester'||t.userUID===user.uid)&&(!event.tenantUIDs||event.tenantUIDs.includes(s(t.userUID))));
  const recipients=Array.from(new Set([...(event.notifyOwner===false?[]:[s(property.ownerUID)]),...eligible.map(t=>s(t.userUID))])).filter(uid=>uid&&uid!==user.uid)
    .map(uid=>({uid,role:uid===property.ownerUID?'owner':'tenant',name:uid===property.ownerUID?s(property.ownerName):(()=>{const t=eligible.find(t=>t.userUID===uid);return t?[s(t.firstName),s(t.lastName)].filter(Boolean).join(' '):'';})()}));
  const propertyName=[s(property.buildingName)||s(property.title)||'Property',s(property.unitNumber)].filter(Boolean).join(' — ');
  const address=formatAddress(property.address||property.location,property.city,property.state,property.zipCode)||'Address not recorded';
  const actorName=s(user.profile?.name)||'Authorized account';
  const role=user.role==='admin'?'Administrator':user.uid===property.ownerUID?'Owner':'Tenant';
  const requesterUID=s(event.requester?.uid)||user.uid,requesterName=s(event.requester?.name)||actorName,requesterRole=requesterUID===property.ownerUID?'Owner':tenants.some(t=>t.userUID===requesterUID)?'Tenant':requesterUID===user.uid?role:'Registered user';
  const message=`${event.title}. Property: ${propertyName}. Address: ${address}. Requested by: ${requesterName} (${requesterRole}).${requesterUID!==user.uid?` Submitted by: ${actorName} (${role}).`:''} ${event.details}. Status: ${event.status.replaceAll('_',' ')}. ${formatDisplayDateTime(now)}.`;
  const eventId=`property360:${event.eventType}:${event.id}`;
  const participant=recipients.length?await stageUserEvent(tx,{actorUID:user.uid,propertyActivity:true,eventType:event.eventType,eventId,
    emailContext:propertyEmailContext(property,[{label:'Requested by',value:requesterName},{label:'Requester role',value:requesterRole},{label:'Submitted by',value:requesterUID!==user.uid?actorName:undefined},{label:'Update',value:event.details},{label:'Recorded',value:now,format:'datetime'}],{status:event.status}),recipients,propertyId:s(property.id),recordId:event.recordId||event.id,templateId:'property-activity',subject:`PropBank — ${event.title}`,title:event.title,
    bodyHtml:`<p>${escapeHtml(event.title)}. ${escapeHtml(event.details)}</p>`,bodyText:`${event.title}. ${event.details}`,action:{label:'View property activity',path:`/manage-property/${encodeURIComponent(s(property.id))}`}}):{id:'',write:()=>{}};
  if(event.notifyAdmin===false)return {ids:[participant.id].filter(Boolean),write:participant.write};
  const admin=await stageUserEvent(tx,{actorUID:user.uid,propertyActivity:true,eventType:`admin.${event.eventType}`,eventId,
    emailContext:propertyEmailContext(property,[{label:'Requested by',value:requesterName},{label:'Requester role',value:requesterRole},{label:'Submitted by',value:requesterUID!==user.uid?actorName:undefined},{label:'Update',value:event.details},{label:'Recorded',value:now,format:'datetime'}],{status:event.status}),recipients:[{role:'admin',email:process.env.ADMIN_EMAIL}],propertyId:s(property.id),recordId:event.recordId||event.id,templateId:'property-activity-admin',subject:`PropBank — ${event.title}`,title:event.title,
    bodyHtml:`<p>${escapeHtml(event.title)}. ${escapeHtml(event.details)}</p>`,bodyText:`${event.title}. ${event.details}`,action:{label:'Review property activity',path:`/admin?tab=${event.type==='service_request'?'service-requests':'properties'}&propertyId=${encodeURIComponent(s(property.id))}`}});
  const id=createHash('sha256').update(eventId).digest('hex'),ref=db.collection(COLLECTIONS.adminNotifications).doc(id),existing=await tx.get(ref);
  return {ids:[participant.id,admin.id].filter(Boolean),write:()=>{
    participant.write();admin.write();
    if(!existing.exists)tx.create(ref,{...event.adminDetails,id,type:event.type,eventType:event.eventType,title:event.title,message,
      propertyId:property.id,propertyTitle:propertyName,propertyAddress:address,ownerId:s(property.ownerUID),userId:requesterUID,
      userName:requesterName,requesterRole,relatedId:event.recordId||event.id,recordId:event.recordId||event.id,status:event.status,actorUID:user.uid,eventId,
      participantUIDs:recipients.map(r=>r.uid),propertyActivity:true,lifecycle:true,destination:`/admin?tab=${event.type==='service_request'?'service-requests':'properties'}&propertyId=${encodeURIComponent(s(property.id))}`,
      isRead:false,readByUIDs:[],emailDeliveryId:admin.deliveryIds[0]||'',emailStatus:process.env.ADMIN_EMAIL?'queued':'unconfigured',timestamp:now,createdAt:now,updatedAt:now});
  }};
}
