export interface NextAgreementDraft {
  durationMonths?:string;
  startDate:string;
  endDate:string;
  monthlyRent:string;
  securityDeposit:string;
  noticePeriod:string;
  lockInPeriod:string;
}

export const emptyNextAgreementDraft=():NextAgreementDraft=>({durationMonths:'',startDate:'',endDate:'',monthlyRent:'',securityDeposit:'',noticePeriod:'',lockInPeriod:''});
interface CivilDate {year:number;month:number;day:number}
const leap=(year:number)=>year%4===0&&(year%100!==0||year%400===0);
const monthDays=(year:number,month:number)=>[31,leap(year)?29:28,31,30,31,30,31,31,30,31,30,31][month-1]||0;
function parseDateOnly(value:string):CivilDate|null {const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)return null;const date={year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};return date.year>=1&&date.month>=1&&date.month<=12&&date.day>=1&&date.day<=monthDays(date.year,date.month)?date:null;}
const formatDateOnly=({year,month,day}:CivilDate)=>`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
function shiftDay(date:CivilDate,amount:1|-1):CivilDate {let {year,month,day}=date;day+=amount;if(day>monthDays(year,month)){day=1;month++;if(month>12){month=1;year++;}}if(day<1){month--;if(month<1){month=12;year--;}day=monthDays(year,month);}return {year,month,day};}
function addMonths(date:CivilDate,months:number):CivilDate {const index=date.year*12+date.month-1+months,year=Math.floor(index/12),month=index-year*12+1;return {year,month,day:Math.min(date.day,monthDays(year,month))};}

export function validNextAgreementDuration(value:unknown):value is string {return typeof value==='string'&&/^\d+$/.test(value)&&Number(value)>=1&&Number(value)<=120;}
export function calculateNextAgreementDates(currentEndDate:string,durationMonths:unknown):{startDate:string;endDate:string} {const current=parseDateOnly(currentEndDate);if(!current)return {startDate:'',endDate:''};const start=shiftDay(current,1),startDate=formatDateOnly(start);if(!validNextAgreementDuration(durationMonths))return {startDate,endDate:''};return {startDate,endDate:formatDateOnly(shiftDay(addMonths(start,Number(durationMonths)),-1))};}
export function deriveNextAgreementDuration(currentEndDate:string,startDate:string,endDate:string):string {if(!parseDateOnly(startDate)||!parseDateOnly(endDate))return '';for(let months=1;months<=120;months++){const calculated=calculateNextAgreementDates(currentEndDate,String(months));if(calculated.startDate===startDate&&calculated.endDate===endDate)return String(months);}return '';}
export function normalizeNextAgreementDraft(value:unknown,currentEndDate:string):unknown {if(!value||typeof value!=='object'||Array.isArray(value))return value;const draft=value as Record<string,unknown>;if(validNextAgreementDuration(draft.durationMonths)||String(draft.durationMonths??'').trim())return value;const duration=deriveNextAgreementDuration(currentEndDate,String(draft.startDate||''),String(draft.endDate||''));return duration?{...draft,durationMonths:duration}:value;}
export function sameNextAgreementDraft(left:unknown,right:unknown):boolean {if(!left||!right||typeof left!=='object'||typeof right!=='object'||Array.isArray(left)||Array.isArray(right))return false;const keys=['durationMonths','startDate','endDate','monthlyRent','securityDeposit','noticePeriod','lockInPeriod'];return keys.every(key=>String((left as Record<string,unknown>)[key]??'')===String((right as Record<string,unknown>)[key]??''));}

export function validateNextAgreementDraft(value:unknown,currentEndDate='',allowUnchangedLegacy=false):string {
  if(!value||typeof value!=='object'||Array.isArray(value))return 'Complete the next agreement details.';
  const draft=value as Record<string,unknown>,keys=['durationMonths','startDate','endDate','monthlyRent','securityDeposit','noticePeriod','lockInPeriod'];
  if(Object.keys(draft).some(key=>!keys.includes(key))||keys.filter(key=>key!=='durationMonths').some(key=>typeof draft[key]!=='string'))return 'Next agreement details are invalid.';
  if(keys.filter(key=>key!=='durationMonths').some(key=>!String(draft[key]).trim()))return 'Complete every next agreement field.';
  if(!parseDateOnly(currentEndDate))return 'Complete the current agreement end date first.';
  const suppliedDuration=String(draft.durationMonths??'').trim();
  const duration=validNextAgreementDuration(draft.durationMonths)?String(draft.durationMonths):suppliedDuration?'':deriveNextAgreementDuration(currentEndDate,String(draft.startDate),String(draft.endDate));
  if(!duration&&!allowUnchangedLegacy)return 'Enter a whole-number next agreement duration between 1 and 120 months.';
  if(duration){const calculated=calculateNextAgreementDates(currentEndDate,duration);if(calculated.startDate!==draft.startDate||calculated.endDate!==draft.endDate)return 'Next agreement dates do not match the current agreement end date and duration.';}
  else if(!parseDateOnly(String(draft.startDate))||!parseDateOnly(String(draft.endDate))||String(draft.endDate)<=String(draft.startDate))return 'Legacy next agreement dates are invalid.';
  if(!/^\d+(?:\.\d{1,2})?$/.test(String(draft.monthlyRent))||Number(draft.monthlyRent)<=0)return 'Enter a valid next agreement monthly rent.';
  if(!/^\d+(?:\.\d{1,2})?$/.test(String(draft.securityDeposit))||Number(draft.securityDeposit)<0)return 'Enter a valid next agreement security deposit.';
  for(const key of ['noticePeriod','lockInPeriod'])if(!/^\d+$/.test(String(draft[key]))||Number(draft[key])<0||Number(draft[key])>120)return `Enter a valid next agreement ${key==='noticePeriod'?'notice':'lock-in'} period.`;
  return '';
}
