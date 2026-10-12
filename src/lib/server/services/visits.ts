import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { requireAdmin, requireSelfOrAdmin } from '../permissions';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readModel, readObject, getRecord, getRecords, epoch, parseRFC3339, firestoreTime, goTimeString } from './domain-contracts';
import { bestEffort, queueEmail, escapeHtml } from './property-effects';
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
  const owner=property.ownerUID?await getUser(s(property.ownerUID)):null;
  if(owner?.email)queueEmail({to:s(owner.email),subject:'Property visit updated',html:`<p>${escapeHtml(s(property.title))}</p><p>${escapeHtml(s(visit.status))}: ${escapeHtml(String(visit.visitDate))}</p>`});
  await bestEffort(()=>createNotification({type:'visit_update',title:'Property Visit Update',message:`Visit ${s(visit.status)} for ${s(property.title)}`,propertyId:property.id,ownerId:property.ownerUID,userId:uid}));
}
export async function createVisit(request:Request) {
  const user=await identity(request);
  let req:RecordData;try{req=await readModel(request,'CreateVisitRequest');}catch{return jsonResponse({success:false,message:'Invalid request body'},400);}
  if(!req.title||!req.visitDate||!req.reminderType)return jsonResponse({success:false,message:'Missing required fields: title, visitDate, reminderType'},400);
  const date=parseRFC3339(req.visitDate);if(!date)return jsonResponse({success:false,message:'Invalid date format. Use ISO 8601 format'},400);
  validateVisit(req);
  if(req.propertyId) {const property=await getProperty(s(req.propertyId));if(!property||property.isActive!==true||property.status==='inactive')throw new ApiError(404,'Available property not found');if(property.createdAs==='tenant'||property.listingType==='manage'||property.isSold||property.rentalStatus==='rented')await propertyMember(user,s(req.propertyId));}
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
async function updateFields(id:string,req:RecordData) {
  const updates:RecordData={updatedAt:new Date()};
  if('isCompleted' in req)updates.isCompleted=req.isCompleted;
  for(const key of ['title','description','reminderType','status'])if(req[key])updates[key]=req[key];
  const date=firestoreTime(req.visitDate);if(date)updates.visitDate=date;
  if(typeof req.reminderTime==='number')updates.reminderTime=req.reminderTime;
  if(req.status==='completed'||req.isCompleted===true)Object.assign(updates,{status:'completed',isCompleted:true});
  else if(req.status==='scheduled'||req.status==='cancelled')updates.isCompleted=false;
  await collection().doc(id).update(updates);
}
export async function updateVisit(request:Request,id:string) {
  const user=await identity(request);let req:RecordData;
  try{req=await readObject(request);model('UpdateVisitRequest',req,true);}catch{return jsonResponse({success:false,message:'Invalid request body'},400);}
  if(Object.keys(req).some(key=>!['title','description','visitDate','reminderType','reminderTime','status','isCompleted'].includes(key)))throw new ApiError(400,'Unsupported visit field');
  validateVisit(req);
  const before=await getRecord(COLLECTIONS.visits,id,'Visit');if(!before)throw new ApiError(404,'Visit not found');requireSelfOrAdmin(user,s(before.userId));
  await updateFields(id,req);const updated=await getRecord(COLLECTIONS.visits,id,'Visit');if(updated)await notifyVisit(updated,user.uid);return response(true,'Visit updated successfully',updated);
}
export async function deleteVisit(request:Request,id:string) {
  const user=await identity(request);const visit=await getRecord(COLLECTIONS.visits,id,'Visit');if(visit)requireSelfOrAdmin(user,s(visit.userId));
  await collection().doc(id).delete();return response(true,'Visit deleted successfully');
}
