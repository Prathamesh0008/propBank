"use client";

import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {apiFetch} from '@/lib/api-client';
import {Button} from '@/ui/button';
import {Textarea} from '@/ui/textarea';
import {Badge} from '@/ui/badge';

export interface ListingReview {
  id:string; createdAs?:string; listingType?:string;
  moderationStatus?:string; moderationRevision?:number; moderationReason?:string;
  moderationHistory?:Array<{action:string;actorUID:string;at:string;reason?:string}>;
}
export default function ListingModeration({property,admin=false}:{property:ListingReview;admin?:boolean}) {
  const [current,setCurrent]=useState(property),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const queries=useQueryClient();
  if(!current.moderationStatus&&(current.createdAs==='tenant'||!['rent','sell','sell_rent'].includes(current.listingType||'')))return null;
  const status=current.moderationStatus??'unreviewed';
  async function decide(action:string) {
    setBusy(true);setError('');
    try {
      const response=await apiFetch(`/api/properties/${current.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({moderationAction:action,reason,expectedRevision:current.moderationRevision||0})});
      const result=await response.json();
      if(!response.ok||!result.success)throw new Error(result.message||result.error||'Listing decision failed; refresh and retry.');
      setCurrent(result.property);setReason('');await queries.invalidateQueries();
    }catch(e){setError(e instanceof Error?e.message:'Listing decision failed');}finally{setBusy(false);}
  }
  return <div className="space-y-2 mt-2">
    <Badge variant="outline">Listing: {status.replaceAll('_',' ')}</Badge>
    {current.moderationReason&&<p className="text-sm">Review reason: {current.moderationReason}</p>}
    {admin&&['pending_review','unreviewed'].includes(status)&&<>
      <Textarea aria-label="Listing review reason" placeholder="Reason (required for rejection or changes)" maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={()=>decide('approve')}>Approve listing</Button>
        <Button variant="outline" disabled={busy||!reason.trim()} onClick={()=>decide('reject')}>Reject listing</Button>
        <Button variant="outline" disabled={busy||!reason.trim()} onClick={()=>decide('request_changes')}>Request changes</Button>
      </div>
    </>}
    {!admin&&['rejected','changes_requested'].includes(status)&&<>
      <p className="text-sm">Edit the property to submit updated details for review, or resubmit the current details.</p>
      <Button variant="outline" disabled={busy} onClick={()=>decide('resubmit')}>Resubmit listing</Button>
    </>}
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {admin&&!!current.moderationHistory?.length&&<details><summary>Listing decision history</summary><ul>{current.moderationHistory.map((entry,index)=><li key={index}>{entry.action.replaceAll('_',' ')} / {entry.actorUID} / {entry.at}{entry.reason?` / ${entry.reason}`:''}</li>)}</ul></details>}
  </div>;
}
