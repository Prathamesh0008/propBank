import 'server-only';
import {enquiryStatuses} from '../../enquiry';
import {requireUser, AccessError, type AuthenticatedUser} from '../auth';
import {getDatabase, COLLECTIONS} from '../firestore';
import {getFirebaseAdminAuth} from '../firebase-admin';
import {ApiError, jsonResponse} from '../http';
import {readObject, knownFields, epoch} from './domain-contracts';
import {stringValue as s, wireValue, type RecordData} from './contracts';

// Separate from notification payloads: owners/customers never receive internal
// tracking/history through existing notification or property endpoints.
export const ENQUIRY_ASSIGNMENTS = 'enquiry_assignments';
const notifications=()=>getDatabase().collection(COLLECTIONS.adminNotifications);
const assignments=()=>getDatabase().collection(ENQUIRY_ASSIGNMENTS);
function requireInboxRole(user:AuthenticatedUser) {
  if(!['admin','agent'].includes(user.role))throw new AccessError(403,'Administrator or assigned agent access required');
}
function project(id:string,notification:RecordData,tracking:RecordData={}) {
  // Explicit allowlist: no owner contacts, adminRemarks, attachments or other
  // confidential property records are granted by enquiry assignment.
  const result:RecordData={id};
  for(const key of ['title','message','propertyId','propertyTitle','propertyAddress','userName','userEmail','userPhone'])result[key]=s(notification[key]);
  return wireValue({...result,timestamp:notification.timestamp||notification.createdAt||null,isRead:notification.isRead===true,
    brokerUID:s(tracking.brokerUID),brokerName:s(tracking.brokerName),status:tracking.status||'new',
    version:tracking.version||0,history:tracking.history||[]});
}
export async function listEnquiries(request:Request) {
  const user=await requireUser(request);requireInboxRole(user);
  const result:RecordData[]=[];
  if(user.role==='admin') {
    // No timestamp orderBy: historical enquiries missing that field must remain visible.
    const snapshot=await notifications().where('type','==','property_enquiry').get();
    for(const doc of snapshot.docs){const tracking=await assignments().doc(doc.id).get();result.push(project(doc.id,doc.data(),tracking.data()) as RecordData);}
  }else {
    // Caller-supplied UIDs/filters cannot widen this query.
    const snapshot=await assignments().where('brokerUID','==',user.uid).get();
    for(const doc of snapshot.docs){const notification=await notifications().doc(doc.id).get();if(notification.exists&&notification.data()?.type==='property_enquiry')result.push(project(doc.id,notification.data()!,doc.data()) as RecordData);}
  }
  result.sort((a,b)=>epoch(b.timestamp)-epoch(a.timestamp));
  return jsonResponse({success:true,enquiries:result});
}
export async function updateEnquiry(request:Request,id:string) {
  const user=await requireUser(request);requireInboxRole(user);
  if(!id||id.includes('/')||id.length>200)throw new ApiError(400,'Invalid enquiry ID');
  let req:RecordData;
  try{const raw=await readObject(request,8192),fields=['action','brokerUID','status','notes','expectedVersion'];if(Object.keys(raw).some(key=>!fields.includes(key)))throw new Error('Unsupported field');req=knownFields(raw,fields);}catch{throw new ApiError(400,'Invalid enquiry update');}
  if(!['assign','status'].includes(s(req.action))||!Number.isInteger(req.expectedVersion)||Number(req.expectedVersion)<0||('notes' in req&&typeof req.notes!=='string')||s(req.notes).length>2000)throw new ApiError(400,'Valid action, version and optional notes (up to 2000 characters) required');
  if(req.action==='assign') {
    if(user.role!=='admin')throw new AccessError(403,'Only administrators can assign enquiries');
    if(typeof req.brokerUID!=='string'||req.brokerUID.includes('/')||req.brokerUID.length>128||'status' in req)throw new ApiError(400,'Supply an agent UID or empty string to unassign');
    if(req.brokerUID) {
      try{const account=await getFirebaseAdminAuth().getUser(req.brokerUID);if(account.disabled)throw new ApiError(400,'Agent account is disabled');}
      catch(error){if(error instanceof ApiError)throw error;if((error as {code?:string}).code==='auth/user-not-found')throw new ApiError(400,'Registered agent account required');throw error;}
    }
  }else if(typeof req.status!=='string'||!Object.hasOwn(enquiryStatuses,req.status)||'brokerUID' in req)throw new ApiError(400,'Valid enquiry status required; assignment changes are admin-only');
  const db=getDatabase(),ref=assignments().doc(id);
  let result:unknown;
  await db.runTransaction(async tx=>{
    const notification=await tx.get(notifications().doc(id));
    if(!notification.exists||notification.data()?.type!=='property_enquiry')throw new ApiError(404,'Property enquiry not found');
    const current=await tx.get(ref),before=current.data()||{};
    const actor=await tx.get(db.collection(COLLECTIONS.users).doc(user.uid)),role=actor.data()?.role;
    if(!actor.exists||actor.data()?.isActive===false||!['admin','agent'].includes(role))throw new AccessError(403,'Active inbox role required');
    if(req.action==='assign'&&role!=='admin')throw new AccessError(403,'Only administrators can assign enquiries');
    if(role!=='admin'&&before.brokerUID!==user.uid)throw new AccessError(403,'Enquiry is not assigned to your account');
    if(req.expectedVersion!==Number(before.version||0))throw new ApiError(409,'Enquiry changed; refresh and retry');
    let brokerName=s(before.brokerName);
    if(req.action==='assign'&&req.brokerUID) {
      const target=await tx.get(db.collection(COLLECTIONS.users).doc(s(req.brokerUID)));
      if(!target.exists||target.data()?.role!=='agent'||target.data()?.isActive===false)throw new ApiError(400,'Active registered agent required');
      brokerName=s(target.data()?.name)||s(req.brokerUID);
    }
    const brokerUID=req.action==='assign'?s(req.brokerUID):s(before.brokerUID),status=req.action==='status'?s(req.status):s(before.status)||'new';
    if(req.action==='assign'&&brokerUID===s(before.brokerUID))throw new ApiError(409,'Assignment is unchanged');
    const history=Array.isArray(before.history)?before.history:[];
    if(history.length>=200)throw new ApiError(409,'Enquiry history limit reached');
    const now=new Date(),action=req.action==='status'?'status_updated':!brokerUID?'unassigned':before.brokerUID?'reassigned':'assigned';
    const tracking={notificationId:id,brokerUID,brokerName:brokerUID?brokerName:'',status,version:Number(before.version||0)+1,updatedAt:now,
      history:[...history,{action,actorUID:user.uid,at:now,notes:s(req.notes).trim(),previousBrokerUID:s(before.brokerUID),brokerUID,previousStatus:s(before.status)||'new',status}]};
    tx.set(ref,tracking);result=project(id,notification.data()!,tracking);
  });
  return jsonResponse({success:true,enquiry:result});
}
