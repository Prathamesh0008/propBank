"use client";
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import type { Negotiation, NegotiationAction } from '@/lib/negotiation';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import AmountInWords from '@/components/AmountInWords';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Props { propertyId?:string; canOffer?:boolean; admin?:boolean }
const money=(value:number|null)=>value===null?'—':`₹${value.toLocaleString('en-IN')}`;
export default function NegotiationPanel({propertyId,canOffer=false,admin=false}:Props) {
  const {user}=useAuth();const {toast}=useToast();const client=useQueryClient();
  const [offer,setOffer]=useState('');const [busy,setBusy]=useState(false);
  const [amounts,setAmounts]=useState<Record<string,string>>({});
  const [brokers,setBrokers]=useState<Record<string,string>>({});
  const {data,isLoading,error}=useQuery<{negotiations:Negotiation[];limited:boolean}>({
    queryKey:['negotiations',user?.uid,propertyId],enabled:!!user,
    queryFn:async()=>{
      const response=await apiFetch(`/api/negotiations${propertyId?`?propertyId=${encodeURIComponent(propertyId)}`:''}`);
      const body=await response.json();if(!response.ok)throw new Error(body.message||'Failed to load negotiations');return body;
    },
  });
  async function mutate(n?:Negotiation,action?:NegotiationAction) {
    if(busy)return;setBusy(true);
    try {
      const raw=n?amounts[n.id]:offer;
      const response=await apiFetch(n?`/api/negotiations/${encodeURIComponent(n.id)}`:'/api/negotiations',{
        method:n?'PATCH':'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(n?{action,version:n.version,...(raw?{amount:Number(raw)}:{}),...(brokers[n.id]?{brokerUID:brokers[n.id]}:{})}:{propertyId,amount:Number(offer)}),
      });
      const body=await response.json();if(!response.ok)throw new Error(body.message||'Could not save negotiation');
      setOffer('');await client.invalidateQueries({queryKey:['negotiations']});
      toast({title:'Negotiation saved',description:'The offer history has been updated.'});
    }catch(failure){await client.invalidateQueries({queryKey:['negotiations']});toast({title:'Could not save',description:failure instanceof Error?failure.message:'Please try again',variant:'destructive'});}
    finally{setBusy(false);}
  }
  if(!user)return null;
  return <Card className="my-6"><CardHeader><CardTitle>Offers and negotiations</CardTitle></CardHeader><CardContent className="space-y-5">
    {canOffer&&propertyId&&<form onSubmit={event=>{event.preventDefault();void mutate();}} className="flex flex-wrap gap-2">
      <div className="max-w-xs"><Input type="number" min="0.01" step="0.01" required aria-label="Your offer in rupees" placeholder="Your offer in rupees" value={offer} onChange={event=>setOffer(event.target.value)} /><AmountInWords amount={offer}/></div>
      <Button disabled={busy} type="submit">Submit offer</Button>
      <p className="w-full text-sm text-muted-foreground">The owner must approve the amount before it can be confirmed.</p>
    </form>}
    {isLoading&&<p>Loading offers…</p>}
    {error&&<p role="alert">{error.message}</p>}
    {!isLoading&&!error&&!data?.negotiations.length&&<p className="text-sm text-muted-foreground">No offers yet.</p>}
    {data?.limited&&<p>Only the first 100 matching records are shown. Open a property to narrow the list.</p>}
    {data?.negotiations.map(n=>{
      const owner=n.ownerUID===user.uid,customer=n.customerUID===user.uid;
      const broker=admin||n.brokerUID===user.uid;
      const pending=['offered','proposed','countered'].includes(n.status);
      return <div key={n.id} className="rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{n.propertyTitle}</h3><span className="text-sm capitalize">{n.status.replaceAll('_',' ')}</span></div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt>Original asking price</dt><dd>{money(n.originalAskingPrice)}</dd></div>
          <div><dt>Customer offer</dt><dd>{money(n.customerOffer)}</dd></div>
          <div><dt>Broker proposal</dt><dd>{money(n.brokerProposedAmount)}</dd></div>
          <div><dt>Owner counter</dt><dd>{money(n.ownerCounterAmount)}</dd></div>
          <div><dt>Owner-approved amount</dt><dd>{money(n.ownerApprovedAmount)}</dd></div>
          <div><dt>Final agreed amount</dt><dd>{money(n.finalAgreedAmount)}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-2">
          {pending&&(owner||broker)&&<div className="max-w-xs"><Input type="number" min="0.01" step="0.01" aria-label={`Amount for ${n.propertyTitle}`} placeholder="Amount in rupees" value={amounts[n.id]||''} onChange={event=>setAmounts({...amounts,[n.id]:event.target.value})} /><AmountInWords amount={amounts[n.id]||''}/></div>}
          {pending&&broker&&<Button disabled={busy||!amounts[n.id]} onClick={()=>void mutate(n,'propose')}>Send proposal to owner</Button>}
          {owner&&['offered','proposed'].includes(n.status)&&<Button disabled={busy} onClick={()=>void mutate(n,'accept')}>Accept amount</Button>}
          {owner&&pending&&<Button disabled={busy||!amounts[n.id]} variant="outline" onClick={()=>void mutate(n,'counter')}>Counter offer</Button>}
          {owner&&(pending||n.status==='owner_approved')&&<Button disabled={busy} variant="outline" onClick={()=>void mutate(n,'reject')}>Reject</Button>}
          {customer&&['countered','owner_approved'].includes(n.status)&&<Button disabled={busy} onClick={()=>void mutate(n,'customer_accept')}>Accept owner-approved amount</Button>}
          {customer&&(pending||n.status==='owner_approved')&&<Button disabled={busy} variant="outline" onClick={()=>void mutate(n,'withdraw')}>Withdraw</Button>}
          {admin&&n.status==='accepted'&&<Button disabled={busy} onClick={()=>void mutate(n,'complete')}>Mark transaction complete</Button>}
        </div>
        {admin&&pending&&<div className="flex flex-wrap gap-2"><Input className="max-w-xs" aria-label="Agent UID" placeholder="Agent UID" value={brokers[n.id]||''} onChange={event=>setBrokers({...brokers,[n.id]:event.target.value})}/><Button variant="outline" disabled={busy||!brokers[n.id]} onClick={()=>void mutate(n,'assign_broker')}>Assign broker</Button></div>}
        <details><summary className="cursor-pointer text-sm">Offer history</summary><ol className="mt-2 space-y-1 text-sm">{n.history.map((event,index)=><li key={index}>{new Date(event.at).toLocaleString('en-IN')} · {event.action.replaceAll('_',' ')}{event.amount!==null?` · ${money(event.amount)}`:''}</li>)}</ol></details>
      </div>;
    })}
  </CardContent></Card>;
}
