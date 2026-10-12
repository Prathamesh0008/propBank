"use client";
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {workflowRequest} from '@/lib/client-workflows';
import {Button} from '@/ui/button';
import {Input} from '@/ui/input';

export default function OwnerVerification({propertyId}:{propertyId:string}) {
 const cache=useQueryClient(),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 return <section className="space-y-3 rounded border p-4"><h3 className="font-semibold">Verify and link owner</h3><p className="text-sm">Review the property document and confirm ownership independently before linking an existing Firebase account. Supplied tenant contacts are not proof of ownership.</p>{message&&<p role="status">{message}</p>}{!done&&<form className="space-y-3" onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setMessage('');try{const response=await workflowRequest<{message:string}>('owner-verification',{propertyId,ownerUID:data.get('ownerUID'),evidenceDocumentId:data.get('evidenceDocumentId'),reviewNote:data.get('reviewNote')});setDone(true);setMessage(response.message);await cache.invalidateQueries();}catch(error){setMessage(error instanceof Error?error.message:'Verification failed');}finally{setBusy(false);}}}><label className="block">Existing owner Firebase UID<Input name="ownerUID" required maxLength={128}/></label><label className="block">Reviewed property document ID<Input name="evidenceDocumentId" required/></label><label className="block">Verification review note<Input name="reviewNote" required maxLength={2000}/></label><label className="flex gap-2"><input type="checkbox" required/>I independently verified ownership evidence and the intended account.</label><Button disabled={busy}>{busy?'Verifying…':'Verify and link owner'}</Button></form>}</section>;
}
