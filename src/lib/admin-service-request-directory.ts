import {calendarToday} from './calendar-date';
import type {AdminNotification} from '@/features/admin/AdminTypes';
export const REQUEST_STATUSES = ['pending','in_progress','resolved','completed','cancelled'] as const;
export const requestStatusLabel = (status:string) => ({pending:'Pending',in_progress:'In progress',resolved:'Resolved',completed:'Completed',cancelled:'Cancelled'}[status] || 'Not recorded');
export interface AdminRequestRow {
  id:string; userUID?:string; propertyId:string; serviceId?:string; serviceName:string; status:string; isArchived?:boolean; createdAt:string; updatedAt?:string;
  requester:{uid:string;name:string;email:string;mobile:string;role:string;profileAvailable:boolean;source:string};
  propertySummary:{id:string;name:string;unit:string;address:string;available:boolean};
  legacy?:AdminNotification;
}
export interface AdminRequestDetail extends AdminRequestRow {
  message?:string;image?:string;adminImage?:string;resolutionReport?:string;adminNotes?:string;
  history?:Array<{status:string;at:string;action?:string;actorUID?:string;actorName?:string;comment?:string;resolutionReport?:string;adminNotes?:string}>;
}
export function legacyRequestRow(n:AdminNotification):AdminRequestRow {
  return {id:n.id,propertyId:n.propertyId,serviceName:n.serviceType||'Service category not recorded',status:'',createdAt:n.timestamp,legacy:n,
    requester:{uid:n.userId||'',name:n.userName||'',email:n.userEmail||'',mobile:n.userPhone||'',role:'Relationship not recorded',profileAvailable:!!n.userId,source:'submission_snapshot'},
    propertySummary:{id:n.propertyId,name:n.propertyTitle||'',unit:'',address:n.propertyAddress||'',available:!!n.propertyId}};
}
export function uniqueRequestRows(rows:AdminRequestRow[]) {return [...new Map(rows.map(r=>[`${r.legacy?'legacy':'request'}:${r.id}`,r])).values()];}
export function requestMetrics(rows:AdminRequestRow[]) {
  return {total:rows.length,pending:rows.filter(r=>r.status==='pending').length,in_progress:rows.filter(r=>r.status==='in_progress').length,
    resolved:rows.filter(r=>r.status==='resolved').length,completed:rows.filter(r=>r.status==='completed').length};
}
export interface RequestFilters {search:string;status:string;category:string;from:string;to:string;archived:boolean}
export function visibleServiceRequests(rows:AdminRequestRow[],filters:RequestFilters) {
  const needle=filters.search.trim().toLocaleLowerCase('en-IN');
  return rows.filter(row=>{
    if(!filters.archived&&row.isArchived)return false;
    if(filters.status&&row.status!==filters.status||filters.category&&row.serviceName!==filters.category)return false;
    if(needle&&!`${row.requester.name} ${row.propertySummary.name} ${row.propertySummary.unit} ${row.serviceName}`.toLocaleLowerCase('en-IN').includes(needle))return false;
    const instant=typeof row.createdAt==='string'&&row.createdAt?new Date(row.createdAt):new Date(NaN),day=/^\d{4}-\d{2}-\d{2}$/.test(row.createdAt)?row.createdAt:Number.isFinite(instant.getTime())?calendarToday('Asia/Kolkata',instant):'';
    if((filters.from||filters.to)&&(!day||filters.from&&day<filters.from||filters.to&&day>filters.to))return false;
    return true;
  }).sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0)||b.id.localeCompare(a.id));
}
