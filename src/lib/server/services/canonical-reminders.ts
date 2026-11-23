import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {getDatabase,COLLECTIONS} from '../firestore';
import {getFirebaseAdminAuth} from '../firebase-admin';
import {jsonResponse} from '../http';
import {epoch} from './domain-contracts';
import {canonicalReminderPlan,daysBetween,type CanonicalReminder} from '@/lib/reminder-policy';
import {localRentDate} from '@/lib/rent-resolution';
import {formatDisplayDate,formatDisplayMonth} from '@/lib/date-format';
import {propertyEmailContext,emailMoney} from '@/lib/email-design';
import {brandedEmail,writeEmailOutbox,type TransactionalEmailEvent} from './transactional-email';
import {requireCron,runVisitReminders} from './reminders';
type Data=Record<string,any>;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Version affects address presentation only; old queued reminders retain the original format. */
export function reminderContent(property:Data,tenant:Data,event:CanonicalReminder,role:string,now=new Date(),addressFormatVersion=1){
 const today=localRentDate(property,now),remaining=daysBetween(today,event.dueDate),title=property.title||property.buildingName||'Your property';
 const subject=event.kind==='expiry'?`Agreement expires in ${remaining} days`:remaining>0?`Rent due in ${remaining} day${remaining===1?'':'s'}`:remaining===0?'Rent is due today':`Rent is ${-remaining} day${remaining===-1?'':'s'} overdue`;
 const text=event.kind==='expiry'?`${title}: the agreement expires on ${formatDisplayDate(event.dueDate)}. Review renewal or move-out arrangements.`:`${title}: ${emailMoney(event.outstanding)} remains outstanding for ${formatDisplayMonth(event.period)}. Due date: ${formatDisplayDate(event.dueDate)}. Payment status: ${event.status==='partial'?'Partially paid':'Unpaid'}.`;
 const path=role==='admin'?`/admin?tab=rented&propertyId=${encodeURIComponent(property.id)}`:`/manage-property/${encodeURIComponent(property.id)}`;
 return {subject,text,...brandedEmail(subject,'',text,{label:event.kind==='expiry'?'Review agreement':'Review rent',path},propertyEmailContext(property,[{label:'Billing period',value:event.kind==='rent'?formatDisplayMonth(event.period):undefined},{label:'Rent amount',value:event.kind==='rent'?event.amount:undefined,format:'money'},{label:'Outstanding balance',value:event.kind==='rent'?event.outstanding:undefined,format:'money'},{label:event.kind==='rent'?'Due date':'Agreement expiry',value:event.dueDate,format:'date'}],{audience:role,status:event.kind==='rent'?(event.status==='partial'?'Partially paid':remaining<0?'Overdue':'Unpaid'):'Expiring',preheader:text},{legacyAddressFormat:addressFormatVersion!==1})),path};
}
async function verifiedEmail(uid:string,tx:FirebaseFirestore.Transaction){
 if(!uid)return '';
 const doc=await tx.get(getDatabase().collection(COLLECTIONS.users).doc(uid));if(!doc.exists||doc.data()?.isActive===false)return '';
 try{const account=await getFirebaseAdminAuth().getUser(uid);return !account.disabled&&account.emailVerified&&emailPattern.test(account.email||'')?account.email!.toLowerCase():'';}
 catch(error){if((error as {code?:string}).code==='auth/user-not-found')return '';throw error;}
}
/** Every reminder and its participant notice commit together. No provider calls here. */
export async function stageCanonicalTenancy(id:string,now=new Date()){
 const db=getDatabase();return db.runTransaction(async tx=>{
  const tenantDoc=await tx.get(db.collection(COLLECTIONS.tenants).doc(id));if(!tenantDoc.exists)return {staged:0,ambiguous:0};
  const tenant={...tenantDoc.data(),id} as Data;if(tenant.isActive!==true||!tenant.propertyId)return {staged:0,ambiguous:0};
  const propertyDoc=await tx.get(db.collection(COLLECTIONS.properties).doc(tenant.propertyId));if(!propertyDoc.exists)return {staged:0,ambiguous:0};
  const property={...propertyDoc.data(),id:propertyDoc.id} as Data;
  const memberships=await tx.get(db.collection(COLLECTIONS.tenants).where('propertyId','==',property.id).where('isActive','==',true).limit(2));
  const events=canonicalReminderPlan(property,tenant,memberships.docs.length,now);
  if(!events.length)return {staged:0,ambiguous:memberships.docs.length>1&&!!property.rentLedger&&!property.rentLedgersByTenancy?.[id]&&!tenant.rentLedger?1:0};
  const ownerEmail=await verifiedEmail(property.ownerUID,tx);
  const tenantUID=tenant.linkConfirmationRequired!==true?String(tenant.userUID||''):'';
  const tenantEmail=tenantUID?await verifiedEmail(tenantUID,tx):'';
  const writes:Array<()=>void>=[];let staged=0;
  for(const event of events){
   const recipients=[...(ownerEmail?[{uid:property.ownerUID,email:ownerEmail,role:'owner'}]:[]),...(tenantEmail&&tenantUID!==property.ownerUID?[{uid:tenantUID,email:tenantEmail,role:'tenant'}]:[])];
   if(event.kind==='rent'&&event.offset===-7)recipients.push({uid:'',email:(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),role:'admin'});
   for(const recipient of recipients){
    const eventType=event.kind==='rent'?'rent.reminder':'agreement.expiry_reminder';
    const eventId=event.kind==='rent'?`${property.id}:${id}:${event.period}:${event.offset}`:`${property.id}:${id}:${event.agreementVersion}:${event.offset}`;
    const key=`${eventType}:${eventId}:${recipient.uid||'admin'}`,deliveryId=hash(key),noticeId=hash(`in-app:${key}`);
    const deliveryRef=db.collection(COLLECTIONS.emailDeliveries).doc(deliveryId),noticeRef=db.collection(COLLECTIONS.adminNotifications).doc(noticeId);
    const delivery=await tx.get(deliveryRef),notice=await tx.get(noticeRef);
    const content=reminderContent(property,tenant,event,recipient.role,now);
    const mail:TransactionalEmailEvent={eventType,eventId,recipientUID:recipient.uid||undefined,recipientRole:recipient.role,recipientEmail:recipient.email,propertyId:property.id,recordId:property.id,templateId:event.kind==='rent'?'rent-reminder':'agreement-expiry-reminder',templateVersion:2,subject:content.subject,html:content.html,text:content.text,idempotencyKey:key,canonicalReminder:true,propertyAddressFormatVersion:1,tenancyId:id,rentPeriod:event.period,agreementVersion:event.agreementVersion,scheduledFor:event.scheduledFor,reminderOffset:event.offset,reminderDueDate:event.dueDate,reminderAmount:event.amount};
    if(!delivery.exists)writes.push(()=>writeEmailOutbox(tx,[mail]));
    if(!notice.exists)writes.push(()=>tx.create(noticeRef,{id:noticeId,type:event.kind==='rent'?'rent_reminder':'agreement_expiry',title:content.subject,message:content.text,propertyId:property.id,tenantId:id,userId:recipient.uid,eventId,emailDeliveryId:deliveryId,emailStatus:recipient.email?'queued':'unconfigured',participantReminder:recipient.role!=='admin',propertyActivity:true,lifecycle:true,participantUIDs:recipient.uid?[recipient.uid]:[],destination:content.path,status:event.status,timestamp:now,createdAt:now,updatedAt:now,isRead:false,readByUIDs:[]}));
    if(!delivery.exists||!notice.exists)staged++;
   }
  }
  // Transaction reads finish before any intent or notification write.
  writes.forEach(write=>write());return {staged,ambiguous:memberships.docs.length>1&&!!property.rentLedger&&!property.rentLedgersByTenancy?.[id]&&!tenant.rentLedger?1:0};
 });
}
/** Fresh canonical membership, balance and content before any provider send. */
export async function refreshCanonicalReminder(value:Data,now=new Date()):Promise<Data|null>{
 const db=getDatabase(),tenantDoc=await db.collection(COLLECTIONS.tenants).doc(String(value.tenancyId||'')).get();if(!tenantDoc.exists)return null;
 const tenant={...tenantDoc.data(),id:tenantDoc.id} as Data;if(tenant.propertyId!==value.propertyId)return null;
 const propertyDoc=await db.collection(COLLECTIONS.properties).doc(tenant.propertyId).get();if(!propertyDoc.exists)return null;
 const property={...propertyDoc.data(),id:propertyDoc.id} as Data;
 const memberships=await db.collection(COLLECTIONS.tenants).where('propertyId','==',property.id).where('isActive','==',true).limit(2).get();
 const event=canonicalReminderPlan(property,tenant,memberships.docs.length,now).find(e=>e.kind===(value.eventType==='rent.reminder'?'rent':'expiry')&&e.period===value.rentPeriod&&e.offset===value.reminderOffset&&e.dueDate===value.reminderDueDate&&e.agreementVersion===value.agreementVersion&&e.scheduledFor===value.scheduledFor);
 if(!event)return null;
 if(value.recipientRole==='tenant'&&(tenant.linkConfirmationRequired===true||tenant.userUID!==value.recipientUID)||value.recipientRole==='owner'&&property.ownerUID!==value.recipientUID)return null;
 if(value.recipientRole==='admin'&&(event.kind!=='rent'||event.offset!==-7))return null;
 let address='';
 if(value.recipientRole==='admin')address=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
 else{const profile=await db.collection(COLLECTIONS.users).doc(value.recipientUID).get();if(!profile.exists||profile.data()?.isActive===false)return null;try{const account=await getFirebaseAdminAuth().getUser(value.recipientUID);if(account.disabled||!account.emailVerified)return null;address=(account.email||'').toLowerCase();}catch(error){if((error as {code?:string}).code==='auth/user-not-found')return null;throw error;}}
 if(!emailPattern.test(address))return value.recipientRole==='admin'?{...reminderContent(property,tenant,event,value.recipientRole,now,value.propertyAddressFormatVersion===1?1:0),recipientEmail:''}:null;
 // Do not redirect a previously queued sensitive message to a changed address.
 if(value.recipientEmail&&address!==value.recipientEmail)return null;
 return {...reminderContent(property,tenant,event,value.recipientRole,now,value.propertyAddressFormatVersion===1?1:0),recipientEmail:address};
}
/** One durable daily cursor. Repeated scheduler ticks resume; completed days do not rescan. */
export async function runCanonicalReminders(now=new Date(),continuationOnly=false){
 const db=getDatabase(),ref=db.collection(COLLECTIONS.emailDeliveries).doc('_rent_reminder_state'),today=localRentDate({},now),lease=randomUUID();
 const claim=await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data()||{};if(d.leaseUntil&&epoch(d.leaseUntil)>now.getTime())return null;if(d.day===today&&d.complete)return null;if(continuationOnly&&d.day!==today)return null;const cursor=d.day===today?String(d.cursor||''):'';tx.set(ref,{kind:'reminder_monitor',day:today,cursor,complete:false,lease,leaseUntil:new Date(now.getTime()+240000),lastRunAt:now},{merge:true});return {cursor,retries:d.day===today&&Array.isArray(d.retryTenancies)?d.retryTenancies as string[]:[]};});
 if(claim===null)return {scanned:0,staged:0,complete:true,busyOrComplete:true};
 let query=db.collection(COLLECTIONS.tenants).where('isActive','==',true).orderBy('__name__').limit(25);if(claim.cursor)query=query.startAfter(claim.cursor);
 const page=await query.get();let cursor=claim.cursor,staged=0,failed=0,ambiguous=0;
 const retryTenancies:string[]=[];
 const ids=[...new Set([...claim.retries,...page.docs.map(d=>d.id)])];
 for(const id of ids){try{const result=await stageCanonicalTenancy(id,now);staged+=result.staged;ambiguous+=result.ambiguous;}catch{failed++;retryTenancies.push(id);if(retryTenancies.length>=25)break;}if(page.docs.some(d=>d.id===id))cursor=id;}
 const complete=!failed&&page.docs.length<25;
 await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data();if(d?.lease!==lease)return;tx.update(ref,{cursor,complete,retryTenancies,lease:'',leaseUntil:now,lastRunAt:now,...(complete?{lastSuccessfulRunAt:now}:{}),report:{staged,failed,ambiguous}});});
 return {scanned:page.docs.length,staged,failed,ambiguous,complete,continuationRequired:!complete};
}
export async function runRentReminderBatch(now=new Date(),continuationOnly=false){
 const started=Date.now(),total={scanned:0,staged:0,failed:0,ambiguous:0,pages:0,complete:false,continuationRequired:true};
 for(let page=0;page<4;page++){
  const result=await runCanonicalReminders(now,continuationOnly||page>0);
  total.scanned+=result.scanned;total.staged+=result.staged;total.failed+=result.failed||0;total.ambiguous+=result.ambiguous||0;total.pages++;
  total.complete=result.complete;total.continuationRequired=!result.complete;
  if(result.complete||result.failed||Date.now()-started>=75000)break;
 }
 return total;
}
export async function canonicalRemindersEndpoint(request:Request){requireCron(request);const result=await runRentReminderBatch(new Date(),new URL(request.url).searchParams.get('continuation')==='true');return jsonResponse({success:!result.failed,...result,properties:result},result.failed?503:200);}
export async function runScheduledVisitReminders(now=new Date()){
 const db=getDatabase(),ref=db.collection(COLLECTIONS.emailDeliveries).doc('_visit_reminder_state'),lease=randomUUID();
 const claim=await db.runTransaction(async tx=>{const d=(await tx.get(ref)).data()||{};if(d.leaseUntil&&epoch(d.leaseUntil)>now.getTime())return null;tx.set(ref,{kind:'reminder_monitor',lease,leaseUntil:new Date(now.getTime()+240000)},{merge:true});return String(d.cursor||'');});
 if(claim===null)return {busy:true};
 const result=await runVisitReminders(now,claim);
 await db.runTransaction(async tx=>{const state=(await tx.get(ref)).data();if(state?.lease!==lease)return;tx.update(ref,{cursor:result.nextCursor||'',lastRunAt:now,...(!result.failed?{lastSuccessfulRunAt:now}:{}),lease:'',leaseUntil:now,report:result});});
 return result;
}
export async function visitRemindersEndpoint(request:Request){requireCron(request);const result=await runScheduledVisitReminders();return jsonResponse(result,'failed' in result&&result.failed?503:200);}
