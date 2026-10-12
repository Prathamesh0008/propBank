"use client";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Link,useParams } from '@/lib/navigation';
import { workflowRequest } from '@/lib/client-workflows';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import { Label } from '@/ui/label';
import { Card,CardHeader,CardTitle,CardContent } from '@/ui/card';

interface Service {id:string;name:string;isActive:boolean}
interface RequestRecord {id:string;propertyId:string;serviceName:string;message:string;image?:string;status:string;isArchived?:boolean;resolutionReport?:string;adminNotes?:string;adminImage?:string;createdAt:string;history?:Array<{status:string;at:string;comment?:string}>}
const ids={maintenance:['plumbing','leakage','fixtures','painting','electrical','other'],legal:['rent-agreement-registration','sale-agreement-procedure','legal-consultation'],related:['society-procedure','pre-rental','painting','plumbing','electrical','other']};
export function ServiceRequestHistory({propertyId,admin=false}:{propertyId?:string;admin?:boolean}) {
  const {user}=useAuth();const [failure,setFailure]=useState(''),[busy,setBusy]=useState('');
  const query=useQuery({queryKey:['service-requests',user?.uid,propertyId,admin],enabled:!!user&&(admin||!!propertyId),queryFn:()=>workflowRequest<{data:RequestRecord[]}>(`service-requests?${admin?'admin=true':`propertyId=${encodeURIComponent(propertyId!)}`}`)});
  async function update(event:React.FormEvent<HTMLFormElement>,id:string) {
    event.preventDefault();const form=new FormData(event.currentTarget);setBusy(id);setFailure('');
    try{
      let image=String(form.get('adminImage')||'');const file=form.get('attachment');
      if(file instanceof File&&file.size) {
        if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP image under 5 MB.');
        const encoded=await readFile(file);
        const upload=await workflowRequest<{url:string}>('upload/service-request-image',{image:encoded,requestId:id});image=upload.url;
      }
      await workflowRequest(`service-requests/${id}`,{status:form.get('status'),resolutionReport:form.get('resolutionReport'),adminNotes:form.get('adminNotes'),adminImage:image,action:form.get('archive')==='yes'?'archive':'unarchive'},'PUT');await query.refetch();
    }catch(error){setFailure(error instanceof Error?error.message:'Could not update request');}finally{setBusy('');}
  }
  return <Card><CardHeader><CardTitle>{admin?'Service requests and resolution':'Request history and admin responses'}</CardTitle></CardHeader><CardContent className="space-y-4">
    {query.isLoading&&<p role="status">Loading requests…</p>}{(query.error||failure)&&<p role="alert" className="text-destructive">{query.error?.message||failure}</p>}
    {!query.isLoading&&!query.error&&!query.data?.data?.length&&<p>No requests yet.</p>}
    {query.data?.data?.map(request=><article key={request.id} className="rounded border p-4 space-y-3 break-words">
      <h3 className="font-semibold">{request.serviceName||'Service request'} · {request.propertyId}</h3><p>{request.message}</p><p>Status: {request.status.replaceAll('_',' ')}{request.isArchived?' · Archived':''}</p>
      {request.image&&<a href={request.image} target="_blank" rel="noopener noreferrer">Open request attachment</a>}
      {(request.resolutionReport||request.adminNotes)&&<p>Admin response: {request.resolutionReport} {request.adminNotes}</p>}
      {request.adminImage&&<a href={request.adminImage} target="_blank" rel="noopener noreferrer">Open resolution attachment</a>}
      <details><summary>History</summary><ol>{request.history?.map((entry,index)=><li key={index}>{entry.status} · {new Date(entry.at).toLocaleString('en-IN')} {entry.comment}</li>)}</ol></details>
      {admin&&<form onSubmit={e=>void update(e,request.id)} className="grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor={`status-${request.id}`}>Status</Label><select id={`status-${request.id}`} name="status" defaultValue={request.status} className="h-10 w-full border rounded px-2">{['pending','in_progress','resolved','completed','cancelled'].map(status=><option key={status}>{status}</option>)}</select></div>
        <div><Label htmlFor={`archive-${request.id}`}>Request archive</Label><select id={`archive-${request.id}`} name="archive" defaultValue={request.isArchived?'yes':'no'} className="h-10 w-full border rounded px-2"><option value="no">Active</option><option value="yes">Archived</option></select></div>
        <div><Label htmlFor={`resolution-${request.id}`}>Solution report</Label><Textarea id={`resolution-${request.id}`} name="resolutionReport" defaultValue={request.resolutionReport||''}/></div>
        <div><Label htmlFor={`notes-${request.id}`}>Admin comment</Label><Textarea id={`notes-${request.id}`} name="adminNotes" defaultValue={request.adminNotes||''}/></div>
        <input type="hidden" name="adminImage" value={request.adminImage||''}/><div><Label htmlFor={`attachment-${request.id}`}>Resolution image</Label><Input id={`attachment-${request.id}`} name="attachment" type="file" accept="image/png,image/jpeg,image/webp"/></div>
        <Button disabled={busy===request.id}>Save resolution and status</Button>
      </form>}
    </article>)}
  </CardContent></Card>;
}
export function readFile(file:File):Promise<string> {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read file'));reader.readAsDataURL(file);});}
export default function ServiceRequestWorkflow({group}:{group:keyof typeof ids}) {
  const {propertyId}=useParams();const {user}=useAuth();const [service,setService]=useState(''),[comment,setComment]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState(''),[failure,setFailure]=useState(''),[generation,setGeneration]=useState(0);
  const catalog=useQuery({queryKey:['services'],queryFn:()=>workflowRequest<{data:Service[]}>('services')});
  const options=catalog.data?.data?.filter(s=>s.isActive!==false&&(ids[group].includes(s.id)||!Object.values(ids).flat().includes(s.id)))||[];
  async function submit(event:React.FormEvent) {
    event.preventDefault();if(!user||!propertyId)return;setBusy(true);setFailure('');setFeedback('');
    try{
      if(file&&(file.size>5*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type)))throw new Error('Choose a JPEG, PNG or WebP image under 5 MB.');
      await workflowRequest('service-requests',{propertyId,userUID:user.uid,serviceId:service,message:comment,...(file?{image:await readFile(file)}:{})});setFeedback('Request submitted. The admin response will appear in the history below.');setGeneration(generation+1);setComment('');setFile(null);
    }catch(error){setFailure(error instanceof Error?error.message:'Could not submit request');}finally{setBusy(false);}
  }
  return <main className="container mx-auto max-w-4xl px-4 py-8 space-y-6"><Link to="/manage-property">← Manage Property</Link><Card><CardHeader><CardTitle>{group==='legal'?'Legal services':group==='related'?'Other related services':'Raise a maintenance request'}</CardTitle></CardHeader><CardContent>
    <p className="mb-4">Property: {propertyId}</p>
    {group==='related'&&<p className="mb-4"><Link to={`/visit-planner?propertyId=${propertyId}`}>Schedule a visit update with owner notification</Link></p>}
    {(catalog.error||failure)&&<p role="alert" className="text-destructive">{catalog.error?.message||failure}</p>}{feedback&&<p role="status">{feedback}</p>}
    <form onSubmit={e=>void submit(e)} className="space-y-4"><div><Label htmlFor="request-category">Service category</Label><select id="request-category" className="w-full rounded border h-10 px-3" required value={service} onChange={e=>setService(e.target.value)}><option value="">Choose category</option>{options.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><Label htmlFor="request-image">Image (optional)</Label><Input key={generation} id="request-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></div><div><Label htmlFor="request-comment">Comment / details</Label><Textarea id="request-comment" required value={comment} onChange={e=>setComment(e.target.value)}/></div><Button disabled={busy||!user||catalog.isLoading}>Submit request</Button></form>
  </CardContent></Card><ServiceRequestHistory key={generation} propertyId={String(propertyId)}/></main>;
}
