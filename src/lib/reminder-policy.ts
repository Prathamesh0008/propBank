import {localRentDate, rentForBillingPeriod, rentDate} from './rent-resolution';
export type ReminderRecord=Record<string,any>;
export const RENT_OFFSETS=[7,1,0,-1,-3,-7];
export const CATCH_UP_DAYS=3;
export const daysBetween=(from:string,to:string)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
export function shiftDay(day:string,days:number){const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function rentBalance(property:ReminderRecord,tenant:ReminderRecord,period:string,activeCount:number){
 const resolved=rentForBillingPeriod(property,period,tenant);
 const scoped=property.rentLedgersByTenancy?.[tenant.id]?.[period]??tenant.rentLedger?.[period];
 const shared=property.rentLedger?.[period];
 if(!scoped&&shared&&activeCount!==1)return {dueDate:resolved.dueDate,amount:resolved.amount,outstanding:null,status:'ambiguous'};
 const entry=scoped??(activeCount===1?shared:undefined);
 const cents=(v:unknown)=>{const n=Number(v);return v!==null&&v!==''&&v!==undefined&&Number.isFinite(n)&&n>=0&&n<=1e9&&Math.abs(n*100-Math.round(n*100))<1e-5?Math.round(n*100):null;};
 const total=entry&&entry.expectedRent!==undefined?cents(entry.expectedRent):cents(resolved.amount);
 const paid=entry?.status==='partial'&&entry.amountPaid===undefined?null:entry?.status==='paid'?total:entry?.amountPaid===undefined?0:cents(entry.amountPaid);
 if(total===null||paid===null||paid>total)return {dueDate:resolved.dueDate,amount:resolved.amount,outstanding:null,status:'invalid'};
 return {dueDate:rentDate(entry?.dueDate)||resolved.dueDate,amount:(total/100).toFixed(2),outstanding:((total-paid)/100).toFixed(2),status:paid===total?'paid':paid?'partial':'due'};
}
export type CanonicalReminder={kind:'rent'|'expiry';period:string;dueDate:string;offset:number;scheduledFor:string;amount:string;outstanding:string;status:string;agreementVersion:string};
export function canonicalReminderPlan(property:ReminderRecord,tenant:ReminderRecord,activeCount:number,now=new Date()):CanonicalReminder[]{
 if(!property.ownerUID||property.isActive!==true||property.status==='inactive'||tenant.isActive!==true||tenant.propertyId!==property.id||tenant.ownerUID!==property.ownerUID||['terminated','expired','cancelled'].includes(tenant.agreementStatus||property.agreementStatus))return [];
 const today=localRentDate(property,now),result:CanonicalReminder[]=[];
 const version=String(tenant.agreementVersion||property.agreementVersion||property.tenancyRevision||tenant.leaseEndDate||property.agreementEndDate||'');
 const latest=(due:string,offsets:number[])=>offsets.map(offset=>({offset,scheduledFor:shiftDay(due,-offset)})).filter(x=>x.scheduledFor<=today&&daysBetween(x.scheduledFor,today)<=CATCH_UP_DAYS).sort((a,b)=>b.scheduledFor.localeCompare(a.scheduledFor))[0];
 const [year,month]=today.slice(0,7).split('-').map(Number);
 for(const delta of [-1,0,1]){
  const period=new Date(Date.UTC(year,month-1+delta,15)).toISOString().slice(0,7),balance=rentBalance(property,tenant,period,activeCount);
  if(!balance.outstanding||Number(balance.outstanding)<=0||!balance.dueDate)continue;
  const start=rentDate(tenant.leaseStartDate||property.agreementStartDate),end=rentDate(tenant.leaseEndDate||property.agreementEndDate);if(start&&balance.dueDate<start||end&&balance.dueDate>end)continue;
  const point=latest(balance.dueDate,RENT_OFFSETS);if(!point)continue;
  result.push({kind:'rent',period,dueDate:balance.dueDate,...point,amount:balance.amount!,outstanding:balance.outstanding,status:balance.status,agreementVersion:version});
 }
 const expiry=rentDate(tenant.leaseEndDate||property.agreementEndDate);
 if(expiry&&expiry>=today){const point=latest(expiry,[30,15,7]);if(point)result.push({kind:'expiry',period:expiry.slice(0,7),dueDate:expiry,...point,amount:'',outstanding:'',status:'active',agreementVersion:version});}
 return result;
}
