import {validPropertyMoney} from './property-money';
import {initializeRentSchedule, suggestedRent, validateUnifiedRentSchedule, type RentScheduleRow} from './rent-schedule';
type RecordData = Record<string, any>;
export function rentDate(value: unknown): string {
  const text = typeof value === 'string' ? value.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || text.startsWith('0001-')) return '';
  const d = new Date(`${text}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === text ? text : '';
}
export function localRentDate(property: RecordData, now = new Date()) {
  try {return new Intl.DateTimeFormat('en-CA', {timeZone: property.timezone || 'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);}
  catch {return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit'}).format(now);}
}
export function previousRentDay(day: string) {const d = new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);}
export function billingDueDate(period: string, day: unknown): string {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period) || !Number.isInteger(Number(day)) || Number(day)<1 || Number(day)>31) return '';
  const [year,month]=period.split('-').map(Number);
  return `${period}-${String(Math.min(Number(day), new Date(Date.UTC(year,month,0)).getUTCDate())).padStart(2,'0')}`;
}
export function rentContract(property: RecordData, tenant?: RecordData): RecordData {
  if (!tenant) return {...property,agreementStartDate:property.leaseStartDate||property.agreementStartDate,agreementEndDate:property.leaseEndDate||property.agreementEndDate};
  return {...property,...tenant,monthlyRent:tenant.monthlyRent==null||tenant.monthlyRent===''?property.monthlyRent:tenant.monthlyRent,paymentDueDate:tenant.paymentDueDate||property.paymentDueDate,agreementStartDate:rentDate(tenant.leaseStartDate)?tenant.leaseStartDate:property.agreementStartDate,agreementEndDate:rentDate(tenant.leaseEndDate)?tenant.leaseEndDate:property.agreementEndDate,
    rentSchedule:Array.isArray(tenant.rentSchedule)&&tenant.rentSchedule.length?tenant.rentSchedule:property.rentSchedule,
    rentAgreementSnapshots:Array.isArray(tenant.rentAgreementSnapshots)&&tenant.rentAgreementSnapshots.length?tenant.rentAgreementSnapshots:property.rentAgreementSnapshots};
}
export function rentSnapshot(record: RecordData, effectiveUntil?: string) {
  return {agreementStartDate:record.leaseStartDate||record.agreementStartDate||'',agreementEndDate:record.leaseEndDate||record.agreementEndDate||'',monthlyRent:record.monthlyRent||'',paymentDueDate:record.paymentDueDate||'',
    rentSchedule:Array.isArray(record.rentSchedule)?record.rentSchedule.map((r:RecordData)=>({...r})):[],
    rentEffectiveFrom:record.rentEffectiveFrom||rentDate(record.leaseStartDate||record.agreementStartDate),...(effectiveUntil?{effectiveUntil:rentDate(record.leaseEndDate||record.agreementEndDate)&&rentDate(record.leaseEndDate||record.agreementEndDate)<effectiveUntil?rentDate(record.leaseEndDate||record.agreementEndDate):effectiveUntil}:{}),version:Number(record.rentTermsVersion||0)};
}
export interface ResolvedRent {amount:string|null;source:'schedule'|'legacy'|'unavailable';dueDate:string}
export function resolveRent(property: RecordData, dueDate: string, tenant?: RecordData): ResolvedRent {
  const unavailable:ResolvedRent={amount:null,source:'unavailable',dueDate};
  if (!rentDate(dueDate)) return unavailable;
  const record=rentContract(property,tenant), snapshots=Array.isArray(record.rentAgreementSnapshots)?record.rentAgreementSnapshots:[];
  const within=(r:RecordData)=>{const from=rentDate(r.rentEffectiveFrom||r.agreementStartDate),to=rentDate(r.effectiveUntil||r.agreementEndDate);return (!from||dueDate>=from)&&(!to||dueDate<=to);};
  const contract=snapshots.find((r:RecordData)=>within(r))||(within(record)?record:null);
  if (!contract) return unavailable;
  const rows=Array.isArray(contract.rentSchedule)?contract.rentSchedule:[];
  if (rows.length) {
    let previous='';
    for (const row of rows) {const from=rentDate(row.fromDate),to=rentDate(row.toDate);if(!from||!to||from>to||previous&&(from<=previous||previousRentDay(from)!==previous)||!validPropertyMoney(String(row.amount)))return unavailable;previous=to;}
    const start=rentDate(contract.agreementStartDate),end=rentDate(contract.agreementEndDate);
    if (start&&end&&!/^Year [2-9]\d*$/i.test(String(rows[0].year))&&(rentDate(rows[0].fromDate)!==start||rentDate(rows[rows.length-1].toDate)!==end))return unavailable;
    if (start&&end&&rows.some((r:RecordData)=>rentDate(r.fromDate)<start||rentDate(r.toDate)>end)) return unavailable;
    if (start&&end&&rows[0].fromDate===start&&rows.every((r:RecordData)=>typeof r.months==='string')&&validateUnifiedRentSchedule(rows,start,end))return unavailable;
    const row=rows.find((r:RecordData)=>rentDate(r.fromDate)<=dueDate&&rentDate(r.toDate)>=dueDate);
    if (row) return {amount:String(row.amount),source:'schedule',dueDate};
    // Only the supported legacy additional-period format has an implicit base period.
    if (!/^Year [2-9]\d*$/i.test(String(rows[0].year))) return unavailable;
  }
  return validPropertyMoney(String(contract.monthlyRent))?{amount:String(contract.monthlyRent),source:'legacy',dueDate}:unavailable;
}
export function rentForBillingPeriod(property: RecordData, period: string, tenant?: RecordData): ResolvedRent {
  const record=rentContract(property,tenant), snapshots=Array.isArray(record.rentAgreementSnapshots)?record.rentAgreementSnapshots:[];
  // Use each contract's actual due day, not an arbitrary day within the month.
  const candidates=new Set<string>();
  for(const contract of [...snapshots,record]){const day=billingDueDate(period,contract.paymentDueDate),from=rentDate(contract.rentEffectiveFrom||contract.agreementStartDate),to=rentDate(contract.effectiveUntil||contract.agreementEndDate);if(day&&(!from||day>=from)&&(!to||day<=to))candidates.add(day);}
  if(candidates.size!==1)return {amount:null,source:'unavailable',dueDate:candidates.size?'':billingDueDate(period,record.paymentDueDate)};
  return resolveRent(property,[...candidates][0],tenant);
}
/** New proposal only; never synthesize schedules for historical records. */
export function buildRenewalSchedule(terms: RecordData): RentScheduleRow[] {
  const rows=initializeRentSchedule([],rentDate(terms.agreementStartDate),rentDate(terms.agreementEndDate),String(terms.monthlyRent||''));
  return rows.map((row,i)=>({...row,amount:i?rows.slice(0,i).reduce(amount=>suggestedRent(amount,String(terms.escalationPercentage||''),String(terms.escalationAmount||'')),String(terms.monthlyRent||'')):String(terms.monthlyRent||'')}));
}

/** Compare financial periods, ignoring object key order and display-only labels. */
export function sameRentSchedule(a:unknown,b:unknown):boolean {
 const periods=(value:unknown)=>Array.isArray(value)?value.map(row=>row&&typeof row==='object'?[row.fromDate,row.toDate,Number(row.months),Number(row.amount)]:row):[];
 return JSON.stringify(periods(a))===JSON.stringify(periods(b));
}
