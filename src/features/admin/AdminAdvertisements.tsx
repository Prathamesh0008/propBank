"use client";
import {useEffect,useRef,useState,type MutableRefObject} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {apiFetch} from '@/lib/api-client';
import {ADVERTISEMENT_MAX_BYTES,ADVERTISEMENT_MIME_TYPES,advertisementDestination,type AdminAdvertisement} from '@/features/properties/property-advertisement';
import styles from './AdminAdvertisements.module.css';

async function operation(path:string,init?:RequestInit){const response=await apiFetch('/api/admin/advertisements'+path,init);const result=await response.json().catch(()=>null);if(!response.ok||!result?.success)throw Error(result?.message||'Advertisement request failed. Refresh and retry.');return result;}
function Preview({file,ad}:{file?:File;ad?:AdminAdvertisement}){
 const [url,setUrl]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{let objectUrl='',cancelled=false;const controller=new AbortController();setUrl('');setError(false);
  if(file){objectUrl=URL.createObjectURL(file);setUrl(objectUrl);}
  else if(ad?.imageUrl)void apiFetch(ad.imageUrl,{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('Preview unavailable');const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Invalid preview');if(!cancelled){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(()=>{if(!cancelled)setError(true);});
  return()=>{cancelled=true;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[file,ad?.imageUrl]);
 return <div className={styles.preview}>{url?<img src={url} alt="Advertisement preview"/>:<p>{error?'Preview unavailable. Refresh to retry.':file||ad?.imageUrl?'Loading preview…':'Select an image to preview.'}</p>}</div>;
}
function Editor({ad,busy,perform,creationKey}:{ad?:AdminAdvertisement;busy:boolean;creationKey?:MutableRefObject<string>;perform:(run:()=>Promise<void>)=>Promise<boolean>}){
 const [file,setFile]=useState<File>(),[destination,setDestination]=useState(ad?.destinationUrl||''),[active,setActive]=useState(ad?.active||false),[fileError,setFileError]=useState('');
 const input=useRef<HTMLInputElement>(null),localKey=useRef('');const createKey=creationKey||localKey;
 useEffect(()=>{setDestination(ad?.destinationUrl||'');setActive(ad?.active||false);setFile(undefined);if(input.current)input.current.value='';},[ad?.version,ad?.destinationUrl,ad?.active]);
 async function save(event:React.FormEvent){event.preventDefault();if(busy)return;
  let url:string;try{url=advertisementDestination(destination);}catch(error){setFileError((error as Error).message);return;}
  if(!ad&&!file){setFileError('Choose an advertisement image.');return;}setFileError('');
  const form=new FormData();form.set('destinationUrl',url);form.set('active',String(active));if(file)form.set('image',file);if(ad)form.set('version',String(ad.version));
  if(!ad&&!createKey.current)createKey.current=crypto.randomUUID();
  const saved=await perform(async()=>{await operation(ad?'/'+ad.id:'',{method:ad?'PUT':'POST',body:form,...(!ad?{headers:{'Idempotency-Key':createKey.current}}:{})});});
  if(saved){setFile(undefined);if(input.current)input.current.value='';if(!ad){setDestination('');setActive(false);createKey.current='';}}
 }
 const locked=busy||ad?.pending||ad?.deleted;
 return <article className={styles.editor}><header><h3>{ad?'Advertisement':'New advertisement'}</h3>{ad&&<span>{ad.deleted?'Deleted — cleanup pending':ad.pending?'Upload pending':ad.active?'Active':'Inactive'}</span>}</header>
  <Preview file={file} ad={ad}/>
  <form onSubmit={save} data-demo-autofill="off">
   <label>Advertisement image{!ad?' *':''}<input ref={input} type="file" accept={ADVERTISEMENT_MIME_TYPES.join(',')} disabled={!!locked} onChange={event=>{
    const selected=event.target.files?.[0];setFileError('');if(selected&&(selected.size>ADVERTISEMENT_MAX_BYTES||!selected.size||!ADVERTISEMENT_MIME_TYPES.includes(selected.type as typeof ADVERTISEMENT_MIME_TYPES[number]))){event.target.value='';setFile(undefined);setFileError('Choose a JPEG, PNG or WebP image up to 4 MB.');return;}setFile(selected);if(!ad)createKey.current='';
   }}/></label>
   <small>{ad?'Select a new image only to replace this advertisement. ':' '}JPEG, PNG or WebP, up to 4 MB. Metadata is removed during upload.</small>
   <label>Destination URL (optional)<input type="url" placeholder="https://…" value={destination} disabled={!!locked} onChange={event=>{setDestination(event.target.value);if(!ad)createKey.current='';}}/></label>
   <label className={styles.check}><input type="checkbox" checked={active} disabled={!!locked} onChange={event=>{setActive(event.target.checked);if(!ad)createKey.current='';}}/> Active on Property Details</label>
   {fileError&&<p role="alert" className={styles.error}>{fileError}</p>}
   <div className={styles.actions}><button type="submit" disabled={!!locked}>{busy?'Working…':ad?'Save changes':'Create advertisement'}</button>
    {ad&&!ad.deleted&&<button type="button" disabled={busy||ad.pending} onClick={()=>{if(window.confirm('Delete this advertisement and its image?'))void perform(async()=>{await operation('/'+ad.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:ad.version})});});}}>Delete</button>}
    {ad?.needsCleanup&&<button type="button" disabled={busy} onClick={()=>void perform(async()=>{await operation('/'+ad.id+'/cleanup',{method:'POST'});createKey.current='';})}>Recover upload / retry cleanup</button>}
   </div>
  </form>
  {ad&&<footer><p>Updated: {ad.updatedAt?new Intl.DateTimeFormat('en-GB',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(ad.updatedAt)):'Pending'}</p><small>Reference: {ad.id}</small>{ad.needsCleanup&&<p>Interrupted uploads can be recovered after two minutes. The previous image stays available until replacement succeeds. Refresh after cleanup; retry if storage remains unavailable.</p>}</footer>}
 </article>;
}
export default function AdminAdvertisements(){
 const {user}=useAuth(),cache=useQueryClient(),lock=useRef(false),creationKey=useRef('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const query=useQuery<{items:AdminAdvertisement[];limit:number;activeLimit:number}>({queryKey:['adminAdvertisements',user?.uid],enabled:!!user,queryFn:()=>operation(''),staleTime:30000});
 async function perform(run:()=>Promise<void>){if(lock.current)return false;lock.current=true;setBusy(true);setError('');setMessage('');try{await run();const refreshed=await query.refetch();if(creationKey.current&&refreshed.data){const created=refreshed.data.items.find(ad=>ad.id===creationKey.current);if(!created||created.deleted)creationKey.current='';}await cache.invalidateQueries({queryKey:['publicAdvertisements']});setMessage('Advertisement changes saved. Review any pending file cleanup shown below.');return true;}catch(error){setError(error instanceof Error?error.message:'Could not update advertisement.');await query.refetch();return false;}finally{lock.current=false;setBusy(false);}}
 return <section className={styles.workspace} aria-label="Advertisements"><header className={styles.heading}><div><h2>Advertisements</h2><p>Image-only banners for the Property Details sidebar.</p></div><button type="button" disabled={busy||query.isFetching} onClick={()=>void query.refetch()}>Refresh</button></header>
  {(error||query.error)&&<p role="alert" className={styles.error}>{error||query.error?.message}</p>}{message&&<p role="status">{message}</p>}
  {query.isLoading?<p role="status">Loading advertisements…</p>:query.data&&<><p className={styles.limits}>{query.data.items.length} advertisements · Up to {query.data.limit} total and {query.data.activeLimit} active.</p><Editor busy={busy} perform={perform} creationKey={creationKey}/>
   {!query.data.items.length&&<p>No advertisements yet. Nothing is shown on Property Details until an advertisement is active.</p>}
   <div className={styles.list}>{query.data.items.map(ad=><Editor key={ad.id} ad={ad} busy={busy} perform={perform}/>)}</div></>}
 </section>;
}
