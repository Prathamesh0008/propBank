import 'server-only';
import {ApiError} from '../http';
import {isRecord,type RecordData} from './contracts';
import {validPropertyMoney} from '@/lib/property-money';
import {sameRentSchedule, localRentDate, previousRentDay, rentDate, rentSnapshot, rentForBillingPeriod} from '@/lib/rent-resolution';

export const rentProtectedFields=['rentAgreementSnapshots','rentEffectiveFrom','rentTermsVersion'];
export function guardRentFields(input:RecordData, before:RecordData={}) {
  for(const key of Object.keys(input))if(rentProtectedFields.some(field=>field.toLowerCase()===key.toLowerCase())&&JSON.stringify(input[key])!==JSON.stringify(before[key]))throw new ApiError(403,'Rent history and versions are server controlled');
}
export function reconcileRentTerms(before:RecordData, updates:RecordData, property:RecordData, expectedVersion:number, now=new Date()) {
  if(!['rent','sell_rent'].includes(String(updates.listingType??before.listingType))&&property.createdAs!=='tenant'&&!('leaseStartDate'in before))return;
  const keys=['monthlyRent','rentSchedule','leaseStartDate','leaseEndDate','agreementStartDate','agreementEndDate','paymentDueDate'];
  const changed=keys.some(key=>key in updates&&(key==='rentSchedule'?!sameRentSchedule(updates[key],before[key]):JSON.stringify(updates[key])!==JSON.stringify(before[key])));
  if(!changed)return;
  const priorRequest=isRecord(property.agreementRequest)?property.agreementRequest:{};
  if(['signed','finalized'].includes(String(before.agreementStatus))||['signed','finalized'].includes(String(property.agreementStatus))||['signed','finalized'].includes(String(priorRequest.baseAgreementStatus))||before.agreementSignedAt||before.agreementFinalizedAt||property.agreementSignedAt||property.agreementFinalizedAt)throw new ApiError(409,'Finalized rental terms require an explicit amendment or renewal');
  if(Number(before.rentTermsVersion||0)!==expectedVersion)throw new ApiError(409,'Rental terms changed; refresh before saving');
  if('monthlyRent'in updates&&!validPropertyMoney(updates.monthlyRent))throw new ApiError(400,'monthlyRent: enter a positive finite decimal amount');
  const today=localRentDate(property,now),oldRows=Array.isArray(before.rentSchedule)?before.rentSchedule:[],newRows=Array.isArray(updates.rentSchedule)?updates.rentSchedule:oldRows;
  for(const old of oldRows)if(rentDate(old.toDate)<today&&!newRows.some((row:RecordData)=>['year','months','amount','fromDate','toDate'].every(key=>row[key]===old[key])))throw new ApiError(409,'rentSchedule: historical periods are immutable; prepare an agreement amendment');
  const history=Array.isArray(before.rentAgreementSnapshots)?before.rentAgreementSnapshots:[];
  if(history.length>=100)throw new ApiError(409,'Rent history limit reached');
  const from=rentDate(before.rentEffectiveFrom||before.leaseStartDate||before.agreementStartDate);
  if(!from||from<today)updates.rentAgreementSnapshots=[...history,rentSnapshot(before,previousRentDay(today))];
  updates.rentEffectiveFrom=from&&from>today?from:today;
  updates.rentTermsVersion=expectedVersion+1;
  if('paymentDueDate'in updates&&updates.paymentDueDate!==before.paymentDueDate&&!rentForBillingPeriod({...before,...updates},today.slice(0,7)).amount)throw new ApiError(400,'paymentDueDate: this change is ambiguous for the current billing month; propose it in a renewal');
}
