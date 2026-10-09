import 'server-only';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getDatabase, COLLECTIONS } from '../firestore';
import { requireAdmin, requireSelfOrAdmin, requireOwnerOrAdmin } from '../permissions';
import { jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readModel, readObject, knownFields, getRecords, parseRFC3339, firestoreTime, goTimeString, epoch } from './domain-contracts';
import { getProperty } from './properties';
import { getUser } from './users';
import { bestEffort } from './property-effects';
import { inquiryMail } from './group2-mail';
const collection=()=>getDatabase().collection(COLLECTIONS.adminNotifications);
export async function createNotification(input:RecordData) {
  const req=model('CreateAdminNotificationRequest',input);const now=new Date();
  const valid=parseRFC3339(req.timestamp);
  const notification=model('AdminNotification',{...req,id:randomUUID(),timestamp:valid?goTimeString(req.timestamp):now,priority:req.priority||'medium',createdAt:now,updatedAt:now});
  await collection().doc(s(notification.id)).set({...storeModel('AdminNotification',notification),timestamp:valid?firestoreTime(req.timestamp):now});return notification;
}
export async function postNotification(request:Request) {
  let req:RecordData;try{req=await readModel(request,'CreateAdminNotificationRequest');}catch{return plainError('Invalid request body',400);}
  const publicInquiry=req.type==='general_inquiry'&&!req.userId&&!request.headers.get('Authorization');
  if(!publicInquiry) {
    const user=await identity(request);if(req.userId)requireSelfOrAdmin(user,s(req.userId));
    if(req.propertyId&&['want_to_sell','want_to_sell_cancelled'].includes(s(req.type))) {const property=await getProperty(s(req.propertyId));requireOwnerOrAdmin(user,{ownerUID:s(property?.ownerUID)});}
    if(req.propertyId&&['service_request','document_upload','other_service_request','legal_service_request'].includes(s(req.type)))await propertyMember(user,s(req.propertyId));
  }
  if(req.propertyId&&['property_enquiry','service_request','want_to_sell','want_to_sell_cancelled'].includes(s(req.type))) {
    const property=await bestEffort(()=>getProperty(s(req.propertyId)));
    if(property) {
      if(property.title)req.propertyTitle=property.title;
      if(property.address||property.location)req.propertyAddress=property.address||property.location;
      if(property.listingType)req.propertyListingType=property.listingType;
      for(const [target,source] of [['ownerName','ownerName'],['ownerEmail','ownerEmail'],['ownerId','ownerUID']])if(!req[target]&&property[source])req[target]=property[source];
      if(!req.ownerPhone&&property.ownerUID) {
        const owner=await bestEffort(()=>getUser(s(property.ownerUID)));
        if(owner){req.ownerPhone=owner.phoneNumber;if(!req.ownerEmail)req.ownerEmail=owner.email;if(!req.ownerName)req.ownerName=owner.name;}
      }
    }
  }
  if(req.userId&&!req.userPhone) {const user=await bestEffort(()=>getUser(s(req.userId)));if(user){req.userPhone=user.phoneNumber;if(!req.userEmail)req.userEmail=user.email;if(!req.userName)req.userName=user.name;}}
  const notification=await createNotification(req);if(req.type==='general_inquiry')inquiryMail(notification);
  return jsonResponse({success:true,message:'Admin notification created successfully',notification:wireModel('AdminNotification',notification)},201);
}
export async function listNotifications(request:Request) {
  const user=await identity(request);const params=new URL(request.url).searchParams;const propertyId=params.get('propertyId');
  let query=collection() as FirebaseFirestore.Query;
  if(propertyId) {if(!await propertyMember(user,propertyId))return plainError('Property not found',404);query=query.where('propertyId','==',propertyId);}
  else {requireAdmin(user);query=params.get('unread')==='true'?query.where('isRead','==',false):query.orderBy('timestamp','desc');}
  const notifications=await bestEffort(()=>getRecords(query,'AdminNotification',true))||[];
  notifications.sort((a,b)=>epoch(b.timestamp)-epoch(a.timestamp));return jsonResponse(notifications.map(n=>wireModel('AdminNotification',n)));
}
export async function readNotification(request:Request,id:string) {
  requireAdmin(await identity(request));let archive=true;
  if(Number(request.headers.get('Content-Length'))>0)try{const req=knownFields(await readObject(request),['action']);if(req.action==='unarchive')archive=false;}catch{/* Go ignores malformed optional bodies. */}
  const now=new Date();const action=archive?'archived':'unarchived';
  await collection().doc(id).update({isRead:archive,updatedAt:now,archiveHistory:FieldValue.arrayUnion({action,timestamp:now}),...(archive?{resolvedAt:now}:{})});
  return jsonResponse({message:`Notification ${action}`,id,action});
}
export async function remarksNotification(request:Request,id:string) {
  requireAdmin(await identity(request));let req:RecordData;
  try{req=knownFields(await readObject(request),['remarks','adminImage']);for(const key of ['remarks','adminImage'])if(req[key]!=null&&typeof req[key]!=='string')throw new Error('Invalid string');}catch{return plainError('Invalid request body',400);}
  const remarks=s(req.remarks),adminImage=s(req.adminImage);
  await collection().doc(id).update({adminRemarks:remarks,updatedAt:new Date(),...(adminImage?{adminImage}:{})});
  return jsonResponse({success:true,message:'Admin remarks updated successfully',id,remarks,adminImage});
}
export async function deleteNotification(request:Request,id:string) {
  requireAdmin(await identity(request));await collection().doc(id).delete();return jsonResponse({message:'Notification deleted successfully',id});
}
