import {sameRentSchedule} from '@/lib/rent-resolution';
import 'server-only';
import {createHash} from 'node:crypto';
import type {Transaction} from 'firebase-admin/firestore';
import {COLLECTIONS,getDatabase} from '../firestore';
import {brandedEmail,emailDeliveryId,writeEmailOutbox,type TransactionalEmailEvent} from './transactional-email';
import {isRecord,stringValue as s,type RecordData} from './contracts';
export interface AdminLifecycleEvent {type:string;propertyId:string;tenantId?:string;actorUID:string;eventId:string;title:string;message:string;email?:boolean;emailDelivery?:TransactionalEmailEvent}
export const adminEmailRequested=(event:AdminLifecycleEvent)=>!!event.emailDelivery||event.email===true||!['property_added','property_pending_approval','agreement_terminated','agreement_termination_submitted','agreement_termination_rejected','agreement_notice_served'].includes(event.type);
export const adminDeliveryStatus=(status:string)=>({pending:'queued',sending:'processing',sent:'provider_accepted',failed:'retryable_failure',exhausted:'exhausted',permanent_failure:'permanent_failure',reconciliation_required:'reconciliation_required',cancelled:'cancelled'}[status]||'queued');
const rows=(v:unknown)=>Array.isArray(v)?v.filter(isRecord):[];
export function propertyLifecycleEvents(id:string,before:RecordData|null,after:RecordData,actorUID:string,eventId:string):AdminLifecycleEvent[]{
 const event=(type:string,title:string,message:string,tenantId='',email=false):AdminLifecycleEvent=>({type,title,message,tenantId,propertyId:id,actorUID,eventId:`${eventId}:${type}:${tenantId}`,email});
 const events:AdminLifecycleEvent[]=[];
 if(!before){events.push(event('property_added','New property submitted','A property was submitted for administrative review.'));if(after.moderationStatus==='pending_review')events.push(event('property_pending_approval','Property pending approval','A property is awaiting listing approval.'));}
 if(before&&before.moderationStatus!==after.moderationStatus&&after.moderationStatus==='pending_review')events.push(event('property_pending_approval','Property pending approval','Property changes require administrative review.'));
 const old=rows(before?.tenants).filter(t=>t.isActive===true),next=rows(after.tenants).filter(t=>t.isActive===true),added=next.filter(t=>!old.some(o=>o.id===t.id)),removed=old.filter(t=>!next.some(o=>o.id===t.id));
 if(added.length&&removed.length)events.push(event('tenant_replaced','Tenant replaced','The property tenancy was replaced.',s(added[0].id),true));
 else{for(const t of added)events.push(event('tenant_assigned','Tenant assigned','A tenant assignment was committed.',s(t.id),true));for(const t of removed)events.push(event('tenant_removed','Tenant removed','A tenancy was ended or removed.',s(t.id)));}
 const term=(value:unknown,key:string)=>key==='rentSchedule'?value:String(value??'');
 const fields=['monthlyRent','securityDeposit','paymentDueDate','leaseStartDate','leaseEndDate','rentSchedule'];
 for(const t of next){const prior=old.find(o=>o.id===t.id);if(prior&&fields.some(k=>k==='rentSchedule'?!sameRentSchedule(prior[k],t[k]):term(prior[k],k)!==term(t[k],k)))events.push(event('rental_terms_changed','Rental terms updated','Current tenancy terms changed; review the agreement history.',s(t.id)));}
 if(before&&next.length&&!events.some(e=>e.type==='rental_terms_changed')&&['monthlyRent','securityDeposit','paymentDueDate','agreementStartDate','agreementEndDate','rentSchedule'].some(k=>k==='rentSchedule'?!sameRentSchedule(before[k],after[k]):term(before[k],k)!==term(after[k],k)))events.push(event('rental_terms_changed','Rental terms updated','Current property rental terms changed.'));
 return events;
}
/** All reads are staged before any business writes; delivery is post-commit only. */
export async function stageAdminLifecycle(tx:Transaction,events:AdminLifecycleEvent[]){
 const db=getDatabase(),notifications:Array<{ref:FirebaseFirestore.DocumentReference;data:RecordData}>=[],emails:TransactionalEmailEvent[]=[];
 for(const event of events){const id=createHash('sha256').update(`admin-lifecycle:${event.eventId}`).digest('hex'),ref=db.collection(COLLECTIONS.adminNotifications).doc(id),exists=await tx.get(ref),now=new Date();
  const recipient=(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),configured=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)&&!!process.env.RESEND_API_KEY&&!!process.env.FROM_EMAIL,destination=`/admin?tab=properties&propertyId=${encodeURIComponent(event.propertyId)}`;
  const requested=adminEmailRequested(event);
  const mail:TransactionalEmailEvent=event.emailDelivery||{eventType:`admin.${event.type}`,eventId:event.eventId,propertyId:event.propertyId,recordId:event.tenantId||event.propertyId,recipientRole:'admin',recipientEmail:recipient,templateId:'admin-property-lifecycle',templateVersion:1,subject:`PropBank - ${event.title}`,idempotencyKey:`admin-lifecycle:${event.eventId}`, ...brandedEmail(event.title,`<p>${event.message}</p>`,event.message,{label:'Review property',path:destination})};
  const deliveryId=requested&&configured?emailDeliveryId(mail):'';
  const delivery=deliveryId?await tx.get(db.collection(COLLECTIONS.emailDeliveries||'email_deliveries').doc(deliveryId)):null;
  if(!exists.exists)notifications.push({ref,data:{id,type:event.type,title:event.title,message:event.message,propertyId:event.propertyId,tenantId:event.tenantId||'',actorUID:event.actorUID,eventId:event.eventId,destination,lifecycle:true,isRead:false,readByUIDs:[],timestamp:now,createdAt:now,updatedAt:now,emailStatus:!requested?'not_requested':!configured?'unconfigured':adminDeliveryStatus(s(delivery?.data()?.status)),emailDeliveryId:deliveryId}});
  if(deliveryId&&!delivery?.exists&&!event.emailDelivery)emails.push(mail);
 }
 return {events:emails,write:()=>{for(const value of notifications)tx.create(value.ref,value.data);writeEmailOutbox(tx,emails);}};
}
