import {stagePropertyParticipantEvents} from './property-effects';
import {guardRentFields,reconcileRentTerms,rentProtectedFields} from './rent-terms';
import {rentForBillingPeriod,localRentDate,rentDate,rentSnapshot,previousRentDay} from '@/lib/rent-resolution';
import {validateTenantRentSchedule} from './property-validation';
import {randomUUID} from 'node:crypto';
import {stageAdminLifecycle,propertyLifecycleEvents} from './admin-lifecycle';
import 'server-only';
import {inventoryProposal,inventoryLocked,propertyInventory} from '@/lib/agreement-inventory';
import { normalizeEmailAddress } from '@/lib/email-address';
import {normalizeNextAgreementDraft,sameNextAgreementDraft,validateNextAgreementDraft} from '@/lib/next-agreement-draft';
import {indianMobile} from '@/lib/indian-phone';
import { getDatabase, COLLECTIONS } from '../firestore';
import { AccessError } from '../auth';
import { requireOwnerOrAdmin, requireSelfOrAdmin } from '../permissions';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, wireValue, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readObject, getRecord, getRecords } from './domain-contracts';
import { bestEffort, escapeHtml } from './property-effects';
import { getUser, saveUser, resolveTenantIdentity } from './users';
import { prepareLink, stageLinks, validContact } from './relationship-links';
import { stageUserEvent, dispatchNotificationIntents, dispatchEmailOutbox, type TransactionalEmailEvent } from './transactional-email';
const inventoryGuard=(value:RecordData)=>{if(Object.keys(value).some(key=>['agreementinventory','inventoryhistory'].includes(key.toLowerCase())))throw new ApiError(403,'Inventory snapshots are server controlled');};
const collection=()=>getDatabase().collection(COLLECTIONS.tenants);
export async function createTenants(request:Request) {
  const user=await identity(request);let req:RecordData;
  try{const raw=await readObject(request);if(Array.isArray(raw.tenants))for(const tenant of raw.tenants)if(isRecord(tenant)){guardRentFields(tenant);validateTenantRentSchedule(tenant);}req=model('CreateTenantRequest',raw,true);req.expectedPropertyUpdatedAt=raw.expectedPropertyUpdatedAt;if(Array.isArray(raw.tenants)&&Array.isArray(req.tenants))req.tenants=(req.tenants as RecordData[]).map((tenant,index)=>({...tenant,...(isRecord(raw.tenants![index])?(inventoryGuard(raw.tenants[index]),'inventory' in raw.tenants[index]?{inventory:raw.tenants[index].inventory}:{}):{}),...(isRecord(raw.tenants![index])&&raw.tenants[index].nextAgreementDraft!==undefined?{nextAgreementDraft:raw.tenants[index].nextAgreementDraft}:{})}));}catch(error){return plainError(error instanceof Error&&/^(rentSchedule|rentScheduleVersion|monthlyRent|price):/.test(error.message)?error.message:'Invalid JSON',400);}
  if(!req.propertyId)return plainError('Property ID is required',400);
  if(!req.ownerUID)return plainError('Owner UID is required',400);
  const tenants=Array.isArray(req.tenants)?req.tenants as RecordData[]:[];
  if(!tenants.length)return plainError('At least one tenant is required',400);
  if(tenants.length>50)return plainError('At most 50 tenants may be assigned at once',400);
  const ref=getDatabase().collection(COLLECTIONS.properties).doc(s(req.propertyId));const snapshot=await ref.get();
  if(!snapshot.exists)return plainError('Property not found',404);
  const raw=snapshot.data()||{};const property=model('Property',raw);requireOwnerOrAdmin(user,{ownerUID:s(property.ownerUID)});
  if(req.ownerUID!==property.ownerUID)throw new AccessError(403,'Property owner access required');
  const added:RecordData[]=[],inventoryInputs=new Map<string,unknown>();
  for(const value of tenants) {
    if(!value.firstName||!value.lastName||!value.email||!value.phone)return plainError(`First name, last name, email, and phone are required for tenant ${s(value.firstName)} ${s(value.lastName)}`,400);
    const email=normalizeEmailAddress(value.email);if(!email)return plainError('Invalid tenant email',400);value.email=email;
    if(value.nextAgreementDraft!==undefined&&value.nextAgreementDraft!==null){value.nextAgreementDraft=normalizeNextAgreementDraft(value.nextAgreementDraft,s(value.leaseEndDate));const error=validateNextAgreementDraft(value.nextAgreementDraft,s(value.leaseEndDate));if(error)return plainError(error,400);}
    const doc=collection().doc();const now=new Date();const tenant:RecordData={...model('Tenant',{...value,userUID:'',linkConfirmationRequired:true,phoneE164:validContact(value.phone),id:doc.id,propertyId:req.propertyId,ownerUID:req.ownerUID,isActive:true,createdAt:now,updatedAt:now}),...(value.nextAgreementDraft?{nextAgreementDraft:value.nextAgreementDraft}:{})};
    const embedded={...tenant};delete embedded.propertyId;delete embedded.ownerUID;
    if(!tenant.isMarried||!tenant.spouse)delete embedded.spouse;
    if('inventory' in value)inventoryInputs.set(s(tenant.id),value.inventory);
    added.push(embedded);
  }
  const candidates=await Promise.all(added.map(t=>prepareLink('tenant',s(req.propertyId),s(t.phone),user.uid,s(req.ownerUID),s(t.id),t.email)));
  const intents=candidates.map(claim=>({claimId:s(claim.id),email:added.find(t=>t.id===claim.tenantId)?.email}));
  let invitationEvents:TransactionalEmailEvent[]=[];
  const intentIds:string[]=[];
  await getDatabase().runTransaction(async tx=>{
    invitationEvents=[];
    const fresh=await tx.get(ref);if(!fresh.exists)throw new AccessError(403,'Property access required');
    requireOwnerOrAdmin(user,{ownerUID:s(fresh.data()?.ownerUID)});
    if(fresh.data()?.ownerUID!==req.ownerUID)throw new AccessError(403,'Property owner changed');
    if(req.expectedPropertyUpdatedAt){const at=fresh.data()?.updatedAt,millis=at?.toDate?at.toDate().getTime():new Date(at||0).getTime();if(millis!==new Date(s(req.expectedPropertyUpdatedAt)).getTime())throw new ApiError(409,'Property changed; reload before saving');}
    for(const tenant of added){try{tenant.agreementInventory=inventoryProposal(inventoryInputs.has(s(tenant.id))?inventoryInputs.get(s(tenant.id)):propertyInventory(fresh.data()?.furnishedChecklist),user.uid,0);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Invalid inventory');}}
    const previous=Array.isArray(fresh.data()?.tenants)?fresh.data()!.tenants.filter(isRecord):[];
    const active=previous.filter((tenant:RecordData)=>tenant.isActive===true);
    for(const tenant of added) {
      if(active.some((existing:RecordData)=>tenant.userUID&&tenant.userUID===existing.userUID||s(tenant.email).trim().toLowerCase()===s(existing.email).trim().toLowerCase()||tenant.phoneE164&&tenant.phoneE164===indianMobile(existing.phone)))throw new ApiError(409,'Tenant already has an active relationship with this property');
      active.push(tenant);
    }
    if(previous.length+added.length>50)throw new AccessError(403,'Property tenant relationship limit reached');
    const lifecycle=await stageAdminLifecycle(tx,propertyLifecycleEvents(s(req.propertyId),fresh.data()!,{...fresh.data(),tenants:[...previous,...added]},user.uid,`assign:${added.map(t=>t.id).join(',')}`));
    const writeLinks=await stageLinks(tx,candidates,intents);invitationEvents=[...writeLinks.events,...lifecycle.events];
    const intent=await stageUserEvent(tx,{actorUID:user.uid,eventType:'tenancy.tenant_assigned',eventId:`${s(req.propertyId)}:${added.map(t=>s(t.id)).join(',')}:assigned`,recipients:[{uid:s(property.ownerUID),role:'owner'},...added.filter(t=>t.userUID).map(t=>({uid:s(t.userUID),role:'tenant'}))],propertyId:s(req.propertyId),recordId:s(req.propertyId),templateId:'tenant-assigned',subject:'Tenant assignment confirmed',title:'Tenant relationship updated',bodyHtml:`<p>A tenant was assigned to <strong>${escapeHtml(s(property.title))}</strong>.</p>`,bodyText:`A tenant was assigned to ${s(property.title)}.`,action:{label:'View rental details',path:`/manage-property/${s(req.propertyId)}`}});intentIds.push(intent.id);
    intent.write();writeLinks();lifecycle.write();
    for(const tenant of added)tx.create(collection().doc(s(tenant.id)),{...storeModel('Tenant',{...tenant,propertyId:req.propertyId,ownerUID:req.ownerUID}),...(tenant.nextAgreementDraft?{nextAgreementDraft:tenant.nextAgreementDraft}:{})});
    const tenancy:RecordData={};
    if(!previous.some((tenant:RecordData)=>tenant.isActive===true)) {
      for(const [root,field] of [['monthlyRent','monthlyRent'],['securityDeposit','securityDeposit'],['paymentDueDate','paymentDueDate'],['agreementStartDate','leaseStartDate'],['agreementEndDate','leaseEndDate']])if(added[0][field])tenancy[root]=added[0][field];
      if(added[0].nextAgreementDraft)tenancy.nextAgreementDraft=added[0].nextAgreementDraft;
      tenancy.rentSchedule=Array.isArray(added[0].rentSchedule)?added[0].rentSchedule:[];tenancy.rentEffectiveFrom=rentDate(added[0].leaseStartDate);tenancy.rentTermsVersion=Number(fresh.data()?.rentTermsVersion||0)+1;
      tenancy.agreementStatus='active';
      if(fresh.data()?.agreementStatus==='terminated') {
        const history=Array.isArray(fresh.data()?.agreementHistory)?fresh.data()!.agreementHistory:[];
        if(history.length>=500)throw new AccessError(403,'Agreement history limit reached');
        tenancy.agreementHistory=[...history,{action:'tenancy_started',actorUID:user.uid,at:new Date()}];
      }
    }
    tx.update(ref,{...tenancy,tenants:[...previous,...added],rentalStatus:'rented',listingType:'rent',noticePeriod:tenants[0].noticePeriod,updatedAt:new Date()});
  });
  if(invitationEvents.length)dispatchEmailOutbox(invitationEvents);
  for(const tenant of added) {
    if(tenant.userUID)await bestEffort(async()=>{const target=await getUser(s(tenant.userUID));if(!target)return;Object.assign(target,{rentedPropertyId:req.propertyId,rentedPropertyOwnerId:property.ownerUID,rentedPropertyOwnerName:property.ownerName,updatedAt:new Date()});await saveUser(target);});
  }
  dispatchNotificationIntents(intentIds);
  return jsonResponse({success:true,message:`${added.length} tenant(s) added successfully`,tenants:wireValue(added)});
}
export async function listTenants(request:Request) {
  const id=new URL(request.url).searchParams.get('propertyId');if(!id)return plainError('Property ID is required',400);
  const user=await identity(request);const property=await propertyMember(user,id);if(!property)return plainError('Property not found',404);
  let tenants=await getRecords(collection().where('propertyId','==',id).where('isActive','==',true),'Tenant');
  if(user.role!=='admin'&&user.uid!==property.ownerUID)tenants=tenants.filter(t=>t.userUID===user.uid||(!t.userUID&&t.linkConfirmationRequired!==true&&user.token.email_verified===true&&s(t.email).toLowerCase()===user.token.email?.toLowerCase()));
  return jsonResponse({success:true,tenants:tenants.length?tenants.map(t=>wireModel('Tenant',t)):null});
}
export async function getTenant(request:Request,id:string) {
  const user=await identity(request);const tenant=await getRecord(COLLECTIONS.tenants,id,'Tenant');if(!tenant)return plainError('Tenant not found',404);
  if(user.role!=='admin'&&user.uid!==tenant.ownerUID&&(tenant.isActive!==true||user.uid!==tenant.userUID))throw new AccessError(403,'Tenant access required');
  return jsonResponse({success:true,tenant:{...wireModel('Tenant',tenant),effectiveMonthlyRent:rentForBillingPeriod(tenant,localRentDate(tenant).slice(0,7)).amount}});
}
export async function updateTenant(request:Request,id:string) {
  const user=await identity(request);let updates:RecordData;try{updates=await readObject(request);}catch{return plainError('Invalid JSON',400);}
  inventoryGuard(updates);
  const inventory=updates.inventory,hasInventory='inventory' in updates,expectedInventoryVersion=updates.expectedInventoryVersion;delete updates.inventory;delete updates.expectedInventoryVersion;
  const expectedPropertyUpdatedAt=s(updates.expectedPropertyUpdatedAt);delete updates.expectedPropertyUpdatedAt;
  const tenantSnapshot=await collection().doc(id).get();if(!tenantSnapshot.exists)return plainError('Tenant not found',404);
  const tenant={...tenantSnapshot.data(),...model('Tenant',tenantSnapshot.data()||{})};
  requireOwnerOrAdmin(user,{ownerUID:s(tenant.ownerUID)});
  guardRentFields(updates,tenant);const expectedRentTermsVersion=updates.expectedRentTermsVersion??Number(tenant.rentTermsVersion||0);delete updates.expectedRentTermsVersion;for(const key of rentProtectedFields)delete updates[key];
  if(!Number.isInteger(expectedRentTermsVersion))return plainError('Invalid rental terms version',400);
  const protectedNames=['ownerUID','propertyId','userUID','id','createdAt','linkConfirmationRequired','phoneE164','linkedAt','linkedByUID'];
  if(Object.keys(updates).some(key=>protectedNames.some(field=>field.toLowerCase()===key.toLowerCase()&&field!==key)))throw new AccessError(403,'Relationship field aliases cannot be changed');
  for(const field of ['ownerUID','propertyId','userUID'])if(field in updates&&updates[field]!==tenant[field])throw new AccessError(403,'Tenant relationships cannot be reassigned');
  if(Object.keys(updates).some(key=>key.includes('.')||key.startsWith('__')))return plainError('Invalid tenant field',400);
  if(['linkConfirmationRequired','phoneE164','linkedAt','linkedByUID'].some(key=>key in updates))throw new AccessError(403,'Relationship verification fields are server controlled');
  if('email' in updates){const email=normalizeEmailAddress(updates.email);if(!email)return plainError('Invalid tenant email',400);updates.email=email;}
  if('phone' in updates)updates.phoneE164=validContact(updates.phone);
  if('nextAgreementDraft' in updates&&updates.nextAgreementDraft!==null){const unchangedLegacy=sameNextAgreementDraft(updates.nextAgreementDraft,tenant.nextAgreementDraft);updates.nextAgreementDraft=normalizeNextAgreementDraft(updates.nextAgreementDraft,s(updates.leaseEndDate||tenant.leaseEndDate));const error=validateNextAgreementDraft(updates.nextAgreementDraft,s(updates.leaseEndDate||tenant.leaseEndDate),unchangedLegacy);if(error)return plainError(error,400);}
  try{validateTenantRentSchedule(updates,tenant);}catch(error){return plainError(error instanceof Error?error.message:'Invalid rent schedule',400);}
  delete updates.id;delete updates.createdAt;updates.updatedAt=new Date();
  try{model('Tenant',{...tenant,...updates},true);}catch{return plainError('Invalid tenant fields',400);}
  await syncTenant(id,updates,user,expectedPropertyUpdatedAt,hasInventory?{items:inventory,version:expectedInventoryVersion}:undefined,Number(expectedRentTermsVersion));return jsonResponse({success:true,message:'Tenant updated successfully'});
}
export async function deleteTenant(request:Request,id:string) {
  const user=await identity(request);const tenant=await getRecord(COLLECTIONS.tenants,id,'Tenant');if(!tenant)return plainError('Tenant not found',404);
  requireSelfOrAdmin(user,s(tenant.ownerUID));await syncTenant(id,{isActive:false,updatedAt:new Date()},user);
  return jsonResponse({success:true,message:'Tenant deleted successfully'});
}
export async function manageAdminTenancy(request:Request,propertyId:string) {
  const user=await identity(request);
  if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
  let req:RecordData;
  try{req=await readObject(request);}catch{return plainError('Invalid JSON',400);}
  const action=s(req.action);
  if(!['assign','replace','remove'].includes(action))return plainError('Invalid tenancy action',400);
  if(!Number.isInteger(req.expectedRevision)||Number(req.expectedRevision)<0)return plainError('Expected tenancy revision is required',400);
  const propertyRef=getDatabase().collection(COLLECTIONS.properties).doc(propertyId);
  let added:RecordData|null=null;
  if(action!=='remove') {
    if(!isRecord(req.tenant))return plainError('Tenant details are required',400);
    const value=req.tenant;inventoryGuard(value);guardRentFields(value);
    try{validateTenantRentSchedule(value);}catch(error){return plainError(error instanceof Error?error.message:'Invalid rent schedule',400);}
    if(!value.firstName||!value.lastName||!value.email||!value.phone||!value.userUID)return plainError('A registered tenant with first name, last name, email, and phone is required',400);
    if(value.paymentDueDate&&(!/^\d{1,2}$/.test(s(value.paymentDueDate))||Number(value.paymentDueDate)<1||Number(value.paymentDueDate)>31))return plainError('Payment due day must be between 1 and 31',400);
    if(value.monthlyRent&&(!Number.isFinite(Number(value.monthlyRent))||Number(value.monthlyRent)<0))return plainError('Monthly rent must be a valid amount',400);
    if(value.securityDeposit&&(!Number.isFinite(Number(value.securityDeposit))||Number(value.securityDeposit)<0))return plainError('Security deposit must be a valid amount',400);
    if(value.leaseStartDate&&value.leaseEndDate&&s(value.leaseEndDate)<s(value.leaseStartDate))return plainError('Agreement end date must be after the start date',400);
    if(value.nextAgreementDraft!==undefined&&value.nextAgreementDraft!==null){value.nextAgreementDraft=normalizeNextAgreementDraft(value.nextAgreementDraft,s(value.leaseEndDate));const error=validateNextAgreementDraft(value.nextAgreementDraft,s(value.leaseEndDate));if(error)return plainError(error,400);}
    await resolveTenantIdentity(s(value.email),s(value.userUID)); // Preserve admin's explicit account validation, without granting tenancy.
    const linkedUID='';
    const doc=collection().doc();const now=new Date();
    added={...model('Tenant',{...value,userUID:linkedUID,id:doc.id,propertyId,ownerUID:'',isActive:true,createdAt:now,updatedAt:now}),...(value.nextAgreementDraft?{nextAgreementDraft:value.nextAgreementDraft}:{})};
    Object.assign(added,{assignedByUID:user.uid,assignmentSource:'admin',linkConfirmationRequired:true,phoneE164:validContact(value.phone)});
  }
  let lifecycleEmails:TransactionalEmailEvent[]=[];
  let removedUID='';let removedUIDs:string[]=[];let ownerUID='';let propertyForNotification:RecordData|null=null;
  const intentIds:string[]=[];
  await getDatabase().runTransaction(async tx=>{
    const snapshot=await tx.get(propertyRef);
    if(!snapshot.exists)throw new ApiError(404,'Property not found');
    const property=snapshot.data()!;ownerUID=s(property.ownerUID);
    if(!ownerUID)throw new ApiError(409,'Verified property ownership is required before assigning a tenant');
    const revision=Number(property.tenancyRevision||0);
    if(revision!==Number(req.expectedRevision))throw new ApiError(409,'Tenancy changed; refresh before continuing');
    if(added){try{added.agreementInventory=inventoryProposal(isRecord(req.tenant)&&'inventory' in req.tenant?req.tenant.inventory:propertyInventory(property.furnishedChecklist),user.uid,0);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Invalid inventory');}}
    const previous=Array.isArray(property.tenants)?property.tenants.filter(isRecord):[];
    const active=previous.filter((tenant:RecordData)=>tenant.isActive===true);
    const activeDocuments=new Map<string,boolean>();
    for(const tenant of active)if(tenant.id)activeDocuments.set(s(tenant.id),(await tx.get(collection().doc(s(tenant.id)))).exists);
    const pendingClaims=added?[await prepareLink('tenant',propertyId,s(added.phone),user.uid,ownerUID,s(added.id),added.email)]:[];
    const writeLinks=await stageLinks(tx,pendingClaims);
    const mutationWrites:Array<()=>void>=[];
    let next=previous;
    if(action==='assign') {
      if(active.length)throw new ApiError(409,'Property already has an active tenant; use replace instead');
      if(active.some((tenant:RecordData)=>added!.userUID&&tenant.userUID===added!.userUID))throw new ApiError(409,'Tenant already has an active relationship with this property');
      added!.ownerUID=ownerUID;next=[...previous,added!];
    } else if(action==='replace') {
      if(!active.length)throw new ApiError(409,'Property has no active tenant to replace');
      if(active.some((tenant:RecordData)=>added!.userUID&&tenant.userUID===added!.userUID))throw new ApiError(409,'Tenant already has an active relationship with this property');
      removedUIDs=active.map((tenant:RecordData)=>s(tenant.userUID)).filter(Boolean);
      for(const tenant of active)if(tenant.id&&activeDocuments.get(s(tenant.id)))mutationWrites.push(()=>tx.update(collection().doc(s(tenant.id)),{isActive:false,updatedAt:new Date(),removedByUID:user.uid}));
      next=previous.map((tenant:RecordData)=>tenant.isActive===true?{...tenant,isActive:false,updatedAt:new Date(),removedByUID:user.uid}:tenant);
      added!.ownerUID=ownerUID;next.push(added!);
    } else {
      const tenantId=s(req.tenantId);
      const target=active.find((tenant:RecordData)=>tenant.id===tenantId);
      if(!target)throw new ApiError(409,'Active tenant relationship not found');
      removedUID=s(target.userUID);
      removedUIDs=[removedUID];
      if(activeDocuments.get(tenantId))mutationWrites.push(()=>tx.update(collection().doc(tenantId),{isActive:false,updatedAt:new Date(),removedByUID:user.uid}));
      next=previous.map((tenant:RecordData)=>tenant.id===tenantId?{...tenant,isActive:false,updatedAt:new Date(),removedByUID:user.uid}:tenant);
    }
    if(added)mutationWrites.push(()=>tx.create(collection().doc(s(added!.id)),{...storeModel('Tenant',{...added,propertyId,ownerUID}),...(added.nextAgreementDraft?{nextAgreementDraft:added.nextAgreementDraft}:{}),assignedByUID:user.uid,assignmentSource:'admin'}));
    const history=Array.isArray(property.relationshipHistory)?property.relationshipHistory:[];
    if(history.length>=500)throw new ApiError(409,'Property relationship history limit reached');
    const activeAfter=next.filter((tenant:RecordData)=>tenant.isActive===true);
    const terms:RecordData={};
    if(added)for(const [root,field] of [['monthlyRent','monthlyRent'],['securityDeposit','securityDeposit'],['paymentDueDate','paymentDueDate'],['agreementStartDate','leaseStartDate'],['agreementEndDate','leaseEndDate'],['nextAgreementDraft','nextAgreementDraft']])terms[root]=added[field]||'';
    if(added){terms.rentSchedule=Array.isArray(added.rentSchedule)?added.rentSchedule:[];terms.rentEffectiveFrom=rentDate(added.leaseStartDate);terms.rentTermsVersion=Number(property.rentTermsVersion||0)+1;if(action==='replace'){const snapshots=Array.isArray(property.rentAgreementSnapshots)?property.rentAgreementSnapshots:[];if(snapshots.length>=100)throw new ApiError(409,'Rent history limit reached');terms.rentAgreementSnapshots=[...snapshots,rentSnapshot(property,rentDate(added.leaseStartDate)?previousRentDay(rentDate(added.leaseStartDate)):undefined)];}}
    const lifecycle=await stageAdminLifecycle(tx,propertyLifecycleEvents(propertyId,property,{...property,...terms,tenants:next},user.uid,`admin-tenancy:${propertyId}:${revision+1}`));lifecycleEmails=lifecycle.events;
    propertyForNotification={...property,...terms,tenants:next,tenancyRevision:revision+1};
    const intent=await stageUserEvent(tx,{actorUID:user.uid,eventType:`tenancy.tenant_${action}`,eventId:`${propertyId}:${Number(req.expectedRevision)+1}:${action}`,recipients:[{uid:ownerUID,role:'owner'},...(added?.userUID?[{uid:s(added.userUID),role:'tenant'}]:[]),...removedUIDs.map(uid=>({uid,role:'former_tenant'}))],propertyId,recordId:propertyId,templateId:`tenant-${action}`,subject:`Tenant ${action} completed`,title:'Tenant relationship updated',bodyHtml:`<p>The tenant relationship for <strong>${escapeHtml(s(propertyForNotification.title))}</strong> was ${action==='replace'?'replaced':action==='remove'?'removed':'assigned'}.</p>`,bodyText:`The tenant relationship for ${s(propertyForNotification.title)} was ${action==='replace'?'replaced':action==='remove'?'removed':'assigned'}.`,action:{label:'View property',path:`/manage-property/${propertyId}`}});intentIds.push(intent.id);intent.write();
    writeLinks();lifecycle.write();for(const write of mutationWrites)write();
    tx.update(propertyRef,{...terms,tenants:next,tenancyRevision:revision+1,rentalStatus:activeAfter.length?'rented':'available',listingType:'rent',updatedAt:new Date(),relationshipHistory:[...history,{action:`tenant_${action}`,actorUID:user.uid,userUID:added?.userUID||removedUID,relationship:'tenant',propertyId,tenantId:added?.id||req.tenantId,at:new Date(),revision:revision+1}]});
    propertyForNotification={...property,...terms,tenants:next,tenancyRevision:revision+1};
  });
  if(lifecycleEmails.length)dispatchEmailOutbox(lifecycleEmails);
  if(added?.userUID&&propertyForNotification) {
    await bestEffort(async()=>{const target=await getUser(s(added!.userUID));if(!target)return;Object.assign(target,{rentedPropertyId:propertyId,rentedPropertyOwnerId:ownerUID,rentedPropertyOwnerName:propertyForNotification!.ownerName,updatedAt:new Date()});await saveUser(target);});
  }
  for(const uid of removedUIDs)await bestEffort(async()=>{const target=await getUser(uid);if(!target||target.rentedPropertyId!==propertyId)return;Object.assign(target,{rentedPropertyId:'',rentedPropertyOwnerId:'',rentedPropertyOwnerName:'',updatedAt:new Date()});await saveUser(target);});
  dispatchNotificationIntents(intentIds);
  return jsonResponse({success:true,message:`Tenant ${action} completed`,tenancyRevision:Number(req.expectedRevision)+1,tenant:added?wireValue(added):undefined});
}
async function syncTenant(id:string,updates:RecordData,user:Awaited<ReturnType<typeof identity>>,expectedPropertyUpdatedAt='',inventory?:{items:unknown;version:unknown},expectedRentTermsVersion?:number) {
  const eventId=randomUUID(),intentIds:string[]=[];let lifecycleEmails:TransactionalEmailEvent[]=[];
  await getDatabase().runTransaction(async tx=>{
    const ref=collection().doc(id),snapshot=await tx.get(ref);
    if(!snapshot.exists)throw new AccessError(403,'Tenant access required');
    const tenant=snapshot.data()!;const propertyRef=getDatabase().collection(COLLECTIONS.properties).doc(s(tenant.propertyId));
    if('userUID' in updates&&updates.userUID!==tenant.userUID)throw new ApiError(409,'Tenant identity changed; refresh before editing');
    const property=await tx.get(propertyRef);
    if(!property.exists)throw new AccessError(403,'Property access required');
    const propertyUpdatedAt=property.data()?.updatedAt;
    const propertyUpdatedMillis=propertyUpdatedAt?.toDate?propertyUpdatedAt.toDate().getTime():new Date(propertyUpdatedAt||0).getTime();
    if(expectedPropertyUpdatedAt&&propertyUpdatedMillis!==new Date(expectedPropertyUpdatedAt).getTime())throw new ApiError(409,'Property or agreement details changed; refresh before saving tenant details');
    requireOwnerOrAdmin(user,{ownerUID:s(property.data()?.ownerUID)});
    if(property.data()?.ownerUID!==tenant.ownerUID)throw new AccessError(403,'Tenant owner relationship changed');
    try{validateTenantRentSchedule(updates,tenant);}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Invalid rent schedule');}
    reconcileRentTerms(tenant,updates,property.data()!,expectedRentTermsVersion??Number(tenant.rentTermsVersion||0));
    if(inventory){if(!Number.isInteger(inventory.version)||inventory.version!==Number(tenant.agreementInventory?.version||0))throw new ApiError(409,'Inventory changed; reload before saving');if(inventoryLocked(tenant,property.data()!))throw new ApiError(409,'Confirmed/finalized inventory requires an explicit amendment');try{updates.agreementInventory=inventoryProposal(inventory.items,user.uid,Number(tenant.agreementInventory?.version||0));}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Invalid inventory');}}
    const tenants=(Array.isArray(property.data()?.tenants)?property.data()!.tenants:[]).filter(isRecord).map((entry:RecordData)=>entry.id===id?{...entry,...updates}:entry);
    const candidates=(updates.phone||updates.email)&&tenant.linkConfirmationRequired===true&&!tenant.userUID?[await prepareLink('tenant',s(tenant.propertyId),s(updates.phone||tenant.phone),user.uid,s(tenant.ownerUID),id,updates.email??tenant.email)]:[];
    const writeLinks=await stageLinks(tx,candidates);
    const propertyUpdates:RecordData={tenants,rentalStatus:tenants.some((t:RecordData)=>t.isActive===true)?'rented':'available',updatedAt:new Date(),tenancyRevision:Number(property.data()?.tenancyRevision||0)+1};
    if(tenant.isActive===true) {
      for(const [root,field] of [['monthlyRent','monthlyRent'],['securityDeposit','securityDeposit'],['paymentDueDate','paymentDueDate'],['agreementStartDate','leaseStartDate'],['agreementEndDate','leaseEndDate'],['noticePeriod','noticePeriod'],['lockInPeriod','lockInPeriod'],['escalationPercentage','escalationPercentage'],['escalationAmount','escalationAmount'],['rentSchedule','rentSchedule'],['nextAgreementDraft','nextAgreementDraft']])if(field in updates)propertyUpdates[root]=updates[field];
      reconcileRentTerms(property.data()!,propertyUpdates,property.data()!,Number(property.data()?.rentTermsVersion||0));
      const changedTerms=Object.keys(propertyUpdates).filter(key=>['monthlyRent','securityDeposit','paymentDueDate','agreementStartDate','agreementEndDate','noticePeriod','lockInPeriod','escalationPercentage','escalationAmount','rentSchedule'].includes(key)&&JSON.stringify(propertyUpdates[key])!==JSON.stringify(property.data()?.[key]??''));
      if(changedTerms.length) {
        const history=Array.isArray(property.data()?.agreementHistory)?property.data()!.agreementHistory:[];
        if(history.length>=500)throw new ApiError(409,'Agreement history limit reached');
        propertyUpdates.agreementHistory=[...history,{action:'tenant_details_updated',actorUID:user.uid,at:new Date(),previousTerms:Object.fromEntries(changedTerms.map(key=>[key,property.data()?.[key]??'']))}];
      }
    }
    const lifecycle=await stageAdminLifecycle(tx,propertyLifecycleEvents(s(tenant.propertyId),property.data()!,{...property.data(),...propertyUpdates},user.uid,`tenant-edit:${id}:${eventId}`));lifecycleEmails=lifecycle.events;
    const participants=await stagePropertyParticipantEvents(tx,property.data()!,{...property.data(),...propertyUpdates,id:s(tenant.propertyId)},propertyUpdates);intentIds.push(...participants.ids);
    participants.write();writeLinks();lifecycle.write();tx.update(ref,updates);tx.update(propertyRef,propertyUpdates);
  });
  dispatchNotificationIntents(intentIds);
  if(lifecycleEmails.length)dispatchEmailOutbox(lifecycleEmails);
}
