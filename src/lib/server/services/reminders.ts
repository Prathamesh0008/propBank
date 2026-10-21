import 'server-only';
import {createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {getDatabase,COLLECTIONS} from '../firestore';
import {ApiError,jsonResponse} from '../http';
import {epoch} from './domain-contracts';
import {isRecord,stringValue as s,type RecordData} from './contracts';
import {resolveTenantIdentity} from './users';
import {sendEmail,escapeHtml,type Email} from './property-effects';
import {formatIST} from './group2-mail';
import {brandedEmail,processTransactionalEmail,type TransactionalEmailEvent} from './transactional-email';

export function requireCron(request:Request){
  const secret=process.env.CRON_SECRET;if(!secret||secret.length<32)throw new ApiError(503,'Reminder scheduler is not configured');
  const supplied=request.headers.get('authorization')||'',digest=(value:string)=>createHash('sha256').update(value).digest();
  if(!timingSafeEqual(digest(supplied),digest(`Bearer ${secret}`)))throw new ApiError(401,'Scheduler authorization required');
}

const generation=(visit:Record<string,unknown>)=>createHash('sha256').update(`${epoch(visit.visitDate)}:${visit.reminderTime}:${visit.userId}`).digest('hex');
export function dueReminder(visit:Record<string,unknown>,now:number){const at=epoch(visit.visitDate),minutes=visit.reminderTime;return visit.isCompleted!==true&&visit.status!=='cancelled'&&visit.status!=='completed'&&visit.reminderType==='email'&&typeof minutes==='number'&&minutes>=0&&minutes<=10080&&Number.isFinite(at)&&at>=now&&at-minutes*60000<=now;}

export async function runVisitReminders(now=new Date()){
  if(!process.env.RESEND_API_KEY||!process.env.FROM_EMAIL)throw new ApiError(503,'Reminder email delivery is not configured');
  const db=getDatabase(),snapshot=await db.collection(COLLECTIONS.visits).where('visitDate','>=',now).where('visitDate','<=',new Date(now.getTime()+7*86400000)).orderBy('visitDate','asc').limit(1000).get();
  const results={scanned:snapshot.docs.length,sent:0,failed:0,skipped:0,needsReconciliation:0,limited:snapshot.docs.length>=1000};
  const eligible=snapshot.docs.filter(doc=>{const visit=doc.data();if(!dueReminder(visit,now.getTime()))return false;const delivery=isRecord(visit.reminderDelivery)?visit.reminderDelivery:{},key=generation(visit);if(epoch(visit.notifiedAt)>0&&(!delivery.generation||delivery.generation===key))return false;if(delivery.generation===key&&delivery.status!=='sent'&&epoch(delivery.firstAttemptAt)>0&&now.getTime()-epoch(delivery.firstAttemptAt)>=23*3600000){results.needsReconciliation++;return false;}return !(delivery.generation===key&&(delivery.status==='sent'||epoch(delivery.leaseUntil)>now.getTime()));});
  results.limited||=eligible.length>20;const candidates=eligible.slice(0,20);let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{while(cursor<candidates.length){const doc=candidates[cursor++],ref=db.collection(COLLECTIONS.visits).doc(doc.id),lease=randomUUID();const claim=await db.runTransaction(async tx=>{const fresh=await tx.get(ref);if(!fresh.exists)return null;const visit=fresh.data()!;if(!dueReminder(visit,now.getTime()))return null;const key=generation(visit),delivery=isRecord(visit.reminderDelivery)?visit.reminderDelivery:{};if(epoch(visit.notifiedAt)>0&&(!delivery.generation||delivery.generation===key))return null;if(delivery.generation===key){if(delivery.status==='sent'||epoch(delivery.leaseUntil)>now.getTime())return null;if(epoch(delivery.firstAttemptAt)>0&&now.getTime()-epoch(delivery.firstAttemptAt)>=23*3600000){results.needsReconciliation++;return null;}}const profile=await tx.get(db.collection(COLLECTIONS.users).doc(s(visit.userId)));if(!profile.exists||profile.data()?.isActive===false||!profile.data()?.email)return null;const mail:Email=delivery.generation===key&&isRecord(delivery.mail)?delivery.mail as unknown as Email:{to:s(profile.data()!.email),subject:`Visit reminder: ${s(visit.title)}`,html:`<p>Hello ${escapeHtml(s(profile.data()!.name))},</p><p>Your visit to ${escapeHtml(s(visit.title))} is scheduled for ${escapeHtml(formatIST(new Date(epoch(visit.visitDate))))}.</p><p>${escapeHtml(s(visit.description))}</p>`};tx.update(ref,{reminderDelivery:{generation:key,status:'sending',lease,leaseUntil:new Date(now.getTime()+120000),firstAttemptAt:delivery.generation===key?delivery.firstAttemptAt:now,mail}});return {key,mail};});if(!claim){results.skipped++;continue;}let sent=false;try{await sendEmail(claim.mail,`visit-${doc.id}-${claim.key}`);sent=true;}catch{}await db.runTransaction(async tx=>{const fresh=await tx.get(ref),data=fresh.data();if(!fresh.exists||data?.reminderDelivery?.lease!==lease)return;tx.update(ref,{reminderDelivery:{...data.reminderDelivery,status:sent?'sent':'failed',leaseUntil:now},...(sent?{notifiedAt:now}:{})});});if(sent)results.sent++;else results.failed++;}}));
  return results;
}

type Calendar={year:number;month:number;day:number};
export type PropertyReminderEvent={key:string;kind:'rent_due'|'agreement_expiry';tenant:RecordData;recipientRole:'tenant'|'owner';recipientUID:string;amount:string;period:string;dueDate:string;offset:number;tenancyId:string;agreementVersion:string;timezone:string;scheduledFor:string};
const defaultTimezone='Asia/Kolkata',supportedOffsets={rent:[7,1,0],agreement:[30,15,7]};
function timezone(value:unknown){const candidate=s(value)||defaultTimezone;try{new Intl.DateTimeFormat('en-US',{timeZone:candidate}).format();return candidate;}catch{return defaultTimezone;}}
function zoned(date:Date,zone:string):Calendar{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date),get=(type:string)=>Number(parts.find(part=>part.type===type)?.value);return {year:get('year'),month:get('month'),day:get('day')};}
const serial=(date:Calendar)=>Date.UTC(date.year,date.month-1,date.day)/86400000;
const iso=(date:Calendar)=>`${date.year}-${String(date.month).padStart(2,'0')}-${String(date.day).padStart(2,'0')}`;
function monthAt(base:Calendar,delta:number){const value=new Date(Date.UTC(base.year,base.month-1+delta,1));return {year:value.getUTCFullYear(),month:value.getUTCMonth()+1};}
function dueFor(year:number,month:number,due:number):Calendar{const last=new Date(Date.UTC(year,month,0)).getUTCDate();return {year,month,day:Math.min(due,last)};}
function dateValue(value:unknown,zone:string):Calendar|null{const text=s(value),match=/^(\d{4})-(\d{2})-(\d{2})/.exec(text);if(match)return {year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};const time=epoch(value);return Number.isFinite(time)?zoned(new Date(time),zone):null;}
function activeProperty(property:RecordData){return property.isActive===true&&property.status!=='inactive'&&property.rentalStatus==='rented'&&!['terminated','expired','cancelled'].includes(s(property.agreementStatus));}

export function propertyReminderEvents(property:RecordData,now:Date):PropertyReminderEvent[]{
  if(!activeProperty(property))return [];
  const zone=timezone(property.timezone),today=zoned(now,zone),todaySerial=serial(today),ledger=isRecord(property.rentLedger)?property.rentLedger:{},ownerUID=s(property.ownerUID);
  const tenants=(Array.isArray(property.tenants)?property.tenants.filter(isRecord).filter(tenant=>tenant.isActive===true):[]);
  const activeTenants=tenants.length?tenants:(property.tenantEmail?[{email:property.tenantEmail,userUID:property.tenantUID,isActive:true}]:[]);
  const events:PropertyReminderEvent[]=[];
  for(const [index,tenant] of activeTenants.entries()){
    const tenancyId=s(tenant.id||tenant.userUID)||`legacy-${index}`,tenantUID=s(tenant.userUID),due=Number(tenant.paymentDueDate||property.paymentDueDate),amount=s(tenant.monthlyRent||property.monthlyRent);
    if(Number.isInteger(due)&&due>=1&&due<=31&&amount){for(const delta of [0,1]){const target=monthAt(today,delta),dueDate=dueFor(target.year,target.month,due),offset=serial(dueDate)-todaySerial,period=`${target.year}-${String(target.month).padStart(2,'0')}`;if(!supportedOffsets.rent.includes(offset)||isRecord(ledger[period])&&ledger[period].status==='paid')continue;for(const recipient of [{role:'tenant' as const,uid:tenantUID},{role:'owner' as const,uid:ownerUID}])if(recipient.role==='tenant'||recipient.uid)events.push({key:`rent:${s(property.id)}:${tenancyId}:${period}:${iso(dueDate)}:${amount}:${offset}:${recipient.role}:${recipient.uid}`,kind:'rent_due',tenant,recipientRole:recipient.role,recipientUID:recipient.uid,amount,period,dueDate:iso(dueDate),offset,tenancyId,agreementVersion:'',timezone:zone,scheduledFor:iso(today)});}}
    const end=dateValue(tenant.leaseEndDate||property.agreementEndDate,zone);if(end){const offset=serial(end)-todaySerial;if(supportedOffsets.agreement.includes(offset)){const agreementVersion=s(tenant.agreementVersion||property.agreementVersion||property.tenancyRevision||iso(end));for(const recipient of [{role:'tenant' as const,uid:tenantUID},{role:'owner' as const,uid:ownerUID}])if(recipient.role==='tenant'||recipient.uid)events.push({key:`agreement:${s(property.id)}:${tenancyId}:${iso(end)}:${agreementVersion}:${offset}:${recipient.role}:${recipient.uid}`,kind:'agreement_expiry',tenant,recipientRole:recipient.role,recipientUID:recipient.uid,amount:'',period:'',dueDate:iso(end),offset,tenancyId,agreementVersion,timezone:zone,scheduledFor:iso(today)});}}
  }
  return events;
}

function reminderEmail(property:RecordData,event:PropertyReminderEvent):TransactionalEmailEvent{
  const title=escapeHtml(s(property.title)||`Property ${s(property.id)}`),role=event.recipientRole==='owner'?'property owner':'tenant';
  const isDue=event.offset===0,heading=event.kind==='rent_due'?(isDue?'Rent is due today':`Rent is due in ${event.offset} ${event.offset===1?'day':'days'}`):`Agreement expires in ${event.offset} days`;
  const bodyHtml=event.kind==='rent_due'?`<p>Hello ${role},</p><p>Rent for <strong>${title}</strong> is ${isDue?'due today':`due in ${event.offset} ${event.offset===1?'day':'days'}`}.</p><p><strong>Amount:</strong> ₹${escapeHtml(event.amount)}<br><strong>Rent period:</strong> ${event.period}<br><strong>Due date:</strong> ${event.dueDate}</p>`:`<p>Hello ${role},</p><p>The current rental agreement for <strong>${title}</strong> expires in ${event.offset} days.</p><p><strong>Agreement end date:</strong> ${event.dueDate}</p><p>Please sign in to review the agreement and discuss next steps. This reminder does not renew or terminate it.</p>`;
  const bodyText=event.kind==='rent_due'?`Rent for ${s(property.title)} is ${isDue?'due today':`due in ${event.offset} days`}. Amount: INR ${event.amount}. Rent period: ${event.period}. Due date: ${event.dueDate}.`:`The current rental agreement for ${s(property.title)} expires in ${event.offset} days on ${event.dueDate}. Sign in to review next steps.`;
  const content=brandedEmail(heading,bodyHtml,bodyText,{label:event.kind==='rent_due'?'View rental information':'View agreement',path:`/manage-property/${encodeURIComponent(s(property.id))}${event.kind==='rent_due'?'#rent':'#agreement'}`});
  return {eventType:event.kind==='rent_due'?'rent.reminder':'agreement.expiry_reminder',eventId:event.key,recipientUID:event.recipientUID,recipientRole:event.recipientRole,propertyId:s(property.id),recordId:event.tenancyId,tenancyId:event.tenancyId,rentPeriod:event.period||undefined,agreementVersion:event.agreementVersion||undefined,scheduledFor:event.scheduledFor,reminderOffset:event.offset,reminderDueDate:event.dueDate,reminderAmount:event.amount||undefined,templateId:event.kind==='rent_due'?'rent-reminder':'agreement-expiry-reminder',templateVersion:1,subject:`${heading}: ${s(property.title)}`,...content,idempotencyKey:`reminder:${event.key}`};
}

export async function runPropertyReminders(now=new Date(),after=''){
  if(!process.env.RESEND_API_KEY||!process.env.FROM_EMAIL)throw new ApiError(503,'Reminder email delivery is not configured');
  const db=getDatabase();let query:FirebaseFirestore.Query=db.collection(COLLECTIONS.properties).where('isActive','==',true).orderBy('__name__').limit(250);if(after){if(after.includes('/'))throw new ApiError(400,'Invalid reminder cursor');query=query.startAfter(after);}
  const snapshot=await query.get(),result={scanned:snapshot.docs.length,sent:0,failed:0,skipped:0,needsReconciliation:0,limited:snapshot.docs.length>=250,nextCursor:snapshot.docs.length>=250?snapshot.docs.at(-1)!.id:null};let attempted=0;
  for(const doc of snapshot.docs){for(const initial of propertyReminderEvents({...doc.data(),id:doc.id},now)){if(attempted>=20){result.limited=true;continue;}const fresh=await doc.ref.get(),current=propertyReminderEvents({...fresh.data(),id:doc.id},now).find(event=>event.key===initial.key);if(!current){result.skipped++;continue;}if(current.recipientRole==='tenant'&&!current.recipientUID){current.recipientUID=await resolveTenantIdentity(s(current.tenant.email),'');}if(!current.recipientUID){result.skipped++;continue;}attempted++;const status=await processTransactionalEmail(reminderEmail({...fresh.data(),id:doc.id},current));if(status==='sent'){result.sent++;const id=createHash('sha256').update(current.key).digest('hex');await db.collection(COLLECTIONS.adminNotifications).doc(`reminder-${id}`).set({id:`reminder-${id}`,type:current.kind,title:current.kind==='rent_due'?'Monthly Rent Reminder':'Agreement Expiry Reminder',message:`${s(fresh.data()?.title)}: ${current.dueDate}`,propertyId:doc.id,ownerId:s(fresh.data()?.ownerUID),timestamp:now,isRead:false,priority:'medium',createdAt:now,updatedAt:now});}else if(status==='failed')result.failed++;else result.skipped++;}}
  return result;
}

export async function remindersEndpoint(request:Request){requireCron(request);const result=await runVisitReminders(),properties=await runPropertyReminders(new Date(),new URL(request.url).searchParams.get('propertyCursor')||'');return jsonResponse({success:result.failed===0&&properties.failed===0,...result,properties},result.failed||properties.failed?503:200);}
