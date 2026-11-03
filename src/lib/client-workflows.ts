import { apiFetch } from './api-client';

export async function workflowRequest<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST'):Promise<T> {
  const response=await apiFetch(`/api/${path}`,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json();
  if(!response.ok||data.success===false)throw new Error(data.message||`Request failed (${response.status})`);
  return data as T;
}
export interface AgreementEvent {action:string;actorUID:string;at:string;previousTerms?:Record<string,string>;noticeStartDate?:string;terminationDate?:string}
export interface AgreementRequest {id:string;kind:string;status:string;requestedBy:string;proposedTerms?:Record<string,string>;terms?:Record<string,string>;noticePeriod?:string;noticeStartDate?:string;terminationDate?:string}
export interface WorkflowProperty {
  id:string;title:string;ownerUID:string;userRole?:string;agreementStatus?:string;
  agreementRequest?:AgreementRequest;agreementHistory?:AgreementEvent[];
  tenants?:Array<{userUID?:string;isActive:boolean;leaseStartDate?:string;leaseEndDate?:string;monthlyRent?:string}>;
  [key:string]:unknown;
}
export const renewalFields=[['monthlyRent','Monthly finalized rent'],['securityDeposit','Security deposit'],['paymentDueDate','Payment due day (1–31)'],['agreementPeriod','Agreement period'],['agreementStartDate','Agreement start date'],['agreementEndDate','Agreement end date'],['noticePeriod','Notice period'],['lockInPeriod','Lock-in period'],['escalationPercentage','Rent escalation percentage'],['escalationAmount','Rent escalation fixed amount'],['unitCondition','Furnishing condition']] as const;
export function renewalPrefill(property:WorkflowProperty):Record<string,string> {
  const tenant=property.tenants?.find(t=>t.isActive);
  const result=Object.fromEntries(renewalFields.map(([key])=>[key,String(property[key]||'')]));
  result.agreementStartDate=String(property.agreementStartDate||tenant?.leaseStartDate||'').slice(0,10);
  result.agreementEndDate=String(property.agreementEndDate||tenant?.leaseEndDate||'').slice(0,10);
  result.monthlyRent=String(property.monthlyRent||tenant?.monthlyRent||'');
  result.maintenanceToBePaidBy=String(property.maintenanceToBePaidBy||'');
  return result;
}
export function propertyCategoryMatches(property:{listingType:string;rentalStatus?:string},category:string) {
  if(!category||category==='all')return true;
  if(category==='available'||category==='rented')return property.listingType==='rent'&&(property.rentalStatus||'available')===category;
  return property.listingType===category;
}
