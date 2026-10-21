import {listingApproved} from '../../listing-policy';
import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { requireAdmin, requireSelfOrAdmin } from '../permissions';
import {AccessError} from '../auth';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, wireValue, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readModel, readObject, getRecord, getRecords, epoch, parseRFC3339, firestoreTime, goTimeString } from './domain-contracts';
import { bestEffort } from './property-effects';
import { queueUserEvent } from './transactional-email';
import { getUser } from './users';
import { getProperty } from './properties';
import { createNotification } from './notifications';
import { visitMail } from './group2-mail';
const response=(success:boolean,message:string,visit?:RecordData|null,visits?:RecordData[])=>jsonResponse({success,message,...(visit?{visit:wireModel('Visit',visit)}:{}),...(visits?.length?{visits:visits.map(v=>wireModel('Visit',v))}:{})});
const collection=()=>getDatabase().collection(COLLECTIONS.visits);
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
async function notifyVisit(visit:RecordData,uid:string) {
  if(!visit.propertyId)return;
  const property=await getProperty(s(visit.propertyId));if(!property)return;
  const recipientUIDs=[s(property.ownerUID),uid].filter(Boolean);
  queueUserEvent({eventType:`visit.${s(visit.status)||'updated'}`,eventId:`${s(visit.id)}:${s(visit.updatedAt)||s(visit.visitDate)}:${s(visit.status)}`,recipientUIDs,propertyId:s(property.id),recordId:s(visit.id),templateId:'visit-update',subject:`Property visit updated: ${s(property.title)}`,title:'Property visit updated',bodyHtml:`<p>${s(property.title)}</p><p>${s(visit.status)}: ${String(visit.visitDate)}</p>`,bodyText:`${s(property.title)}. ${s(visit.status)}: ${String(visit.visitDate)}`});
  await bestEffort(()=>createNotification({type:'visit_update',title:'Property Visit Update',message:`Visit ${s(visit.status)} for ${s(property.title)}`,propertyId:property.id,ownerId:property.ownerUID,userId:uid}));
}
export async function createVisit(request:Request) {
  const user=await identity(request);
  let req:RecordData;try{req=await readModel(request,'CreateVisitRequest');}catch{return jsonResponse({success:false,message:'Invalid request body'},400);}
  if(!req.title||!req.visitDate||!req.reminderType)return jsonResponse({success:false,message:'Missing required fields: title, visitDate, reminderType'},400);
  const date=parseRFC3339(req.visitDate);if(!date)return jsonResponse({success:false,message:'Invalid date format. Use ISO 8601 format'},400);
  validateVisit(req);
  if(req.propertyId) {const property=await getProperty(s(req.propertyId));if(!property||property.isActive!==true||property.status==='inactive')throw new ApiError(404,'Available property not found');if(!listingApproved(property)||property.createdAs==='tenant'||property.listingType==='manage'||property.isSold||property.rentalStatus==='rented')await propertyMember(user,s(req.propertyId));}
  const now=new Date();const visit=model('Visit',{...req,id:await visitID(),userId:user.uid,visitDate:goTimeString(req.visitDate),status:'scheduled',isCompleted:false,createdAt:now,updatedAt:now});
  await collection().doc(s(visit.id)).create({...storeModel('Visit',visit),visitDate:firestoreTime(req.visitDate)});
  const profile=await bestEffort(()=>getUser(user.uid));if(profile)visitMail(profile,visit);
  await notifyVisit(visit,user.uid);
  return jsonResponse({success:true,message:'Visit scheduled successfully',visit:wireModel('Visit',visit)},201);
}
export async function listVisits(request:Request) {
  const params=new URL(request.url).searchParams;const uid=params.get('userId');
  if(!uid)return plainError('User ID required for visits',400);
  const user=await identity(request);requireSelfOrAdmin(user,uid);
  const status=params.get('status');let query=collection().where('userId','==',uid);
  if(status!=='active'&&status!=='completed')query=query.orderBy('visitDate','asc');
  let visits=await getRecords(query,'Visit');const now=Date.now();
  if(status==='active'||status==='completed') {
    // Passing the scheduled time is not evidence that a visit took place.
    visits=visits.filter(v=>status==='active'?!v.isCompleted&&(!v.status||v.status==='scheduled'):v.status!=='cancelled'&&(!!v.isCompleted||v.status==='completed'));
    visits.sort((a,b)=>(epoch(a.visitDate)-epoch(b.visitDate))*(status==='completed'?-1:1));
  }
  return response(true,'Visits retrieved successfully',null,visits);
}
export async function getVisit(request:Request,id:string) {
  const user=await identity(request);const visit=await getRecord(COLLECTIONS.visits,id,'Visit');
  if(!visit)return jsonResponse({success:false,message:'Visit not found'},404);
  requireSelfOrAdmin(user,s(visit.userId));return response(true,'Visit retrieved successfully',visit);
}
function updateFields(req:RecordData) {
  const updates:RecordData={updatedAt:new Date()};
  if('isCompleted' in req)updates.isCompleted=req.isCompleted;
  for(const key of ['title','description','reminderType','status'])if(req[key])updates[key]=req[key];
  const date=firestoreTime(req.visitDate);if(date)updates.visitDate=date;
  if(typeof req.reminderTime==='number')updates.reminderTime=req.reminderTime;
  if(req.status==='completed'||req.isCompleted===true)Object.assign(updates,{status:'completed',isCompleted:true});
  else if(req.status==='scheduled'||req.status==='cancelled')updates.isCompleted=false;
  return updates;
}
export async function updateVisit(request:Request,id:string) {
  const user=await identity(request);let req:RecordData;
  try{req=await readObject(request);model('UpdateVisitRequest',req,true);}catch{return jsonResponse({success:false,message:'Invalid request body'},400);}
  if(Object.keys(req).some(key=>!['title','description','visitDate','reminderType','reminderTime','status','isCompleted','expectedVersion'].includes(key)))throw new ApiError(400,'Unsupported visit field');
  validateVisit(req);
  if('expectedVersion' in req&&(!Number.isInteger(req.expectedVersion)||Number(req.expectedVersion)<0))throw new ApiError(400,'Invalid visit version');
  if('isCompleted' in req&&req.status&&req.isCompleted!==(req.status==='completed'))throw new ApiError(400,'Visit completion and status disagree');
  const db=getDatabase(),ref=collection().doc(id);
  await db.runTransaction(async tx=>{
    const doc=await tx.get(ref);if(!doc.exists)throw new ApiError(404,'Visit not found');const before=doc.data()!;
    const actor=await tx.get(db.collection(COLLECTIONS.users).doc(user.uid));
    if(!actor.exists||actor.data()?.isActive===false)throw new AccessError(403,'Active user required');
    if(actor.data()?.role!=='admin'&&user.uid!==before.userId)throw new AccessError(403,'Access denied');
    if(req.expectedVersion!==undefined&&req.expectedVersion!==Number(before.managementVersion||0))throw new ApiError(409,'Visit changed; refresh and retry');
    const updates=updateFields(req);
    if(req.isCompleted===false&&!req.status&&before.status==='completed')updates.status='scheduled';
    updates.managementVersion=Number(before.managementVersion||0)+1;
    if(actor.data()?.role==='admin') {
      const history=Array.isArray(before.visitAdminHistory)?before.visitAdminHistory:[];
      if(history.length>=200)throw new ApiError(409,'Visit administration history limit reached');
      updates.visitAdminHistory=[...history,{actorUID:user.uid,at:updates.updatedAt,previousStatus:visitStatus(before),status:visitStatus({...before,...updates}),changes:Object.fromEntries(Object.keys(req).filter(key=>key!=='expectedVersion').map(key=>[key,updates[key]??req[key]])),version:updates.managementVersion}];
    }
    tx.update(ref,updates);
  });
  const updated=await getRecord(COLLECTIONS.visits,id,'Visit');if(updated)await notifyVisit(updated,user.uid);return response(true,'Visit updated successfully',updated);
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
