import {normalizeEmailAddress} from './email-address';
import {indianMobile} from './indian-phone';

export type AdminOwnerContact={personName:string;companyName:string;email:string;phone:string;alternatePhone:string;workingProfile:string;selectedUID?:string};
export const emptyAdminOwner:AdminOwnerContact={personName:'',companyName:'',email:'',phone:'',alternatePhone:'',workingProfile:''};
export function adminInvitationEligible(claim:Record<string,any>,property:Record<string,any>,tenant?:Record<string,any>){
  if(!claim.adminIntake||!property.adminIntake||claim.adminAuthorizedByUID!==property.createdByUID||claim.createdByUID!==property.createdByUID||property.isActive===false||property.status==='inactive')return false;
  if(claim.relationship==='owner')return !property.ownerUID&&property.ownershipVerification==='pending'&&normalizeEmailAddress(property.reportedOwner?.email)===claim.recipientEmailNormalized;
  return !!tenant&&tenant.propertyId===claim.propertyId&&tenant.id===claim.tenantId&&tenant.isActive===true&&!tenant.userUID&&tenant.linkConfirmationRequired===true&&normalizeEmailAddress(tenant.email)===claim.recipientEmailNormalized&&tenant.ownerUID===property.ownerUID;
}
export function adminOwnerContact(value:unknown):AdminOwnerContact {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Owner information is required');
  const record=value as Record<string,unknown>,allowed=[...Object.keys(emptyAdminOwner),'selectedUID'];
  if(Object.keys(record).some(key=>!allowed.includes(key))||Object.values(record).some(v=>typeof v!=='string'||v.length>500))throw Error('Invalid owner information');
  const email=normalizeEmailAddress(record.email),phone=indianMobile(record.phone),alternate=record.alternatePhone?indianMobile(record.alternatePhone):'';
  if(!String(record.personName||'').trim())throw Error('Owner full name is required');
  if(!email)throw Error('A valid owner email is required');
  if(!phone||record.alternatePhone&&!alternate)throw Error('Enter a valid owner mobile number');
  return {...emptyAdminOwner,...record,personName:String(record.personName).trim(),email,phone,alternatePhone:alternate||''} as AdminOwnerContact;
}
