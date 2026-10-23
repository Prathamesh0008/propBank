import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { ApiError, jsonResponse } from '../http';
import { isPropertyTenant } from '../permissions';
import { wireValue, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, readObject } from './domain-contracts';
import { getUser } from './users';
import { bestEffort, escapeHtml } from './property-effects';
import { createNotification } from './notifications';
import { persistUserEvent } from './transactional-email';

const terms=['monthlyRent','securityDeposit','paymentDueDate','escalationPercentage','escalationAmount','agreementPeriod','agreementStartDate','agreementEndDate','noticePeriod','lockInPeriod','unitCondition','maintenanceToBePaidBy'];
const entries=(v:unknown):RecordData[]=>Array.isArray(v)?v.filter(isRecord):[];
function date(value:unknown) {
  const parsed=new Date(s(value));
  if(!s(value)||!Number.isFinite(parsed.getTime()))throw new ApiError(400,'Valid agreement dates required');
  if(/^\d{4}-\d{2}-\d{2}$/.test(s(value))&&parsed.toISOString().slice(0,10)!==value)throw new ApiError(400,'Invalid agreement calendar date');
  return parsed;
}
function readTerms(value:unknown):RecordData {
  if(value==null)return {};
  if(!isRecord(value))throw new ApiError(400,'Terms must be an object');
  const result:RecordData={};
  for(const [key,val] of Object.entries(value)) {
    if(!terms.includes(key)||typeof val!=='string')throw new ApiError(400,'Invalid renewal term');
    result[key]=val;
  }
  if(result.monthlyRent&&(!Number.isFinite(Number(result.monthlyRent))||Number(result.monthlyRent)<=0))throw new ApiError(400,'Positive monthly rent required');
  if(result.paymentDueDate&&(!/^\d{1,2}$/.test(s(result.paymentDueDate))||Number(result.paymentDueDate)<1||Number(result.paymentDueDate)>31))throw new ApiError(400,'Payment due day must be 1–31');
  if(result.maintenanceToBePaidBy&&!['owner','tenant'].includes(s(result.maintenanceToBePaidBy)))throw new ApiError(400,'Invalid maintenance payer');
  if(result.agreementStartDate)date(result.agreementStartDate);
  if(result.agreementEndDate)date(result.agreementEndDate);
  if(result.agreementStartDate&&result.agreementEndDate&&date(result.agreementEndDate)<=date(result.agreementStartDate))throw new ApiError(400,'Agreement end must follow start');
  return result;
}
async function agreement(request:Request,renew:boolean,tenantRequest:boolean) {
  const user=await identity(request,true);
  let req:RecordData;
  try{req=await readObject(request,16384);}catch{throw new ApiError(400,'Invalid request body');}
  for(const key of ['propertyId','action','noticePeriod','noticeStartDate','terminationDate','requestId'])if(key in req&&typeof req[key]!=='string')throw new ApiError(400,'Invalid agreement request field');
  const id=s(req.propertyId);
  if(!id||id.includes('/'))throw new ApiError(400,'Property ID required');
  const proposed=readTerms(req.terms),action=s(req.action)||'request';
  if(renew&&!['request','approve','complete','reject'].includes(action))throw new ApiError(400,'Invalid renewal action');
  if(!renew&&!['request','terminate','reject'].includes(action))throw new ApiError(400,'Invalid termination action');
  if(tenantRequest&&action!=='request')throw new ApiError(403,'Owner approval required');
  const db=getDatabase(),ref=db.collection(COLLECTIONS.properties).doc(id),now=new Date();
  let tenant:RecordData={},before:RecordData={},changed=true;
  const updated=await db.runTransaction(async tx=>{
    const snapshot=await tx.get(ref);
    if(!snapshot.exists)throw new ApiError(404,'Property not found');
    const property=snapshot.data()!;
    before=property;
    const active=entries(property.tenants).filter(t=>t.isActive===true);
    const relationships=active.length?active:[{email:s(property.tenantEmail),isActive:property.rentalStatus==='rented'}];
    if(tenantRequest) {
      if(!isPropertyTenant(user,{tenants:relationships as Parameters<typeof isPropertyTenant>[1]['tenants']}))throw new ApiError(403,'Active tenant relationship required');
      tenant=active.find(t=>t.userUID===user.uid||!t.userUID&&s(t.email).toLowerCase()===user.token.email?.toLowerCase())||{};
    } else {
      if(property.ownerUID!==user.uid)throw new ApiError(403,'Only the property owner can approve or terminate an agreement');
      tenant=active[0]||{name:property.tenantName,email:property.tenantEmail,phone:property.mobileNumber};
    }
    const history=Array.isArray(property.agreementHistory)?property.agreementHistory:[];
    if(history.length>=500)throw new ApiError(409,'Agreement history limit reached');
    const current=isRecord(property.agreementRequest)?property.agreementRequest:null;
    if(req.requestId&&req.requestId!==current?.id)throw new ApiError(409,'Agreement request changed');
    const updates:RecordData={updatedAt:now};
    const snapshotTerms=Object.fromEntries(terms.map(key=>[key,property[key]??'']));
    let event:RecordData={id:randomUUID(),actorUID:user.uid,at:now,kind:renew?'renewal':'termination',action,previousTerms:snapshotTerms,previousTenants:entries(property.tenants)};
    if(renew) {
      if(property.rentalStatus!=='rented')throw new ApiError(409,'Active rental required for renewal');
      if(['approve','complete','reject'].includes(action)) {
        if(!current||current.kind!=='renewal'||current.status!=='pending'||!req.requestId)throw new ApiError(409,'Pending renewal request ID required');
        if(action==='reject')updates.agreementRequest={...current,status:'rejected',resolvedAt:now,resolvedBy:user.uid};
        else {
          const values=readTerms({...current.terms as RecordData,...proposed});
          if(!values.agreementStartDate||!values.agreementEndDate)throw new ApiError(400,'Renewal start and end dates required');
          Object.assign(updates,values,{agreementStatus:'renewed',agreementRequest:{...current,status:'completed',terms:values,resolvedAt:now,resolvedBy:user.uid}});
          updates.tenants=entries(property.tenants).map(t=>t.isActive===true?{...t,monthlyRent:values.monthlyRent??t.monthlyRent,leaseStartDate:values.agreementStartDate,leaseEndDate:values.agreementEndDate,updatedAt:now}:t);
          event={...event,terms:values};
        }
      } else {
        if(current?.status==='pending'&&current.kind==='renewal'&&current.requestedBy===user.uid){changed=false;return property;}
        if(current?.status==='pending')throw new ApiError(409,'Resolve the pending agreement request first');
        updates.agreementRequest={id:randomUUID(),kind:'renewal',status:'pending',requestedBy:user.uid,requestedAt:now,terms:{...snapshotTerms,...proposed}};
        updates.agreementStatus='renewal_requested';
      }
    } else if(tenantRequest) {
      if(current?.status==='pending')throw new ApiError(409,'Resolve the pending agreement request first');
      updates.agreementRequest={id:randomUUID(),kind:'termination',status:'pending',requestedBy:user.uid,requestedAt:now,noticePeriod:s(req.noticePeriod),noticeStartDate:s(req.noticeStartDate),terminationDate:s(req.terminationDate)};
    } else if(action==='reject') {
      if(!current||current.kind!=='termination'||current.status!=='pending'||!req.requestId)throw new ApiError(409,'Pending termination request ID required');
      updates.agreementRequest={...current,status:'rejected',resolvedAt:now,resolvedBy:user.uid};
    } else {
      const notice=!!req.noticePeriod;
      if(notice) {
        const start=date(req.noticeStartDate),end=date(req.terminationDate);
        if(end<start)throw new ApiError(400,'Termination must follow notice start');
        Object.assign(updates,{agreementStatus:'notice_served',noticePeriod:s(req.noticePeriod),noticeStartDate:start.toISOString(),anticipatedTerminationDate:end.toISOString()});
      } else {
        if(property.agreementStatus==='terminated'){changed=false;return property;}
        Object.assign(updates,{agreementStatus:'terminated',rentalStatus:'available',terminationDate:now,tenants:entries(property.tenants).map(t=>({...t,isActive:false,updatedAt:now}))});
        for(const key of ['tenantName','tenantEmail','personName','mobileNumber','primaryNo','ultNo','agreementStartDate','agreementEndDate','agreementPeriod','noticePeriod','lockInPeriod','anticipatedTerminationDate'])updates[key]='';
      }
      if(current)updates.agreementRequest={...current,status:current.kind==='termination'?'completed':'cancelled',resolvedAt:now,resolvedBy:user.uid};
      event={...event,action:notice?'notice_served':'terminated',noticePeriod:s(req.noticePeriod),noticeStartDate:s(req.noticeStartDate),terminationDate:s(req.terminationDate)||now};
    }
    const tenantDocs=await tx.get(db.collection(COLLECTIONS.tenants).where('propertyId','==',id));
    if(Array.isArray(updates.tenants))for(const doc of tenantDocs.docs) {
      const embedded=(updates.tenants as RecordData[]).find(t=>t.id===doc.id);
      if(embedded)tx.update(doc.ref,{...embedded,propertyId:id,ownerUID:property.ownerUID});
    }
    updates.agreementHistory=[...history,event];
    tx.update(ref,updates);
    return {...property,...updates};
  });
  if(changed) {
    const owner=await getUser(s(before.ownerUID)),tenantName=s(tenant.name)||[s(tenant.firstName),s(tenant.lastName)].join(' ');
    await bestEffort(()=>createNotification({type:renew?'agreement_renewal':'agreement_termination',title:renew?(tenantRequest?'Renewal Requested by Tenant':'Agreement Renewal Update'):(tenantRequest?'Termination Requested by Tenant':'Agreement Termination Update'),message:(renew?'Renewal':'Termination')+' '+action+' for '+s(before.title)+'. Notice Starts From: '+s(req.noticeStartDate),propertyId:id,ownerId:before.ownerUID,ownerName:owner?.name||before.ownerName,ownerEmail:owner?.email||before.ownerEmail,userId:user.uid,tenantName,tenantEmail:tenant.email,tenantPhone:tenant.phone,priority:'high'}));
    await bestEffort(()=>persistUserEvent({eventType:`agreement.${renew?'renewal':'termination'}_${action}`,eventId:`${id}:${s(updated.agreementHistory?.length)}:${renew?'renewal':'termination'}:${action}`,recipients:[{uid:s(before.ownerUID),role:'owner'},...(tenant.userUID?[{uid:s(tenant.userUID),role:'tenant'}]:[])],propertyId:id,recordId:s(updated.agreementRequest?.id)||id,templateId:'agreement-activity',subject:'Agreement activity updated',title:'Agreement activity updated',bodyHtml:`<p><strong>${escapeHtml(s(before.title))}</strong>: ${escapeHtml(s(updated.agreementStatus||action).replaceAll('_',' '))}.</p>`,bodyText:`${s(before.title)}: ${s(updated.agreementStatus||action).replaceAll('_',' ')}.`,action:{label:'View agreement',path:`/manage-property/${id}`}}));
  }
  return jsonResponse({success:true,message:renew?'Agreement renewal request updated successfully.':'Agreement termination updated successfully.',property:wireValue(updated),request:wireValue(updated.agreementRequest||null)});
}
export const ownerAgreement=(request:Request,renew:boolean)=>agreement(request,renew,false);
export const tenantAgreement=(request:Request,renew:boolean)=>agreement(request,renew,true);
