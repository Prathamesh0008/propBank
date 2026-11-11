export type RentScheduleRow={year:string;months:string;amount:string;fromDate:string;toDate:string};

const isoParts=(value:string)=>{const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)return null;const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?{year,month,day,date}:null;};
const iso=(date:Date)=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
function addCalendarMonths(value:string,months:number){const parsed=isoParts(value);if(!parsed||!Number.isInteger(months))return '';const targetMonth=parsed.month-1+months,year=parsed.year+Math.floor(targetMonth/12),month=((targetMonth%12)+12)%12,last=new Date(Date.UTC(year,month+1,0)).getUTCDate();return iso(new Date(Date.UTC(year,month,Math.min(parsed.day,last))));}
function previousDay(value:string){const parsed=isoParts(value);if(!parsed)return '';const result=new Date(parsed.date);result.setUTCDate(result.getUTCDate()-1);return iso(result);}

export function calculateAgreementEndDate(startDate:string,period:string|number){const months=Number(period);return Number.isInteger(months)&&months>0?previousDay(addCalendarMonths(startDate,months)):'';}
const initialRentMonths=10;
export function additionalRentYearCount(period:string|number){const months=Number(period);return Number.isInteger(months)&&months>initialRentMonths?Math.ceil((months-initialRentMonths)/12):0;}
export function additionalRentPeriod(startDate:string,period:string|number,index:number):RentScheduleRow|null {
  const total=Number(period),yearNumber=index+2,startOffset=initialRentMonths+index*12;
  if(!Number.isInteger(total)||total<=startOffset||!isoParts(startDate))return null;
  const months=Math.min(12,total-startOffset),fromDate=addCalendarMonths(startDate,startOffset),toDate=previousDay(addCalendarMonths(startDate,startOffset+months));
  return {year:`Year ${yearNumber}`,months:String(months),amount:'',fromDate,toDate};
}
export function rebuildAdditionalRentSchedule(rows:Array<Partial<RentScheduleRow>>,startDate:string,period:string|number){return rows.map((row,index)=>{const calculated=additionalRentPeriod(startDate,period,index);return calculated?{...calculated,amount:row.amount||''}:null;}).filter((row):row is RentScheduleRow=>!!row);}
export function validateAdditionalRentSchedule(rows:Array<Partial<RentScheduleRow>>,startDate:string,period:string|number,agreementEndDate:string){
  const expectedEnd=calculateAgreementEndDate(startDate,period);if(!expectedEnd||agreementEndDate!==expectedEnd)return 'Agreement end date must match the start date and agreement duration';
  const maximum=additionalRentYearCount(period);if(rows.length>maximum)return 'Year-wise rent exceeds the agreement duration';
  for(let index=0;index<rows.length;index++){const expected=additionalRentPeriod(startDate,period,index),row=rows[index];if(!expected||row.year!==expected.year||row.months!==expected.months||row.fromDate!==expected.fromDate||row.toDate!==expected.toDate)return 'Year-wise rent dates must be chronological and within the agreement duration';if(!Number.isFinite(Number(row.amount||''))||Number(row.amount||'')<=0)return `${expected.year} rent must be a positive amount`;}
  return '';
}
export function rentAmountForDate(record:Record<string,unknown>,date:string){const schedule=Array.isArray(record.rentSchedule)?record.rentSchedule:[];for(const value of schedule){if(!value||typeof value!=='object')continue;const row=value as Record<string,unknown>,from=typeof row.fromDate==='string'?row.fromDate.slice(0,10):'',to=typeof row.toDate==='string'?row.toDate.slice(0,10):'',amount=typeof row.amount==='string'?row.amount:String(row.amount??'');if(from&&to&&date>=from&&date<=to&&Number.isFinite(Number(amount))&&Number(amount)>0)return amount;}return typeof record.monthlyRent==='string'?record.monthlyRent:String(record.monthlyRent??'');}

// Unified schedules retain the existing row shape and legacy readers above.
export const rentYearLabel = (index: number) => { const n = index + 1; return `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'} Year`; };
export function agreementMonths(start: string, end: string) { if (!isoParts(start) || !isoParts(end) || end < start)
    return 0; for (let n = 1; n <= 1200; n++)
    if (calculateAgreementEndDate(start, n) >= end)
        return n; return 0; }
export function arrangeRentSchedule(rows: RentScheduleRow[], start: string, end: string): RentScheduleRow[] { let offset = 0; return rows.map((row, index) => { const months = Number(row.months), from = addCalendarMonths(start, offset); offset += Number.isInteger(months) && months > 0 ? months : 0; const to = calculateAgreementEndDate(start, offset); return { ...row, year: rentYearLabel(index), fromDate: from && from <= end ? from : '', toDate: to && from <= end ? (to > end ? end : to) : '' }; }); }
export function initializeRentSchedule(rows: RentScheduleRow[], start: string, end: string, rent: string): RentScheduleRow[] { const total = agreementMonths(start, end); if (!total)
    return rows; const result: RentScheduleRow[] = []; for (let offset = 0, index = 0; offset < total; offset += 12, index++) {
    const old = rows[index];
    result.push({ year: rentYearLabel(index), months: String(Math.min(12, total - offset)), amount: (rows[0]?.fromDate && rows[0].fromDate > start ? (rows.find(r => r.fromDate <= addCalendarMonths(start, offset) && r.toDate >= addCalendarMonths(start, offset))?.amount || (index === 0 ? rent : '')) : old?.amount || (index === 0 ? rent : '')), fromDate: '', toDate: '' });
} return arrangeRentSchedule(result, start, end); }
export function validateUnifiedRentSchedule(rows: RentScheduleRow[], start: string, end: string) { if (!isoParts(start) || !isoParts(end) || end < start)
    return 'Enter valid agreement dates'; if (!rows.length)
    return 'Add Year 1 to cover the agreement'; if (rows.length > 100)
    return 'At most 100 schedule periods are supported'; let previous = '', offset = 0; for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Number.isInteger(Number(row.months)) || Number(row.months) < 1)
        return `${rentYearLabel(i)}: months must be a positive whole number`;
    if (!Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0)
        return `${rentYearLabel(i)}: confirm a positive monthly rent`;
    if (!isoParts(row.fromDate) || !isoParts(row.toDate) || row.fromDate > row.toDate || row.fromDate < start || row.toDate > end)
        return 'Schedule dates must be within the agreement';
    if (i === 0 ? row.fromDate !== start : previousDay(row.fromDate) !== previous)
        return 'Schedule must have no gaps or overlaps';
    offset += Number(row.months);
    const expected = calculateAgreementEndDate(start, offset);
    if (row.toDate !== (expected > end ? end : expected) || offset > agreementMonths(start, end))
        return 'Months must match each schedule date range';
    previous = row.toDate;
} return previous !== end ? 'Schedule must cover the entire agreement; add the remaining year or adjust months' : ''; }
export function suggestedRent(previous: string, percentage: string, amount: string) { const base = Number(previous), fixed = Number(amount || 0), percent = Number(percentage || 0); return base > 0 ? String(Math.round((base * (1 + percent / 100) + fixed) * 100) / 100) : ''; }
export function validateSubmittedRentSchedule(record: Record<string, unknown>, startKey = 'agreementStartDate', endKey = 'agreementEndDate') { if (record.rentSchedule === undefined)
    return ''; if (!Array.isArray(record.rentSchedule))
    return 'Invalid rent schedule'; const rows = record.rentSchedule as RentScheduleRow[]; if (!rows.length)
    return ''; if (rows.some(r => !r || typeof r !== 'object' || ['year', 'months', 'amount', 'fromDate', 'toDate'].some(k => typeof (r as unknown as Record<string, unknown>)[k] !== 'string')))
    return 'Invalid rent schedule row'; return validateUnifiedRentSchedule(rows, String(record[startKey] || '').slice(0, 10), String(record[endKey] || '').slice(0, 10)); }

export function validateCurrentAgreementRow(row:{durationMonths:string;startDate:string;endDate:string;monthlyRent:string}):string {if(!/^\d+$/.test(row.durationMonths)||Number(row.durationMonths)<1||Number(row.durationMonths)>120||!row.startDate||calculateAgreementEndDate(row.startDate,row.durationMonths)!==row.endDate)return "Agreement duration and dates must match (1 to 120 whole months).";if(!/^\d+(?:\.\d{1,2})?$/.test(row.monthlyRent)||Number(row.monthlyRent)<=0)return "Enter a positive monthly rent.";return "";}
