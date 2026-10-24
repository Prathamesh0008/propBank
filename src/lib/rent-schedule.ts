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
