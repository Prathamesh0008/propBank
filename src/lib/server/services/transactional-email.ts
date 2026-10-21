import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { AccessError } from '../auth';
import { COLLECTIONS, getDatabase } from '../firestore';
import { ApiError, jsonResponse, plainError } from '../http';
import { identity, readObject } from './domain-contracts';
import { sendEmail } from './resend';
import { getUser } from './users';
import { isRecord, stringValue as s, wireValue, type RecordData } from './contracts';

export type TransactionalEmailEvent={
  eventType:string;eventId:string;recipientUID?:string;recipientRole:string;recipientEmail?:string;
  propertyId?:string;recordId?:string;templateId:string;templateVersion:number;
  subject:string;html:string;text:string;idempotencyKey?:string;
  tenancyId?:string;rentPeriod?:string;agreementVersion?:string;scheduledFor?:string;reminderOffset?:number;reminderDueDate?:string;reminderAmount?:string;
};
type UserEvent={eventType:string;eventId:string;recipients?:Array<{uid?:string;role:string;email?:string}>;recipientUIDs?:string[];propertyId?:string;recordId?:string;templateId:string;subject:string;title?:string;bodyHtml:string;bodyText:string;action?:{label:string;path:string}};

const deliveries=()=>getDatabase().collection(COLLECTIONS.emailDeliveries);
const safeError=()=> 'Email provider delivery failed';
const keyFor=(event:TransactionalEmailEvent,email:string)=>event.idempotencyKey||`${event.eventType}:${event.eventId}:${event.recipientUID||email.toLowerCase()}`;
const idFor=(key:string)=>createHash('sha256').update(key).digest('hex');
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function brandedEmail(title:string,bodyHtml:string,bodyText:string,action?:{label:string;path:string}) {
  const base=(process.env.APP_URL||process.env.NEXT_PUBLIC_APP_URL||'').replace(/\/$/,'');
  const href=base&&action?.path?.startsWith('/')?`${base}${action.path}`:'';
  const actionHtml=href?`<p style="margin:28px 0"><a href="${href}" style="background:#A25C42;color:#F8F6F0;text-decoration:none;padding:12px 18px;border-radius:4px;display:inline-block">${action!.label}</a></p>`:'';
  return {html:`<!doctype html><html><body style="margin:0;background:#E6E1D6;color:#242B28;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;background:#F8F6F0;border-top:5px solid #A25C42"><tr><td style="padding:28px"><p style="margin:0 0 28px;font-weight:700;letter-spacing:.04em">PropBank</p><h1 style="font-size:25px;line-height:1.2;margin:0 0 18px">${title}</h1>${bodyHtml}${actionHtml}<p style="border-top:1px solid #D4D0C5;padding-top:18px;margin-top:30px;color:#565C56;font-size:13px">This is an automated account notification from PropBank.</p></td></tr></table></td></tr></table></body></html>`,text:`PropBank\n\n${title}\n\n${bodyText}${href?`\n\n${action!.label}: ${href}`:''}\n\nThis is an automated account notification from PropBank.`};
}

async function resolveRecipient(event:TransactionalEmailEvent) {
  if(event.recipientUID) {
    const profile=await getUser(event.recipientUID);
    if(!profile||profile.isActive===false||!emailPattern.test(s(profile.email)))return '';
    return s(profile.email).toLowerCase();
  }
  const configured=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  return event.recipientRole==='admin'&&configured&&event.recipientEmail?.toLowerCase()===configured&&emailPattern.test(configured)?configured:'';
}

async function deliver(id:string) {
  const ref=deliveries().doc(id),now=new Date(),lease=randomUUID();let value:RecordData|null=null;
  await getDatabase().runTransaction(async tx=>{const snapshot=await tx.get(ref);if(!snapshot.exists)return;const current=snapshot.data()!,status=s(current.status);if(!(['pending','failed'].includes(status)||status==='sending'&&Number(current.deliveryLeaseUntil?.toMillis?.()||new Date(current.deliveryLeaseUntil||0).getTime())<=now.getTime())||Number(current.retryCount||0)>=5||status==='failed'&&Number(current.nextRetryAt?.toMillis?.()||new Date(current.nextRetryAt||0).getTime())>now.getTime())return;value=current;tx.update(ref,{status:'sending',deliveryLease:lease,deliveryLeaseUntil:new Date(now.getTime()+120000),lastAttemptAt:now,updatedAt:now});});
  if(!value)return 'skipped';
  try{
    await sendEmail({to:s(value.recipientEmail),subject:s(value.subject),html:s(value.html),text:s(value.text)},s(value.idempotencyKey));
    await ref.update({status:'sent',sentAt:now,lastAttemptAt:now,updatedAt:now,retryCount:Number(value.retryCount||0)+1,errorSummary:'',deliveryLease:'',deliveryLeaseUntil:now});return 'sent';
  }catch{
    await ref.update({status:'failed',lastAttemptAt:now,updatedAt:now,retryCount:Number(value.retryCount||0)+1,errorSummary:safeError(),nextRetryAt:new Date(now.getTime()+5*60*1000),deliveryLease:'',deliveryLeaseUntil:now});return 'failed';
  }
}

export async function enqueueTransactionalEmail(event:TransactionalEmailEvent) {
  const recipientEmail=await resolveRecipient(event);if(!recipientEmail)return {queued:false,reason:'recipient_ineligible'};
  const idempotencyKey=keyFor(event,recipientEmail),id=idFor(idempotencyKey),ref=deliveries().doc(id),now=new Date();
  let created=false;
  await getDatabase().runTransaction(async tx=>{const existing=await tx.get(ref);if(existing.exists)return;created=true;tx.create(ref,{id,...event,recipientEmail,idempotencyKey,status:'pending',retryCount:0,createdAt:now,updatedAt:now,errorSummary:''});});
  return {queued:created,id,duplicate:!created};
}

export function queueTransactionalEmail(event:TransactionalEmailEvent){after(async()=>{try{const result=await enqueueTransactionalEmail(event);if(result.queued&&result.id)await deliver(result.id);}catch{/* Business operation already committed; delivery remains best effort until a transactional caller supplies the outbox write. */}});}
export async function processTransactionalEmail(event:TransactionalEmailEvent){const result=await enqueueTransactionalEmail(event);if(!result.id)return result.reason==='recipient_ineligible'?'skipped':'failed';return deliver(result.id);}
export function queueUserEvent(event:UserEvent) {
  const content=brandedEmail(event.title||event.subject,event.bodyHtml,event.bodyText,event.action);
  const recipients:Array<{uid?:string;role:string;email?:string}>=event.recipients||event.recipientUIDs?.map(uid=>({uid,role:'user'}))||[];
  for(const recipient of recipients)queueTransactionalEmail({eventType:event.eventType,eventId:event.eventId,recipientUID:recipient.uid,recipientRole:recipient.role,recipientEmail:recipient.email,propertyId:event.propertyId,recordId:event.recordId,templateId:event.templateId,templateVersion:1,subject:event.subject,...content});
}

export async function listEmailDeliveries(request:Request) {
  const user=await identity(request);if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
  const params=new URL(request.url).searchParams;const status=params.get('status')||'',eventType=params.get('eventType')||'';
  const snapshot=await deliveries().get();let rows:RecordData[]=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  if(status)rows=rows.filter(row=>row.status===status);if(eventType)rows=rows.filter(row=>row.eventType===eventType);
  rows.sort((a,b)=>+new Date(b.createdAt as string)-+new Date(a.createdAt as string));
  return jsonResponse({success:true,deliveries:wireValue(rows.slice(0,200).map(row=>({...row,html:undefined,text:undefined,subject:s(row.subject),recipientEmail:s(row.recipientEmail).replace(/(^.).*(@.*$)/,'$1***$2')})))});
}

function reminderDate(value:unknown){const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(s(value));return match?`${match[1]}-${match[2]}-${match[3]}`:'';}
async function reminderIsCurrent(value:RecordData){
  if(!['rent.reminder','agreement.expiry_reminder'].includes(s(value.eventType)))return true;
  const snapshot=await getDatabase().collection(COLLECTIONS.properties).doc(s(value.propertyId)).get();if(!snapshot.exists)return false;
  const property=snapshot.data()!;if(property.isActive!==true||property.status==='inactive'||property.rentalStatus!=='rented'||['terminated','expired','cancelled'].includes(s(property.agreementStatus)))return false;
  const tenants=(Array.isArray(property.tenants)?property.tenants:[]).filter((tenant:RecordData)=>tenant&&tenant.isActive===true),tenant=tenants.find((entry:RecordData)=>s(entry.id||entry.userUID)===s(value.tenancyId));if(!tenant)return false;
  if(value.eventType==='agreement.expiry_reminder')return reminderDate(tenant.leaseEndDate||property.agreementEndDate)===s(value.reminderDueDate)&&s(tenant.agreementVersion||property.agreementVersion||property.tenancyRevision||value.reminderDueDate)===s(value.agreementVersion);
  const ledger=isRecord(property.rentLedger)?property.rentLedger:{},period=s(value.rentPeriod);if(isRecord(ledger[period])&&ledger[period].status==='paid')return false;
  const due=Number(tenant.paymentDueDate||property.paymentDueDate),match=/^(\d{4})-(\d{2})$/.exec(period);if(!match||!Number.isInteger(due)||due<1||due>31)return false;const year=Number(match[1]),month=Number(match[2]),day=Math.min(due,new Date(Date.UTC(year,month,0)).getUTCDate()),currentDue=`${period}-${String(day).padStart(2,'0')}`;
  return currentDue===s(value.reminderDueDate)&&s(tenant.monthlyRent||property.monthlyRent)===s(value.reminderAmount);
}

export async function retryEmailDelivery(request:Request,id:string) {
  const user=await identity(request);if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
  let req:RecordData;try{req=await readObject(request);}catch{return plainError('Invalid JSON',400);}
  if(Object.keys(req).length)throw new ApiError(400,'Retry does not accept message or recipient changes');
  const ref=deliveries().doc(id);
  const snapshot=await ref.get();if(!snapshot.exists)throw new ApiError(404,'Delivery not found');if(!await reminderIsCurrent(snapshot.data()!))throw new ApiError(409,'Reminder is obsolete and cannot be retried');
  await getDatabase().runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists)throw new ApiError(404,'Delivery not found');const value=doc.data()!;if(value.status!=='failed'||Number(value.retryCount||0)>=5)throw new ApiError(409,'Delivery is not eligible for retry');tx.update(ref,{status:'pending',updatedAt:new Date(),errorSummary:'',nextRetryAt:null});});
  after(()=>deliver(id));return jsonResponse({success:true,message:'Delivery queued for retry'});
}
