"use client";
import styles from './EnquiryInbox.module.css';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {workflowRequest} from '@/lib/client-workflows';
import {enquiryStatuses, type ManagedEnquiry, type EnquiryStatus} from '@/lib/enquiry';
import {Button} from '@/ui/button';
import {Textarea} from '@/ui/textarea';
import {Card,CardHeader,CardTitle,CardContent} from '@/ui/card';
import {Badge} from '@/ui/badge';

interface Agent {uid:string;name:string;role?:string;isActive?:boolean}
function EnquiryRow({enquiry,admin,agents,onSave}:{enquiry:ManagedEnquiry;admin:boolean;agents:Agent[];onSave:(body:Record<string,unknown>)=>Promise<void>}) {
 const [broker,setBroker]=useState(enquiry.brokerUID),[status,setStatus]=useState<EnquiryStatus>(enquiry.status),[notes,setNotes]=useState(''),[busy,setBusy]=useState(false);
 async function save(action:'assign'|'status') {setBusy(true);try{await onSave({action,expectedVersion:enquiry.version,notes,...(action==='assign'?{brokerUID:broker}:{status})});}finally{setBusy(false);}}
 return <Card className={styles.enquiry}><CardHeader className={styles.enquiryHeader}><CardTitle className={styles.enquiryTitle}>{enquiry.propertyTitle||enquiry.title||'Property enquiry'}</CardTitle></CardHeader><CardContent className={styles.enquiryBody}>
  <p className={styles.address}>{enquiry.propertyAddress}</p>
  <p className={styles.customer}>Customer: {enquiry.userName} / {enquiry.userEmail} / {enquiry.userPhone}</p>
  <p className={styles.message}>{enquiry.message}</p>
  <Badge variant="outline">{enquiryStatuses[enquiry.status]}</Badge>
  <p className="text-sm">Assigned broker: {enquiry.brokerName||enquiry.brokerUID||'Unassigned'}</p>
  <Textarea aria-label="Private enquiry notes" placeholder="Optional private notes for admin and the assigned broker" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000} disabled={busy}/>
  {admin&&<div className="flex flex-wrap gap-2"><label>Broker<select aria-label="Assigned broker" className="border rounded h-10 w-full" value={broker} onChange={e=>setBroker(e.target.value)} disabled={busy}>
    <option value="">Unassigned</option>{enquiry.brokerUID&&!agents.some(a=>a.uid===enquiry.brokerUID)&&<option value={enquiry.brokerUID}>{enquiry.brokerName||enquiry.brokerUID} (current)</option>}
    {agents.map(a=><option key={a.uid} value={a.uid}>{a.name||a.uid}</option>)}
  </select></label><Button variant="outline" disabled={busy||broker===enquiry.brokerUID} onClick={()=>save('assign')}>Save assignment</Button></div>}
  <div className="flex flex-wrap gap-2"><label>Enquiry status<select aria-label="Enquiry status" className="border rounded h-10 w-full" value={status} onChange={e=>setStatus(e.target.value as EnquiryStatus)} disabled={busy}>
    {Object.entries(enquiryStatuses).map(([value,label])=><option key={value} value={value}>{label}</option>)}
  </select></label><Button disabled={busy||(status===enquiry.status&&!notes.trim())} onClick={()=>save('status')}>Save progress</Button></div>
  <details className={styles.history}><summary>Assignment and status history</summary>{enquiry.history.length?<ul className="space-y-2 mt-2">{enquiry.history.map((event,index)=><li key={index} className="text-sm break-words">{event.action.replaceAll('_',' ')} / {event.actorUID} / {new Date(event.at).toLocaleString()} / {event.previousBrokerUID||'Unassigned'} to {event.brokerUID||'Unassigned'} / {enquiryStatuses[event.previousStatus]} to {enquiryStatuses[event.status]}{event.notes&&<p className="whitespace-pre-wrap">{event.notes}</p>}</li>)}</ul>:<p className="text-sm">No assignment or progress recorded.</p>}</details>
 </CardContent></Card>;
}
export default function EnquiryInbox({admin=false,agents=[]}:{admin?:boolean;agents?:Agent[]}) {
 const {user,loading}=useAuth(),[error,setError]=useState('');
 const query=useQuery({queryKey:['enquiries',user?.uid],queryFn:()=>workflowRequest<{enquiries:ManagedEnquiry[]}>('enquiries'),enabled:!!user&&!loading,staleTime:0});
 async function save(enquiry:ManagedEnquiry,body:Record<string,unknown>){setError('');try{await workflowRequest(`enquiries/${enquiry.id}`,body,'PATCH');}catch(e){setError(e instanceof Error?e.message:'Could not update enquiry');}finally{await query.refetch();}}
 return <section className={styles.inbox} aria-label={admin?'Property enquiry inbox':'Assigned property enquiries'}>
  <h2 className={styles.heading}>{admin?'Property enquiry inbox':'Your assigned property enquiries'}</h2>
  <p className="text-sm">Notes and history are private to administrators and the currently assigned broker. Progress records do not schedule visits or finalize negotiations.</p>
  <Button variant="outline" onClick={()=>query.refetch()} disabled={query.isFetching}>Refresh enquiries</Button>
  {error&&<p role="alert" className="text-destructive">{error}</p>}
  {query.isLoading?<p role="status">Loading enquiries...</p>:query.error?<p role="alert">Could not load enquiries. Refresh to retry.</p>:!query.data?.enquiries.length?<p>No enquiries in your permitted scope.</p>:query.data.enquiries.map(enquiry=><EnquiryRow key={`${enquiry.id}:${enquiry.version}`} enquiry={enquiry} admin={admin} agents={agents.filter(a=>a.role==='agent'&&a.isActive!==false)} onSave={body=>save(enquiry,body)}/>)}
 </section>;
}
export function BrokerEnquiries(){
 const {user,loading}=useAuth();
 const profile=useQuery({queryKey:['enquiryInboxRole',user?.uid],queryFn:()=>workflowRequest<{user?:{role:string}}>(`users/${user!.uid}`),enabled:!!user&&!loading,staleTime:0});
 return profile.data?.user?.role==='agent'?<EnquiryInbox/>:null;
}
