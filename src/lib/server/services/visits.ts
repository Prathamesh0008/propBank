import 'server-only';
import { randomInt } from 'node:crypto';
import { getDatabase, COLLECTIONS } from '../firestore';
import { requireAdmin, requireSelfOrAdmin } from '../permissions';
import { jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, stringValue as s, type RecordData } from './contracts';
import { identity, readModel, getRecord, getRecords, epoch, parseRFC3339, firestoreTime, goTimeString } from './domain-contracts';
import { bestEffort } from './property-effects';
import { getUser } from './users';
import { visitMail } from './group2-mail';
const response=(success:boolean,message:string,visit?:RecordData|null,visits?:RecordData[])=>jsonResponse({success,message,...(visit?{visit:wireModel('Visit',visit)}:{}),...(visits?.length?{visits:visits.map(v=>wireModel('Visit',v))}:{})});
const collection=()=>getDatabase().collection(COLLECTIONS.visits);
async function visitID() {
  for(let attempt=0;attempt<10;attempt++) {
    const id=Array.from({length:4},()=>String.fromCharCode(65+randomInt(26))).join('')+Array.from({length:4},()=>String(randomInt(10))).join('');
    if(!(await collection().doc(id).get()).exists)return id;
  }
  return `VISIT${Number(BigInt(Date.now())*1000000n%100000000n)}`;
}
export async function createVisit(request:Request) {
  const user=await identity(request);
  let req:RecordData;try{req=await readModel(request,'CreateVisitRequest');}catch{return jsonResponse({success:false,message:'Invalid request body'},400);}
  if(!req.title||!req.visitDate||!req.reminderType)return jsonResponse({success:false,message:'Missing required fields: title, visitDate, reminderType'},400);
  const date=parseRFC3339(req.visitDate);if(!date)return jsonResponse({success:false,message:'Invalid date format. Use ISO 8601 format'},400);
  const now=new Date();const visit=model('Visit',{...req,id:await visitID(),userId:user.uid,visitDate:goTimeString(req.visitDate),status:'scheduled',isCompleted:false,createdAt:now,updatedAt:now});
  await collection().doc(s(visit.id)).create({...storeModel('Visit',visit),visitDate:firestoreTime(req.visitDate)});
  const profile=await bestEffort(()=>getUser(user.uid));if(profile)visitMail(profile,visit);
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
    for(const visit of visits)if(epoch(visit.visitDate)<now&&!visit.isCompleted) {
      await bestEffort(()=>updateFields(s(visit.id),{isCompleted:true,status:'completed'}));
      if(status==='completed'){visit.isCompleted=true;visit.status='completed';}
    }
    visits=visits.filter(v=>status==='active'?epoch(v.visitDate)>now&&!v.isCompleted:!!v.isCompleted||epoch(v.visitDate)<now);
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
  const updates:RecordData={updatedAt:new Date(),isCompleted:req.isCompleted===true};
  for(const key of ['title','description','reminderType','status'])if(req[key])updates[key]=req[key];
  const date=firestoreTime(req.visitDate);if(date)updates.visitDate=date;
  if(typeof req.reminderTime==='number'&&req.reminderTime>0)updates.reminderTime=req.reminderTime;
  await collection().doc(id).set(updates,{merge:true});
}
export async function updateVisit(request:Request,id:string) {
  const user=await identity(request);let req:RecordData;
  try{req=await readModel(request,'UpdateVisitRequest');}catch{return jsonResponse({success:false,message:'Invalid request body'},400);}
  const before=await getRecord(COLLECTIONS.visits,id,'Visit');if(before)requireSelfOrAdmin(user,s(before.userId));else requireAdmin(user);
  await updateFields(id,req);return response(true,'Visit updated successfully',await getRecord(COLLECTIONS.visits,id,'Visit'));
}
export async function deleteVisit(request:Request,id:string) {
  const user=await identity(request);const visit=await getRecord(COLLECTIONS.visits,id,'Visit');if(visit)requireSelfOrAdmin(user,s(visit.userId));
  await collection().doc(id).delete();return response(true,'Visit deleted successfully');
}
