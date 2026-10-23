import 'server-only';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { COLLECTIONS, getDatabase } from '../firestore';
import { model, storeModel, wireModel, wireValue, parsePrice, isRecord, stringValue as s, type RecordData } from './contracts';
import { getUser, saveUser } from './users';
import { brandedEmail, persistUserEvent, type TransactionalEmailEvent } from './transactional-email';

export interface Email { to:string; subject:string; html:string }
export function escapeHtml(value:string):string {
  const entities:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return value.replace(/[&<>"']/g,character=>entities[character]);
}
export type TrustedTemplateHtml={readonly __trustedTemplateHtml:string};
export const trustedTemplateHtml=(html:string):TrustedTemplateHtml=>({__trustedTemplateHtml:html});
export function formatTemplate(template:string,values:Array<string|TrustedTemplateHtml>) {
  let index=0;
  return template.replace(/%%|%s|%d/g,token=>{if(token==='%%')return '%';const value=values[index++]??'';return typeof value==='string'?escapeHtml(value):value.__trustedTemplateHtml;});
}
export async function sendEmail(mail:Email,idempotencyKey?:string) {
  if (!mail.to || !process.env.RESEND_API_KEY) return;
  const from=process.env.FROM_EMAIL || 'connect@propbank.shop';
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json',...(idempotencyKey!==undefined?{'Idempotency-Key':idempotencyKey}:{})},body:JSON.stringify({from:`Propbank <${from}>`,to:[mail.to],subject:mail.subject,html:mail.html.replaceAll('connectpropbank@gmail.com',from)}),signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Property email delivery failed');
}
export async function bestEffort<T>(action:()=>Promise<T>):Promise<T|null> {
  try { return await action(); } catch { return null; }
}
export function queueEmail(mail:Email) {
  if (!mail.to) return;
  after(async()=>{ await bestEffort(()=>sendEmail(mail)); });
}
const entries=(value:unknown):RecordData[]=>Array.isArray(value)?value.filter(isRecord):[];
const fullName=(tenant:RecordData)=>`${s(tenant.firstName)} ${s(tenant.lastName)}`;

async function notify(property:RecordData,type:'property_added'|'want_to_sell'|'want_to_sell_cancelled') {
  const owner=await bestEffort(()=>getUser(s(property.ownerUID)));
  const tenant=entries(property.tenants)[0] || {};
  const now=new Date();
  const added=type==='property_added';
  const cancelled=type==='want_to_sell_cancelled';
  const notification=model('AdminNotification',{
    id:randomUUID(),type,
    title:added?'New Property Added':cancelled?'Property Owner Cancelled Sell Request':'Property Owner Wants to Sell',
    message:added&&property.createdAs==='tenant'?`Tenant supplied rental property "${s(property.title)}"; owner details await verification.`:added?`New property "${s(property.title)}" has been added by owner: ${s(property.ownerName)}`:cancelled?`Property owner ${s(property.ownerName)} has cancelled the request to sell property: ${s(property.title)}`:`Property owner ${s(property.ownerName)} wants to sell property: ${s(property.title)}`,
    propertyId:property.id,ownerId:property.ownerUID,ownerName:property.ownerName,
    ownerPhone:added?property.ownerPhone:owner?.phoneNumber||'',
    ownerEmail:added?property.ownerEmail:property.ownerEmail||owner?.email||'',ownerRole:owner?.role||'',
    tenantName:entries(property.tenants).length?fullName(tenant):'',tenantEmail:tenant.email||'',tenantPhone:tenant.phone||'',
    buyers:entries(property.buyers).length?JSON.stringify(entries(property.buyers).map(b=>wireModel('BuyerInfo',b))):'',
    ...(added?{propertyTitle:property.title,propertyAddress:property.location,propertyListingType:property.listingType}:{}),
    timestamp:new Date(Math.floor(now.getTime()/1000)*1000),isRead:false,priority:added||cancelled?'medium':'high',createdAt:now,updatedAt:now,
  });
  await getDatabase().collection(COLLECTIONS.adminNotifications).doc(s(notification.id)).set(storeModel('AdminNotification',notification));
}
async function linkUsers(property:RecordData,tenants:RecordData[]) {
  for (const tenant of tenants) {
    if (!s(tenant.userUID)) continue;
    await bestEffort(async()=>{
      const user=await getUser(s(tenant.userUID));
      if (!user) return;
      Object.assign(user,{rentedPropertyId:property.id,rentedPropertyOwnerId:property.ownerUID,rentedPropertyOwnerName:property.ownerName,updatedAt:new Date()});
      await saveUser(user);
    });
  }
}
async function tenantAddedEmails(property:RecordData,previous:RecordData[],tenants:RecordData[]) {
  const oldEmails=new Set(previous.map(t=>s(t.email).trim().toLowerCase()).filter(Boolean));
  for (const tenant of tenants) {
    const email=s(tenant.email);
    if ((email.trim() && oldEmails.has(email.trim().toLowerCase())) || (tenant.isActive!==true && tenant.isActive!=='true')) continue;
    if (![tenant.email,tenant.firstName,tenant.lastName,tenant.phone].some(v=>s(v).trim())) continue;
    const tenantUID=s(tenant.userUID);if(!tenantUID)continue;
    await bestEffort(()=>persistUserEvent({eventType:'tenancy.tenant_assigned',eventId:`${s(property.id)}:${s(tenant.id)||tenantUID}:property-effect-assigned`,recipients:[...(property.ownerUID?[{uid:s(property.ownerUID),role:'owner'}]:[]),{uid:tenantUID,role:'tenant'}],propertyId:s(property.id),recordId:s(tenant.id)||s(property.id),templateId:'tenant-assigned',subject:'Tenant assignment confirmed',title:'Tenant relationship updated',bodyHtml:`<p>A tenant was assigned to <strong>${escapeHtml(s(property.title))}</strong>.</p>`,bodyText:`A tenant was assigned to ${s(property.title)}.`,action:{label:'View rental details',path:`/manage-property/${s(property.id)}`}}));
  }
}
export async function propertyCreatedEffects(property:RecordData) {
  await bestEffort(()=>notify(property,'property_added'));
  const tenants=entries(property.tenants);
  if(property.createdAs==='tenant')return;
  if (tenants.length) {
    await bestEffort(()=>tenantAddedEmails(property,[],tenants));
    await linkUsers(property,tenants);
  }
}
export async function propertyUpdatedEffects(before:RecordData,property:RecordData,updates:RecordData) {
  const previous=entries(before.tenants);
  const tenants=entries(property.tenants);
  if (Array.isArray(updates.tenants)) {
    const raw=entries(updates.tenants);
    await linkUsers(property,raw);
    await bestEffort(()=>tenantAddedEmails(property,previous,raw));
  }
  if (typeof updates.wantToSell==='boolean' && updates.wantToSell!==before.wantToSell) await bestEffort(()=>notify(property,updates.wantToSell?'want_to_sell':'want_to_sell_cancelled'));
  const termsChanged=['monthlyRent','securityDeposit','paymentDueDate','agreementStartDate','agreementEndDate'].some(field=>field in updates&&updates[field]!==before[field])||Array.isArray(updates.tenants)&&tenants.some(tenant=>{const old=previous.find(entry=>entry.id===tenant.id);return old&&['monthlyRent','securityDeposit','paymentDueDate','leaseStartDate','leaseEndDate'].some(field=>tenant[field]!==old[field]);});
  if(termsChanged)await bestEffort(()=>persistUserEvent({eventType:'tenancy.rental_terms_updated',eventId:`${s(property.id)}:${String(wireValue(property.updatedAt))}:terms`,recipients:[...(property.ownerUID?[{uid:s(property.ownerUID),role:'owner'}]:[]),...tenants.filter(tenant=>tenant.isActive===true&&tenant.userUID).map(tenant=>({uid:s(tenant.userUID),role:'tenant'}))],propertyId:s(property.id),recordId:s(property.id),templateId:'rental-terms-updated',subject:'Rental terms updated',title:'Rental terms updated',bodyHtml:`<p>The rental terms for <strong>${escapeHtml(s(property.title))}</strong> were updated.</p>`,bodyText:`The rental terms for ${s(property.title)} were updated.`,action:{label:'View rental details',path:`/manage-property/${s(property.id)}`}}));
}

export function propertyNotificationEvents(property:RecordData,submitter:RecordData,status='pending_review'):TransactionalEmailEvent[] {
  const id=s(property.id),revision=Number(property.moderationRevision||1),title=s(property.title);
  const label=status.replaceAll('_',' '),reason=s(property.moderationReason),submitted=status==='pending_review';
  const subject=submitted?'Property submitted - Pending Review':`Property ${label}`;
  const body=`Property: ${title}\nReference ID: ${id}\nStatus: ${label}${reason?`\nAdmin reason: ${reason}`:''}`;
  const make=(role:string,uid:string,email:string,text:string,path:string):TransactionalEmailEvent=>{
    const notificationSubject=submitted&&role==='admin'?'PropBank \u2013 New Property Submitted for Review':subject;
    return ({
    eventType:submitted?'property.submitted':`property.${status}`,eventId:`property:${id}:${revision}:${status}`,
    recipientUID:uid,recipientRole:role,recipientEmail:email,propertyId:id,recordId:id,templateId:'property-review',templateVersion:1,subject:notificationSubject,
    ...brandedEmail(notificationSubject,`<p>${escapeHtml(text).replaceAll('\n','<br>')}</p>`,text,{label:submitted&&role==='admin'?'Review property':'View property',path}),
  });
  };
  const recipientUID=s(submitter.uid),email=s(submitter.email);
  const events=[make('owner',recipientUID,email,body,`/property/${encodeURIComponent(id)}`)];
  if(submitted) {
    const submittedAt=wireValue(property.createdAt);
    const adminBody=`Property: ${title}\nReference ID: ${id}\nLocation: ${s(property.location)||s(property.address)}\nOwner name: ${s(property.ownerName)||s(isRecord(property.reportedOwner)?property.reportedOwner.personName||property.reportedOwner.companyName:'')||'Not supplied'}\nOwner email: ${s(property.ownerEmail)||s(isRecord(property.reportedOwner)?property.reportedOwner.email:'')||'Not supplied'}\nSubmission date: ${typeof submittedAt==='string'?submittedAt:'Not recorded'}\nStatus: Pending Review\nSubmitter: ${s(submitter.name)}\nEmail: ${email}\nPhone: ${s(submitter.phoneNumber)}\nUser ID: ${recipientUID}`;
    events.push(make('admin','',(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),adminBody,`/admin?tab=properties&propertyId=${encodeURIComponent(id)}`));
  }
  return events;
}
