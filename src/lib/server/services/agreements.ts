import 'server-only';
import { getDatabase, COLLECTIONS } from '../firestore';
import { jsonResponse, plainError } from '../http';
import { wireModel, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, readObject, knownFields } from './domain-contracts';
import { getProperty } from './properties';
import { getUser } from './users';
import { bestEffort } from './property-effects';
import { createNotification } from './notifications';
import { ownerTerminationMail, tenantRequestMail, formatIST } from './group2-mail';
const entries=(v:unknown):RecordData[]=>Array.isArray(v)?v.filter(isRecord):[];
async function readRequest(request:Request,renew:boolean):Promise<RecordData|null> {
  try{const req=knownFields(await readObject(request),renew?['propertyId']:['propertyId','noticePeriod','noticeStartDate','terminationDate']);for(const key of Object.keys(req))if(req[key]!=null&&typeof req[key]!=='string')return null;return req;}catch{return null;}
}
const timestamp=()=>new Date(Math.floor(Date.now()/1000)*1000).toISOString();
const propertyFields=(p:RecordData)=>({propertyId:p.id,ownerId:p.ownerUID,ownerName:p.ownerName,ownerEmail:p.ownerEmail,propertyTitle:p.title,propertyAddress:p.location,propertyListingType:p.listingType,timestamp:timestamp(),isRead:false});
export async function ownerAgreement(request:Request,renew:boolean) {
  const user=await identity(request,true);const req=await readRequest(request,renew);if(!req)return plainError('Invalid request body',400);
  const id=s(req.propertyId);const property=id?await getProperty(id):null;if(!property)return plainError('Property not found',404);
  if(property.ownerUID!==user.uid)return plainError(`Unauthorized: You can only ${renew?'renew':'terminate'} your own property agreements`,403);
  const profile=await bestEffort(()=>getUser(s(property.ownerUID)));
  const owner={name:profile?profile.name:property.ownerName,email:profile?profile.email:property.ownerEmail,phoneNumber:profile?.phoneNumber||property.primaryNo};
  const tenant:RecordData={name:property.tenantName,email:property.tenantEmail,phone:property.mobileNumber};
  for(const t of entries(property.tenants))if(t.isActive){tenant.name=`${s(t.firstName)} ${s(t.lastName)}`;if(!tenant.email)tenant.email=t.email;tenant.phone=t.phone;}
  const notice=!!req.noticePeriod;const updates:RecordData={updatedAt:new Date()};
  if(renew)updates.agreementStatus='renewed';
  else if(notice)Object.assign(updates,{agreementStatus:'notice_served',anticipatedTerminationDate:s(req.terminationDate)});
  else {Object.assign(updates,{agreementStatus:'terminated',rentalStatus:'available',status:'active',tenants:[]});for(const key of ['anticipatedTerminationDate','tenantName','personName','mobileNumber','primaryNo','ultNo','agreementStartDate','agreementEndDate','agreementPeriod','noticePeriod','lockInPeriod'])updates[key]='';}
  await getDatabase().collection(COLLECTIONS.properties).doc(id).update(updates);
  const updated=await getProperty(id);
  if(renew)await bestEffort(()=>createNotification({...propertyFields(property),type:'agreement_renewal',title:'Agreement Renewal Request',message:`${s(owner.name)} has requested to renew the agreement for property: ${s(property.title)}\nProperty ID: ${id}\nOwner: ${s(owner.name)} (${s(owner.email)})`,ownerPhone:property.primaryNo,propertyAddress:property.address,priority:'high'}));
  else {
    ownerTerminationMail(property,owner,tenant,notice,notice?s(req.terminationDate):formatIST(new Date()));
    await bestEffort(()=>createNotification({...propertyFields(property),type:'agreement_termination',title:notice?'Notice Served by Owner':'Agreement Terminated Immediately',message:notice?`Owner ${s(owner.name)} has served a ${s(req.noticePeriod)} termination notice for property ${s(property.title)}. Notice Starts From: ${s(req.noticeStartDate)}. Anticipated Termination Date: ${s(req.terminationDate)}. Tenant: ${s(tenant.name)}.`:`Owner ${s(owner.name)} has immediately terminated the agreement for property ${s(property.title)}. Tenant: ${s(tenant.name)}.`,ownerName:owner.name,ownerEmail:owner.email,ownerPhone:owner.phoneNumber,ownerRole:property.ownerRole,userName:tenant.name,userEmail:tenant.email,userPhone:tenant.phone,tenantName:tenant.name,tenantEmail:tenant.email,tenantPhone:tenant.phone,priority:'high'}));
  }
  return jsonResponse({success:true,message:renew?'Agreement renewal request submitted successfully. Admin has been notified.':notice?'Termination notice served successfully. Tenant has been notified.':'Agreement terminated successfully. Tenant information has been removed.',property:updated?wireModel('Property',updated):null});
}
export async function tenantAgreement(request:Request,renew:boolean) {
  const user=await identity(request);const req=await readRequest(request,renew);if(!req)return plainError('Invalid request body',400);
  const id=s(req.propertyId);const property=id?await getProperty(id):null;if(!property)return plainError('Property not found',404);
  const email=user.token.email||user.email;let tenant:RecordData|null=null;
  if(property.tenantEmail&&property.tenantEmail===email)tenant={name:property.tenantName,email:property.tenantEmail,phone:property.mobileNumber};
  else if(property.mobileNumber&&property.mobileNumber===user.phoneNumber)tenant={name:property.tenantName,email:property.tenantEmail||email,phone:property.mobileNumber};
  else {const t=entries(property.tenants).find(t=>t.isActive&&((t.email&&t.email===email)||(t.phone&&t.phone===user.phoneNumber)));if(t)tenant={name:`${s(t.firstName)} ${s(t.lastName)}`,email:t.email,phone:t.phone};}
  if(!tenant)return plainError('Unauthorized: You are not recognized as a tenant of this property',403);
  if(!tenant.phone)tenant.phone=user.phoneNumber;
  const ownerProfile=property.ownerPhone?null:await bestEffort(()=>getUser(s(property.ownerUID)));
  const owner={name:property.ownerName,email:property.ownerEmail};
  await bestEffort(()=>createNotification({...propertyFields(property),type:renew?'agreement_renewal':'agreement_termination',title:renew?'Renewal Requested by Tenant':'Termination Requested by Tenant',message:renew?`Tenant ${s(tenant!.name)} (${s(tenant!.email)}) has requested renewal for property ${s(property.title)}.`:`Tenant ${s(tenant!.name)} has requested termination for property ${s(property.title)}.\nNotice Period: ${s(req.noticePeriod)}\nNotice Starts From: ${s(req.noticeStartDate)}\nAnticipated Termination Date: ${s(req.terminationDate)}`,ownerPhone:property.ownerPhone||ownerProfile?.phoneNumber||'',userName:tenant!.name,userEmail:tenant!.email,userPhone:tenant!.phone,tenantName:tenant!.name,tenantEmail:tenant!.email,tenantPhone:tenant!.phone,priority:'medium'}));
  await tenantRequestMail(property,owner,tenant,renew,s(req.noticePeriod));
  return jsonResponse({success:true,message:renew?'Renewal request sent to owner successfully.':'Termination request sent to owner successfully.'});
}
