import 'server-only';
import { getDatabase, COLLECTIONS } from '../firestore';
import { AccessError } from '../auth';
import { requireOwnerOrAdmin, requireSelfOrAdmin } from '../permissions';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, wireValue, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readModel, readObject, getRecord, getRecords } from './domain-contracts';
import { bestEffort } from './property-effects';
import { getUser, saveUser, resolveTenantIdentity } from './users';
import { tenantMail } from './group2-mail';
const collection=()=>getDatabase().collection(COLLECTIONS.tenants);
export async function createTenants(request:Request) {
  const user=await identity(request);let req:RecordData;
  try{req=await readModel(request,'CreateTenantRequest');}catch{return plainError('Invalid JSON',400);}
  if(!req.propertyId)return plainError('Property ID is required',400);
  if(!req.ownerUID)return plainError('Owner UID is required',400);
  const tenants=Array.isArray(req.tenants)?req.tenants as RecordData[]:[];
  if(!tenants.length)return plainError('At least one tenant is required',400);
  if(tenants.length>50)return plainError('At most 50 tenants may be assigned at once',400);
  const ref=getDatabase().collection(COLLECTIONS.properties).doc(s(req.propertyId));const snapshot=await ref.get();
  if(!snapshot.exists)return plainError('Property not found',404);
  const raw=snapshot.data()||{};const property=model('Property',raw);requireOwnerOrAdmin(user,{ownerUID:s(property.ownerUID)});
  if(req.ownerUID!==property.ownerUID)throw new AccessError(403,'Property owner access required');
  const added:RecordData[]=[];
  for(const value of tenants) {
    if(!value.firstName||!value.lastName||!value.email||!value.phone)return plainError(`First name, last name, email, and phone are required for tenant ${s(value.firstName)} ${s(value.lastName)}`,400);
    const doc=collection().doc();const now=new Date();const tenant=model('Tenant',{...value,userUID:await resolveTenantIdentity(s(value.email),s(value.userUID)),id:doc.id,propertyId:req.propertyId,ownerUID:req.ownerUID,isActive:true,createdAt:now,updatedAt:now});
    const embedded={...tenant};delete embedded.propertyId;delete embedded.ownerUID;
    if(!tenant.isMarried||!tenant.spouse)delete embedded.spouse;
    added.push(embedded);
  }
  await getDatabase().runTransaction(async tx=>{
    const fresh=await tx.get(ref);if(!fresh.exists)throw new AccessError(403,'Property access required');
    requireOwnerOrAdmin(user,{ownerUID:s(fresh.data()?.ownerUID)});
    if(fresh.data()?.ownerUID!==req.ownerUID)throw new AccessError(403,'Property owner changed');
    const previous=Array.isArray(fresh.data()?.tenants)?fresh.data()!.tenants.filter(isRecord):[];
    const active=previous.filter((tenant:RecordData)=>tenant.isActive===true);
    for(const tenant of added) {
      if(active.some((existing:RecordData)=>tenant.userUID&&tenant.userUID===existing.userUID||s(tenant.email).trim().toLowerCase()===s(existing.email).trim().toLowerCase()))throw new ApiError(409,'Tenant already has an active relationship with this property');
      active.push(tenant);
    }
    if(previous.length+added.length>50)throw new AccessError(403,'Property tenant relationship limit reached');
    for(const tenant of added)tx.create(collection().doc(s(tenant.id)),storeModel('Tenant',{...tenant,propertyId:req.propertyId,ownerUID:req.ownerUID}));
    const tenancy:RecordData={};
    if(!previous.some((tenant:RecordData)=>tenant.isActive===true)) {
      for(const [root,field] of [['monthlyRent','monthlyRent'],['securityDeposit','securityDeposit'],['paymentDueDate','paymentDueDate'],['agreementStartDate','leaseStartDate'],['agreementEndDate','leaseEndDate']])if(added[0][field])tenancy[root]=added[0][field];
      tenancy.agreementStatus='active';
      if(fresh.data()?.agreementStatus==='terminated') {
        const history=Array.isArray(fresh.data()?.agreementHistory)?fresh.data()!.agreementHistory:[];
        if(history.length>=500)throw new AccessError(403,'Agreement history limit reached');
        tenancy.agreementHistory=[...history,{action:'tenancy_started',actorUID:user.uid,at:new Date()}];
      }
    }
    tx.update(ref,{...tenancy,tenants:[...previous,...added],rentalStatus:'rented',listingType:'rent',noticePeriod:tenants[0].noticePeriod,updatedAt:new Date()});
  });
  for(const tenant of added) {
    tenantMail(property,tenant);
    if(tenant.userUID)await bestEffort(async()=>{const target=await getUser(s(tenant.userUID));if(!target)return;Object.assign(target,{rentedPropertyId:req.propertyId,rentedPropertyOwnerId:property.ownerUID,rentedPropertyOwnerName:property.ownerName,updatedAt:new Date()});await saveUser(target);});
  }
  return jsonResponse({success:true,message:`${added.length} tenant(s) added successfully`,tenants:wireValue(added)});
}
export async function listTenants(request:Request) {
  const id=new URL(request.url).searchParams.get('propertyId');if(!id)return plainError('Property ID is required',400);
  const user=await identity(request);const property=await propertyMember(user,id);if(!property)return plainError('Property not found',404);
  let tenants=await getRecords(collection().where('propertyId','==',id).where('isActive','==',true),'Tenant');
  if(user.role!=='admin'&&user.uid!==property.ownerUID)tenants=tenants.filter(t=>t.userUID===user.uid||(!t.userUID&&user.token.email_verified===true&&s(t.email).toLowerCase()===user.token.email?.toLowerCase()));
  return jsonResponse({success:true,tenants:tenants.length?tenants.map(t=>wireModel('Tenant',t)):null});
}
export async function getTenant(request:Request,id:string) {
  const user=await identity(request);const tenant=await getRecord(COLLECTIONS.tenants,id,'Tenant');if(!tenant)return plainError('Tenant not found',404);
  if(user.role!=='admin'&&user.uid!==tenant.ownerUID&&(tenant.isActive!==true||user.uid!==tenant.userUID))throw new AccessError(403,'Tenant access required');
  return jsonResponse({success:true,tenant:wireModel('Tenant',tenant)});
}
export async function updateTenant(request:Request,id:string) {
  const user=await identity(request);let updates:RecordData;try{updates=await readObject(request);}catch{return plainError('Invalid JSON',400);}
  const tenant=await getRecord(COLLECTIONS.tenants,id,'Tenant');if(!tenant)return plainError('Tenant not found',404);
  requireOwnerOrAdmin(user,{ownerUID:s(tenant.ownerUID)});
  for(const field of ['ownerUID','propertyId','userUID'])if(field in updates&&updates[field]!==tenant[field])throw new AccessError(403,'Tenant relationships cannot be reassigned');
  if(Object.keys(updates).some(key=>key.includes('.')||key.startsWith('__')))return plainError('Invalid tenant field',400);
  delete updates.id;delete updates.createdAt;updates.updatedAt=new Date();
  try{model('Tenant',{...tenant,...updates},true);}catch{return plainError('Invalid tenant fields',400);}
  if(updates.email&&updates.email!==tenant.email)updates.userUID=await resolveTenantIdentity(s(updates.email),s(tenant.userUID));
  await syncTenant(id,updates,user);return jsonResponse({success:true,message:'Tenant updated successfully'});
}
export async function deleteTenant(request:Request,id:string) {
  const user=await identity(request);const tenant=await getRecord(COLLECTIONS.tenants,id,'Tenant');if(!tenant)return plainError('Tenant not found',404);
  requireSelfOrAdmin(user,s(tenant.ownerUID));await syncTenant(id,{isActive:false,updatedAt:new Date()},user);
  return jsonResponse({success:true,message:'Tenant deleted successfully'});
}
async function syncTenant(id:string,updates:RecordData,user:Awaited<ReturnType<typeof identity>>) {
  await getDatabase().runTransaction(async tx=>{
    const ref=collection().doc(id),snapshot=await tx.get(ref);
    if(!snapshot.exists)throw new AccessError(403,'Tenant access required');
    const tenant=snapshot.data()!;const propertyRef=getDatabase().collection(COLLECTIONS.properties).doc(s(tenant.propertyId));
    const property=await tx.get(propertyRef);
    if(!property.exists)throw new AccessError(403,'Property access required');
    requireOwnerOrAdmin(user,{ownerUID:s(property.data()?.ownerUID)});
    if(property.data()?.ownerUID!==tenant.ownerUID)throw new AccessError(403,'Tenant owner relationship changed');
    const tenants=(Array.isArray(property.data()?.tenants)?property.data()!.tenants:[]).filter(isRecord).map((entry:RecordData)=>entry.id===id?{...entry,...updates}:entry);
    tx.update(ref,updates);tx.update(propertyRef,{tenants,rentalStatus:tenants.some((t:RecordData)=>t.isActive===true)?'rented':'available',updatedAt:new Date()});
  });
}
