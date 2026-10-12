export type ProductRecord=Record<string,any>;
export function dateText(value:unknown):string {
  if(typeof value==='string')return value;
  if(value instanceof Date)return value.toISOString();
  return '';
}
export function todayIST(now=new Date()){return new Date(now.getTime()+19800000).toISOString().slice(0,10);}
export function dueDate(month:string,day:number){const [year,m]=month.split('-').map(Number);return `${month}-${String(Math.min(day,new Date(Date.UTC(year,m,0)).getUTCDate())).padStart(2,'0')}`;}
export function ledgerStatus(row:ProductRecord,today:string){return row.status==='paid'?'Paid':row.dueDate&&row.dueDate<today?'Overdue':'Due';}
export function lifecycle(p:ProductRecord,requests:ProductRecord[]=[],visits:ProductRecord[]=[],offers:ProductRecord[]=[]) {
 const result:string[]=[];
 if(p.status==='inactive'||p.isActive===false)return ['Archived'];
 if(p.isSold)return ['Sold'];
 if(p.agreementStatus==='notice_served')result.push('Notice Period');
 if(p.rentalStatus==='rented')result.push('Rented');
 else if(p.listingType==='sell')result.push('For Sale');
 else result.push(p.agreementStatus==='terminated'?'Vacant':'Available');
 if(requests.some(r=>!r.isArchived&&['pending','in_progress'].includes(r.status)))result.push('Maintenance');
 if(visits.some(v=>v.status==='scheduled'&&!v.isCompleted))result.push('Visit Scheduled');
 if(offers.some(n=>!['completed','rejected','withdrawn'].includes(n.status)))result.push('Negotiation');
 return result;
}
export function tenantLifecycle(t:ProductRecord,p:ProductRecord){if(t.isActive===false)return 'Former Tenant';if(p.agreementStatus==='notice_served')return 'Notice Period';if(p.ownershipVerification==='pending'||!p.agreementStartDate||!p.agreementEndDate)return 'Agreement Pending';return t.userUID?'Active':'Added / Identified';}
export function maintenanceLabel(status:string){return ({pending:'Open',in_progress:'In Progress',resolved:'Resolved',completed:'Closed',cancelled:'Cancelled'} as Record<string,string>)[status]||status;}
