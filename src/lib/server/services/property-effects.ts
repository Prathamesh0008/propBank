import 'server-only';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { COLLECTIONS, getDatabase } from '../firestore';
import { model, storeModel, wireModel, parsePrice, isRecord, stringValue as s, type RecordData } from './contracts';
import { getUser, saveUser } from './users';
import { templates } from './property-email-templates';

export interface Email { to:string; subject:string; html:string }
export function formatTemplate(template:string,values:string[]) {
  let index=0;
  return template.replace(/%%|%s|%d/g,token=>token==='%%'?'%':values[index++] ?? '');
}
export async function sendEmail(mail:Email) {
  if (!mail.to || !process.env.RESEND_API_KEY) return;
  const from=process.env.FROM_EMAIL || 'connect@propbank.shop';
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:`Propbank <${from}>`,to:[mail.to],subject:mail.subject,html:mail.html.replaceAll('connectpropbank@gmail.com',from)}),signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Property email delivery failed');
}
export async function bestEffort<T>(action:()=>Promise<T>):Promise<T|null> {
  try { return await action(); } catch { return null; }
}
export function queueEmail(mail:Email) {
  if (!mail.to) return;
  after(async()=>{ await bestEffort(()=>sendEmail(mail)); });
}
const queue=queueEmail;
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
    message:added?`New property "${s(property.title)}" has been added by owner: ${s(property.ownerName)}`:cancelled?`Property owner ${s(property.ownerName)} has cancelled the request to sell property: ${s(property.title)}`:`Property owner ${s(property.ownerName)} wants to sell property: ${s(property.title)}`,
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
  const owner=await bestEffort(()=>getUser(s(property.ownerUID)));
  const oldEmails=new Set(previous.map(t=>s(t.email).trim().toLowerCase()).filter(Boolean));
  for (const tenant of tenants) {
    const email=s(tenant.email);
    if ((email.trim() && oldEmails.has(email.trim().toLowerCase())) || (tenant.isActive!==true && tenant.isActive!=='true')) continue;
    if (![tenant.email,tenant.firstName,tenant.lastName,tenant.phone].some(v=>s(v).trim())) continue;
    const details=[s(property.title),s(property.location),s(property.propertyType),s(tenant.monthlyRent)||s(property.monthlyRent),s(tenant.leaseStartDate)||s(property.agreementStartDate),s(tenant.leaseEndDate)||s(property.agreementEndDate)];
    queue({to:email,subject:"🏠 Welcome! You've been added as a Tenant - Propbank",html:formatTemplate(templates.TenantAdded,['Welcome to Your New Home!',fullName(tenant).trim()||'Tenant','You have been added as a tenant to the following property.',...details])});
    queue({to:s(owner?.email)||s(property.ownerEmail),subject:'🏠 Tenant Added to Your Property - Propbank',html:formatTemplate(templates.TenantAdded,['Tenant Added to Your Property',owner?s(owner.name):s(property.ownerName),'A new tenant has been added to your property.',...details])});
  }
}
export async function propertyCreatedEffects(property:RecordData) {
  await bestEffort(()=>notify(property,'property_added'));
  const tenants=entries(property.tenants);
  if (tenants.length) {
    await bestEffort(()=>tenantAddedEmails(property,[],tenants));
    await linkUsers(property,tenants);
  }
}
export async function propertyUpdatedEffects(before:RecordData,property:RecordData,updates:RecordData) {
  const previous=entries(before.tenants);
  const tenants=entries(property.tenants);
  if (typeof updates.monthlyRent==='string' && before.monthlyRent && updates.monthlyRent && updates.monthlyRent!==before.monthlyRent && parsePrice(updates.monthlyRent)>parsePrice(before.monthlyRent)) {
    const tenant=tenants.find(t=>t.isActive===true && t.email);
    const email=s(property.tenantEmail)||s(tenant?.email);
    const name=s(property.tenantName)||(tenant?fullName(tenant):'');
    queue({to:email,subject:'📈 Rent Update Notice - Propbank',html:formatTemplate(templates.RentUpdate,[name,s(property.title),s(before.monthlyRent),updates.monthlyRent,s(property.location)])});
  }
  if (Array.isArray(updates.tenants)) {
    const raw=entries(updates.tenants);
    await linkUsers(property,raw);
    await bestEffort(()=>tenantAddedEmails(property,previous,raw));
    for (const tenant of tenants) {
      if (!tenant.id || !tenant.paymentDueDate) continue;
      const old=previous.find(t=>t.id===tenant.id);
      if (!old || old.paymentDueDate===tenant.paymentDueDate) continue;
      queue({to:s(tenant.email),subject:'📅 Payment Due Date Updated - Propbank',html:formatTemplate(templates.PaymentDueUpdate,[fullName(tenant).trim()||'Tenant',s(property.title),s(tenant.paymentDueDate),`${s(property.address)}, ${s(property.city)}`])});
    }
  }
  if (typeof updates.wantToSell==='boolean' && updates.wantToSell!==before.wantToSell) await bestEffort(()=>notify(property,updates.wantToSell?'want_to_sell':'want_to_sell_cancelled'));
}
