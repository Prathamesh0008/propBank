import 'server-only';
import {randomUUID} from 'node:crypto';
import {getDatabase,COLLECTIONS} from '../firestore';
import {requireUser,AccessError} from '../auth';
import {isPropertyTenant,requireOwnerOrAdmin} from '../permissions';
import {ApiError,jsonResponse} from '../http';
import {propertyMember,readObject,epoch} from './domain-contracts';
import {propertyResponse,wireValue,isRecord} from './contracts';
import {lifecycle,tenantLifecycle,dueDate,todayIST,ledgerStatus} from '../../property-product';
import type {ProductRecord as RecordData} from '../../property-product';
import {persistUserEvent} from './transactional-email';
import {bestEffort,escapeHtml} from './property-effects';

async function records(collection:string,id?:string){const base=getDatabase().collection(collection);const snapshot=await (id?base.where('propertyId','==',id):base).get();return snapshot.docs.map(doc=>({...doc.data(),id:doc.id})) as RecordData[];}
export async function propertyHub(request:Request){
 const user=await requireUser(request),id=new URL(request.url).searchParams.get('propertyId');
 let properties:RecordData[]=[];
 if(id){const p=await propertyMember(user,id);if(!p)throw new ApiError(404,'Property not found');properties=[{...p,id}];}
 else {const all=await records(COLLECTIONS.properties);properties=all.filter(p=>user.role==='admin'||p.ownerUID===user.uid||isPropertyTenant(user,{ownerUID:p.ownerUID,tenants:(p.tenants||[]).length?p.tenants:[{email:p.tenantEmail,isActive:p.rentalStatus==='rented'}]}));}
 const truncated=properties.length>250;properties=properties.slice(0,250);
 const hubs:RecordData[]=[],actions:RecordData[]=[];const today=todayIST();
 for(const p of properties){
  const role=user.role==='admin'?'admin':p.ownerUID===user.uid?'owner':'tenant';
  const [documents,inspections,allRequests,allVisits,allOffers]=await Promise.all([records(COLLECTIONS.documents,p.id),records(COLLECTIONS.inspectionReports,p.id),records(COLLECTIONS.serviceRequests,p.id),records(COLLECTIONS.visits,p.id),records(COLLECTIONS.negotiations,p.id)]);
  const requests=allRequests.filter(r=>role!=='tenant'||r.userUID===user.uid);
  const visits=allVisits.filter(v=>role!=='tenant'||v.userId===user.uid);
  const offers=allOffers.filter(n=>user.role==='admin'||[n.ownerUID,n.customerUID,n.brokerUID].includes(user.uid));
  const history:RecordData[]=[];
  const event=(at:unknown,label:string,source:string,actorUID?:unknown)=>{if(epoch(at))history.push({at:wireValue(at),label,source,actorUID:actorUID||''});};
  event(p.createdAt,'Property added','Property');if(epoch(p.updatedAt)>epoch(p.createdAt))event(p.updatedAt,'Property updated (latest stored update)','Property');
  for(const t of p.tenants||[]){event(t.createdAt,`Tenant assigned: ${t.firstName||t.userUID||'Tenant'}`,'Tenant');if(t.isActive===false)event(t.updatedAt,'Tenant marked inactive','Tenant');}
  for(const h of p.agreementHistory||[])event(h.at,`Agreement: ${h.action}`,'Agreement',h.actorUID);
  if(p.agreementRequest)event(p.agreementRequest.requestedAt,`${p.agreementRequest.kind} requested`,'Agreement',p.agreementRequest.requestedBy);
  for(const d of documents){event(d.createdAt,`Document uploaded: ${d.documentName}`,'Documents',d.userId);for(const h of d.statusHistory||[])event(h.at,`Document ${h.status}`,'Documents',h.actorUID);}
  for(const i of inspections)event(i.createdAt,`Inspection: ${i.reportType}`,'Inspection',i.userId);
  for(const r of requests){event(r.createdAt,`Request raised: ${r.serviceName}`,'Maintenance',r.userUID);for(const h of r.history||[])event(h.at,`Request ${h.action||h.status}: ${h.status}`,'Maintenance',h.actorUID);}
  for(const v of visits){event(v.createdAt,`Visit scheduled: ${v.title}`,'Visits',v.userId);if(v.status!=='scheduled')event(v.updatedAt,`Visit ${v.status}`,'Visits',v.userId);}
  for(const n of offers)for(const h of n.history||[])event(h.at,`Negotiation: ${h.action}`,'Negotiation',h.actorUID);
  for(const h of p.rentLedgerHistory||[])event(h.at,`Rent ${h.month}: ${h.status}`,'Rent',h.actorUID);
  history.sort((a,b)=>epoch(b.at)-epoch(a.at));
  const ledger=Object.values(p.rentLedger||{}) as RecordData[];
  const active=p.rentalStatus==='rented'&&p.agreementStatus!=='terminated'&&p.isActive!==false&&p.status!=='inactive';
  const month=today.slice(0,7);
  if(active&&Number.isFinite(Number(p.monthlyRent))&&Number(p.monthlyRent)>0&&Number.isInteger(Number(p.paymentDueDate))&&Number(p.paymentDueDate)>=1&&Number(p.paymentDueDate)<=31&&!ledger.some(row=>row.month===month)&&(!p.agreementStartDate||String(p.agreementStartDate).slice(0,10)<=today)&&(!p.agreementEndDate||String(p.agreementEndDate).slice(0,10)>=`${month}-01`))ledger.push({month,expectedRent:p.monthlyRent,dueDate:dueDate(month,Number(p.paymentDueDate)),status:'due',derived:true,notes:'Current supplied terms; no payment recorded.'});
  for(const row of ledger)row.displayStatus=ledgerStatus(row,today);
  ledger.sort((a,b)=>b.month.localeCompare(a.month));
  const add=(label:string,path:string)=>actions.push({propertyId:p.id,propertyTitle:p.title,label,path,role});
  const path=`/manage-property/${p.id}`;
  if(active&&p.agreementRequest?.status==='pending'&&(role==='owner'||role==='admin'))add(`${p.agreementRequest.kind} awaiting owner decision`,`/${p.agreementRequest.kind==='renewal'?'renew':'terminate'}-agreement/${p.id}`);
  const remaining=Math.ceil((Date.parse(String(p.agreementEndDate).slice(0,10))-Date.parse(today))/86400000);
  if(active&&remaining>=0&&remaining<=90)add(`Agreement expires in ${remaining} days`,`/renew-agreement/${p.id}`);
  if(active)for(const row of ledger)if(row.displayStatus!=='Paid'&&Number(row.expectedRent)>0&&row.dueDate<=today)add(`${row.displayStatus} rent: ${row.month} (payment not recorded)`,`${path}#rent`);
  for(const r of requests)if(!r.isArchived&&['pending','in_progress'].includes(r.status))add(`Unresolved request: ${r.serviceName}`,`${path}#maintenance`);
  for(const v of visits)if(v.status==='scheduled'&&!v.isCompleted)add(`${epoch(v.visitDate)>=Date.now()?'Upcoming visit':'Visit outcome not recorded'}: ${v.title}`,`${path}#visits`);
  for(const n of offers){const actionable=role==='owner'&&['offered','proposed'].includes(n.status)||n.customerUID===user.uid&&['owner_approved','countered'].includes(n.status)||user.role==='admin'&&['offered','accepted'].includes(n.status)||n.brokerUID===user.uid&&n.status==='offered';if(actionable)add(`Negotiation awaiting action: ${n.status}`,`${path}#negotiation`);}
  if(user.role==='admin')for(const d of documents)if(d.status==='submitted')add(`Report/document needs review: ${d.documentName}`,`/attach-documents/${p.id}`);
  hubs.push({property:propertyResponse(p,'normal',role),role,statuses:lifecycle(p,requests,visits,offers),tenants:(p.tenants||[]).map((t:RecordData)=>({...t,lifecycle:tenantLifecycle(t,p),linked:!!t.userUID})),documents,inspections,requests,visits,offers,ledger,history,ledgerVersion:p.rentLedgerVersion||0,...(user.role==='admin'?{internalNotes:p.internalNotes||[]}:{}),moveIn:{tenantAssigned:(p.tenants||[]).some((t:RecordData)=>t.isActive===true),agreementRecorded:!!p.agreementStartDate&&!!p.agreementEndDate,initialInspection:inspections.some(i=>i.reportType==='on_possession'),documentsAttached:documents.length>0,activeTenancy:active},moveOut:{notice:p.agreementStatus==='notice_served'||p.agreementStatus==='terminated',finalInspection:inspections.some(i=>i.reportType==='on_handover'),pendingTasks:requests.filter(r=>!r.isArchived&&['pending','in_progress'].includes(r.status)).length,closed:p.agreementStatus==='terminated'}});
 }
 if(!id&&user.role!=='admin'){
  for(const field of ['brokerUID','customerUID']){
   const snapshot=await getDatabase().collection(COLLECTIONS.negotiations).where(field,'==',user.uid).get();
   for(const doc of snapshot.docs){const n=doc.data();if(hubs.some(h=>h.property.id===n.propertyId))continue;const actionable=field==='brokerUID'&&['offered','proposed','countered'].includes(n.status)||field==='customerUID'&&['owner_approved','countered'].includes(n.status);if(actionable)actions.push({propertyId:n.propertyId,propertyTitle:n.propertyTitle,label:field==='brokerUID'?'Assigned negotiation awaiting broker proposal':'Owner-approved offer awaiting your acceptance',path:'/manage-property#assigned-offers',role:field==='brokerUID'?'broker':'customer'});}
  }
 }
 let pipeline:RecordData[]=[];
 if(user.role==='admin'&&!id){const inquiries=await records(COLLECTIONS.adminNotifications);pipeline=inquiries.filter(n=>['general_inquiry','property_enquiry'].includes(n.type)).map(n=>{const hub=hubs.find(h=>h.property.id===n.propertyId),linkedVisits=(hub?.visits||[]).filter((v:RecordData)=>n.userId&&v.userId===n.userId),linkedOffers=(hub?.offers||[]).filter((v:RecordData)=>n.userId&&v.customerUID===n.userId);const stage=linkedOffers.some((o:RecordData)=>o.status==='completed')?'Converted':linkedOffers.some((o:RecordData)=>!['withdrawn','rejected'].includes(o.status))?'Negotiation':linkedVisits.some((v:RecordData)=>v.status==='completed')?'Visited':linkedVisits.some((v:RecordData)=>v.status==='scheduled')?'Visit Scheduled':n.adminRemarks?'Admin response recorded':'New Inquiry';return {id:n.id,propertyId:n.propertyId,userId:n.userId,name:n.userName,title:n.title,stage};});}
 const metrics={totalProperties:hubs.length,ownedRelationships:hubs.filter(h=>h.property.ownerUID).length,activeTenantRelationships:hubs.reduce((n,h)=>n+h.tenants.filter((t:RecordData)=>t.isActive===true).length,0),available:hubs.filter(h=>h.statuses.includes('Available')||h.statuses.includes('Vacant')).length,rented:hubs.filter(h=>h.statuses.includes('Rented')).length,forSale:hubs.filter(h=>h.statuses.includes('For Sale')).length,pendingMaintenance:hubs.reduce((n,h)=>n+h.requests.filter((r:RecordData)=>!r.isArchived&&['pending','in_progress'].includes(r.status)).length,0),pendingApprovals:hubs.filter(h=>h.property.agreementRequest?.status==='pending').length,expiringAgreements:hubs.filter(h=>{const days=(Date.parse(String(h.property.agreementEndDate).slice(0,10))-Date.parse(today))/86400000;return h.property.rentalStatus==='rented'&&days>=0&&days<=90;}).length,openNegotiations:hubs.reduce((n,h)=>n+h.offers.filter((o:RecordData)=>!['completed','rejected','withdrawn'].includes(o.status)).length,0),upcomingVisits:hubs.reduce((n,h)=>n+h.visits.filter((v:RecordData)=>v.status==='scheduled'&&!v.isCompleted&&epoch(v.visitDate)>=Date.now()).length,0)};
 return jsonResponse({success:true,hubs:wireValue(hubs),actions,metrics,pipeline,truncated});
}

export async function updatePropertyHub(request:Request){
 const user=await requireUser(request),body=await readObject(request,16384);const id=typeof body.propertyId==='string'?body.propertyId:'';
 if(!id)throw new ApiError(400,'Property ID required');
 const db=getDatabase(),ref=db.collection(COLLECTIONS.properties).doc(id);let paidEvent:RecordData|null=null;
 await db.runTransaction(async tx=>{
  const snapshot=await tx.get(ref);if(!snapshot.exists)throw new ApiError(404,'Property not found');const p=snapshot.data()!;
  if(body.action==='internal_note'){
   if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
   if(typeof body.note!=='string'||!body.note.trim()||body.note.length>2000)throw new ApiError(400,'Note must contain 1–2000 characters');
   const notes=p.internalNotes||[];if(notes.length>=200)throw new ApiError(409,'Internal note limit reached');tx.update(ref,{internalNotes:[...notes,{id:randomUUID(),text:body.note.trim(),actorUID:user.uid,at:new Date()}]});return;
  }
  if(body.action!=='rent_ledger')throw new ApiError(400,'Invalid action');
  requireOwnerOrAdmin(user,{ownerUID:p.ownerUID||''});
  if(!Number.isInteger(body.version)||body.version!==(p.rentLedgerVersion||0))throw new ApiError(409,'Rent ledger changed; refresh before saving');
  const {month,expectedRent,dueDate:date,status,receiptId,notes}=body;
  if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||typeof expectedRent!=='number'||!Number.isFinite(expectedRent)||expectedRent<0||expectedRent>1e9||typeof status!=='string'||!['due','paid'].includes(status)||typeof date!=='string'||!date.startsWith(month+'-')||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||typeof notes!=='string'||notes.length>1000||typeof receiptId!=='string')throw new ApiError(400,'Invalid ledger entry');
  if(receiptId){const receipt=await tx.get(db.collection(COLLECTIONS.documents).doc(receiptId));if(!receipt.exists||receipt.data()?.propertyId!==id||receipt.data()?.documentType!=='payment_receipt')throw new ApiError(400,'Receipt must belong to this property');}
  const ledger=p.rentLedger||{},history=p.rentLedgerHistory||[];
  if(!ledger[month]&&Object.keys(ledger).length>=120||history.length>=500)throw new ApiError(409,'Rent tracking history limit reached');
  const now=new Date();tx.update(ref,{rentLedger:{...ledger,[month]:{month,expectedRent,dueDate:date,status,receiptId,notes,updatedAt:now,actorUID:user.uid}},rentLedgerVersion:(p.rentLedgerVersion||0)+1,rentLedgerHistory:[...history,{month,status,actorUID:user.uid,at:now,previousEntry:ledger[month]||null}]});
  if(status==='paid'&&ledger[month]?.status!=='paid')paidEvent={property:p,month,expectedRent,version:(p.rentLedgerVersion||0)+1};
 });
 if(paidEvent){const event=paidEvent as RecordData,p=event.property as RecordData,tenants=(Array.isArray(p.tenants)?p.tenants:[]).filter((tenant:RecordData)=>tenant.isActive===true&&tenant.userUID);await bestEffort(()=>persistUserEvent({eventType:'rent.payment_recorded',eventId:`${id}:${String(event.month)}:${String(event.version)}:paid`,recipients:[{uid:String(p.ownerUID||''),role:'owner'},...tenants.map((tenant:RecordData)=>({uid:String(tenant.userUID),role:'tenant'}))],propertyId:id,recordId:`${id}:${String(event.month)}`,templateId:'rent-payment-recorded',subject:'Rent payment recorded',title:'Rent payment recorded',bodyHtml:`<p>Rent for <strong>${escapeHtml(String(p.title||id))}</strong> was recorded as paid for ${escapeHtml(String(event.month))}.</p>`,bodyText:`Rent for ${String(p.title||id)} was recorded as paid for ${String(event.month)}.`,action:{label:'View rent history',path:`/manage-property/${id}#rent`}}));}
 return jsonResponse({success:true,message:'Property tracking updated'});
}
