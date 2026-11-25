"use client";
import {formatDisplayDateTime} from '@/lib/date-format';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useAuth} from '@/contexts/AuthContext';
import {workflowRequest} from '@/lib/client-workflows';
import {useDataRefresh} from '@/lib/data-refresh';
import {Button} from '@/ui/button';
import styles from './AdminNotificationFeed.module.css';
interface Notice {id:string;type:string;title:string;message:string;propertyId:string;timestamp:string;isRead:boolean;destination:string|null;emailStatus?:string}
const emailLabels:Record<string,string>={queued:'Queued',processing:'Processing',provider_accepted:'Provider accepted',delivered:'Delivered',retryable_failure:'Retry pending',exhausted:'Retries exhausted',permanent_failure:'Failed',reconciliation_required:'Delivery review required',cancelled:'Cancelled',not_requested:'Not requested',unconfigured:'Not configured',bounced:'Bounced'};
export default function AdminNotificationFeed({onUnreadCount,onViewProperty,state='all'}:{onUnreadCount:(count:number)=>void;onViewProperty:(id:string)=>void;state?:string}){
 const {user}=useAuth();
 const [cursor,setCursor]=useState(''),[pages,setPages]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const readLock=useRef(false);
 const query=useQuery({queryKey:['adminNotificationFeed',user?.uid,state,cursor],enabled:!!user,staleTime:60000,refetchOnWindowFocus:false,refetchInterval:60000,queryFn:()=>workflowRequest<{items:Notice[];unreadCount:number;nextCursor:string|null}>(`admin/notifications/feed?${new URLSearchParams({cursor,state})}`)});
 useEffect(()=>{if(query.data)onUnreadCount(query.data.unreadCount);},[query.data,onUnreadCount]);
 useEffect(()=>{setCursor('');setPages([]);},[state]);
 useDataRefresh(['notifications','properties','tenants','agreements'],()=>void query.refetch());
 async function read(id?:string){
  if(readLock.current)return false;
  readLock.current=true;setBusy(true);setError('');
  try{
   if(id)await workflowRequest(`admin/notifications/${encodeURIComponent(id)}/read`,{},'PUT');
   else{
    let more=true,markCursor='',cutoff='';
    for(let page=0;page<20&&more;page++){
     const result=await workflowRequest<{mayHaveMore:boolean;nextCursor:string|null;cutoff:string}>('admin/notifications/feed',{action:'mark_all_read',cursor:markCursor,...(cutoff?{cutoff}:{})});
     more=result.mayHaveMore;markCursor=result.nextCursor||'';cutoff=result.cutoff;
     if(page===19&&more)throw Error('4000 notifications marked read. Repeat to process the remaining notifications.');
    }
   }
   await query.refetch();return true;
  }catch(e){setError(e instanceof Error?e.message:'Could not update notification status');await query.refetch().catch(()=>{});return false;}
  finally{readLock.current=false;setBusy(false);}
 }
 async function openNotice(notice:Notice){
  if(readLock.current)return;
  if(!notice.isRead&&!await read(notice.id))return;
  // Feed destinations are existing admin workflows; never follow external URLs.
  if(notice.destination?.startsWith('/admin?tab=properties'))onViewProperty(notice.propertyId);
  else if(notice.destination==='/admin'||notice.destination?.startsWith('/admin?'))window.location.assign(notice.destination);
 }
 return <section className={styles.section} aria-label="Admin notifications">
  <div className={styles.toolbar}><div><p className={styles.eyebrow}>PROPERTY ACTIVITY</p><h2>Admin Notifications</h2></div><span className={styles.count}>{query.data?.unreadCount??'...'} unread</span><Button variant="outline" disabled={busy||!query.data?.unreadCount} onClick={()=>void read()}>Mark all as read</Button><Button variant="ghost" disabled={busy||query.isFetching} onClick={()=>void query.refetch()}>Refresh</Button></div>
  {(query.error||error)&&<div role="alert" className={styles.error}>{query.error?.message||error}{query.data&&<p>Showing the last loaded notifications. Refresh to confirm the latest status.</p>}</div>}
  {query.isLoading&&<p role="status">Loading notifications...</p>}
  {query.data&&!query.data.items.length&&<p className={styles.empty}>No notifications in this view.</p>}
  <ol className={styles.notices}>{query.data?.items.map(n=><li key={n.id} className={!n.isRead?styles.unread:styles.read}>
   <div className={styles.noticeHeader}><span className={styles.type}>{n.type.replaceAll('_',' ').replaceAll('.',' ')}</span><span className={styles.readState}>{n.isRead?'Read':'Unread'}</span></div>
   <h3>{n.title}</h3><p>{n.message}</p>
   <div className={styles.metadata}><time>{formatDisplayDateTime(n.timestamp,{timeZone:'Asia/Kolkata'})}</time>{n.emailStatus&&<span>Email: {emailLabels[n.emailStatus]||n.emailStatus.replaceAll('_',' ')}</span>}</div>
   <div className={styles.actions}>{n.destination&&<Button variant="ghost" size="sm" disabled={busy} onClick={()=>void openNotice(n)}>Open details</Button>}{!n.isRead&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>void read(n.id)}>Mark as read</Button>}<details><summary>Internal reference</summary><p>{n.propertyId||'Historical reference unavailable'}</p></details></div>
  </li>)}</ol>
  <div className={styles.pagination}><Button variant="outline" disabled={!pages.length||busy||query.isFetching} onClick={()=>{setCursor(pages.at(-1)||'');setPages(p=>p.slice(0,-1));}}>Previous</Button><Button variant="outline" disabled={!query.data?.nextCursor||busy||query.isFetching} onClick={()=>{setPages(p=>[...p,cursor]);setCursor(query.data!.nextCursor!);}}>Next</Button></div>
 </section>;
}
