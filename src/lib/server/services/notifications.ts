import {publicListing} from '../../listing-policy';
import 'server-only';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getDatabase, COLLECTIONS } from '../firestore';
import { AccessError,type AuthenticatedUser } from '../auth';
import {prepareFile,saveMediaRecord,prepareMediaBindings,restoreFileReferences} from './media';
import {persistInquiry} from './enquiry-protection';
import { requireAdmin, requireSelfOrAdmin, requireOwnerOrAdmin } from '../permissions';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readModel, readObject, knownFields, parseRFC3339, firestoreTime, goTimeString, epoch } from './domain-contracts';
import { getProperty } from './properties';
import { getUser } from './users';
import { bestEffort, escapeHtml } from './property-effects';
import {persistUserEvent} from './transactional-email';
import { inquiryMail } from './group2-mail';
const collection=()=>getDatabase().collection(COLLECTIONS.adminNotifications);
export async function createNotification(input:RecordData,actor?:AuthenticatedUser) {
  const req=model('CreateAdminNotificationRequest',input);const now=new Date();
  const valid=parseRFC3339(req.timestamp);
  const notification=model('AdminNotification',{...req,id:randomUUID(),timestamp:valid?goTimeString(req.timestamp):now,priority:req.priority||'medium',createdAt:now,updatedAt:now});
  const data={...storeModel('AdminNotification',notification),timestamp:valid?firestoreTime(req.timestamp):now,...(input.relatedId?{relatedId:input.relatedId}:{})};
  if(actor)await saveMediaRecord(COLLECTIONS.adminNotifications,s(notification.id),data,actor,true);else await collection().doc(s(notification.id)).create(data);return notification;
}
export async function postNotification(request:Request) {
  let req:RecordData;try{req=await readModel(request,'CreateAdminNotificationRequest',64<<10);}catch{return plainError('Invalid request body',400);}
  let actor:AuthenticatedUser|undefined;
  const publicInquiry=req.type==='general_inquiry'&&!req.userId&&!request.headers.get('Authorization');
  const allowed=['general_inquiry','property_enquiry','service_request','document_upload','other_service_request','legal_service_request','want_to_sell','want_to_sell_cancelled'];
  if(!publicInquiry) {
    const user=await identity(request);actor=user;if(req.userId)requireSelfOrAdmin(user,s(req.userId));
    if(user.role!=='admin'&&!allowed.includes(s(req.type)))throw new AccessError(403,'Internal notification types are server controlled');
    req.userId=user.uid;
    const profile=await getUser(user.uid);req.userName=profile?.name||'';req.userEmail=user.token.email||'';req.userPhone=profile?.phoneNumber||'';
    if(req.propertyId&&['want_to_sell','want_to_sell_cancelled'].includes(s(req.type))) {const property=await getProperty(s(req.propertyId));requireOwnerOrAdmin(user,{ownerUID:s(property?.ownerUID)});}
    if(req.propertyId&&['service_request','document_upload','other_service_request','legal_service_request'].includes(s(req.type))&&!await propertyMember(user,s(req.propertyId)))throw new ApiError(404,'Property not found');
  }
  if(req.type==='property_enquiry'&&req.propertyId) {const property=await getProperty(s(req.propertyId));if(!property)throw new ApiError(404,'Available property not found');if(!publicListing(property)&&actor)await propertyMember(actor,s(req.propertyId));}
  if(req.type==='general_inquiry') {
    req.userName=s(req.userName).trim();req.userEmail=s(req.userEmail).trim().toLowerCase();req.userPhone=s(req.userPhone).replace(/[\s()-]/g,'');
    req.propertyId='';req.serviceImage='';req.adminImage='';
    if(s(req.message).length>4000||s(req.title).length>200||!/^\+?\d{3,20}$/.test(s(req.userPhone)))throw new ApiError(400,'Enquiry details exceed the allowed size or phone format');
    if(!['buy','rent','sell'].includes(s(req.inquiryType))||!['residential','commercial','industrial'].includes(s(req.propertyType))||!s(req.userName).trim()||s(req.userName).length>200||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(req.userEmail))||s(req.userEmail).length>320||! /^[+\d\s()-]{3,30}$/.test(s(req.userPhone)))throw new ApiError(400,'Valid inquiry type, property type, name, email and phone are required');
    if(req.requestVisit&&(!parseRFC3339(`${s(req.visitDate)}T00:00:00Z`)||! /^(?:0[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/.test(s(req.visitTime))))throw new ApiError(400,'Valid visit date and time are required');
  }
  for(const key of ['ownerId','ownerName','ownerEmail','ownerPhone','ownerRole','tenantName','tenantEmail','tenantPhone','buyers','adminRemarks'])req[key]='';
  req.isRead=false;req.priority='medium';req.timestamp=new Date().toISOString();
  if(req.propertyId) {
    const property=await bestEffort(()=>getProperty(s(req.propertyId)));
    if(property) {
      if(property.title)req.propertyTitle=property.title;
      if(property.address||property.location)req.propertyAddress=property.address||property.location;
      if(property.listingType)req.propertyListingType=property.listingType;
      for(const [target,source] of [['ownerName','ownerName'],['ownerEmail','ownerEmail'],['ownerId','ownerUID']])if(property[source])req[target]=property[source];
      if(!req.ownerPhone&&property.ownerUID) {
        const owner=await bestEffort(()=>getUser(s(property.ownerUID)));
        if(owner){req.ownerPhone=owner.phoneNumber;if(!req.ownerEmail)req.ownerEmail=owner.email;if(!req.ownerName)req.ownerName=owner.name;}
      }
    }
  }
  if(req.userId&&!req.userPhone) {const user=await bestEffort(()=>getUser(s(req.userId)));if(user){req.userPhone=user.phoneNumber;if(!req.userEmail)req.userEmail=user.email;if(!req.userName)req.userName=user.name;}}
  let notification:RecordData,duplicate=false;
  if(req.type==='general_inquiry') {
    // General enquiries cannot smuggle private file/property references.
    req.propertyId='';req.serviceImage='';req.adminImage='';
    const now=new Date();
    const data=model('AdminNotification',{...req,id:randomUUID(),timestamp:now,createdAt:now,updatedAt:now});
    const saved=await persistInquiry(request,storeModel('AdminNotification',data));notification=model('AdminNotification',saved.notification);duplicate=saved.duplicate;
    if(!duplicate)await bestEffort(()=>inquiryMail(notification));
  }else {
    for(const field of ['serviceImage','adminImage'])if(req[field])req[field]=await prepareFile(s(req[field]),actor!,s(req.propertyId),field);
    notification=await createNotification(req,actor);
  }
  const visible=wireModel('AdminNotification',notification);
  for(const key of ['ownerEmail','ownerPhone','tenantEmail','tenantPhone','buyers'])visible[key]='';
  return jsonResponse({success:true,message:duplicate?'Enquiry already received':'Admin notification created successfully',duplicate,notification:visible},duplicate?200:201);
}
export async function listNotifications(request:Request) {
  const user=await identity(request);const params=new URL(request.url).searchParams;const propertyId=params.get('propertyId');
  let query=collection() as FirebaseFirestore.Query;
  if(propertyId) {if(!await propertyMember(user,propertyId))return plainError('Property not found',404);query=query.where('propertyId','==',propertyId);}
  else {requireAdmin(user);query=params.get('unread')==='true'?query.where('isRead','==',false):query.orderBy('timestamp','desc');}
  const snapshot=await query.get();let notifications:RecordData[]=[];
  for(const doc of snapshot.docs)try{const data=doc.data();notifications.push({...model('AdminNotification',data),id:doc.id,...(typeof data.relatedId==='string'?{relatedId:data.relatedId}:{})});}catch{/* Skip malformed legacy records. */}
  if(propertyId&&user.role!=='admin') {const property=await getProperty(propertyId);if(property?.ownerUID!==user.uid)notifications=notifications.filter(n=>n.userId===user.uid||['agreement_termination','agreement_renewal'].includes(s(n.type)));}
  notifications.sort((a,b)=>epoch(b.timestamp)-epoch(a.timestamp));return jsonResponse(notifications.map(n=>({...wireModel('AdminNotification',n),...(n.relatedId?{relatedId:n.relatedId}:{})})));
}
export async function readNotification(request:Request,id:string) {
  requireAdmin(await identity(request));let archive=true;
  if(Number(request.headers.get('Content-Length'))>0)try{const req=knownFields(await readObject(request),['action']);if(req.action==='unarchive')archive=false;}catch{/* Go ignores malformed optional bodies. */}
  const now=new Date();const action=archive?'archived':'unarchived';
  await collection().doc(id).update({isRead:archive,updatedAt:now,archiveHistory:FieldValue.arrayUnion({action,timestamp:now}),...(archive?{resolvedAt:now}:{})});
  return jsonResponse({message:`Notification ${action}`,id,action});
}
export async function remarksNotification(request:Request,id:string) {
  const actor=await identity(request);requireAdmin(actor);let req:RecordData;
  try{req=knownFields(await readObject(request),['remarks','adminImage']);for(const key of ['remarks','adminImage'])if(req[key]!=null&&typeof req[key]!=='string')throw new Error('Invalid string');}catch{return plainError('Invalid request body',400);}
  const remarks=s(req.remarks);let adminImage=s(req.adminImage);
  const before=await collection().doc(id).get();if(!before.exists)throw new ApiError(404,'Notification not found');
  restoreFileReferences(COLLECTIONS.adminNotifications,id,req,before.data()!);
  if(adminImage)adminImage=await prepareFile(s(req.adminImage),actor,s(before.data()?.propertyId),'response',s(before.data()?.adminImage));
  await saveMediaRecord(COLLECTIONS.adminNotifications,id,{...before.data(),adminRemarks:remarks,updatedAt:new Date(),...(adminImage?{adminImage}:{})},actor);
  const profile=before.data()?.userId?await getUser(s(before.data()?.userId)):null;
  if(profile?.email)await bestEffort(()=>persistUserEvent({eventType:'request.admin_response',eventId:`${id}:${String(before.data()?.updatedAt||'response')}:${remarks}`,recipients:[{uid:s(before.data()?.userId),role:'requester'}],propertyId:s(before.data()?.propertyId),recordId:id,templateId:'admin-response',subject:'Request response from PropBank',title:'PropBank request update',bodyHtml:`<p>${escapeHtml(remarks)}</p>`,bodyText:remarks,action:{label:'View your property',path:before.data()?.propertyId?`/manage-property/${s(before.data()?.propertyId)}`:'/manage-property'}}));
  return jsonResponse({success:true,message:'Admin remarks updated successfully',id,remarks,adminImage});
}
export async function deleteNotification(request:Request,id:string) {
  requireAdmin(await identity(request));await collection().doc(id).delete();return jsonResponse({message:'Notification deleted successfully',id});
}
