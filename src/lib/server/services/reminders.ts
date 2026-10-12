import 'server-only';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { ApiError, jsonResponse } from '../http';
import { epoch } from './domain-contracts';
import { isRecord, stringValue, type RecordData } from './contracts';
import { resolveTenantIdentity, getUser } from './users';
import { sendEmail, escapeHtml, type Email } from './property-effects';
import { formatIST } from './group2-mail';

export function requireCron(request:Request) {
  const secret=process.env.CRON_SECRET;
  if(!secret||secret.length<32)throw new ApiError(503,'Reminder scheduler is not configured');
  const supplied=request.headers.get('authorization')||'';
  const digest=(value:string)=>createHash('sha256').update(value).digest();
  if(!timingSafeEqual(digest(supplied),digest(`Bearer ${secret}`)))throw new ApiError(401,'Scheduler authorization required');
}
const generation=(visit:Record<string,unknown>)=>createHash('sha256').update(`${epoch(visit.visitDate)}:${visit.reminderTime}:${visit.userId}`).digest('hex');
export function dueReminder(visit:Record<string,unknown>,now:number) {
  const at=epoch(visit.visitDate);
  const minutes=visit.reminderTime;
  return visit.isCompleted!==true&&visit.status!=='cancelled'&&visit.status!=='completed'&&visit.reminderType==='email'
    && typeof minutes==='number'&&minutes>=0&&minutes<=10080
    && Number.isFinite(at)&&at>=now&&at-minutes*60000<=now;
}
export async function runVisitReminders(now=new Date()) {
  if(!process.env.RESEND_API_KEY||!process.env.FROM_EMAIL)throw new ApiError(503,'Reminder email delivery is not configured');
  const db=getDatabase();
  const snapshot=await db.collection(COLLECTIONS.visits).where('visitDate','>=',now).where('visitDate','<=',new Date(now.getTime()+7*86400000)).orderBy('visitDate','asc').limit(1000).get();
  const results={scanned:snapshot.docs.length,sent:0,failed:0,skipped:0,needsReconciliation:0,limited:snapshot.docs.length>=1000};
  // At most twenty deliveries per invocation; overlapping runs share leases.
  const eligible=snapshot.docs.filter(doc=>{
    const visit=doc.data();if(!dueReminder(visit,now.getTime()))return false;
    const delivery=isRecord(visit.reminderDelivery)?visit.reminderDelivery:{};
    const key=generation(visit);
    if(epoch(visit.notifiedAt)>0&&(!delivery.generation||delivery.generation===key))return false;
    if(delivery.generation===key&&delivery.status!=='sent'&&epoch(delivery.firstAttemptAt)>0&&now.getTime()-epoch(delivery.firstAttemptAt)>=23*3600000){results.needsReconciliation++;return false;}
    return !(delivery.generation===key&&(delivery.status==='sent'||epoch(delivery.leaseUntil)>now.getTime()));
  });
  results.limited ||= eligible.length>20;
  const candidates=eligible.slice(0,20);
  let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<candidates.length) {
      const doc=candidates[cursor++];
      const ref=db.collection(COLLECTIONS.visits).doc(doc.id);
      const lease=randomUUID();
      const claim=await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);if(!fresh.exists)return null;
        const visit=fresh.data()!;if(!dueReminder(visit,now.getTime()))return null;
        const key=generation(visit);
        const delivery=isRecord(visit.reminderDelivery)?visit.reminderDelivery:{};
        // Respect reminders already delivered by Go (notifiedAt) as well.
        if(epoch(visit.notifiedAt)>0&&(!delivery.generation||delivery.generation===key))return null;
        if(delivery.generation===key) {
          if(delivery.status==='sent'||epoch(delivery.leaseUntil)>now.getTime())return null;
          // Resend retains deduplication for 24 hours. Ambiguous older sends
          // need reconciliation instead of an automatic potentially duplicate mail.
          if(epoch(delivery.firstAttemptAt)>0&&now.getTime()-epoch(delivery.firstAttemptAt)>=23*3600000) {
            results.needsReconciliation++;return null;
          }
        }
        const profile=await tx.get(db.collection(COLLECTIONS.users).doc(stringValue(visit.userId)));
        if(!profile.exists||profile.data()?.isActive===false||!profile.data()?.email)return null;
        // Freeze the provider payload so retries with the same key are identical.
        const mail:Email=delivery.generation===key&&isRecord(delivery.mail)?delivery.mail as unknown as Email:{
          to:stringValue(profile.data()!.email),subject:`Visit reminder: ${stringValue(visit.title)}`,
          html:`<p>Hello ${escapeHtml(stringValue(profile.data()!.name))},</p><p>Your visit to ${escapeHtml(stringValue(visit.title))} is scheduled for ${escapeHtml(formatIST(new Date(epoch(visit.visitDate))))}.</p><p>${escapeHtml(stringValue(visit.description))}</p>`,
        };
        tx.update(ref,{reminderDelivery:{generation:key,status:'sending',lease,leaseUntil:new Date(now.getTime()+120000),firstAttemptAt:delivery.generation===key?delivery.firstAttemptAt:now,mail}});
        return {key,mail};
      });
      if(!claim){results.skipped++;continue;}
      let sent=false;
      try{await sendEmail(claim.mail,`visit-${doc.id}-${claim.key}`);sent=true;}catch{/* Retry with the same provider key on the next eligible run. */}
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);const data=fresh.data();
        if(!fresh.exists||data?.reminderDelivery?.lease!==lease)return;
        tx.update(ref,{reminderDelivery:{...data.reminderDelivery,status:sent?'sent':'failed',leaseUntil:now},...(sent?{notifiedAt:now}:{})});
      });
      if(sent)results.sent++;else results.failed++;
    }
  }));
  return results;
}
export async function remindersEndpoint(request:Request) {
  requireCron(request);
  const result=await runVisitReminders();
  const properties=await runPropertyReminders(new Date(),new URL(request.url).searchParams.get('propertyCursor')||'');
  return jsonResponse({success:result.failed===0&&properties.failed===0,...result,properties},result.failed||properties.failed?503:200);
}

export function propertyReminderEvents(property:RecordData,now:Date) {
  if(property.isActive!==true||property.status==='inactive'||property.rentalStatus!=='rented'||property.agreementStatus==='terminated')return [];
  const local=new Date(now.getTime()+330*60000),day=local.getUTCDate(),month=local.getUTCMonth(),year=local.getUTCFullYear();
  const monthKey=`${year}-${String(month+1).padStart(2,'0')}`;
  const today=Date.UTC(year,month,day);
  const tenants=Array.isArray(property.tenants)?property.tenants.filter(isRecord).filter(t=>t.isActive===true):[];
  const candidates=tenants.length?tenants:property.tenantEmail?[{email:property.tenantEmail,isActive:true}]:[];
  const events=candidates.flatMap((tenant,index)=>{
    const events:Array<{key:string;kind:string;tenant:RecordData;amount:string;period:string}>=[];
    const due=Number(tenant.paymentDueDate||property.paymentDueDate);
    const amount=stringValue(tenant.monthlyRent||property.monthlyRent);
    const identity=stringValue(tenant.userUID||tenant.id||tenant.email)||String(index);
    if(Number.isInteger(due)&&due>=1&&due<=31&&day===Math.min(due,new Date(Date.UTC(year,month+1,0)).getUTCDate())&&amount)events.push({key:`rent:${identity}:${monthKey}`,kind:'rent_due',tenant,amount,period:monthKey});
    const end=epoch(tenant.leaseEndDate||property.agreementEndDate);
    if(Number.isFinite(end)) {
      const endLocal=new Date(end+330*60000),endDay=Date.UTC(endLocal.getUTCFullYear(),endLocal.getUTCMonth(),endLocal.getUTCDate());
      const remaining=Math.round((endDay-today)/86400000);
      if(remaining>=0&&remaining<=90) {
        const threshold=remaining<=60?60:90;
        events.push({key:`expiry:${identity}:${endDay}:${threshold}`,kind:'agreement_expiry',tenant,amount:'',period:`${remaining} days`});
      }
    }
    return events;
  });
  const expiry=events.find(event=>event.kind==='agreement_expiry');
  if(expiry&&property.ownerUID&&property.ownerEmail)events.push({...expiry,key:`owner:${expiry.key}`,tenant:{userUID:property.ownerUID,email:property.ownerEmail}});
  return events;
}

export async function runPropertyReminders(now=new Date(),after='') {
  if(!process.env.RESEND_API_KEY||!process.env.FROM_EMAIL)throw new ApiError(503,'Reminder email delivery is not configured');
  const db=getDatabase();let query:FirebaseFirestore.Query=db.collection(COLLECTIONS.properties).where('isActive','==',true).orderBy('__name__').limit(1000);
  if(after) {if(after.includes('/'))throw new ApiError(400,'Invalid reminder cursor');query=query.startAfter(after);}
  const snapshot=await query.get();
  const result={scanned:snapshot.docs.length,sent:0,failed:0,skipped:0,needsReconciliation:0,limited:snapshot.docs.length>=1000,nextCursor:snapshot.docs.length>=1000?snapshot.docs.at(-1)!.id:null};
  let attempted=0;
  for(const doc of snapshot.docs) {
    for(const event of propertyReminderEvents(doc.data(),now)) {
      if(attempted>=20){result.limited=true;continue;}
      const key=createHash('sha256').update(event.key).digest('hex'),lease=randomUUID(),ref=db.collection(COLLECTIONS.properties).doc(doc.id);
      const existing=isRecord(doc.data().reminderDeliveries)?doc.data().reminderDeliveries:{};
      if(isRecord(existing[key])&&(existing[key].status==='sent'||epoch(existing[key].leaseUntil)>now.getTime())){result.skipped++;continue;}
      const claim=await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref);if(!fresh.exists)return null;
        const property=fresh.data()!;
        const current=propertyReminderEvents(property,now).find(candidate=>candidate.key===event.key);if(!current)return null;
        const deliveries=isRecord(property.reminderDeliveries)?property.reminderDeliveries:{};
        const delivery=isRecord(deliveries[key])?deliveries[key]:{};
        if(delivery.status==='sent'||epoch(delivery.leaseUntil)>now.getTime())return null;
        if(epoch(delivery.firstAttemptAt)>0&&now.getTime()-epoch(delivery.firstAttemptAt)>=23*3600000){result.needsReconciliation++;return null;}
        const uid=await resolveTenantIdentity(stringValue(current.tenant.email),stringValue(current.tenant.userUID));
        const profile=uid?await getUser(uid):null;
        // Email-only off-platform tenants may still receive owner-assigned reminders.
        const email=profile?.email||current.tenant.email;if(!email)return null;
        const mail:Email=isRecord(delivery.mail)?delivery.mail as unknown as Email:{to:stringValue(email),subject:current.kind==='rent_due'?'Monthly rent due':'Agreement expiry reminder',html:`<p>${escapeHtml(stringValue(property.title))}</p><p>${current.kind==='rent_due'?`Rent ${escapeHtml(current.amount)} is due for ${escapeHtml(current.period)}.`:`Your agreement expires in ${escapeHtml(current.period)}. Contact the owner to discuss renewal.`}</p>`};
        tx.update(ref,{[`reminderDeliveries.${key}`]:{status:'sending',lease,leaseUntil:new Date(now.getTime()+120000),firstAttemptAt:delivery.firstAttemptAt||now,mail,kind:current.kind,period:current.period}});
        return mail;
      });
      if(!claim){result.skipped++;continue;}attempted++;
      let sent=false;try{await sendEmail(claim,`property-${doc.id}-${key}`);sent=true;}catch{/* Same provider key and frozen payload are retried within its retention window. */}
      await db.runTransaction(async tx=>{
        const fresh=await tx.get(ref),deliveries=fresh.data()?.reminderDeliveries;
        if(!fresh.exists||!isRecord(deliveries)||!isRecord(deliveries[key])||deliveries[key].lease!==lease)return;
        tx.update(ref,{[`reminderDeliveries.${key}`]:{...deliveries[key],status:sent?'sent':'failed',leaseUntil:now,...(sent?{sentAt:now}:{})}});
        if(sent) {
          const id=`reminder-${doc.id}-${key}`;
          tx.set(db.collection(COLLECTIONS.adminNotifications).doc(id),{id,type:event.kind,title:event.kind==='rent_due'?'Monthly Rent Due':'Agreement Expiry Reminder',message:claim.subject,propertyId:doc.id,ownerId:fresh.data()?.ownerUID||'',timestamp:now,isRead:false,priority:'medium',createdAt:now,updatedAt:now});
        }
      });
      if(sent)result.sent++;else result.failed++;
    }
  }
  return result;
}
