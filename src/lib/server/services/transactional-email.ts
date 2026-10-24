import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import { after } from 'next/server';
import { AccessError } from '../auth';
import { COLLECTIONS, getDatabase } from '../firestore';
import { ApiError, jsonResponse, plainError } from '../http';
import { identity, readObject } from './domain-contracts';
import { sendEmail } from './resend';
import { isRecord, stringValue as s, wireValue, type RecordData } from './contracts';

export type TransactionalEmailEvent={
  eventType:string;eventId:string;recipientUID?:string;recipientRole:string;recipientEmail?:string;
  propertyId?:string;recordId?:string;templateId:string;templateVersion:number;
  subject:string;html:string;text:string;idempotencyKey?:string;
  tenancyId?:string;rentPeriod?:string;agreementVersion?:string;scheduledFor?:string;reminderOffset?:number;reminderDueDate?:string;reminderAmount?:string;
};
type UserEvent={eventType:string;eventId:string;recipients?:Array<{uid?:string;role:string;email?:string}>;recipientUIDs?:string[];propertyId?:string;recordId?:string;templateId:string;subject:string;title?:string;bodyHtml:string;bodyText:string;action?:{label:string;path:string}};

const deliveries=()=>getDatabase().collection(COLLECTIONS.emailDeliveries || 'email_deliveries');
const safeError=()=> 'Email provider delivery failed';
const keyFor=(event:TransactionalEmailEvent,email:string)=>event.idempotencyKey||`${event.eventType}:${event.eventId}:${event.recipientUID||email.toLowerCase()}`;
const idFor=(key:string)=>createHash('sha256').update(key).digest('hex');
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const definedFields=(value:RecordData)=>Object.fromEntries(Object.entries(value).filter(([,entry])=>entry!==undefined));
const diagnosticCode=(error:unknown)=>typeof error==='object'&&error!==null&&'code' in error?String(error.code):error instanceof Error?error.name:'UNKNOWN_ERROR';

export function brandedEmail(title:string,bodyHtml:string,bodyText:string,action?:{label:string;path:string}) {
  const base=(process.env.APP_URL||process.env.NEXT_PUBLIC_APP_URL||'').replace(/\/$/,'');
  const href=base&&action?.path?.startsWith('/')?`${base}${action.path}`:'';
  const actionHtml=href?`<p style="margin:28px 0"><a href="${href}" style="background:#A25C42;color:#F8F6F0;text-decoration:none;padding:12px 18px;border-radius:4px;display:inline-block">${action!.label}</a></p>`:'';
  return {html:`<!doctype html><html><body style="margin:0;background:#E6E1D6;color:#242B28;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:auto;background:#F8F6F0;border-top:5px solid #A25C42"><tr><td style="padding:28px"><p style="margin:0 0 28px;font-weight:700;letter-spacing:.04em">PropBank</p><h1 style="font-size:25px;line-height:1.2;margin:0 0 18px">${title}</h1>${bodyHtml}${actionHtml}<p style="border-top:1px solid #D4D0C5;padding-top:18px;margin-top:30px;color:#565C56;font-size:13px">This is an automated account notification from PropBank.</p></td></tr></table></td></tr></table></body></html>`,text:`PropBank\n\n${title}\n\n${bodyText}${href?`\n\n${action!.label}: ${href}`:''}\n\nThis is an automated account notification from PropBank.`};
}

async function resolveRecipient(event:TransactionalEmailEvent) {
  if(event.recipientUID) {
    const snapshot=await getDatabase().collection(COLLECTIONS.users).doc(event.recipientUID).get(),profile=snapshot.data();
    if(!snapshot.exists||profile?.isActive===false||!emailPattern.test(s(profile?.email)))return '';
    return s(profile?.email).toLowerCase();
  }
  const configured=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  return event.recipientRole==='admin'&&configured&&event.recipientEmail?.toLowerCase()===configured&&emailPattern.test(configured)?configured:'';
}

async function deliver(id:string) {
  const ref=deliveries().doc(id),now=new Date(),lease=randomUUID();let value:RecordData|null=null;
  await getDatabase().runTransaction(async tx=>{value=null;const snapshot=await tx.get(ref);if(!snapshot.exists)return;const current=snapshot.data()!,status=s(current.status);if(!(['pending','failed'].includes(status)||status==='sending'&&Number(current.deliveryLeaseUntil?.toMillis?.()||new Date(current.deliveryLeaseUntil||0).getTime())<=now.getTime())||Number(current.retryCount||0)>=5||status==='failed'&&Number(current.nextRetryAt?.toMillis?.()||new Date(current.nextRetryAt||0).getTime())>now.getTime())return;value=current;tx.update(ref,{status:'sending',deliveryLease:lease,deliveryLeaseUntil:new Date(now.getTime()+120000),lastAttemptAt:now,updatedAt:now});});
  if(!value)return 'skipped';
  try{
    if(value.firstAttemptAt&&now.getTime()-new Date(wireValue(value.firstAttemptAt) as string).getTime()>=23*60*60*1000)throw new Error('Delivery reconciliation required');
    if(!value.firstAttemptAt)await ref.update({firstAttemptAt:now});
    const provider=await sendEmail({to:s(value.recipientEmail)||(value.recipientRole==='admin'?process.env.ADMIN_EMAIL||'':''),subject:s(value.subject),html:s(value.html),text:s(value.text)},s(value.idempotencyKey));
    await ref.update({status:'sent',sentAt:now,lastAttemptAt:now,updatedAt:now,retryCount:Number(value.retryCount||0)+1,errorSummary:'',providerMessageId:provider.id||'',deliveryLease:'',deliveryLeaseUntil:now});return 'sent';
  }catch(error){
    console.error('Transactional email delivery failed',{deliveryId:id,eventType:value.eventType});
    await ref.update({status:'failed',lastAttemptAt:now,updatedAt:now,retryCount:Number(value.retryCount||0)+1,errorSummary:error instanceof Error&&error.message==='Delivery reconciliation required'?'Delivery reconciliation required before retry':safeError(),nextRetryAt:new Date(now.getTime()+5*60*1000),deliveryLease:'',deliveryLeaseUntil:now});return 'failed';
  }
}

// Persist alongside the business mutation; no provider calls occur in a transaction.
export function writeEmailOutbox(tx:Transaction,events:TransactionalEmailEvent[]) {
  const now=new Date();
  for(const event of events) {
    const recipientEmail=event.recipientEmail||'',idempotencyKey=keyFor(event,recipientEmail),id=idFor(idempotencyKey);
    tx.create(deliveries().doc(id),definedFields({...event,id,recipientEmail,idempotencyKey,status:'pending',retryCount:0,createdAt:now,updatedAt:now,errorSummary:''}));
  }
}
export function dispatchEmailOutbox(events:TransactionalEmailEvent[]) {
  after(async()=>{for(const event of events)try{await deliver(idFor(keyFor(event,event.recipientEmail||'')));}catch{console.error('Property email outbox dispatch failed',{eventType:event.eventType,eventId:event.eventId});}});
}

export async function enqueueTransactionalEmail(event:TransactionalEmailEvent) {
  const recipientEmail=await resolveRecipient(event);if(!recipientEmail)return {queued:false,reason:'recipient_ineligible'};
  const idempotencyKey=keyFor(event,recipientEmail),id=idFor(idempotencyKey),ref=deliveries().doc(id),now=new Date();
  let created=false;
  await getDatabase().runTransaction(async tx=>{const existing=await tx.get(ref);if(existing.exists)return;created=true;tx.create(ref,definedFields({id,...event,recipientEmail,idempotencyKey,status:'pending',retryCount:0,createdAt:now,updatedAt:now,errorSummary:''}));});
  return {queued:created,id,duplicate:!created};
}

export function queueTransactionalEmail(event:TransactionalEmailEvent){after(async()=>{try{const result=await enqueueTransactionalEmail(event);if(result.queued&&result.id)await deliver(result.id);}catch{/* Business operation already committed; delivery remains best effort until a transactional caller supplies the outbox write. */}});}
export async function processTransactionalEmail(event:TransactionalEmailEvent){
  const adminVisit=event.recipientRole==='admin'&&event.eventType.startsWith('visit.');
  try {
    const result=await enqueueTransactionalEmail(event);
    if(adminVisit)console.info('visit_email_stage',{stage:'admin_record_created',visitId:event.recordId||'',deliveryId:result.id||'',created:!!result.queued,duplicate:!!result.duplicate,reason:result.reason||''});
    if(!result.id)return result.reason==='recipient_ineligible'?'skipped':'failed';
    if(adminVisit)console.info('visit_email_stage',{stage:'admin_resend_attempted',visitId:event.recordId||'',deliveryId:result.id});
    const outcome=await deliver(result.id);
    if(outcome!=='skipped'){if(adminVisit)console.info('visit_email_stage',{stage:'admin_result',visitId:event.recordId||'',deliveryId:result.id,status:outcome});return outcome;}
    const current=await deliveries().doc(result.id).get(),status=current.data()?.status==='sent'?'sent':current.data()?.status==='failed'?'failed':'skipped';
    if(adminVisit)console.info('visit_email_stage',{stage:'admin_result',visitId:event.recordId||'',deliveryId:result.id,status});return status;
  } catch(error) {
    if(adminVisit)console.error('visit_email_stage',{stage:'admin_result',visitId:event.recordId||'',status:'exception',errorCode:diagnosticCode(error)});
    throw error;
  }
}
export async function persistUserEvent(event:UserEvent) {
  const content=brandedEmail(event.title||event.subject,event.bodyHtml,event.bodyText,event.action);
  const recipients:Array<{uid?:string;role:string;email?:string}>=event.recipients||event.recipientUIDs?.map(uid=>({uid,role:'user'}))||[];
  const ids:string[]=[];
  for(const recipient of recipients){const result=await enqueueTransactionalEmail({eventType:event.eventType,eventId:event.eventId,recipientUID:recipient.uid,recipientRole:recipient.role,recipientEmail:recipient.email,propertyId:event.propertyId,recordId:event.recordId,templateId:event.templateId,templateVersion:1,subject:event.subject,...content});if(result.queued&&result.id)ids.push(result.id);}
  if(ids.length)after(async()=>{for(const id of ids)await deliver(id);});
  return {recorded:ids.length};
}
export async function processUserEvent(event:UserEvent) {
  const content=brandedEmail(event.title||event.subject,event.bodyHtml,event.bodyText,event.action);
  const recipients:Array<{uid?:string;role:string;email?:string}>=event.recipients||event.recipientUIDs?.map(uid=>({uid,role:'user'}))||[];
  const outcomes:Array<{role:string;status:string}>=[];
  for(const recipient of recipients)outcomes.push({role:recipient.role,status:await processTransactionalEmail({eventType:event.eventType,eventId:event.eventId,recipientUID:recipient.uid,recipientRole:recipient.role,recipientEmail:recipient.email,propertyId:event.propertyId,recordId:event.recordId,templateId:event.templateId,templateVersion:1,subject:event.subject,...content})});
  return outcomes;
}
export function queueUserEvent(event:UserEvent){after(async()=>{try{await persistUserEvent(event);}catch{console.error('Transactional email event persistence failed',{eventType:event.eventType,eventId:event.eventId});}});}

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
  if(value.recipientRole==='owner'&&s(value.recipientUID)!==s(property.ownerUID)||value.recipientRole==='tenant'&&s(value.recipientUID)!==s(tenant.userUID))return false;
  const expectedSchedule=(due:string)=>{const parsed=Date.parse(`${due}T00:00:00Z`);return Number.isFinite(parsed)?new Date(parsed-Number(value.reminderOffset||0)*86400000).toISOString().slice(0,10):'';};
  if(value.eventType==='agreement.expiry_reminder'){const due=reminderDate(tenant.leaseEndDate||property.agreementEndDate);return due===s(value.reminderDueDate)&&expectedSchedule(due)===s(value.scheduledFor)&&s(tenant.agreementVersion||property.agreementVersion||property.tenancyRevision||value.reminderDueDate)===s(value.agreementVersion);}
  const ledger=isRecord(property.rentLedger)?property.rentLedger:{},period=s(value.rentPeriod);if(isRecord(ledger[period])&&ledger[period].status==='paid')return false;
  const due=Number(tenant.paymentDueDate||property.paymentDueDate),match=/^(\d{4})-(\d{2})$/.exec(period);if(!match||!Number.isInteger(due)||due<1||due>31)return false;const year=Number(match[1]),month=Number(match[2]),day=Math.min(due,new Date(Date.UTC(year,month,0)).getUTCDate()),currentDue=`${period}-${String(day).padStart(2,'0')}`;
  return currentDue===s(value.reminderDueDate)&&expectedSchedule(currentDue)===s(value.scheduledFor)&&s(tenant.monthlyRent||property.monthlyRent)===s(value.reminderAmount);
}

export async function retryEmailDelivery(request:Request,id:string) {
  const user=await identity(request);if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
  let req:RecordData;try{req=await readObject(request);}catch{return plainError('Invalid JSON',400);}
  if(Object.keys(req).length)throw new ApiError(400,'Retry does not accept message or recipient changes');
  const ref=deliveries().doc(id);
  const snapshot=await ref.get();if(!snapshot.exists)throw new ApiError(404,'Delivery not found');if(!await reminderIsCurrent(snapshot.data()!))throw new ApiError(409,'Reminder is obsolete and cannot be retried');
  await getDatabase().runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists)throw new ApiError(404,'Delivery not found');const value=doc.data()!;if(!(['failed','pending'].includes(s(value.status))||value.status==='sending'&&Number(value.deliveryLeaseUntil?.toMillis?.()||new Date(value.deliveryLeaseUntil||0).getTime())<=Date.now())||Number(value.retryCount||0)>=5)throw new ApiError(409,'Delivery is not eligible for retry');tx.update(ref,{status:'pending',updatedAt:new Date(),errorSummary:'',nextRetryAt:null});});
  after(()=>deliver(id));return jsonResponse({success:true,message:'Delivery queued for retry'});
}
