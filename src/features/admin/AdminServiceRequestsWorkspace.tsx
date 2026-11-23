"use client";
import {formatPropertyAddress} from '@/lib/property-address';
import {useState,useRef,type ReactNode} from 'react';
import {useInfiniteQuery,useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {apiFetch} from '@/lib/api-client';
import {workflowRequest} from '@/lib/client-workflows';
import {formatDisplayDate,formatDisplayDateTime} from '@/lib/date-format';
import {REQUEST_STATUSES,requestStatusLabel,requestMetrics,uniqueRequestRows,visibleServiceRequests,legacyRequestRow,type AdminRequestRow,type AdminRequestDetail} from '@/lib/admin-service-request-directory';
import type {AdminNotification} from './AdminTypes';
import {readFile} from '@/features/services/ServiceRequestWorkflow';
import SessionMediaImage from '@/components/SessionMediaImage';
import {Button} from '@/ui/button';
import {Input} from '@/ui/input';
import {Textarea} from '@/ui/textarea';
import {DateRangePicker} from '@/ui/date-picker';
import {Dialog,DialogContent,DialogTitle,DialogHeader,DialogDescription} from '@/ui/dialog';
import styles from './AdminServiceRequestsWorkspace.module.css';

interface Page {data:AdminRequestRow[];nextCursor:string|null;coverageComplete:boolean}
interface Props {legacyRequests?:AdminNotification[];legacyLoading?:boolean;renderLegacyDetails?:(request:AdminNotification)=>ReactNode;onViewProperty:(id:string)=>void;onViewUser?:(uid:string)=>void}
export function ServiceRequestTable({rows,onSelect}:{rows:AdminRequestRow[];onSelect:(row:AdminRequestRow)=>void}) {
  return <div className={styles.tableScroll} role="region" aria-label="Service requests directory" tabIndex={0}><table className={styles.table}><thead><tr>{['Requested by','Requester role','Property / Unit','Service category','Submitted','Current status','Action'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={`${row.legacy?'legacy':'request'}:${row.id}`} onClick={()=>onSelect(row)} onKeyDown={event=>{if(event.target===event.currentTarget&&['Enter',' '].includes(event.key)){event.preventDefault();onSelect(row);}}} tabIndex={0} aria-label={`View request from ${row.requester.name||'requester not recorded'} for ${row.propertySummary.name||'property not recorded'}`}><td><strong>{row.requester.name||'Name not recorded'}</strong>{row.legacy&&<small>Historical request</small>}</td><td>{row.requester.role}</td><td><strong>{row.propertySummary.name||'Property not recorded'}</strong>{row.propertySummary.unit&&<small>Unit {row.propertySummary.unit}</small>}</td><td>{row.serviceName||'Not recorded'}</td><td>{formatDisplayDate(row.createdAt)}</td><td><span className={styles.status}>{requestStatusLabel(row.status)}</span>{row.isArchived&&<small>Archived</small>}</td><td><Button variant="ghost" size="sm" onClick={event=>{event.stopPropagation();onSelect(row);}}>View Details</Button></td></tr>)}{!rows.length&&<tr><td colSpan={7}>No matching requests in the loaded records.</td></tr>}</tbody></table></div>;
}
function Attachment({url,label}:{url?:string;label:string}) {
  const {fileAccess,retryFileAccess}=useAuth();
  if(!url)return null;
  if(url.startsWith('/api/media/')&&fileAccess?.phase!=='ready')return <div className={styles.unavailable} role="status"><p>{label}: {fileAccess?.message||'Secure file access is not ready.'}</p><Button type="button" variant="outline" disabled={['preparing','retrying'].includes(fileAccess?.phase||'')} onClick={()=>void retryFileAccess()}>Retry secure file access</Button></div>;
  if(!url.startsWith('/api/media/')&&!/^https:\/\//i.test(url))return <p>{label}: attachment unavailable.</p>;
  return <a className={styles.attachment} href={url} target="_blank" rel="noopener noreferrer"><SessionMediaImage src={url} alt={label} loading="lazy"/><span>Open {label.toLowerCase()}</span></a>;
}
export function ServiceRequestDetails({record,onViewProperty,onViewUser,onChanged}:{record:AdminRequestDetail;onViewProperty:(id:string)=>void;onViewUser?:(id:string)=>void;onChanged:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
  async function update(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();const formElement=event.currentTarget,form=new FormData(formElement);setBusy(true);setError('');setSaved('');
    try {
      let image='';const file=form.get('attachment');
      if(file instanceof File&&file.size){if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP image under 5 MB.');
        image=(await workflowRequest<{url:string}>('upload/service-request-image',{image:await readFile(file),requestId:record.id})).url;
        if(!image)throw Error('Resolution image upload did not return a file reference');}
      await workflowRequest(`service-requests/${encodeURIComponent(record.id)}`,{status:form.get('status'),resolutionReport:form.get('resolutionReport'),adminNotes:form.get('adminNotes'),...(image?{adminImage:image}:{})},'PUT');
      setSaved('Resolution and status saved.');await onChanged();
    }catch(e){setError(e instanceof Error?e.message:'Could not update request');}finally{setBusy(false);}
  }
  async function archive(){if(!window.confirm(record.isArchived?'Restore this request to the active directory?':'Archive this request? Its status and history will be preserved.'))return;
    setBusy(true);setError('');setSaved('');try{await workflowRequest(`service-requests/${encodeURIComponent(record.id)}`,{action:record.isArchived?'unarchive':'archive'},'PUT');setSaved(record.isArchived?'Request restored.':'Request archived.');await onChanged();}catch(e){setError(e instanceof Error?e.message:'Could not change archive state');}finally{setBusy(false);}}
  return <div className={styles.details}>
    <div className={styles.detailGrid}><section><h3>Requester</h3><dl><div><dt>Full name</dt><dd>{record.requester.name||'Not recorded'}</dd></div><div><dt>Relationship</dt><dd>{record.requester.role}</dd></div><div><dt>Mobile</dt><dd>{record.requester.mobile||'Not recorded'}</dd></div><div><dt>Email</dt><dd>{record.requester.email||'Not recorded'}</dd></div></dl>{record.requester.source==='submission_snapshot'&&<p>Historical submission details; a current profile is unavailable.</p>}{record.requester.profileAvailable&&onViewUser&&<Button variant="outline" size="sm" onClick={()=>onViewUser(record.requester.uid)}>View requester profile</Button>}</section>
    <section><h3>Property</h3><strong>{record.propertySummary.name||'Property not recorded'}</strong>{record.propertySummary.unit&&<p>Unit {record.propertySummary.unit}</p>}<p>{formatPropertyAddress({address:record.propertySummary.address})||'Address not recorded'}</p><small>Property reference: {record.propertyId||'Not recorded'}</small>{record.propertySummary.available&&<Button variant="outline" size="sm" onClick={()=>onViewProperty(record.propertyId)}>View Property</Button>}</section></div>
    <section><h3>Request information</h3><dl><div><dt>Service category</dt><dd>{record.serviceName||'Not recorded'}</dd></div><div><dt>Submitted</dt><dd>{formatDisplayDateTime(record.createdAt)}</dd></div><div><dt>Current status</dt><dd>{requestStatusLabel(record.status)}{record.isArchived?' · Archived':''}</dd></div></dl><p className={styles.prose}>{record.message||'Description not recorded'}</p><Attachment url={record.image} label="Original request photograph"/><small>Request reference: {record.id}</small></section>
    <section><h3>Resolution</h3>{record.resolutionReport&&<p className={styles.prose}>{record.resolutionReport}</p>}{record.adminNotes&&<p className={styles.prose}>Latest update: {record.adminNotes}</p>}<Attachment url={record.adminImage} label="Resolution photograph"/>
      {error&&<p role="alert" className={styles.error}>{error}</p>}{saved&&<p role="status">{saved}</p>}
      <form data-demo-autofill="off" className={styles.resolution} onSubmit={event=>void update(event)}><label>Status<select name="status" defaultValue={record.status} required disabled={busy}>{!REQUEST_STATUSES.includes(record.status as typeof REQUEST_STATUSES[number])&&<option value="">Select status</option>}{REQUEST_STATUSES.map(status=><option value={status} key={status}>{requestStatusLabel(status)}</option>)}</select></label><p><strong>Resolved</strong> means the work has been addressed and awaits final closure. <strong>Completed</strong> closes the request.</p><label>Resolution report<Textarea name="resolutionReport" defaultValue={record.resolutionReport||''} maxLength={8000} disabled={busy} placeholder="Describe the work completed"/></label><label>Update for requester<Textarea name="adminNotes" maxLength={4000} disabled={busy} placeholder="Add a new update; previous notes remain in history"/></label><label>Resolution photo (optional)<Input type="file" name="attachment" accept="image/jpeg,image/png,image/webp" disabled={busy}/></label><div className={styles.actions}><Button type="submit" disabled={busy}>{busy?'Saving…':'Save resolution and status'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>void archive()}>{record.isArchived?'Restore to active':'Archive request'}</Button></div></form>
    </section><section><h3>History</h3>{record.history?.length?<ol className={styles.history}>{record.history.map((entry,index)=><li key={index}><strong>{requestStatusLabel(entry.status)}{entry.action?' · '+entry.action.replaceAll('_',' '):''}</strong><span>{formatDisplayDateTime(entry.at)} · {entry.actorName||'Name not recorded'}</span>{entry.actorUID&&<small>Account reference: {entry.actorUID}</small>}{entry.comment&&<p className={styles.prose}>{entry.comment}</p>}{entry.adminNotes&&<p className={styles.prose}>{entry.adminNotes}</p>}{entry.resolutionReport&&<p className={styles.prose}>{entry.resolutionReport}</p>}</li>)}</ol>:<p>No history recorded.</p>}</section>
  </div>;
}
export default function AdminServiceRequestsWorkspace({legacyRequests=[],legacyLoading=false,renderLegacyDetails,onViewProperty,onViewUser}:Props) {
  const {user}=useAuth(),cache=useQueryClient();const [selected,setSelected]=useState<AdminRequestRow|null>(null),[mode,setMode]=useState('dated');
  const returnFocus=useRef<HTMLElement|null>(null);
  const select=(row:AdminRequestRow)=>{returnFocus.current=typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null;setSelected(row);};
  const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[category,setCategory]=useState(''),[dates,setDates]=useState({from:'',to:''}),[archived,setArchived]=useState(false);
  const query=useInfiniteQuery({queryKey:['service-requests','admin-directory',user?.uid,mode],enabled:!!user,initialPageParam:'',staleTime:60000,refetchOnWindowFocus:false,retry:false,
    queryFn:async({pageParam,signal})=>{const response=await apiFetch(`/api/service-requests?${new URLSearchParams({admin:'true',directory:'true',pageSize:'25',mode,cursor:pageParam})}`,{signal});const result=await response.json();if(!response.ok)throw Error(result.message||'Could not load service requests');return result as Page;},getNextPageParam:page=>page.nextCursor||undefined});
  const detail=useQuery({queryKey:['service-requests','admin-detail',user?.uid,selected?.id],enabled:!!user&&!!selected&&!selected.legacy,staleTime:30000,refetchOnWindowFocus:false,retry:false,
    queryFn:()=>workflowRequest<{request:AdminRequestDetail}>(`service-requests/${encodeURIComponent(selected!.id)}`)});
  const rows=uniqueRequestRows([...(query.data?.pages.flatMap(page=>page.data)||[]),...(mode==='dated'?legacyRequests.map(legacyRequestRow):[])]),visible=visibleServiceRequests(rows,{search,status,category,...dates,archived}),metrics=requestMetrics(rows);
  const categories=[...new Set(rows.map(row=>row.serviceName).filter(Boolean))].sort();
  const navigateProperty=(id:string)=>{setSelected(null);onViewProperty(id);},navigateUser=(id:string)=>{setSelected(null);onViewUser?.(id);};
  async function changed(){await Promise.all([query.refetch(),detail.refetch(),cache.invalidateQueries({queryKey:['adminOverview']})]);}
  return <section className={styles.workspace} aria-labelledby="service-directory-title"><header className={styles.heading}><div><h2 id="service-directory-title">Service Requests / Issues</h2><p>Manage service work and requester updates.</p></div><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>Refresh</Button></header>
    <dl className={styles.metrics} aria-label="Counts for loaded requests">{[['Total requests',metrics.total],['Pending',metrics.pending],['In progress',metrics.in_progress],['Resolved',metrics.resolved],['Completed',metrics.completed]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.scope}>Loaded-record counts, including archived requests. Historical notices with no recorded lifecycle status are included only in Total.</p>
    <div className={styles.filters}><label>Search loaded requests<Input type="search" value={search} placeholder="Requester, property or service category" onChange={e=>setSearch(e.target.value)}/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{REQUEST_STATUSES.map(s=><option value={s} key={s}>{requestStatusLabel(s)}</option>)}</select></label><label>Service category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">All loaded categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><DateRangePicker fromLabel="Submitted from" toLabel="Submitted to" value={dates} onChange={setDates}/><label className={styles.checkbox}><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Include archived</label></div>
    <div className={styles.historyMode}><Button variant="ghost" onClick={()=>{setSelected(null);setMode(mode==='dated'?'undated':'dated');}}>{mode==='dated'?'Undated historical records':'Newest requests'}</Button><p className={styles.scope}>Search and filters cover loaded records only. {mode==='undated'?'Undated history uses bounded reference-order continuation.':'Dated requests are newest first.'} Load more to search older records. Legacy notices cover the supplied notification page.</p></div>
    {(query.isLoading||legacyLoading)&&<p role="status">Loading requests…</p>}{query.error&&<p role="alert" className={styles.error}>{query.error.message}</p>}
    <ServiceRequestTable rows={visible} onSelect={select}/><footer className={styles.footer}><span>{visible.length} matching / {rows.length} loaded</span>{query.hasNextPage&&<Button variant="outline" disabled={query.isFetchingNextPage} onClick={()=>void query.fetchNextPage()}>{query.isFetchingNextPage?'Loading…':'Load more requests'}</Button>}</footer>
    <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className={styles.modal} onCloseAutoFocus={event=>{event.preventDefault();if(returnFocus.current?.isConnected)returnFocus.current.focus();}}><DialogHeader><DialogTitle>{selected?.serviceName||'Service request details'}</DialogTitle><DialogDescription>Requester, property, resolution and recorded activity.</DialogDescription></DialogHeader>
      {selected?.legacy?renderLegacyDetails?.(selected.legacy):<>{detail.isLoading&&<p role="status">Loading request details…</p>}{detail.error&&<div role="alert"><p>{detail.error.message}</p><Button variant="outline" onClick={()=>void detail.refetch()}>Retry details</Button></div>}{detail.data&&selected&&detail.data.request.id===selected.id&&<ServiceRequestDetails key={`${selected.id}:${detail.data.request.updatedAt||''}`} record={detail.data.request} onViewProperty={navigateProperty} onViewUser={onViewUser?navigateUser:undefined} onChanged={changed}/>}</>}
    </DialogContent></Dialog>
  </section>;
}
