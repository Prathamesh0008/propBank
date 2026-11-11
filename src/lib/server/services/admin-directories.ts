import {adminDeliveryStatus} from './admin-lifecycle';
import {documentPage,documentsById} from '../query-pages';
import {ledgerStatus} from '@/lib/property-product';
import {localRentDate} from '@/lib/rent-resolution';
import 'server-only';
import {requireAdmin} from '../permissions';
import {COLLECTIONS,getDatabase} from '../firestore';
import {ApiError,jsonResponse} from '../http';
import {identity,readObject} from './domain-contracts';
import {isRecord,stringValue as s,wireValue,type RecordData} from './contracts';
import {resolveRent,rentForBillingPeriod} from '@/lib/rent-resolution';
const display=(v:unknown)=>typeof v==='string'||typeof v==='number'&&Number.isFinite(v)?String(v):'';
const reference=(v:string)=>!!v&&v.length<=200&&!v.includes('/');
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=(v:unknown)=>{const text=typeof v==='string'?v.slice(0,10):s(wireValue(v)).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(text)&&text!=='0001-01-01'?text:'';};
export function activeDirectoryTenant(t:RecordData,p:RecordData,id:string,today:string){return t.propertyId===id&&!!p.ownerUID&&t.ownerUID===p.ownerUID&&t.isActive===true&&!['terminated','expired','cancelled'].includes(s(t.status))&&!['terminated','expired','cancelled'].includes(s(t.agreementStatus))&&(!date(t.leaseEndDate||p.agreementEndDate)||date(t.leaseEndDate||p.agreementEndDate)>=today);}
export async function rentedProperties(request:Request){
 requireAdmin(await identity(request));const params=new URL(request.url).searchParams,db=getDatabase(),cursor=params.get('cursor')||'',search=(params.get('search')||'').trim().toLowerCase(),status=params.get('status')||'all',sort=params.get('sort')==='desc'?'desc':'asc';
 if(cursor&&!reference(cursor)||search.length>150||!['all','active','awaiting_confirmation','notice_served'].includes(status))throw new ApiError(400,'Invalid directory filter');
 let scanCursor=cursor,nextCursor:string|null=cursor||null,inspected=0;const properties:RecordData[]=[],today=day();
 // Up to four windows for sparse substring searches. A continuation means coverage
 // is incomplete, even when this bounded search returns no matches.
 for(let window=0;window<(search?4:1);window++){
  const page=await documentPage(db.collection(COLLECTIONS.properties),25,scanCursor,sort);nextCursor=page.nextCursor;inspected+=page.docs.length;
  const candidates=page.docs.filter(doc=>!search||`${s(doc.data().title)} ${doc.id}`.toLowerCase().includes(search)),byProperty=new Map<string,Array<{id:string;value:RecordData}>>();
  if(candidates.length){const linked=await db.collection(COLLECTIONS.tenants).where('propertyId','in',candidates.map(d=>d.id)).where('isActive','==',true).limit(1276).get();if(linked.docs.length===1276)throw new ApiError(409,'Tenancy candidate limit exceeded; refine this directory page');for(const d of linked.docs){const t=d.data(),key=s(t.propertyId),group=byProperty.get(key)||[];group.push({id:d.id,value:t});if(group.length>50)throw new ApiError(409,'Active tenancies exceed the supported directory page; review this property');byProperty.set(key,group);}}
  for(const doc of candidates){const p=doc.data(),today=localRentDate(p);
  const tenants=(byProperty.get(doc.id)||[]).filter(t=>activeDirectoryTenant(t.value,p,doc.id,today)).map(t=>{const value=t.value,state=value.linkConfirmationRequired===true?'awaiting_confirmation':p.agreementStatus==='notice_served'?'notice_served':'active';const rent=rentForBillingPeriod(p,today.slice(0,7),value);return {id:t.id,userUID:s(value.userUID),name:s(value.name)||[s(value.firstName),s(value.lastName)].filter(Boolean).join(' ')||'Not recorded',phone:s(value.phone),email:s(value.email),monthlyRent:(rent.dueDate?rent.amount:resolveRent(p,today,value).amount)||'',securityDeposit:display(value.securityDeposit??p.securityDeposit),startDate:date(value.leaseStartDate||p.agreementStartDate),endDate:date(value.leaseEndDate||p.agreementEndDate),dueDay:display(value.paymentDueDate??p.paymentDueDate),paymentStatus:isRecord(p.rentLedger)&&isRecord(p.rentLedger[localRentDate(p).slice(0,7)])?ledgerStatus(p.rentLedger[localRentDate(p).slice(0,7)],today)+(byProperty.get(doc.id)!.length>1?' (property ledger)':''):'Not recorded',status:state};}).filter(t=>status==='all'||t.status===status);
  if(tenants.length)properties.push({id:doc.id,title:s(p.title)||'Unnamed property',address:s(p.address||p.location),ownerName:s(p.ownerName)||'Not recorded',ownerPhone:s(p.ownerPhone),ownerEmail:s(p.ownerEmail),agreementStatus:s(p.agreementStatus)||'active',tenants});
  }
  if(properties.length||!nextCursor)break;scanCursor=nextCursor;
 }
 return jsonResponse({success:true,properties,nextCursor,pageCount:properties.length,candidatesInspected:inspected,coverageComplete:!nextCursor,searchMode:'bounded-substring'});
}

export async function notificationFeed(request:Request){
 const user=await identity(request);requireAdmin(user);const db=getDatabase(),collection=db.collection(COLLECTIONS.adminNotifications),params=new URL(request.url).searchParams,cursor=params.get('cursor')||'';
 if(cursor&&!reference(cursor))throw new ApiError(400,'Invalid cursor');
 const unreadCount=async()=>{const [total,read]=await Promise.all([collection.count().get(),collection.where('readByUIDs','array-contains',user.uid).count().get()]);return Math.max(0,total.data().count-read.data().count);};
 if(request.method==='GET'&&params.get('countOnly')==='true')return jsonResponse({success:true,unreadCount:await unreadCount()});
 if(request.method==='POST'){
  const body=await readObject(request,4096);if(body.action!=='mark_all_read'||Object.keys(body).some(k=>!['action','cursor','cutoff'].includes(k))||body.cursor&&!reference(String(body.cursor)))throw new ApiError(400,'Invalid notification action');
  const cutoff=body.cutoff?new Date(String(body.cutoff)):new Date();if(!Number.isFinite(cutoff.getTime())||cutoff.getTime()>Date.now()+1000)throw new ApiError(400,'Invalid cutoff');let count=0,next:string|null=null;
  await db.runTransaction(async tx=>{count=0;let q=collection.orderBy('__name__').limit(200);if(body.cursor)q=q.startAfter(String(body.cursor));const page=await tx.get(q);next=page.docs.length===200?page.docs.at(-1)!.id:null;for(const doc of page.docs){const n=doc.data(),read=Array.isArray(n.readByUIDs)?n.readByUIDs:[];if(read.includes(user.uid)||new Date(s(wireValue(n.timestamp))).getTime()>cutoff.getTime())continue;tx.update(doc.ref,{readByUIDs:[...read,user.uid],updatedAt:new Date()});count++;}});return jsonResponse({success:true,updated:count,mayHaveMore:!!next,nextCursor:next,cutoff:cutoff.toISOString()});
 }
 const state=params.get('state')||'all';if(!['all','unread','read'].includes(state))throw new ApiError(400,'Invalid notification filter');
 let query:FirebaseFirestore.Query=collection.orderBy('timestamp','desc').limit(25);if(cursor){const anchor=await collection.doc(cursor).get();if(!anchor.exists)throw new ApiError(400,'Notification cursor no longer exists');query=query.startAfter(anchor);}
 const [page,unread]=await Promise.all([query.get(),unreadCount()]);const items:RecordData[]=[],visible=page.docs.filter(doc=>{const read=Array.isArray(doc.data().readByUIDs)&&doc.data().readByUIDs.includes(user.uid);return state==='all'||(state==='read')===read;}),bound=await documentsById(COLLECTIONS.properties,visible.map(d=>s(d.data().propertyId))),tenantRefs=await documentsById(COLLECTIONS.tenants,visible.map(d=>s(d.data().tenantId)));
 const deliveryRows=await documentsById(COLLECTIONS.emailDeliveries||'email_deliveries',visible.map(d=>s(d.data().emailDeliveryId)));
 const linkedRefs=new Map<string,Map<string,RecordData>>();for(const collectionName of [COLLECTIONS.visits,COLLECTIONS.serviceRequests,COLLECTIONS.negotiations]){const names=visible.filter(d=>{const type=s(d.data().eventType||d.data().type);return collectionName===COLLECTIONS.visits?type.startsWith('visit.'):collectionName===COLLECTIONS.serviceRequests?type.startsWith('maintenance.'):type.startsWith('negotiation.');}).map(d=>s(d.data().recordId));linkedRefs.set(collectionName,await documentsById(collectionName,names));}
 for(const doc of page.docs){const n=doc.data(),isRead=Array.isArray(n.readByUIDs)&&n.readByUIDs.includes(user.uid),id=s(n.propertyId);if(state==='read'&&!isRead||state==='unread'&&isRead)continue;const valid=bound.has(id);let tenantId='';if(valid&&tenantRefs.get(s(n.tenantId))?.propertyId===id)tenantId=s(n.tenantId);
  let destination=valid?`/admin?tab=properties&propertyId=${encodeURIComponent(id)}`:null;const linkedCollection=s(n.eventType||n.type).startsWith('visit.')?COLLECTIONS.visits:s(n.eventType||n.type).startsWith('maintenance.')?COLLECTIONS.serviceRequests:s(n.eventType||n.type).startsWith('negotiation.')?COLLECTIONS.negotiations:'';if(linkedCollection&&reference(s(n.recordId))){const record=linkedRefs.get(linkedCollection)?.get(s(n.recordId));if(record&&(!id||record.propertyId===id))destination=`/admin?tab=${linkedCollection===COLLECTIONS.visits?'visits':linkedCollection===COLLECTIONS.serviceRequests?'service-requests':'offers'}`;}
  items.push({id:doc.id,type:s(n.type),title:s(n.title)||'Administrative activity',message:n.lifecycle===true?s(n.message):'Administrative activity recorded. Open the related details.',propertyId:valid?id:'',tenantId,actorUID:s(n.actorUID),eventId:s(n.eventId),timestamp:wireValue(n.timestamp||n.createdAt),isRead,destination,emailStatus:deliveryRows.has(s(n.emailDeliveryId))?adminDeliveryStatus(s(deliveryRows.get(s(n.emailDeliveryId))?.status)):s(n.emailStatus)||'not_requested'});
 }
 return jsonResponse({success:true,items,unreadCount:unread,nextCursor:page.docs.length===25?page.docs.at(-1)!.id:null});
}
