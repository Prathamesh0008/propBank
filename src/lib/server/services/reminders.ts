import 'server-only';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { ApiError, jsonResponse } from '../http';
import { epoch } from './domain-contracts';
import { isRecord, stringValue, type RecordData } from './contracts';
import { escapeHtml } from './property-effects';
import { formatIST } from './group2-mail';
import { brandedEmail, processTransactionalEmail, type TransactionalEmailEvent } from './transactional-email';
import {rentAmountForDate} from '@/lib/rent-schedule';

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
  if(!process.env.RESEND_API_KEY||!process.env.FROM_EMAIL||!process.env.ADMIN_EMAIL)throw new ApiError(503,'Reminder email delivery is not configured');
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
        const uid=stringValue(visit.userId),profile=await tx.get(db.collection(COLLECTIONS.users).doc(uid));
        if(!profile.exists||profile.data()?.isActive===false||profile.data()?.emailVerified===false||!profile.data()?.email)return null;
        const title=stringValue(visit.title),when=formatIST(new Date(epoch(visit.visitDate))),details=stringValue(visit.description);
        const bodyHtml=`<p><strong>${escapeHtml(title)}</strong></p><p>Scheduled: ${escapeHtml(when)}</p>${details?`<p>${escapeHtml(details)}</p>`:''}`;
        const bodyText=`${title}. Scheduled: ${when}.${details?` Details: ${details}`:''}`;
        const events:TransactionalEmailEvent[]=delivery.generation===key&&Array.isArray(delivery.events)?delivery.events as TransactionalEmailEvent[]:[
          {eventType:'visit.reminder',eventId:`${doc.id}:${key}:requester`,recipientUID:uid,recipientRole:'requester',recordId:doc.id,templateId:'visit-reminder-requester',templateVersion:1,subject:`Visit reminder: ${title}`,...brandedEmail('Your visit is in 30 minutes',bodyHtml,bodyText,{label:'Open Visit Planner',path:'/visit-planner'}),idempotencyKey:`visit.reminder:${doc.id}:${key}:requester`,scheduledFor:new Date(epoch(visit.visitDate)-30*60000).toISOString(),reminderOffset:30},
          ...(stringValue(profile.data()!.email).toLowerCase()===stringValue(process.env.ADMIN_EMAIL).toLowerCase()?[]:[{eventType:'visit.reminder',eventId:`${doc.id}:${key}:admin`,recipientRole:'admin',recipientEmail:process.env.ADMIN_EMAIL,recordId:doc.id,templateId:'visit-reminder-admin',templateVersion:1,subject:`Visit reminder: ${title}`,...brandedEmail('A visit starts in 30 minutes',`<p>Requester: ${escapeHtml(stringValue(profile.data()!.name)||'Registered user')}<br>Verified email: ${escapeHtml(stringValue(profile.data()!.email))}</p>${bodyHtml}`,`Requester: ${stringValue(profile.data()!.name)||'Registered user'} (${stringValue(profile.data()!.email)}). ${bodyText}`,{label:'Open admin visits',path:'/admin?tab=visits'}),idempotencyKey:`visit.reminder:${doc.id}:${key}:admin`,scheduledFor:new Date(epoch(visit.visitDate)-30*60000).toISOString(),reminderOffset:30} as TransactionalEmailEvent]),
        ];
        tx.update(ref,{reminderDelivery:{generation:key,status:'sending',lease,leaseUntil:new Date(now.getTime()+120000),firstAttemptAt:delivery.generation===key?delivery.firstAttemptAt:now,events}});
        return {key,events};
      });
      if(!claim){results.skipped++;continue;}
      const outcomes=[];for(const event of claim.events)outcomes.push(await processTransactionalEmail(event));
      const sent=outcomes.every(outcome=>outcome==='sent');
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

type ReminderCandidate={kind:'rent_due'|'agreement_expiry';recipientUID:string;recipientRole:'owner'|'tenant';tenancyId:string;period:string;amount:string;dueDate:string;offset:number;agreementVersion:string};
const isoDate=(year:number,month:number,day:number)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
function localDate(now:Date,timezone:string){
  let zone=timezone||'Asia/Kolkata';try{new Intl.DateTimeFormat('en-CA',{timeZone:zone}).format(now);}catch{zone='Asia/Kolkata';}
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
  return {year:parts.year,month:parts.month,day:parts.day,date:isoDate(parts.year,parts.month,parts.day)};
}
function calendarDays(from:string,to:string){return Math.round((Date.parse(`${to}T00:00:00Z`)-Date.parse(`${from}T00:00:00Z`))/86400000);}
function dateOnly(value:unknown){const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(stringValue(value));if(!match)return '';const y=Number(match[1]),m=Number(match[2]),d=Number(match[3]);return m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate()?isoDate(y,m,d):'';}

export function propertyReminderEvents(property:RecordData,now:Date):ReminderCandidate[] {
  if(property.isActive!==true||property.status==='inactive'||property.rentalStatus!=='rented'||['terminated','expired','cancelled'].includes(stringValue(property.agreementStatus)))return [];
  const local=localDate(now,stringValue(property.timezone)),period=`${local.year}-${String(local.month).padStart(2,'0')}`;
  const ledger=isRecord(property.rentLedger)?property.rentLedger:{},paid=isRecord(ledger[period])&&ledger[period].status==='paid';
  const tenants=(Array.isArray(property.tenants)?property.tenants:[]).filter(isRecord).filter(tenant=>tenant.isActive===true&&stringValue(tenant.userUID));
  const events:ReminderCandidate[]=[];
  for(const tenant of tenants){
    const tenancyId=stringValue(tenant.id||tenant.userUID),amount=rentAmountForDate({...property,...tenant,rentSchedule:Array.isArray(tenant.rentSchedule)?tenant.rentSchedule:property.rentSchedule},local.date),dueDay=Number(tenant.paymentDueDate||property.paymentDueDate);
    const dueDate=Number.isInteger(dueDay)&&dueDay>=1&&dueDay<=31?isoDate(local.year,local.month,Math.min(dueDay,new Date(Date.UTC(local.year,local.month,0)).getUTCDate())):'';
    const rentOffset=dueDate?calendarDays(local.date,dueDate):-1;
    const expiryDate=dateOnly(tenant.leaseEndDate||property.agreementEndDate),expiryOffset=expiryDate?calendarDays(local.date,expiryDate):-1;
    const agreementVersion=stringValue(tenant.agreementVersion||property.agreementVersion||property.tenancyRevision||expiryDate);
    const recipients:Array<{recipientUID:string;recipientRole:'owner'|'tenant'}>=[{recipientUID:stringValue(tenant.userUID),recipientRole:'tenant'}];
    if(property.ownerUID)recipients.push({recipientUID:stringValue(property.ownerUID),recipientRole:'owner'});
    if(!paid&&amount&&[7,1,0].includes(rentOffset))for(const recipient of recipients)events.push({kind:'rent_due',...recipient,tenancyId,period,amount,dueDate,offset:rentOffset,agreementVersion});
    if(expiryDate&&[30,15,7].includes(expiryOffset))for(const recipient of recipients)events.push({kind:'agreement_expiry',...recipient,tenancyId,period:expiryDate.slice(0,7),amount:'',dueDate:expiryDate,offset:expiryOffset,agreementVersion});
  }
  return events;
}

type Cursor={after:string;property:string;event:number};
function cursorSecret(){return process.env.CRON_SECRET||'';}
function encodeCursor(value:Cursor){const payload=Buffer.from(JSON.stringify({v:1,...value})).toString('base64url'),signature=createHash('sha256').update(`${cursorSecret()}:${payload}`).digest('base64url');return `${payload}.${signature}`;}
function decodeCursor(token:string):Cursor {
  if(!token)return {after:'',property:'',event:0};
  const [payload,signature,extra]=token.split('.');if(!payload||!signature||extra)throw new ApiError(400,'Invalid reminder cursor');
  const expected=createHash('sha256').update(`${cursorSecret()}:${payload}`).digest();let supplied:Buffer;try{supplied=Buffer.from(signature,'base64url');}catch{throw new ApiError(400,'Invalid reminder cursor');}
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new ApiError(400,'Invalid reminder cursor');
  let parsed:RecordData;try{parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));}catch{throw new ApiError(400,'Invalid reminder cursor');}
  if(parsed.v!==1||typeof parsed.after!=='string'||typeof parsed.property!=='string'||!Number.isInteger(parsed.event)||Number(parsed.event)<0||[parsed.after,parsed.property].some(value=>stringValue(value).includes('/')||stringValue(value).length>1500))throw new ApiError(400,'Invalid reminder cursor');
  return {after:stringValue(parsed.after),property:stringValue(parsed.property),event:Number(parsed.event)};
}
function transactionalEvent(property:RecordData,event:ReminderCandidate,scheduledFor:string):TransactionalEmailEvent {
  const propertyId=stringValue(property.id),title=stringValue(property.title)||propertyId;
  const eventType=event.kind==='rent_due'?'rent.reminder':'agreement.expiry_reminder';
  const eventId=event.kind==='rent_due'?`${propertyId}:${event.tenancyId}:${event.period}:${event.offset}`:`${propertyId}:${event.tenancyId}:${event.agreementVersion}:${event.offset}`;
  const subject=event.kind==='rent_due'?event.offset===0?'Rent is due today':`Rent due in ${event.offset} day${event.offset===1?'':'s'}`:`Rental agreement expires in ${event.offset} days`;
  const bodyText=event.kind==='rent_due'?`${title}: rent ${event.amount} for ${event.period} is due on ${event.dueDate}.`:`${title}: the current rental agreement expires on ${event.dueDate}. Review renewal or move-out arrangements in PropBank.`;
  const bodyHtml=event.kind==='rent_due'?`<p><strong>${escapeHtml(title)}</strong></p><p>Rent amount: ${escapeHtml(event.amount)}<br>Rental period: ${escapeHtml(event.period)}<br>Due date: ${escapeHtml(event.dueDate)}</p>`:`<p><strong>${escapeHtml(title)}</strong></p><p>The current rental agreement expires on ${escapeHtml(event.dueDate)}. Review renewal or move-out arrangements in PropBank.</p>`;
  return {eventType,eventId,recipientUID:event.recipientUID,recipientRole:event.recipientRole,propertyId,recordId:propertyId,templateId:event.kind==='rent_due'?'rent-reminder':'agreement-expiry-reminder',templateVersion:1,subject,...brandedEmail(subject,bodyHtml,bodyText,{label:event.kind==='rent_due'?'View rental information':'View agreement',path:`/manage-property/${propertyId}`}),idempotencyKey:`${eventType}:${eventId}:${event.recipientUID}`,tenancyId:event.tenancyId,rentPeriod:event.kind==='rent_due'?event.period:undefined,agreementVersion:event.kind==='agreement_expiry'?event.agreementVersion:undefined,scheduledFor,reminderOffset:event.offset,reminderDueDate:event.dueDate,reminderAmount:event.kind==='rent_due'?event.amount:undefined};
}

export async function runPropertyReminders(now=new Date(),cursorToken='') {
  if(!process.env.RESEND_API_KEY||!process.env.FROM_EMAIL)throw new ApiError(503,'Reminder email delivery is not configured');
  const cursor=decodeCursor(cursorToken),db=getDatabase();let query:FirebaseFirestore.Query=db.collection(COLLECTIONS.properties).where('isActive','==',true).orderBy('__name__').limit(250);
  if(cursor.after)query=query.startAfter(cursor.after);
  const snapshot=await query.get(),result={scanned:snapshot.docs.length,sent:0,failed:0,skipped:0,needsReconciliation:0,limited:false,nextCursor:null as string|null};
  let completed=cursor.after,attempted=0;
  for(let documentIndex=0;documentIndex<snapshot.docs.length;documentIndex++){
    const doc=snapshot.docs[documentIndex];
    if(cursor.property&&documentIndex===0&&doc.id!==cursor.property)throw new ApiError(409,'Reminder cursor is stale');
    const property={...doc.data(),id:doc.id} as RecordData,events=propertyReminderEvents(property,now);let eventIndex=documentIndex===0&&cursor.property===doc.id?cursor.event:0;
    if(eventIndex>events.length)throw new ApiError(409,'Reminder cursor is stale');
    for(;eventIndex<events.length;eventIndex++){
      if(attempted>=20){result.limited=true;result.nextCursor=encodeCursor({after:completed,property:doc.id,event:eventIndex});return result;}
      attempted++;const outcome=await processTransactionalEmail(transactionalEvent(property,events[eventIndex],localDate(now,stringValue(property.timezone)).date));
      if(outcome==='sent')result.sent++;else if(outcome==='failed')result.failed++;else result.skipped++;
    }
    completed=doc.id;
  }
  if(snapshot.docs.length===250){result.limited=true;result.nextCursor=encodeCursor({after:completed,property:'',event:0});}
  return result;
}
