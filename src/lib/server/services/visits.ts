import {listingApproved} from '../../listing-policy';
import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { requireAdmin, requireSelfOrAdmin } from '../permissions';
import {AccessError} from '../auth';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, wireValue, stringValue as s, type RecordData } from './contracts';
import { identity, readModel, readObject, getRecord, epoch, parseRFC3339, firestoreTime, goTimeString } from './domain-contracts';
import { bestEffort, escapeHtml } from './property-effects';
import { getUser } from './users';
import { getProperty } from './properties';
import { createNotification } from './notifications';
import { processUserEvent } from './transactional-email';
import {formatIST} from './group2-mail';
const wireVisit=(visit:RecordData)=>({...wireModel('Visit',visit),managementVersion:Number(visit.managementVersion||0)});
const response=(success:boolean,message:string,visit?:RecordData|null,visits?:RecordData[])=>jsonResponse({success,message,...(visit?{visit:wireVisit(visit)}:{}),...(visits?{visits:visits.map(wireVisit)}:{})});
const collection=()=>getDatabase().collection(COLLECTIONS.visits);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function requireVisitAdminEmail() {
  const email=s(process.env.ADMIN_EMAIL).trim().toLowerCase();
  if(!emailPattern.test(email))throw new ApiError(503,'Visit notifications are unavailable because ADMIN_EMAIL is missing or invalid');
  return email;
}
async function visitID() {
  for(let attempt=0;attempt<10;attempt++) {
    const id=Array.from({length:4},()=>String.fromCharCode(65+randomInt(26))).join('')+Array.from({length:4},()=>String(randomInt(10))).join('');
    if(!(await collection().doc(id).get()).exists)return id;
  }
  return `VISIT${randomUUID()}`;
}
function validateVisit(req:RecordData) {
  if(req.status&&!['scheduled','completed','cancelled'].includes(s(req.status)))throw new ApiError(400,'Invalid visit status');
  if(req.reminderType==='mobile')throw new ApiError(400,'Mobile notification delivery is not configured; choose email or none');
  if(req.reminderType&&!['email','none'].includes(s(req.reminderType)))throw new ApiError(400,'Invalid reminder type');
  if(req.reminderTime!==undefined&&(typeof req.reminderTime!=='number'||!Number.isInteger(req.reminderTime)||req.reminderTime<0||req.reminderTime>10080))throw new ApiError(400,'Reminder time must be 0–10080 minutes');
  if(req.visitDate&&!parseRFC3339(req.visitDate))throw new ApiError(400,'Invalid visit date');
}
async function notifyVisit(visit:RecordData,uid:string,adminEmail:string) {
  const property=visit.propertyId?await getProperty(s(visit.propertyId)):null,requester=await getUser(uid),owner=property?.ownerUID?await getUser(s(property.ownerUID)):null;
  const scheduledAt=epoch(visit.visitDate);if(!Number.isFinite(scheduledAt)||scheduledAt<=0)throw new Error('Invalid persisted visit date');
  const status=s(visit.status)||'scheduled',version=Number(visit.managementVersion||0),visitTitle=s(visit.title),propertyTitle=s(property?.title)||'General property visit',when=formatIST(new Date(scheduledAt)),details=s(visit.description),eventId=`${s(visit.id)}:${version}:${status}`;
  const commonHtml=`<p><strong>${escapeHtml(visitTitle)}</strong><br>${escapeHtml(propertyTitle)}</p><p>Status: ${escapeHtml(status)}<br>Scheduled: ${escapeHtml(when)}</p>${details?`<p>${escapeHtml(details)}</p>`:''}`;
  const commonText=`${visitTitle}. ${propertyTitle}. Status: ${status}. Scheduled: ${when}.${details?` Details: ${details}`:''}`;
  const requesterResult=await bestEffort(()=>processUserEvent({eventType:`visit.${status}`,eventId:`${eventId}:requester`,recipients:[{uid,role:'requester'}],propertyId:s(property?.id),recordId:s(visit.id),templateId:'visit-activity-requester',subject:'Property visit updated',title:'Property visit updated',bodyHtml:commonHtml,bodyText:commonText,action:{label:'Open Visit Planner',path:'/visit-planner'}}));
  console.info('visit_email_stage',{stage:'requester_processed',visitId:s(visit.id),status:requesterResult?.[0]?.status||'exception'});
  const adminHtml=`<p>Requester: ${escapeHtml(s(requester?.name)||'Registered user')}<br>Verified email: ${escapeHtml(s(requester?.email))}</p>${commonHtml}<p>Visit reference: ${escapeHtml(s(visit.id))}${property?.location?`<br>Location: ${escapeHtml(s(property.location))}`:''}</p>`;
  if(emailPattern.test(adminEmail)&&s(requester?.email).toLowerCase()!==adminEmail) {
    console.info('visit_email_stage',{stage:'admin_resolved',visitId:s(visit.id),recipientType:'configured_admin'});
    try {
      const result=await processUserEvent({eventType:`visit.${status}`,eventId:`${eventId}:admin`,recipients:[{role:'admin',email:adminEmail}],propertyId:s(property?.id),recordId:s(visit.id),templateId:'visit-activity-admin',subject:'PropBank visit activity',title:'Visit activity requires attention',bodyHtml:adminHtml,bodyText:`Requester: ${s(requester?.name)||'Registered user'} (${s(requester?.email)}). ${commonText} Visit reference: ${s(visit.id)}.`,action:{label:'Open admin visits',path:'/admin?tab=visits'}});
      if(result[0]?.status==='skipped')console.info('Visit administrator email already recorded',{visitId:s(visit.id),eventType:`visit.${status}`});
    } catch {
      console.error('Visit administrator email could not be queued',{visitId:s(visit.id),eventType:`visit.${status}`});
    }
  } else if(!emailPattern.test(adminEmail))console.error('Visit administrator email is not configured',{visitId:s(visit.id),eventType:`visit.${status}`});
  if(property?.ownerUID&&s(property.ownerUID)!==uid&&owner?.isActive!==false&&owner?.emailVerified!==false)await bestEffort(()=>processUserEvent({eventType:`visit.${status}`,eventId:`${eventId}:owner`,recipients:[{uid:s(property.ownerUID),role:'owner'}],propertyId:s(property.id),recordId:s(visit.id),templateId:'visit-activity-owner',subject:'Property visit updated',title:'Visit scheduled for your property',bodyHtml:`<p><strong>${escapeHtml(propertyTitle)}</strong></p><p>Visitor: ${escapeHtml(s(requester?.name)||'Registered PropBank user')}<br>Status: ${escapeHtml(status)}<br>Scheduled: ${escapeHtml(when)}</p>`,bodyText:`${propertyTitle}. Visitor: ${s(requester?.name)||'Registered PropBank user'}. Status: ${status}. Scheduled: ${when}.`,action:{label:'View property',path:`/manage-property/${s(property.id)}`}}));
  try {await createNotification({type:'visit_update',title:'Property Visit Update',message:`${s(requester?.name)||'A registered user'} ${status} a visit for ${propertyTitle} on ${when}`,propertyId:s(property?.id),ownerId:s(property?.ownerUID),userId:uid,userName:s(requester?.name),userEmail:s(requester?.email),visitDate:goTimeString(visit.visitDate),visitTime:when,relatedId:s(visit.id)});} catch {console.error('Visit administrator notification could not be created',{visitId:s(visit.id),eventType:`visit.${status}`});}
}
async function notifyVisitSafely(visit:RecordData,uid:string,adminEmail:string) {
  try {await notifyVisit(visit,uid,adminEmail);}
  catch(error) {console.error('visit_email_stage',{stage:'notification_processing_failed',visitId:s(visit.id),status:'committed',errorCode:error instanceof Error?error.name:'UNKNOWN_ERROR'});}
}
export async function createVisit(request:Request) {
  const user=await identity(request);
  const adminEmail=requireVisitAdminEmail();
  let req:RecordData;try{req=await readModel(request,'CreateVisitRequest');}catch{return jsonResponse({success:false,message:'Invalid request body'},400);}
  if(!req.title||!req.visitDate)return jsonResponse({success:false,message:'Missing required fields: title, visitDate'},400);
  const date=parseRFC3339(req.visitDate);if(!date)return jsonResponse({success:false,message:'Invalid date format. Use ISO 8601 format'},400);
  if(date.getTime()<=Date.now())return jsonResponse({success:false,message:'Visit date must be in the future'},400);
  req.reminderType='email';req.reminderTime=30;validateVisit(req);
  if(req.propertyId) {const property=await getProperty(s(req.propertyId));if(!property||property.isActive!==true||property.status==='inactive'||!listingApproved(property)||property.createdAs==='tenant'||property.listingType==='manage'||property.isSold||property.isRented||property.rentalStatus==='rented')throw new ApiError(404,'Available property not found');}
  const now=new Date();const visit:RecordData={...model('Visit',{...req,id:await visitID(),userId:user.uid,visitDate:goTimeString(req.visitDate),status:'scheduled',isCompleted:false,createdAt:now,updatedAt:now}),managementVersion:0};
  await collection().doc(s(visit.id)).create({...storeModel('Visit',visit),visitDate:firestoreTime(req.visitDate),managementVersion:0});
  console.info('visit_email_stage',{stage:'visit_saved',visitId:s(visit.id)});
  await notifyVisitSafely(visit,user.uid,adminEmail);
  return jsonResponse({success:true,message:'Visit scheduled successfully',visit:wireVisit(visit)},201);
}
export async function listVisits(request:Request) {
  const params=new URL(request.url).searchParams;const uid=params.get('userId');
  if(!uid)return plainError('User ID required for visits',400);
  const user=await identity(request);requireSelfOrAdmin(user,uid);
  const status=params.get('status');
  if(status&&!['active','completed','cancelled'].includes(status))throw new ApiError(400,'Invalid visit status filter');
  // A requester-scoped equality query needs no composite index. Sorting after the
  // bounded user query avoids production failures when userId+visitDate is absent.
  const snapshot=await collection().where('userId','==',uid).get();let visits:RecordData[]=[];
  for(const doc of snapshot.docs){try{const raw=doc.data(),visit=model('Visit',raw);visit.id=doc.id;visit.managementVersion=Number(raw.managementVersion||0);visits.push(visit);}catch{/* Preserve Go behavior: skip malformed records. */}}
  if(status==='active'||status==='completed') {
    // Passing the scheduled time is not evidence that a visit took place.
    visits=visits.filter(v=>status==='active'?!v.isCompleted&&(!v.status||v.status==='scheduled'):v.status!=='cancelled'&&(!!v.isCompleted||v.status==='completed'));
    visits.sort((a,b)=>(epoch(a.visitDate)-epoch(b.visitDate))*(status==='completed'?-1:1));
  } else if(status==='cancelled')visits=visits.filter(v=>v.status==='cancelled');
  visits.sort((a,b)=>(epoch(a.visitDate)-epoch(b.visitDate))*(status==='completed'?-1:1));
  return response(true,'Visits retrieved successfully',null,visits);
}
export async function getVisit(request:Request,id:string) {
  const user=await identity(request);const document=await collection().doc(id).get();
  if(!document.exists)return jsonResponse({success:false,message:'Visit not found'},404);
  const raw=document.data()!,visit=model('Visit',raw);visit.id=id;visit.managementVersion=Number(raw.managementVersion||0);
  requireSelfOrAdmin(user,s(visit.userId));return response(true,'Visit retrieved successfully',visit);
}
function updateFields(req:RecordData) {
  const updates:RecordData={updatedAt:new Date()};
  if('isCompleted' in req)updates.isCompleted=req.isCompleted;
  for(const key of ['title','description','reminderType','status'])if(req[key])updates[key]=req[key];
  const date=firestoreTime(req.visitDate);if(date)Object.assign(updates,{visitDate:date,notifiedAt:null,reminderDelivery:null});
  if(typeof req.reminderTime==='number')updates.reminderTime=req.reminderTime;
  if(req.status==='completed'||req.isCompleted===true)Object.assign(updates,{status:'completed',isCompleted:true});
  else if(req.status==='scheduled'||req.status==='cancelled')updates.isCompleted=false;
  return updates;
}
export async function updateVisit(request:Request,id:string) {
  const user=await identity(request),adminEmail=s(process.env.ADMIN_EMAIL).trim().toLowerCase();let req:RecordData;
  try{req=await readObject(request);model('UpdateVisitRequest',req,true);}catch{return jsonResponse({success:false,message:'Invalid request body'},400);}
  if(Object.keys(req).some(key=>!['title','description','visitDate','status','isCompleted','expectedVersion'].includes(key)))throw new ApiError(400,'Unsupported visit field');
  if(req.visitDate){req.reminderType='email';req.reminderTime=30;}
  validateVisit(req);
  if(req.visitDate&&parseRFC3339(req.visitDate)!.getTime()<=Date.now())throw new ApiError(400,'Visit date must be in the future');
  if('expectedVersion' in req&&(!Number.isInteger(req.expectedVersion)||Number(req.expectedVersion)<0))throw new ApiError(400,'Invalid visit version');
  const db=getDatabase(),ref=collection().doc(id);
  await db.runTransaction(async tx=>{
    const doc=await tx.get(ref);if(!doc.exists)throw new ApiError(404,'Visit not found');const before=doc.data()!;
    const actor=await tx.get(db.collection(COLLECTIONS.users).doc(user.uid));
    if(!actor.exists||actor.data()?.isActive===false)throw new AccessError(403,'Active user required');
    if(actor.data()?.role!=='admin'&&user.uid!==before.userId)throw new AccessError(403,'Access denied');
    if(req.expectedVersion!==undefined&&req.expectedVersion!==Number(before.managementVersion||0))throw new ApiError(409,'Visit changed; refresh and retry');
    const previousStatus=visitStatus(before);
    // Check the transaction snapshot, including legacy completion flags, before any write.
    if(previousStatus==='completed'||previousStatus==='cancelled')throw new ApiError(409,`This ${previousStatus} visit can no longer be modified`);
    if('isCompleted' in req&&req.status&&req.isCompleted!==(req.status==='completed'))throw new ApiError(400,'Visit completion and status disagree');
    const updates=updateFields(req);
    updates.managementVersion=Number(before.managementVersion||0)+1;
    if(actor.data()?.role==='admin') {
      const history=Array.isArray(before.visitAdminHistory)?before.visitAdminHistory:[];
      if(history.length>=200)throw new ApiError(409,'Visit administration history limit reached');
      updates.visitAdminHistory=[...history,{actorUID:user.uid,at:updates.updatedAt,previousStatus:visitStatus(before),status:visitStatus({...before,...updates}),changes:Object.fromEntries(Object.keys(req).filter(key=>key!=='expectedVersion').map(key=>[key,updates[key]??req[key]])),version:updates.managementVersion}];
    }
    tx.update(ref,updates);
  });
  const document=await ref.get();let updated:RecordData|null=null;if(document.exists){const raw=document.data()!;updated=model('Visit',raw);updated.id=id;updated.managementVersion=Number(raw.managementVersion||0);}if(updated)await notifyVisitSafely(updated,s(updated.userId),adminEmail);return response(true,'Visit updated successfully',updated);
}
export async function deleteVisit(request:Request,id:string) {
  const user=await identity(request);const visit=await getRecord(COLLECTIONS.visits,id,'Visit');if(visit)requireSelfOrAdmin(user,s(visit.userId));
  await collection().doc(id).delete();return response(true,'Visit deleted successfully');
}

function visitStatus(visit:RecordData):string {
  return visit.status==='cancelled'?'cancelled':visit.isCompleted===true||visit.status==='completed'?'completed':s(visit.status)||'scheduled';
}
export async function listAdminVisits(request:Request) {
 const user=await identity(request);requireAdmin(user);
 const params=new URL(request.url).searchParams,status=params.get('status')||'',propertyId=params.get('propertyId')||'',from=params.get('dateFrom')||'',to=params.get('dateTo')||'';
 if(status&&!['scheduled','completed','cancelled'].includes(status)||propertyId.includes('/'))throw new ApiError(400,'Invalid visit filter');
 for(const date of [from,to])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!parseRFC3339(date+'T00:00:00Z')))throw new ApiError(400,'Invalid visit date filter');
 if(from&&to&&from>to)throw new ApiError(400,'Visit date range is reversed');
 const snapshot=await collection().get(),visits:RecordData[]=[];
 const profiles=new Map<string,Awaited<ReturnType<typeof getUser>>>(),properties=new Map<string,Awaited<ReturnType<typeof getProperty>>>();
 for(const doc of snapshot.docs) {
  const raw=doc.data();let visit:RecordData;try{visit=model('Visit',raw);}catch{continue;}visit.id=doc.id;
  const currentStatus=visitStatus(visit),time=epoch(visit.visitDate),day=Number.isFinite(time)?new Date(time+330*60000).toISOString().slice(0,10):'';
  if(status&&status!==currentStatus||propertyId&&visit.propertyId!==propertyId||from&&(!day||day<from)||to&&(!day||day>to))continue;
  const uid=s(visit.userId),pid=s(visit.propertyId);
  if(uid&&!profiles.has(uid))profiles.set(uid,await getUser(uid));
  if(pid&&!pid.includes('/')&&!properties.has(pid))properties.set(pid,await getProperty(pid));
  const profile=profiles.get(uid),property=properties.get(pid);
  visits.push({...wireModel('Visit',visit),status:currentStatus,managementVersion:Number(raw.managementVersion||0),visitAdminHistory:wireValue(raw.visitAdminHistory||[]),requester:{uid,name:profile?.name||'',email:profile?.email||'',phone:profile?.phoneNumber||''},property:property?{id:pid,title:property.title,address:property.address||property.location}:null});
 }
 visits.sort((a,b)=>epoch(a.visitDate)-epoch(b.visitDate));return jsonResponse({success:true,visits});
}
