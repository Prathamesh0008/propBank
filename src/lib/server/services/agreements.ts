import {buildRenewalSchedule,rentSnapshot,rentDate} from '@/lib/rent-resolution';
import {validatePropertyRentSchedule} from './property-validation';
import {validPropertyMoney} from '@/lib/property-money';
import {inventoryProposal} from '@/lib/agreement-inventory';
import {stageAdminLifecycle} from './admin-lifecycle';
import {dispatchEmailOutbox,type TransactionalEmailEvent} from './transactional-email';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { ApiError, jsonResponse } from '../http';
import { isPropertyTenant } from '../permissions';
import { wireValue, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, readObject } from './domain-contracts';
import { getUser } from './users';
import { bestEffort, escapeHtml } from './property-effects';
import { createNotificationOnce } from './notifications';
import { stageUserEvent,dispatchNotificationIntents } from './transactional-email';

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
  try{req=await readObject(request,512000);}catch{throw new ApiError(400,'Invalid request body');}
  for(const key of ['propertyId','action','noticePeriod','noticeStartDate','terminationDate','requestId'])if(key in req&&typeof req[key]!=='string')throw new ApiError(400,'Invalid agreement request field');
  const id=s(req.propertyId);
  if(!id||id.includes('/'))throw new ApiError(400,'Property ID required');
  if('inventory' in req&&(!renew||tenantRequest||req.action!=='request'))throw new ApiError(403,'Only owner renewal proposals may include inventory');
  if('rentSchedule'in req)throw new ApiError(400,'rentSchedule: submit the proposed schedule inside terms');
  if(req.terms!=null&&!isRecord(req.terms))throw new ApiError(400,'Terms must be an object');
  const rawTerms=isRecord(req.terms)?req.terms:{},proposedSchedule=rawTerms.rentSchedule;
  const proposed=readTerms(Object.fromEntries(Object.entries(rawTerms).filter(([key])=>key!=='rentSchedule'))),action=s(req.action)||'request';
  if(proposedSchedule!==undefined&&(!renew||action!=='request'))throw new ApiError(400,'rentSchedule: schedules belong to renewal proposals only');
  if(renew&&!['request','approve','complete','reject'].includes(action))throw new ApiError(400,'Invalid renewal action');
  if(!renew&&!['request','terminate','reject'].includes(action))throw new ApiError(400,'Invalid termination action');
  if(tenantRequest&&action!=='request')throw new ApiError(403,'Owner approval required');
  const db=getDatabase(),ref=db.collection(COLLECTIONS.properties).doc(id),now=new Date();
  let lifecycleEmails:TransactionalEmailEvent[]=[];
  let tenant:RecordData={},before:RecordData={},changed=true;
  const intentIds:string[]=[];
  const updated=await db.runTransaction(async tx=>{
    changed=true;lifecycleEmails=[];
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
      if(property.ownerUID!==user.uid&&user.role!=='admin')throw new ApiError(403,'Only the property owner can approve or terminate an agreement');
      tenant=active[0]||{name:property.tenantName,email:property.tenantEmail,phone:property.mobileNumber};
    }
    const history=Array.isArray(property.agreementHistory)?property.agreementHistory:[];
    if(history.length>=500)throw new ApiError(409,'Agreement history limit reached');
    const current=isRecord(property.agreementRequest)?property.agreementRequest:null;
    if(req.requestId&&req.requestId!==current?.id)throw new ApiError(409,'Agreement request changed');
    if(req.expectedRentTermsVersion!==undefined&&req.expectedRentTermsVersion!==Number(property.rentTermsVersion||0))throw new ApiError(409,'Rental terms changed; refresh the renewal');
    const updates:RecordData={updatedAt:now};
    const snapshotTerms=Object.fromEntries(terms.map(key=>[key,property[key]??'']));
    let event:RecordData={id:randomUUID(),actorUID:user.uid,at:now,kind:renew?'renewal':'termination',action,previousTerms:snapshotTerms,previousTenants:entries(property.tenants)};
    if(renew) {
      if(property.rentalStatus!=='rented')throw new ApiError(409,'Active rental required for renewal');
      if(['approve','complete','reject'].includes(action)) {
        if(!current||current.kind!=='renewal'||current.status!=='pending'||!req.requestId)throw new ApiError(409,'Pending renewal request ID required');
        if(action!=='reject'&&Object.keys(proposed).length)throw new ApiError(400,'Approval must not include edited renewal terms');
        if(action==='reject')updates.agreementRequest={...current,status:'rejected',resolvedAt:now,resolvedBy:user.uid};
        else {
          const values=readTerms(current.proposedTerms||current.terms);
          if(!validPropertyMoney(values.monthlyRent))throw new ApiError(400,'monthlyRent: a valid renewal rent is required');
          if(!values.agreementStartDate||!values.agreementEndDate)throw new ApiError(400,'Renewal start and end dates required');
          if(current.baseRentTermsVersion!==undefined&&current.baseRentTermsVersion!==Number(property.rentTermsVersion||0))throw new ApiError(409,'Rental terms changed since this renewal proposal');
          if(current.baseTenancyRevision!==undefined&&current.baseTenancyRevision!==Number(property.tenancyRevision||0))throw new ApiError(409,'Tenancy changed since this renewal proposal');
          const newSchedule=Array.isArray(current.rentSchedule)?current.rentSchedule:[];
          try{if(current.rentSchedule!==undefined)validatePropertyRentSchedule({...values,rentSchedule:current.rentSchedule,rentScheduleVersion:2});}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Invalid renewal schedule');}
          updates.rentSchedule=newSchedule;updates.rentAgreementSnapshots=[...(Array.isArray(property.rentAgreementSnapshots)?property.rentAgreementSnapshots:[]),rentSnapshot(property)];
          if((updates.rentAgreementSnapshots as unknown[]).length>100)throw new ApiError(409,'Rent history limit reached');
          updates.rentEffectiveFrom=rentDate(values.agreementStartDate);updates.rentTermsVersion=Number(property.rentTermsVersion||0)+1;
          Object.assign(updates,values,{agreementStatus:'renewed',agreementRequest:{...current,status:'completed',terms:values,resolvedAt:now,resolvedBy:user.uid}});
          updates.tenants=entries(property.tenants).map(t=>t.isActive===true?{...t,rentSchedule:newSchedule,rentAgreementSnapshots:[...(Array.isArray(t.rentAgreementSnapshots)?t.rentAgreementSnapshots:[]),rentSnapshot({...property,...t,agreementStartDate:t.leaseStartDate||property.agreementStartDate,agreementEndDate:t.leaseEndDate||property.agreementEndDate})],rentEffectiveFrom:rentDate(values.agreementStartDate),rentTermsVersion:Number(t.rentTermsVersion||0)+1,monthlyRent:values.monthlyRent??t.monthlyRent,leaseStartDate:values.agreementStartDate,leaseEndDate:values.agreementEndDate,updatedAt:now}:t);
          if(isRecord(current.inventoryProposal)){
            const proposal=current.inventoryProposal, selected=active.find(t=>t.id===proposal.tenantId);
            if(!selected||Number((selected.agreementInventory as RecordData|undefined)?.version||0)!==proposal.expectedVersion)throw new ApiError(409,'Renewal inventory changed; reject and prepare a new request');
            const inventoryHistory=Array.isArray(selected.inventoryHistory)?[...selected.inventoryHistory]:[];
            if(inventoryHistory.length>=100)throw new ApiError(409,'Inventory history limit reached');
            if(selected.agreementInventory&&!inventoryHistory.some(v=>v.version===(selected.agreementInventory as RecordData).version))inventoryHistory.push(selected.agreementInventory);
            updates.tenants=(updates.tenants as RecordData[]).map(t=>t.id===selected.id?{...t,agreementInventory:proposal.snapshot,inventoryHistory}:t);
          }
          event={...event,terms:values,rentSchedule:newSchedule,previousRentSchedule:property.rentSchedule||[],previousRentContract:rentSnapshot(property),inventoryProposal:current.inventoryProposal||null};
        }
      } else {
        if(current?.status==='pending'&&current.kind==='renewal'&&current.requestedBy===user.uid){if(Object.entries(proposed).some(([key,value])=>current.terms?.[key]!==value)||proposedSchedule!==undefined&&JSON.stringify(current.rentSchedule)!==JSON.stringify(proposedSchedule))throw new ApiError(409,'A different renewal proposal is already pending; reject it before editing');changed=false;return property;}
        if(current?.status==='pending')throw new ApiError(409,'Resolve the pending agreement request first');
        const nextTerms={...snapshotTerms,...proposed};
        if(!rentDate(nextTerms.agreementStartDate)||!rentDate(nextTerms.agreementEndDate))throw new ApiError(400,'Renewal start and end dates are required');
        if(rentDate(property.agreementEndDate)&&rentDate(nextTerms.agreementStartDate)<=rentDate(property.agreementEndDate))throw new ApiError(400,'Renewal must start after the current agreement ends');
        for(const key of ['escalationPercentage','escalationAmount'])if(nextTerms[key]&&!validPropertyMoney(nextTerms[key],false))throw new ApiError(400,`${key}: enter a finite non-negative decimal`);
        const schedule=proposedSchedule===undefined?buildRenewalSchedule(nextTerms):proposedSchedule;
        try{validatePropertyRentSchedule({...nextTerms,rentSchedule:schedule,rentScheduleVersion:2});}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Invalid renewal schedule');}
        updates.agreementRequest={id:randomUUID(),kind:'renewal',status:'pending',requestedBy:user.uid,requestedAt:now,terms:nextTerms,rentSchedule:schedule,baseRentTermsVersion:Number(property.rentTermsVersion||0),baseTenancyRevision:Number(property.tenancyRevision||0),baseAgreementStatus:s(property.agreementStatus)};
        if('inventory' in req){
          const selected=active.find(t=>t.id===req.inventoryTenantId);
          if(!selected||!Number.isInteger(req.expectedInventoryVersion)||Number((selected.agreementInventory as RecordData|undefined)?.version||0)!==req.expectedInventoryVersion)throw new ApiError(409,'Select the current tenancy inventory version');
          let snapshot;try{snapshot=inventoryProposal(req.inventory,user.uid,Number(req.expectedInventoryVersion),now);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Invalid inventory');}
          (updates.agreementRequest as RecordData).inventoryProposal={tenantId:selected.id,expectedVersion:req.expectedInventoryVersion,snapshot};
        }
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
    if(renew&&action!=='reject'&&Array.isArray(updates.tenants))for(const t of updates.tenants)if(Array.isArray(t.rentAgreementSnapshots)&&t.rentAgreementSnapshots.length>100)throw new ApiError(409,'Tenant rent history limit reached');
    const inventoryProposalRequest=isRecord(updates.agreementRequest)&&isRecord(updates.agreementRequest.inventoryProposal)?updates.agreementRequest.inventoryProposal:null;
    if(renew&&action!=='reject'&&inventoryProposalRequest){const linked=tenantDocs.docs.find(doc=>doc.id===inventoryProposalRequest.tenantId);if(!linked||linked.data().ownerUID!==property.ownerUID||Number(linked.data().agreementInventory?.version||0)!==inventoryProposalRequest.expectedVersion)throw new ApiError(409,'Tenancy inventory relationship changed');}
    const lifecycle=await stageAdminLifecycle(tx,[{type:renew?(action==='request'?'agreement_renewal_submitted':['approve','complete'].includes(action)?'agreement_renewed':'agreement_renewal_rejected'):updates.agreementStatus==='terminated'?'agreement_terminated':tenantRequest?'agreement_termination_submitted':action==='reject'?'agreement_termination_rejected':'agreement_notice_served',propertyId:id,tenantId:s(tenant.id),actorUID:user.uid,eventId:`agreement:${id}:${s(event.id)}`,title:renew?'Agreement renewal activity':'Agreement termination activity',message:renew?`Renewal ${action} was committed.`:`Agreement ${s(updates.agreementStatus)||action} was committed.`}]);lifecycleEmails=lifecycle.events;
    const eventId=`${id}:${history.length+1}:${renew?'renewal':'termination'}:${action}`;
    const intent=await stageUserEvent(tx,{actorUID:user.uid,eventType:`agreement.${renew?'renewal':'termination'}_${action}`,eventId,recipients:[{uid:s(property.ownerUID),role:'owner'},...(tenant.userUID?[{uid:s(tenant.userUID),role:'tenant'}]:[])],propertyId:id,recordId:s((updates.agreementRequest as RecordData)?.id)||id,templateId:'agreement-activity',subject:'Agreement activity updated',title:'Agreement activity updated',bodyHtml:`<p><strong>${escapeHtml(s(property.title))}</strong>: ${escapeHtml(s(updates.agreementStatus||action).replaceAll('_',' '))}.</p>`,bodyText:`${s(property.title)}: ${s(updates.agreementStatus||action).replaceAll('_',' ')}.`,action:{label:'View agreement',path:`/manage-property/${id}`}});intentIds.push(intent.id);const notificationWrites:Array<()=>void>=[intent.write];
    if(!renew){
      const owner=(await tx.get(db.collection(COLLECTIONS.users).doc(s(property.ownerUID)))).data(),actor=(await tx.get(db.collection(COLLECTIONS.users).doc(user.uid))).data();
      const outcome=tenantRequest?'requested':action==='reject'?'rejected':s(updates.agreementStatus)==='notice_served'?'notice_served':'terminated',actionLabel=outcome==='notice_served'?'Early termination notice issued':outcome==='terminated'?'Agreement terminated':outcome==='rejected'?'Termination request rejected':'Early termination requested';
      const ownerName=s(owner?.name)||s(property.ownerName),tenantName=s(tenant.name)||[s(tenant.firstName),s(tenant.lastName)].filter(Boolean).join(' '),actorName=s(actor?.name)||'Authorized account',propertyName=[s(property.buildingName)||s(property.title),s(property.unitNumber)].filter(Boolean).join(' - '),noticeDate=s(updates.noticeStartDate)||s(req.noticeStartDate),effectiveDate=s(updates.anticipatedTerminationDate)||s(req.terminationDate);
      const summary=`${actionLabel}. Property: ${propertyName}. Property ID: ${id}. Owner: ${ownerName}. Tenant: ${tenantName}. Initiated by: ${actorName} (${user.uid===s(property.ownerUID)?'owner':'tenant'}). Notice date: ${noticeDate}. Effective termination date: ${effectiveDate}.`;
      const adminIntent=await stageUserEvent(tx,{actorUID:user.uid,eventType:`agreement.termination_admin_${outcome}`,eventId:`${eventId}:admin`,recipients:[{role:'admin',email:process.env.ADMIN_EMAIL}],propertyId:id,recordId:id,templateId:'agreement-termination-admin',subject:`PropBank - ${actionLabel}`,title:actionLabel,bodyHtml:`<p><strong>Property:</strong> ${escapeHtml(propertyName)}</p><p><strong>Property ID:</strong> ${escapeHtml(id)}</p><p>${escapeHtml(summary)}</p>`,bodyText:summary,action:{label:'Review agreement',path:`/manage-property/${id}`}});intentIds.push(adminIntent.id);
      const notificationRef=db.collection(COLLECTIONS.adminNotifications).doc(`agreement-${adminIntent.id}`),existing=await tx.get(notificationRef);
      notificationWrites.push(adminIntent.write);if(!existing.exists)notificationWrites.push(()=>tx.create(notificationRef,{id:notificationRef.id,type:'agreement_termination',title:actionLabel,message:summary,propertyId:id,ownerId:property.ownerUID,userId:user.uid,isRead:false,readByUIDs:[],timestamp:now,createdAt:now,eventId}));
    }
    for(const write of notificationWrites)write();
    if(Array.isArray(updates.tenants))for(const doc of tenantDocs.docs) {
      const embedded=(updates.tenants as RecordData[]).find(t=>t.id===doc.id);
      if(embedded)tx.update(doc.ref,{...embedded,propertyId:id,ownerUID:property.ownerUID});
    }
    lifecycle.write();updates.agreementHistory=[...history,event];
    tx.update(ref,updates);
    return {...property,...updates};
  });
  dispatchNotificationIntents(intentIds);
  if(lifecycleEmails.length)dispatchEmailOutbox(lifecycleEmails);
  return jsonResponse({success:true,message:renew?'Agreement renewal request updated successfully.':'Agreement termination updated successfully.',property:wireValue(updated),request:wireValue(updated.agreementRequest||null)});
}
export const ownerAgreement=(request:Request,renew:boolean)=>agreement(request,renew,false);
export const tenantAgreement=(request:Request,renew:boolean)=>agreement(request,renew,true);