import 'server-only';
import { getDatabase, COLLECTIONS } from '../firestore';
import { AccessError } from '../auth';
import { requireOwnerOrAdmin, requireSelfOrAdmin } from '../permissions';
import { jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, wireValue, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readModel, readObject, getRecord, getRecords } from './domain-contracts';
import { bestEffort } from './property-effects';
import { getUser, saveUser } from './users';
import { tenantMail } from './group2-mail';
const collection=()=>getDatabase().collection(COLLECTIONS.tenants);
export async function createTenants(request:Request) {
  const user=await identity(request);let req:RecordData;
  try{req=await readModel(request,'CreateTenantRequest');}catch{return plainError('Invalid JSON',400);}
  if(!req.propertyId)return plainError('Property ID is required',400);
  if(!req.ownerUID)return plainError('Owner UID is required',400);
  const tenants=Array.isArray(req.tenants)?req.tenants as RecordData[]:[];
  if(!tenants.length)return plainError('At least one tenant is required',400);
  const ref=getDatabase().collection(COLLECTIONS.properties).doc(s(req.propertyId));const snapshot=await ref.get();
  if(!snapshot.exists)return plainError('Property not found',404);
  const raw=snapshot.data()||{};const property=model('Property',raw);requireOwnerOrAdmin(user,{ownerUID:s(property.ownerUID)});
  if(req.ownerUID!==property.ownerUID)throw new AccessError(403,'Property owner access required');
  const previous=Array.isArray(raw.tenants)?raw.tenants.filter(isRecord):[];const added:RecordData[]=[];
  for(const value of tenants) {
    if(!value.firstName||!value.lastName||!value.email||!value.phone)return plainError(`First name, last name, email, and phone are required for tenant ${s(value.firstName)} ${s(value.lastName)}`,400);
    const doc=collection().doc();const now=new Date();const tenant=model('Tenant',{...value,id:doc.id,propertyId:req.propertyId,ownerUID:req.ownerUID,isActive:true,createdAt:now,updatedAt:now});
    try{await doc.set(storeModel('Tenant',tenant));}catch{return plainError(`Failed to create tenant ${s(value.firstName)} ${s(value.lastName)}`,500);}
    const embedded={...tenant};delete embedded.propertyId;delete embedded.ownerUID;
    if(!tenant.isMarried||!tenant.spouse)delete embedded.spouse;
    added.push(embedded);tenantMail(property,tenant);
    if(tenant.userUID)await bestEffort(async()=>{const target=await getUser(s(tenant.userUID));if(!target)return;Object.assign(target,{rentedPropertyId:req.propertyId,rentedPropertyOwnerId:property.ownerUID,rentedPropertyOwnerName:property.ownerName,updatedAt:new Date()});await saveUser(target);});
  }
  await ref.update({tenants:[...previous,...added],rentalStatus:'rented',listingType:'rent',noticePeriod:tenants[0].noticePeriod,updatedAt:new Date()});
  return jsonResponse({success:true,message:`${added.length} tenant(s) added successfully`,tenants:wireValue(added)});
}
export async function listTenants(request:Request) {
  const id=new URL(request.url).searchParams.get('propertyId');if(!id)return plainError('Property ID is required',400);
  const user=await identity(request);const property=await propertyMember(user,id);if(!property)return plainError('Property not found',404);
  const tenants=await getRecords(collection().where('propertyId','==',id).where('isActive','==',true),'Tenant');
  return jsonResponse({success:true,tenants:tenants.length?tenants.map(t=>wireModel('Tenant',t)):null});
}
export async function getTenant(request:Request,id:string) {
  const user=await identity(request);const tenant=await getRecord(COLLECTIONS.tenants,id,'Tenant');if(!tenant)return plainError('Tenant not found',404);
  if(user.role!=='admin'&&user.uid!==tenant.ownerUID&&user.uid!==tenant.userUID)await propertyMember(user,s(tenant.propertyId)).then(p=>{if(!p)throw new AccessError(403,'Property access required');});
  return jsonResponse({success:true,tenant:wireModel('Tenant',tenant)});
}
export async function updateTenant(request:Request,id:string) {
  const user=await identity(request);let updates:RecordData;try{updates=await readObject(request);}catch{return plainError('Invalid JSON',400);}
  const tenant=await getRecord(COLLECTIONS.tenants,id,'Tenant');if(!tenant)return plainError('Failed to update tenant',500);
  requireOwnerOrAdmin(user,{ownerUID:s(tenant.ownerUID)});
  for(const field of ['ownerUID','propertyId','userUID'])if(field in updates&&updates[field]!==tenant[field])throw new AccessError(403,'Tenant relationships cannot be reassigned');
  delete updates.id;delete updates.createdAt;updates.updatedAt=new Date();
  await collection().doc(id).update(updates);return jsonResponse({success:true,message:'Tenant updated successfully'});
}
export async function deleteTenant(request:Request,id:string) {
  const user=await identity(request);const tenant=await getRecord(COLLECTIONS.tenants,id,'Tenant');if(!tenant)return plainError('Failed to delete tenant',500);
  requireSelfOrAdmin(user,s(tenant.ownerUID));await collection().doc(id).update({isActive:false,updatedAt:new Date()});
  return jsonResponse({success:true,message:'Tenant deleted successfully'});
}
