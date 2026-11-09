// Calendar dates are civil dates, never UTC instants.
export function parseCalendarDate(value:string):Date|undefined {
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);if(!match)return;
 const [,y,m,d]=match.map(Number),date=new Date(0);date.setHours(12,0,0,0);date.setFullYear(y,m-1,d);
 return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:undefined;
}
export function calendarValue(date:Date):string {return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function displayCalendarDate(value:string):string {return parseCalendarDate(value)?value.split('-').reverse().join('-'):'';}
export function parseCalendarDisplay(value:string):string {const match=/^(\d{2})-(\d{2})-(\d{4})$/.exec(value),canonical=match?`${match[3]}-${match[2]}-${match[1]}`:'';return parseCalendarDate(canonical)?canonical:'';}
export function calendarToday(timeZone='Asia/Kolkata',now=new Date()):string {const parts=new Intl.DateTimeFormat('en-IN',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),get=(type:string)=>parts.find(p=>p.type===type)?.value;return `${get('year')}-${get('month')}-${get('day')}`;}
export function calendarAllowed(value:string,min?:string,max?:string,disabledDate?:(date:Date)=>boolean):boolean {const date=parseCalendarDate(value);return !!date&&(!min||!parseCalendarDate(min)||value>=min)&&(!max||!parseCalendarDate(max)||value<=max)&&!disabledDate?.(date);}
export function validCalendarRange(from:string,to:string):boolean {return !!parseCalendarDate(from)&&!!parseCalendarDate(to)&&from<=to;}
