"use client";
import {connectionState} from '@/lib/relationship-link-state';
import styles from "./OwnerVerification.module.css";
import {useState,useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {workflowRequest} from '@/lib/client-workflows';
import {Button} from '@/ui/button';
import {Input} from '@/ui/input';

interface DecisionEvent {action:string;actorUID:string;at:string;reason:string}
const emptyHistory:DecisionEvent[]=[];
interface Review {status:string;version:number;reason:string;history:DecisionEvent[]}
export function OwnerVerificationStatus({status,reason}:{status?:string;reason?:string}) {
 return <div className={`${styles.status} text-sm`}><p>Owner verification: {status||'pending'}</p>{reason&&<p>Verification rejection reason: {reason}</p>}</div>;
}
export default function OwnerVerification({propertyId,status='pending',version=0,reason='',history=emptyHistory,evidenceDocuments=[],onDecision}:{propertyId:string;status?:string;version?:number;reason?:string;history?:DecisionEvent[];evidenceDocuments?:Array<{id:string;documentName?:string;documentType?:string;status?:string}>;onDecision?:()=>void|Promise<void>}) {
 const cache=useQueryClient(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[review,setReview]=useState<Review>({status,version,reason,history}),[requests,setRequests]=useState<Array<{id:string;candidateUID:string}>>([]);
 useEffect(()=>{setReview({status,version,reason,history});},[propertyId,status,version,reason,history]);
 useEffect(()=>{let active=true;void workflowRequest<{links:Array<{id:string;relationship:string;status:string;candidateUID:string}>}>(`relationship-links?propertyId=${encodeURIComponent(propertyId)}`).then(data=>{if(active)setRequests(data.links.filter(item=>item.relationship==='owner'&&connectionState(item.status)==='pending_admin_verification'));}).catch(()=>{if(active)setRequests([]);});return()=>{active=false;};},[propertyId,review.version]);
 async function submit(event:React.FormEvent<HTMLFormElement>,action:string){
  event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage('');
  try{const response=await workflowRequest<{message:string;verification:Review}>('owner-verification',{propertyId,action,expectedVersion:review.version,...(action==='approve'?{ownerUID:data.get('ownerUID'),evidenceDocumentId:data.get('evidenceDocumentId'),reviewNote:data.get('reviewNote')}:{reason:data.get('reason')||''})});setReview(response.verification);setMessage(response.message);await Promise.all(['ownerVerification','relationshipLinks','property','userProperties','allProperties','productHub'].map(key=>cache.invalidateQueries({queryKey:[key]})));await onDecision?.();}
  catch(error){setMessage(error instanceof Error?error.message:'Verification failed');}finally{setBusy(false);}
 }
 return <section className={`${styles.verification} space-y-3`} aria-label="Owner verification decisions"><h3 className="font-semibold">Verify and link owner</h3><OwnerVerificationStatus status={review.status} reason={review.reason}/>
 <p className="text-sm">Review the property document and confirm ownership independently before linking an existing Firebase account. Supplied tenant contacts are not proof of ownership.</p>
 {message&&<p role="status">{message}</p>}
 <Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const data=await workflowRequest<{property:{ownershipVerification:string;ownershipVerificationVersion?:number;ownershipVerificationReason?:string;ownershipVerificationHistory?:DecisionEvent[]}}>(`properties/${propertyId}`);const p=data.property;setReview({status:p.ownershipVerification,version:p.ownershipVerificationVersion||0,reason:p.ownershipVerificationReason||'',history:p.ownershipVerificationHistory||[]});const candidates=await workflowRequest<{links:Array<{id:string;relationship:string;status:string;candidateUID:string}>}>(`relationship-links?propertyId=${encodeURIComponent(propertyId)}`);setRequests(candidates.links.filter(item=>item.relationship==='owner'&&connectionState(item.status)==='pending_admin_verification'));await onDecision?.();}catch{setMessage('Could not refresh verification. Please retry.');}finally{setBusy(false);}}}>Refresh verification</Button>
 {!!requests.length&&<div className={styles.status}><h4>Requested ownership verification</h4>{requests.map(item=><p key={item.id}>Verified-email candidate account UID: {item.candidateUID}. Reference: {item.id.slice(0,8)}.</p>)}<p>Email matching identifies a candidate account; it is not evidence of ownership. Review the required property evidence independently.</p></div>}
 {review.status==='pending'&&<>
 <form className="space-y-3" onSubmit={event=>submit(event,'approve')}><label className="block">Candidate owner account{requests.length?<select name="ownerUID" required className="mt-1 h-10 w-full rounded border px-3"><option value="">Select an authorized candidate</option>{requests.map(item=><option key={item.id} value={item.candidateUID}>Verified-email candidate · {item.candidateUID.slice(0,8)}…</option>)}</select>:<Input name="ownerUID" required maxLength={128} aria-describedby="owner-uid-help"/>}</label>{!requests.length&&<p id="owner-uid-help" className="text-sm text-muted-foreground">No pending verified-email candidate was found. Enter an existing account only after independently confirming its identity.</p>}<label className="block">Reviewed property document{evidenceDocuments.length?<select name="evidenceDocumentId" required className="mt-1 h-10 w-full rounded border px-3"><option value="">Select reviewed evidence</option>{evidenceDocuments.map(document=><option key={document.id} value={document.id}>{document.documentName||document.documentType||'Document'} · {document.status||'submitted'}</option>)}</select>:<><Input name="evidenceDocumentId" required maxLength={160}/><span className="block text-sm text-muted-foreground">No uploaded property documents were returned. Refresh documents before approving.</span></>}</label><label className="block">Verification review note<Input name="reviewNote" required maxLength={2000}/></label><label className="flex gap-2"><input type="checkbox" required/>I independently verified ownership evidence and the intended account.</label><Button disabled={busy}>Verify and link owner</Button></form>
 <form className="space-y-3" onSubmit={event=>submit(event,'reject')}><label className="block">Rejection reason<Input name="reason" required maxLength={2000}/></label><Button variant="outline" disabled={busy}>Reject owner verification</Button></form>
 </>}
 {review.status==='rejected'&&<form className="space-y-3" onSubmit={event=>submit(event,'reconsider')}><label className="block">Reconsideration note (optional)<Input name="reason" maxLength={2000}/></label><Button variant="outline" disabled={busy}>Reopen owner verification for review</Button></form>}
 {!!review.history.length&&<details><summary>Owner verification history</summary><ul>{review.history.map((item,index)=><li key={index} className="text-sm break-words">{item.action} / {item.actorUID} / {new Date(item.at).toLocaleString()} / {item.reason}</li>)}</ul></details>}
 </section>;
}
