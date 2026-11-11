import 'server-only';
import {recordRead} from '../read-budget';
import { getFirebaseAdminAuth } from '../firebase-admin';
import { createHash, randomUUID } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import { after } from 'next/server';
import { AccessError } from '../auth';
import { COLLECTIONS, getDatabase } from '../firestore';
import { ApiError, jsonResponse, plainError } from '../http';
import { identity, readObject } from './domain-contracts';
import { sendEmail, EmailConfigurationError, EmailProviderError } from './resend';
import { isRecord, stringValue as s, wireValue, type RecordData } from './contracts';
import {rentForBillingPeriod} from '@/lib/rent-resolution';
import {normalizeEmailAddress} from '@/lib/email-address';
import {currentConnectionState} from '@/lib/relationship-link-state';

export type TransactionalEmailEvent={
  eventType:string;eventId:string;recipientUID?:string;recipientRole:string;recipientEmail?:string;
  propertyId?:string;recordId?:string;templateId:string;templateVersion:number;
  subject:string;html:string;text:string;idempotencyKey?:string;
  invitationClaimId?:string;tenancyId?:string;rentPeriod?:string;agreementVersion?:string;scheduledFor?:string;reminderOffset?:number;reminderDueDate?:string;reminderAmount?:string;
};
export type UserEvent={actorUID?:string;eventType:string;eventId:string;recipients?:Array<{uid?:string;role:string;email?:string}>;recipientUIDs?:string[];propertyId?:string;recordId?:string;templateId:string;subject:string;title?:string;bodyHtml:string;bodyText:string;action?:{label:string;path:string}};

const deliveries=()=>getDatabase().collection(COLLECTIONS.emailDeliveries || 'email_deliveries');
const safeError=()=> 'Email provider delivery failed';
const keyFor=(event:TransactionalEmailEvent,email:string)=>event.idempotencyKey||`${event.eventType}:${event.eventId}:${event.recipientUID||email.toLowerCase()}`;
const idFor=(key:string)=>createHash('sha256').update(key).digest('hex');
export const emailDeliveryId=(event:TransactionalEmailEvent)=>idFor(keyFor(event,event.recipientEmail||''));
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
    if(!snapshot.exists||profile?.isActive===false)return '';
    if(/^(relationship\.|owner_verification\.|tenancy\.)/.test(event.eventType)) {
      try {
        const account=await getFirebaseAdminAuth().getUser(event.recipientUID);
        return !account.disabled&&account.emailVerified&&emailPattern.test(account.email||'')?(account.email||'').toLowerCase():'';
      } catch(error) {
        if((error as {code?:string}).code==='auth/user-not-found')return '';
        throw error;
      }
    }
    if(!emailPattern.test(s(profile?.email)))return '';
    return s(profile?.email).toLowerCase();
  }
  // Previous-address security notices are constructed exclusively by trusted
  // server account code. This permits that address to be notified after the
  // authoritative Firebase email has changed without accepting a browser-
  // supplied destination.
  if(event.recipientRole==='previous_email'&&event.eventType.startsWith('user.email_')&&emailPattern.test(s(event.recipientEmail)))return s(event.recipientEmail).toLowerCase();
  const configured=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  return event.recipientRole==='admin'&&configured&&event.recipientEmail?.toLowerCase()===configured&&emailPattern.test(configured)?configured:'';
}

async function deliver(id:string) {
  const ref=deliveries().doc(id),now=new Date(),lease=randomUUID();let value:RecordData|null=null;
  await getDatabase().runTransaction(async tx=>{value=null;const snapshot=await tx.get(ref);if(!snapshot.exists)return;const current=snapshot.data()!,status=s(current.status);if(['pending','failed','sending'].includes(status)&&Number(current.retryCount||0)>=5){tx.update(ref,{status:'exhausted',updatedAt:now});return;}if(!(['pending','failed'].includes(status)||status==='sending'&&Number(current.deliveryLeaseUntil?.toMillis?.()||new Date(current.deliveryLeaseUntil||0).getTime())<=now.getTime())||Number(current.retryCount||0)>=5||status==='failed'&&Number(current.nextRetryAt?.toMillis?.()||new Date(current.nextRetryAt||0).getTime())>now.getTime())return;value=current;tx.update(ref,{status:'sending',deliveryLease:lease,deliveryLeaseUntil:new Date(now.getTime()+120000),recoveryAt:new Date(now.getTime()+120000),lastAttemptAt:now,updatedAt:now});});
  if(!value)return 'skipped';
  const finish=async(update:RecordData)=>getDatabase().runTransaction(async tx=>{const fresh=await tx.get(ref);if(fresh.data()?.deliveryLease===lease)tx.update(ref,update);});
  try{
    if(!await invitationIsCurrent(value)||!await reminderIsCurrent(value)){await finish({status:'cancelled',errorSummary:'Invitation is no longer eligible',updatedAt:now,deliveryLease:'',deliveryLeaseUntil:now});return 'skipped';}
    if(value.firstAttemptAt&&now.getTime()-new Date(wireValue(value.firstAttemptAt) as string).getTime()>=23*60*60*1000)throw new Error('Delivery reconciliation required');
    if(!value.firstAttemptAt)await finish({firstAttemptAt:now});
    const recipient=s(value.recipientEmail)||(value.recipientRole==='admin'?process.env.ADMIN_EMAIL||'':'');
    if(value.recipientRole==='admin'&&!emailPattern.test(recipient))throw new EmailConfigurationError('ADMIN_EMAIL must be a valid recipient address');
    const provider=await sendEmail({to:recipient,subject:s(value.subject),html:s(value.html),text:s(value.text)},s(value.idempotencyKey));
    await finish({status:'sent',sentAt:now,lastAttemptAt:now,updatedAt:now,retryCount:Number(value.retryCount||0)+1,errorSummary:'',failureCategory:'',providerMessageId:provider.id||'',deliveryLease:'',deliveryLeaseUntil:now});return 'sent';
  }catch(error){
    console.error(`Transactional email delivery failed ${JSON.stringify({deliveryId:id,eventType:value.eventType,...(error instanceof EmailProviderError?{providerStatus:error.status,providerErrorCode:error.providerCode}:{}),configurationFailure:error instanceof EmailConfigurationError})}`);
    const exhausted=Number(value.retryCount||0)+1>=5,permanent=error instanceof EmailProviderError&&error.providerCode!=='sender_domain_not_verified'&&[400,404,422].includes(error.status),reconciliation=error instanceof Error&&error.message==='Delivery reconciliation required';
    await finish({status:exhausted?'exhausted':permanent?'permanent_failure':reconciliation?'reconciliation_required':'failed',recoveryAt:new Date(now.getTime()+Math.min(60,5*2**Number(value.retryCount||0))*60000),lastAttemptAt:now,updatedAt:now,retryCount:Number(value.retryCount||0)+1,errorSummary:error instanceof EmailConfigurationError?error.message:error instanceof EmailProviderError&&error.providerCode==='sender_domain_not_verified'?'Sender domain is not verified in Resend; correct its DNS records':error instanceof Error&&error.message==='Delivery reconciliation required'?'Delivery reconciliation required before retry':safeError(),failureCategory:error instanceof EmailConfigurationError?'configuration':'provider_or_transport',...(error instanceof EmailProviderError?{providerStatus:error.status,providerErrorCode:error.providerCode}:{}),nextRetryAt:new Date(now.getTime()+5*60*1000),deliveryLease:'',deliveryLeaseUntil:now});return 'failed';
  }
}

// Persist alongside the business mutation; no provider calls occur in a transaction.
export function writeEmailOutbox(tx:Transaction,events:TransactionalEmailEvent[]) {
  const now=new Date();
  for(const event of events) {
    const recipientEmail=event.recipientEmail||'',idempotencyKey=keyFor(event,recipientEmail),id=idFor(idempotencyKey);
    tx.create(deliveries().doc(id),definedFields({...event,id,recipientEmail,idempotencyKey,status:'pending',recoveryAt:now,retryCount:0,createdAt:now,updatedAt:now,errorSummary:''}));
  }
}
export function dispatchEmailOutbox(events:TransactionalEmailEvent[]) {
  // The business transaction has committed. Registration failure must leave a
  // recoverable pending delivery, never turn a saved property into an HTTP 500.
  try{after(async()=>{for(const event of events)try{await deliver(idFor(keyFor(event,event.recipientEmail||'')));}catch{console.error('Property email outbox dispatch failed',{eventType:event.eventType});}});}
  catch{console.error('Email post-response dispatch unavailable; persisted outbox requires authorized retry');}
}

export async function enqueueTransactionalEmail(event:TransactionalEmailEvent) {
  const recipientEmail=await resolveRecipient(event);if(!recipientEmail)return {queued:false,reason:'recipient_ineligible'};
  const idempotencyKey=keyFor(event,recipientEmail),id=idFor(idempotencyKey),ref=deliveries().doc(id),now=new Date();
  let created=false;
  await getDatabase().runTransaction(async tx=>{const existing=await tx.get(ref);if(existing.exists)return;created=true;tx.create(ref,definedFields({id,...event,recipientEmail,idempotencyKey,status:'pending',recoveryAt:now,retryCount:0,createdAt:now,updatedAt:now,errorSummary:''}));});
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
  let id='';await getDatabase().runTransaction(async tx=>{const staged=await stageUserEvent(tx,event);id=staged.id;staged.write();});
  dispatchNotificationIntents([id]);return {recorded:1};
}
export async function processUserEvent(event:UserEvent) {
  const content=brandedEmail(event.title||event.subject,event.bodyHtml,event.bodyText,event.action);
  const recipients:Array<{uid?:string;role:string;email?:string}>=event.recipients||event.recipientUIDs?.map(uid=>({uid,role:'user'}))||[];
  const outcomes:Array<{role:string;status:string}>=[];
  for(const recipient of recipients)outcomes.push({role:recipient.role,status:await processTransactionalEmail({eventType:event.eventType,eventId:event.eventId,recipientUID:recipient.uid,recipientRole:recipient.role,recipientEmail:recipient.email,propertyId:event.propertyId,recordId:event.recordId,templateId:event.templateId,templateVersion:1,subject:event.subject,...content})});
  return outcomes;
}
export function queueUserEvent(event:UserEvent){after(async()=>{try{await persistUserEvent(event);}catch{console.error('Transactional email event persistence failed',{eventType:event.eventType});}});}

export async function listEmailDeliveries(request:Request) {
  const user=await identity(request);if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
  const params=new URL(request.url).searchParams;const status=params.get('status')||'',eventType=params.get('eventType')||'';
  const pageSize=Number(params.get('pageSize')||100),after=params.get('after')||'';
  const legacy=params.get('legacy')==='true';
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>200||after.includes('/')||after.length>1500)throw new ApiError(400,'Invalid delivery page');
  // Staged deliveries have createdAt. Snapshot cursors disambiguate equal timestamps.
  // Filter bounded pages locally to avoid requiring new composite indexes.
  let query:FirebaseFirestore.Query=deliveries().orderBy(legacy?'__name__':'createdAt','desc').limit(pageSize+1);
  if(after){const cursor=await deliveries().doc(after).get();if(!cursor.exists||!legacy&&cursor.data()?.createdAt===undefined)throw new ApiError(409,'Delivery page changed; refresh history');query=query.startAfter(cursor);}
  const snapshot=await query.get(),page=snapshot.docs.slice(0,pageSize);
  recordRead('delivery_page',snapshot.docs.length);
  let rows:RecordData[]=page.map(doc=>({id:doc.id,...doc.data()}));
  if(legacy)rows=rows.filter(row=>row.createdAt===undefined||row.createdAt===null);
  if(status)rows=rows.filter(row=>row.status===status);if(eventType)rows=rows.filter(row=>row.eventType===eventType);
  rows.sort((a,b)=>+new Date(b.createdAt as string)-+new Date(a.createdAt as string));
  return jsonResponse({success:true,deliveries:wireValue(rows.map(row=>({...row,html:undefined,text:undefined,event:undefined,subject:s(row.subject),recipientEmail:s(row.recipientEmail).replace(/(^.).*(@.*$)/,'$1***$2')}))),nextCursor:snapshot.docs.length>pageSize?page.at(-1)?.id:null});
}

function reminderDate(value:unknown){const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(s(value));return match?`${match[1]}-${match[2]}-${match[3]}`:'';}
async function invitationIsCurrent(value:RecordData){
  if(!['relationship.owner_invitation','relationship.tenant_invitation'].includes(s(value.eventType)))return true;
  if(!value.invitationClaimId||!value.propertyId)return false;
  const claim=(await getDatabase().collection('relationship_links').doc(s(value.invitationClaimId)).get()).data();
  if(!claim||claim.propertyId!==value.propertyId||['linked','rejected','expired'].includes(currentConnectionState(claim)))return false;
  const sender=(await getDatabase().collection(COLLECTIONS.users).doc(s(claim.invitationAuthorizedByUID||claim.createdByUID)).get()).data();
  if(!sender||sender.isActive===false)return false;
  const property=(await getDatabase().collection(COLLECTIONS.properties).doc(s(value.propertyId)).get()).data();
  if(!property||property.isActive===false)return false;
  const email=normalizeEmailAddress(value.recipientEmail);
  if(value.eventType==='relationship.owner_invitation')return claim.relationship==='owner'&&property.createdAs==='tenant'&&!property.ownerUID&&email!==null&&email===normalizeEmailAddress(property.reportedOwner?.email);
  if(claim.relationship!=='tenant'||!claim.ownerUID||claim.ownerUID!==property.ownerUID||claim.authorizedByUID!==claim.ownerUID||(claim.invitationAuthorizedByUID||claim.createdByUID)!==claim.ownerUID)return false;
  const tenant=(await getDatabase().collection(COLLECTIONS.tenants).doc(s(claim.tenantId)).get()).data();
  return !!tenant&&tenant.propertyId===value.propertyId&&tenant.ownerUID===property.ownerUID&&tenant.isActive===true&&!tenant.userUID&&tenant.linkConfirmationRequired===true&&email!==null&&email===normalizeEmailAddress(tenant.email);
}
async function reminderIsCurrent(value:RecordData){
  if(!['rent.reminder','agreement.expiry_reminder'].includes(s(value.eventType)))return true;
  const snapshot=await getDatabase().collection(COLLECTIONS.properties).doc(s(value.propertyId)).get();if(!snapshot.exists)return false;
  const property=snapshot.data()!;if(property.isActive!==true||property.status==='inactive'||property.rentalStatus!=='rented'||['terminated','expired','cancelled'].includes(s(property.agreementStatus)))return false;
  const tenants=(Array.isArray(property.tenants)?property.tenants:[]).filter((tenant:RecordData)=>tenant&&tenant.isActive===true),tenant=tenants.find((entry:RecordData)=>s(entry.id||entry.userUID)===s(value.tenancyId));if(!tenant)return false;
  if(value.recipientRole==='owner'&&s(value.recipientUID)!==s(property.ownerUID)||value.recipientRole==='tenant'&&s(value.recipientUID)!==s(tenant.userUID))return false;
  const expectedSchedule=(due:string)=>{const parsed=Date.parse(`${due}T00:00:00Z`);return Number.isFinite(parsed)?new Date(parsed-Number(value.reminderOffset||0)*86400000).toISOString().slice(0,10):'';};
  if(value.eventType==='agreement.expiry_reminder'){const due=reminderDate(tenant.leaseEndDate||property.agreementEndDate);return due===s(value.reminderDueDate)&&expectedSchedule(due)===s(value.scheduledFor)&&s(tenant.agreementVersion||property.agreementVersion||property.tenancyRevision||value.reminderDueDate)===s(value.agreementVersion);}
  const ledger=isRecord(property.rentLedger)?property.rentLedger:{},period=s(value.rentPeriod);if(isRecord(ledger[period])&&ledger[period].status==='paid')return false;
  const resolved=rentForBillingPeriod(property,period,tenant),currentDue=resolved.dueDate,currentAmount=resolved.amount;
  return currentDue===s(value.reminderDueDate)&&expectedSchedule(currentDue)===s(value.scheduledFor)&&currentAmount===s(value.reminderAmount);
}

export async function retryEmailDelivery(request:Request,id:string) {
  const user=await identity(request);if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
  let req:RecordData;try{req=await readObject(request);}catch{return plainError('Invalid JSON',400);}
  if(Object.keys(req).length)throw new ApiError(400,'Retry does not accept message or recipient changes');
  const ref=deliveries().doc(id);
  const snapshot=await ref.get();if(!snapshot.exists)throw new ApiError(404,'Delivery not found');if(!await reminderIsCurrent(snapshot.data()!))throw new ApiError(409,'Reminder is obsolete and cannot be retried');if(!await invitationIsCurrent(snapshot.data()!))throw new ApiError(409,'Invitation is obsolete and cannot be retried');
  await getDatabase().runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists)throw new ApiError(404,'Delivery not found');const value=doc.data()!;if(!(['failed','pending'].includes(s(value.status))||value.status==='sending'&&Number(value.deliveryLeaseUntil?.toMillis?.()||new Date(value.deliveryLeaseUntil||0).getTime())<=Date.now())||Number(value.retryCount||0)>=5)throw new ApiError(409,'Delivery is not eligible for retry');tx.update(ref,{status:'pending',recoveryAt:new Date(),updatedAt:new Date(),errorSummary:'',nextRetryAt:null});});
  after(()=>recoverNotification(id));return jsonResponse({success:true,message:'Delivery queued for retry'});
}

/** An unresolved recipient is staged durably before the authoritative business write. */
export async function stageUserEvent(tx:Transaction,event:UserEvent){
 const id=idFor(`notification-intent:${event.eventType}:${event.eventId}`),ref=deliveries().doc(id),existing=await tx.get(ref),now=new Date();
 const recipients=event.recipients||event.recipientUIDs?.map(uid=>({uid,role:'user'}))||[];
 if(recipients.length>60)throw new ApiError(400,'Notification recipient limit exceeded');
 const stored=JSON.parse(JSON.stringify(event)),mail:TransactionalEmailEvent[]=[],addresses=new Set<string>(),content=brandedEmail(event.title||event.subject,event.bodyHtml,event.bodyText,event.action);
 // Resolve recipients before writes; provider calls are strictly post-commit.
 for(const recipient of recipients){const e:TransactionalEmailEvent={eventType:event.eventType,eventId:event.eventId,recipientUID:recipient.uid,recipientRole:recipient.role,recipientEmail:'email' in recipient?recipient.email:undefined,propertyId:event.propertyId,recordId:event.recordId,templateId:event.templateId,templateVersion:1,subject:event.subject,...content};const address=await resolveRecipient(e);if(address&&!addresses.has(address)){addresses.add(address);e.recipientEmail=address;const existingMail=await tx.get(deliveries().doc(emailDeliveryId(e)));if(!existingMail.exists&&!mail.some(m=>emailDeliveryId(m)===emailDeliveryId(e)))mail.push(e);}}
 return {id,write:()=>{if(!existing.exists)tx.create(ref,{id,kind:'notification_intent',eventType:'notification.intent',sourceEventType:event.eventType,event:stored,status:'pending',retryCount:0,recoveryAt:now,createdAt:now,updatedAt:now});writeEmailOutbox(tx,mail);}};
}
export function dispatchNotificationIntents(ids:string[]){try{after(async()=>{for(const id of ids)try{await recoverNotification(id);}catch{console.error('Notification recovery deferred');}});}catch{/* Durable intent remains pending. */}}
export async function recoverNotification(id:string,sendChildren=true){
 const ref=deliveries().doc(id),snapshot=await ref.get();if(!snapshot.exists)return 'skipped';const value=snapshot.data()!;
 if(value.kind!=='notification_intent')return deliver(id);
 const now=new Date(),lease=randomUUID();let claimed=false;
 const finish=async(update:RecordData)=>getDatabase().runTransaction(async tx=>{const fresh=await tx.get(ref);if(fresh.data()?.deliveryLease===lease)tx.update(ref,update);});
 await getDatabase().runTransaction(async tx=>{claimed=false;const doc=await tx.get(ref),v=doc.data();if(v&&['pending','failed','sending'].includes(s(v.status))&&Number(v.retryCount||0)>=5){tx.update(ref,{status:'exhausted',updatedAt:now});return;}if(!v||!['pending','failed','sending'].includes(s(v.status))||Number(v.retryCount||0)>=5||v.status==='sending'&&new Date(wireValue(v.deliveryLeaseUntil) as string).getTime()>now.getTime()||v.status==='failed'&&new Date(wireValue(v.recoveryAt) as string).getTime()>now.getTime())return;claimed=true;tx.update(ref,{status:'sending',deliveryLease:lease,deliveryLeaseUntil:new Date(now.getTime()+120000),recoveryAt:new Date(now.getTime()+120000)});});
 if(!claimed)return 'skipped';
 try{
  const event=value.event as UserEvent,content=brandedEmail(event.title||event.subject,event.bodyHtml,event.bodyText,event.action),recipients:Array<{uid?:string;role:string;email?:string}>=event.recipients||event.recipientUIDs?.map(uid=>({uid,role:'user'}))||[],ids:string[]=[];
  const addresses=new Set<string>();
  for(const recipient of recipients){const mail:TransactionalEmailEvent={eventType:event.eventType,eventId:event.eventId,recipientUID:recipient.uid,recipientRole:recipient.role,recipientEmail:recipient.email,propertyId:event.propertyId,recordId:event.recordId,templateId:event.templateId,templateVersion:1,subject:event.subject,...content};const address=await resolveRecipient(mail);if(address&&!addresses.has(address)){addresses.add(address);const result=await enqueueTransactionalEmail(mail);if(result.id)ids.push(result.id);}}
  // Admin previews contain policy text only; participant templates remain private.
  if(/^(rent\.payment|maintenance\.|visit\.|negotiation\.|owner_verification\.|user\.(mobile|profile)|agent\.)/.test(event.eventType)){
   const noticeId=event.eventType.startsWith('visit.')?idFor(`admin-activity:${event.eventType}:${event.eventId.replace(/:(requester|admin|owner)$/,'')}`):id;
   const nref=getDatabase().collection(COLLECTIONS.adminNotifications).doc(noticeId);
   await getDatabase().runTransaction(async tx=>{const existing=await tx.get(nref);if(!existing.exists)tx.create(nref,{id,type:event.eventType.startsWith('visit.')?'visit_update':event.eventType.startsWith('negotiation.')?'negotiation_update':event.eventType.startsWith('maintenance.')?'service_request':event.eventType,eventType:event.eventType,ownerId:recipients.find(r=>r.role==='owner')?.uid||'',userId:recipients.find(r=>r.role==='customer'||r.role==='requester')?.uid||'',title:'Administrative activity',message:`${event.eventType.replaceAll('.',' ').replaceAll('_',' ')} recorded. Review the authorized details.`,propertyId:event.propertyId||'',recordId:event.recordId||'',relatedId:event.recordId||'',actorUID:event.actorUID||'',eventId:event.eventId,lifecycle:true,isRead:false,readByUIDs:[],timestamp:now,createdAt:now,emailStatus:process.env.ADMIN_EMAIL?'queued':'unconfigured'});});
   if(!event.eventType.startsWith('visit.')&&!recipients.some(r=>r.role==='admin')&&process.env.ADMIN_EMAIL&&!addresses.has(process.env.ADMIN_EMAIL.trim().toLowerCase())){const result=await enqueueTransactionalEmail({eventType:`admin.${event.eventType}`,eventId:event.eventId,recipientRole:'admin',recipientEmail:process.env.ADMIN_EMAIL,propertyId:event.propertyId,recordId:event.recordId,templateId:'admin-activity',templateVersion:1,subject:'PropBank administrative activity',...brandedEmail('Administrative activity',`<p>${event.eventType.replaceAll('.',' ').replaceAll('_',' ')} recorded.</p>`,`${event.eventType} recorded.`,{label:'Review notifications',path:'/admin?tab=notifications'})});if(result.id)ids.push(result.id);}
  }
  await finish({status:'processed',updatedAt:new Date(),deliveryLease:'',deliveryLeaseUntil:now});
  if(sendChildren)for(const child of ids)try{await deliver(child);}catch{/* Pending child is independently recoverable. */}
  return 'processed';
 }catch{
  const retryCount=Number(value.retryCount||0)+1;await finish({status:retryCount>=5?'exhausted':'failed',retryCount,recoveryAt:new Date(Date.now()+Math.min(60,5*2**retryCount)*60000),updatedAt:new Date(),errorSummary:'Notification staging failed; retry pending',deliveryLease:'',deliveryLeaseUntil:now});return 'failed';
 }
}
