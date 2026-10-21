"use client";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {workflowRequest} from '@/lib/client-workflows';
import {Button} from '@/ui/button';
import {Input} from '@/ui/input';
import {Card,CardHeader,CardTitle,CardContent} from '@/ui/card';
import {Link} from '@/lib/navigation';
import styles from './AdminVisits.module.css';

interface VisitRow {
 id:string;title:string;description:string;userId:string;propertyId?:string;visitDate:string;status:string;managementVersion:number;
 requester:{uid:string;name:string;email:string;phone:string};property:{id:string;title:string;address:string}|null;
 visitAdminHistory:Array<{actorUID:string;at:string;previousStatus:string;status:string;version:number}>;
}
function VisitCard({visit,onSave}:{visit:VisitRow;onSave:(status:string)=>Promise<void>}) {
 const [status,setStatus]=useState(visit.status),[busy,setBusy]=useState(false);
 return <Card className={styles.visit}><CardHeader><CardTitle className="text-lg">{visit.title}</CardTitle></CardHeader><CardContent className="space-y-3">
  <p className="text-sm break-words">Requester: {visit.requester.name||visit.userId} / {visit.requester.email||'Email unavailable'} / {visit.requester.phone||'Phone unavailable'}</p>
  <p className="text-sm">Scheduled: {new Date(visit.visitDate).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})} (IST)</p>
  {visit.property?<Link className="underline" to={`/manage-property/${visit.property.id}`}>{visit.property.title||visit.property.id}</Link>:<p className="text-sm">{visit.propertyId?'Linked property unavailable':'No linked property'}</p>}
  <p className="text-sm whitespace-pre-wrap break-words">{visit.description}</p><p className="text-sm">Status: {visit.status}</p>
  <div className="flex flex-wrap gap-2"><label>Visit status<select className="border rounded h-10 w-full" aria-label="Visit status" value={status} onChange={e=>setStatus(e.target.value)} disabled={busy}>{['scheduled','completed','cancelled'].map(value=><option key={value} value={value}>{value}</option>)}</select></label><Button disabled={busy||status===visit.status} onClick={async()=>{setBusy(true);try{await onSave(status);}finally{setBusy(false);}}}>Save visit status</Button></div>
  <details><summary>Administrative visit history</summary>{visit.visitAdminHistory.length?<ul>{visit.visitAdminHistory.map((event,index)=><li key={index} className="text-sm">{event.actorUID} / {new Date(event.at).toLocaleString()} / {event.previousStatus} to {event.status}</li>)}</ul>:<p className="text-sm">No administrative changes recorded.</p>}</details>
 </CardContent></Card>;
}
export default function AdminVisits(){
 const [filters,setFilters]=useState({status:'',dateFrom:'',dateTo:'',propertyId:''}),[error,setError]=useState('');
 const query=useQuery({queryKey:['adminVisits',filters],queryFn:()=>workflowRequest<{visits:VisitRow[]}>(`admin/visits?status=${filters.status}&dateFrom=${filters.dateFrom}&dateTo=${filters.dateTo}&propertyId=${encodeURIComponent(filters.propertyId)}`),staleTime:0});
 async function save(visit:VisitRow,status:string){setError('');try{await workflowRequest(`visits/${visit.id}`,{status,expectedVersion:visit.managementVersion},'PUT');}catch(e){setError(e instanceof Error?e.message:'Could not update visit');}finally{await query.refetch();}}
 return <section className={styles.visits} aria-label="Admin visits"><header className={styles.heading}><span className={styles.kicker}>SCHEDULE & FOLLOW-UP</span><h2>Visit requests</h2><p>Review appointments, filter records and update visit progress.</p></header>
 <form className={styles.filters} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);setFilters({status:String(data.get('status')||''),dateFrom:String(data.get('dateFrom')||''),dateTo:String(data.get('dateTo')||''),propertyId:String(data.get('propertyId')||'').trim()});}}>
 <label>Status<select className="border rounded h-10 w-full" aria-label="Filter visit status" name="status"><option value="">All statuses</option>{['scheduled','completed','cancelled'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
 <label>From date (IST)<Input aria-label="Visit from date" type="date" name="dateFrom"/></label><label>To date (IST)<Input aria-label="Visit to date" type="date" name="dateTo"/></label><label>Property ID<Input aria-label="Filter visit property" name="propertyId"/></label><Button>Filter visits</Button>
 </form><Button className={styles.refresh} variant="outline" disabled={query.isFetching} onClick={()=>query.refetch()}>Refresh visits</Button>
 {error&&<p role="alert" className="text-destructive">{error}</p>}
 {query.isLoading?<p role="status">Loading visits...</p>:query.error?<p role="alert">{query.error.message}</p>:!query.data?.visits.length?<p>No visits match these filters.</p>:query.data.visits.map(visit=><VisitCard key={`${visit.id}:${visit.managementVersion}`} visit={visit} onSave={status=>save(visit,status)}/>)}
 </section>;
}
