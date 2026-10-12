"use client";
import { useEffect,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useParams,Link } from '@/lib/navigation';
import { renewalFields,renewalPrefill,workflowRequest,type WorkflowProperty } from '@/lib/client-workflows';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Card,CardHeader,CardTitle,CardContent } from '@/ui/card';

export default function AgreementWorkflow({renew}:{renew:boolean}) {
  const {propertyId}=useParams();const {user,loading:authLoading}=useAuth();const cache=useQueryClient();
  const [terms,setTerms]=useState<Record<string,string>>({});const [notice,setNotice]=useState('1 Month');
  const [start,setStart]=useState(new Date().toISOString().slice(0,10));const [end,setEnd]=useState('');
  const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[failure,setFailure]=useState('');
  const query=useQuery({queryKey:['agreement',propertyId,user?.uid],enabled:!!user&&!!propertyId,queryFn:()=>workflowRequest<{property:WorkflowProperty}>(`properties/${propertyId}`)});
  const property=query.data?.property,owner=property?.ownerUID===user?.uid;
  const member=owner||property?.userRole==='tenant';
  const pending=property?.agreementRequest?.status==='pending'?property.agreementRequest:undefined;
  useEffect(()=>{if(property){setTerms({...renewalPrefill(property),...(pending?.proposedTerms||pending?.terms||{})});setNotice(String(pending?.noticePeriod||property.noticePeriod||'1 Month'));if(pending?.noticeStartDate||property.noticeStartDate)setStart(String(pending?.noticeStartDate||property.noticeStartDate).slice(0,10));setEnd(String(pending?.terminationDate||property.anticipatedTerminationDate||'').slice(0,10));}},[property,pending]);
  async function submit(action:string) {
    if(!property||busy)return;
    if(!renew&&action==='terminate'&&!window.confirm('Finalize termination? Current tenancy ends; agreement history is retained.'))return;
    setBusy(true);setFailure('');setFeedback('');
    try {
      const endpoint=`agreements/${renew?(owner?'renew':'request-renewal'):(owner?'terminate':'request-termination')}`;
      const body={propertyId:property.id,action,...(pending?{requestId:pending.id}:{}),...(renew?{terms:Object.fromEntries(Object.entries(terms).filter(([,value])=>value!==''))}:action==='terminate'?{}:{noticePeriod:notice,...(notice?{noticeStartDate:start,terminationDate:end}:{})})};
      await workflowRequest(endpoint,body);
      await Promise.all([query.refetch(),cache.invalidateQueries({queryKey:['userProperties']}),cache.invalidateQueries({queryKey:['property',property.id]})]);
      setFeedback(action==='reject'?'Request rejected.':renew&&action==='approve'?'Renewal approved. Agreed terms updated.':!renew&&action==='terminate'?'Agreement terminated; history retained.':owner&&!renew?'Notice recorded. Final termination requires an owner decision.':'Request submitted; pending owner approval.');
    }catch(error){setFailure(error instanceof Error?error.message:'Could not save agreement');}finally{setBusy(false);}
  }
  return <main className="container mx-auto max-w-4xl px-4 py-8 space-y-5">
    <Link to="/manage-property">← Manage Property</Link>
    <Card><CardHeader><CardTitle>{renew?'Agreement renewal':'Agreement termination'}</CardTitle></CardHeader><CardContent className="space-y-5">
      {(authLoading||query.isLoading)&&<p role="status">Loading agreement…</p>}
      {(query.error||failure)&&<p role="alert" className="text-destructive">{query.error?.message||failure}</p>}
      {!authLoading&&!user&&<Link to="/auth">Sign in to manage agreements</Link>}
      {property&&<><h2 className="font-semibold break-words">{property.title} · {property.id}</h2>
        <p>Agreement status: {String(property.agreementStatus||'Active')} · {owner?'Owner':'Tenant'}</p>
        <p className="text-sm">Current rent: ₹{String(property.monthlyRent||'Not supplied')} · {String(property.agreementStartDate||'')} → {String(property.agreementEndDate||'')}</p>
        {pending&&<p className="rounded border p-3">Pending {pending.kind} request. Existing terms remain in effect until the owner decides.</p>}
        {member&&property.agreementStatus!=='terminated'&&<form onSubmit={e=>{e.preventDefault();void submit('request');}} className="space-y-4">
          {renew?<div className="grid gap-4 sm:grid-cols-2">{renewalFields.map(([key,label])=><div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} type={key.includes('Date')?'date':'text'} value={terms[key]||''} onChange={e=>setTerms({...terms,[key]:e.target.value})}/></div>)}<div><Label htmlFor="maintenance-payer">Maintenance paid by</Label><select id="maintenance-payer" className="h-10 w-full rounded border px-3" value={terms.maintenanceToBePaidBy||''} onChange={e=>setTerms({...terms,maintenanceToBePaidBy:e.target.value})}><option value="">Select</option><option value="owner">Owner</option><option value="tenant">Tenant</option></select></div></div>:<div className="grid gap-4 sm:grid-cols-3"><div><Label htmlFor="notice-period">Notice period</Label><Input id="notice-period" value={notice} onChange={e=>setNotice(e.target.value)}/></div><div><Label htmlFor="notice-start">Notice start</Label><Input id="notice-start" type="date" value={start} onChange={e=>setStart(e.target.value)} required/></div><div><Label htmlFor="termination-date">Termination date</Label><Input id="termination-date" type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)} required/></div></div>}
          <div className="flex flex-wrap gap-3">
            {!pending&&<Button disabled={busy} type="submit">{renew?'Submit renewal request':owner?'Serve notice':'Request termination'}</Button>}
            {owner&&pending&&pending.kind===(renew?'renewal':'termination')&&<>{renew?<Button type="button" disabled={busy} onClick={()=>void submit('approve')}>Approve renewal</Button>:<Button type="button" disabled={busy||!start||!end} onClick={()=>void submit('request')}>Approve notice</Button>}<Button type="button" variant="outline" disabled={busy} onClick={()=>void submit('reject')}>Reject request</Button></>}
            {owner&&!renew&&<Button type="button" variant="destructive" disabled={busy} onClick={()=>void submit('terminate')}>Finalize termination</Button>}
          </div>
        </form>}
        {!member&&<p role="alert">Only the property owner or current tenant can use this workflow.</p>}
        {feedback&&<p role="status">{feedback}</p>}
        <Link to={`/attach-documents/${property.id}`}>Agreement documents and receipts</Link>
      </>}
    </CardContent></Card>
    {property&&<Card><CardHeader><CardTitle>Agreement history</CardTitle></CardHeader><CardContent>{!property.agreementHistory?.length?<p>No agreement changes recorded.</p>:<ol className="space-y-3">{property.agreementHistory.map((event,index)=><li key={index} className="rounded border p-3 break-words"><p>{event.action.replaceAll('_',' ')} · {new Date(event.at).toLocaleString('en-IN')}</p>{event.previousTerms&&<details><summary>Previous agreed terms</summary><dl>{Object.entries(event.previousTerms).map(([key,value])=><div key={key}>{key}: {String(value)}</div>)}</dl></details>}</li>)}</ol>}</CardContent></Card>}
  </main>;
}
