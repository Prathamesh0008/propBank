import 'server-only';
import {verifiedMobile,validContact,discoverFor} from './relationship-links';
import {indianMobile} from '@/lib/indian-phone';
import {AccessError,requireUser} from '../auth';
import {COLLECTIONS,getDatabase} from '../firestore';
import {getFirebaseAdminAuth} from '../firebase-admin';
import {ApiError,jsonResponse} from '../http';
import {authMetadata,recordAuthActivity} from './auth-activity';
import {isRecord,stringValue as s,wireValue,type RecordData} from './contracts';
import {brandedEmail,dispatchEmailOutbox,persistUserEvent,writeEmailOutbox,type TransactionalEmailEvent} from './transactional-email';

const users=()=>getDatabase().collection(COLLECTIONS.users);
const clean=(value:unknown,max:number)=>s(value).trim().replace(/\s+/g,' ').slice(0,max);
const url=(value:unknown)=>{const candidate=clean(value,500);if(!candidate)return '';try{const parsed=new URL(candidate);if(parsed.protocol!=='https:')throw new Error();return parsed.href;}catch{throw new ApiError(400,'Profile photo and website links must use a valid HTTPS URL');}};
const displayRole=(role:string)=>role==='admin'?'Administrator':role==='agent'?'Real Estate Agent':'Individual';
const notify=async(input:{uid:string;eventType:string;eventId:string;subject:string;title:string;body:string;previousEmail?:string})=>{
  const recipients:Array<{uid?:string;role:string;email?:string}>=[{uid:input.uid,role:'user'}];
  if(input.previousEmail)recipients.push({role:'previous_email',email:input.previousEmail});
  await persistUserEvent({eventType:input.eventType,eventId:input.eventId,recipients,recordId:input.uid,templateId:'account-security',subject:input.subject,title:input.title,bodyHtml:`<p>${input.body}</p><p>If you did not make this change, reset your password and contact PropBank support.</p>`,bodyText:`${input.body} If you did not make this change, reset your password and contact PropBank support.`,action:{label:'Review your account',path:'/my-account'}}).catch(()=>null);
};

async function self(request:Request){
  const identity=await requireUser(request),uid=identity.uid,ref=users().doc(uid);
  // requireUser already retrieved and validated this profile. Keep one
  // authoritative read per request rather than immediately reading it again.
  const profile=identity.profile;if(!profile)throw new AccessError(403,'Active user profile required');
  if(profile.isActive===false)throw new AccessError(403,'Active user profile required');
  const account=await getFirebaseAdminAuth().getUser(uid);if(account.disabled)throw new AccessError(403,'Active user profile required');
  return {identity,uid,ref,profile,account};
}

async function activityFor(uid:string){
  const snapshot=await getDatabase().collection('auth_activity').where('targetUID','==',uid).get();
  const rows:RecordData[]=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
  return rows.sort((a,b)=>+new Date(wireValue(b.createdAt) as string)-+new Date(wireValue(a.createdAt) as string)).slice(0,100).map(value=>wireValue(value));
}

export async function readMyAccount(request:Request){
  const {uid,ref,profile,account,identity}=await self(request);let current={...profile};
  const firebaseEmail=(account.email||'').trim().toLowerCase(),storedEmail=s(profile.email).trim().toLowerCase();
  // Firebase is authoritative for a completed verified email change. Sync only
  // after Firebase marks the new address verified; a pending verification never
  // changes the persisted profile or emits a completion notification.
  if(account.emailVerified&&firebaseEmail&&firebaseEmail!==storedEmail){
    const now=new Date(),eventId=`user:${uid}:email:${firebaseEmail}`,content=brandedEmail('Email address changed','<p>The verified email address for your PropBank account was changed.</p><p>If you did not make this change, reset your password and contact PropBank support.</p>','The verified email address for your PropBank account was changed. If you did not make this change, reset your password and contact PropBank support.',{label:'Review your account',path:'/my-account'});
    const events:TransactionalEmailEvent[]=[{eventType:'user.email_changed',eventId,recipientUID:uid,recipientRole:'user',recipientEmail:firebaseEmail,recordId:uid,templateId:'account-security',templateVersion:1,subject:'Your PropBank email address changed',idempotencyKey:`${eventId}:new`,...content},...(storedEmail?[{eventType:'user.email_changed',eventId,recipientRole:'previous_email',recipientEmail:storedEmail,recordId:uid,templateId:'account-security',templateVersion:1,subject:'Your PropBank email address changed',idempotencyKey:`${eventId}:previous`,...content} as TransactionalEmailEvent]:[])];
    await getDatabase().runTransaction(async tx=>{tx.set(ref,{email:firebaseEmail,emailVerified:true,updatedAt:now},{merge:true});writeEmailOutbox(tx,events);});dispatchEmailOutbox(events);
    await recordAuthActivity({eventType:'email_changed',actorUID:uid,targetUID:uid,context:{source:'firebase'}}).catch(()=>null);
    current={...current,email:firebaseEmail,emailVerified:true,updatedAt:now};
  }
  const metadata=authMetadata(account),activity=await activityFor(uid);
  return jsonResponse({success:true,account:wireValue({name:s(current.name),email:firebaseEmail||s(current.email),phoneNumber:s(current.phoneNumber),phoneVerified:!!await verifiedMobile(identity),photoURL:s(current.photoURL),role:s(current.role),roleLabel:displayRole(s(current.role)),isActive:current.isActive!==false,agencyName:s(current.agencyName),agencyPhone:s(current.agencyPhone),agencyWebsite:s(current.agencyWebsite),bio:s(current.bio),notificationPreferences:isRecord(current.notificationPreferences)?current.notificationPreferences:{productUpdates:true,activitySummaries:true,security:true},...metadata,activity})});
}

export async function updateMyAccount(request:Request){
  const {uid,ref,profile,account,identity}=await self(request);let body:RecordData;
  try{const raw:unknown=await request.json();if(!isRecord(raw))throw new Error();body=raw;}catch{throw new ApiError(400,'Invalid account update');}
  const allowed=new Set(['name','phoneNumber','photoURL','bio','agencyName','agencyPhone','agencyWebsite','notificationPreferences']);
  if(Object.keys(body).some(key=>!allowed.has(key)))throw new ApiError(400,'Account role, status and email cannot be changed through profile settings');
  const name=clean(body.name,100);if(name.length<2)throw new ApiError(400,'Enter a valid full name');
  const phone=clean(body.phoneNumber,20).replace(/[^0-9+]/g,'');
  const oldPhone=s(profile.phoneNumber),phoneChanged=phone!==oldPhone&&(!indianMobile(phone)||indianMobile(phone)!==indianMobile(oldPhone));
  if(phoneChanged){
    const authenticatedAt=Number(identity.token.auth_time||0),verifiedPhone=clean(identity.token.phone_number,20).replace(/[^0-9+]/g,'');
    if(!authenticatedAt||Date.now()/1000-authenticatedAt>300)throw new AccessError(403,'Recent authentication is required to change the mobile number');
    validContact(phone);
    if(!verifiedPhone||indianMobile(verifiedPhone)!==indianMobile(phone)||await verifiedMobile(identity)!==indianMobile(phone))throw new ApiError(503,'Phone verification is not configured or the new number has not been verified');
    if(phone){const duplicate=await users().where('phoneNumber','==',phone).limit(1).get();if(duplicate.docs.some(doc=>doc.id!==uid))throw new ApiError(409,'This phone number is already registered with another account');}
  }
  const preferences=isRecord(body.notificationPreferences)?{productUpdates:body.notificationPreferences.productUpdates!==false,activitySummaries:body.notificationPreferences.activitySummaries!==false,security:true}:isRecord(profile.notificationPreferences)?profile.notificationPreferences:{productUpdates:true,activitySummaries:true,security:true};
  const updates:RecordData={name,phoneNumber:phone,photoURL:url(body.photoURL),bio:clean(body.bio,500),notificationPreferences:preferences,updatedAt:new Date()};
  if(s(profile.role)==='agent')Object.assign(updates,{agencyName:clean(body.agencyName,120),agencyPhone:clean(body.agencyPhone,20).replace(/[^0-9+]/g,''),agencyWebsite:url(body.agencyWebsite)});
  const changed=Object.keys(updates).filter(key=>key!=='updatedAt'&&JSON.stringify(updates[key])!==JSON.stringify(profile[key]));
  if(!changed.length)return jsonResponse({success:true,message:'No account changes were needed'});
  await ref.set(updates,{merge:true});
  try{if(name!==account.displayName||updates.photoURL!==account.photoURL)await getFirebaseAdminAuth().updateUser(uid,{displayName:name,photoURL:s(updates.photoURL)||null});}
  catch(error){await ref.set({name:profile.name||'',photoURL:profile.photoURL||'',updatedAt:profile.updatedAt||new Date()},{merge:true});throw error;}
  await recordAuthActivity({eventType:phoneChanged?'phone_changed':changed.length===1&&changed[0]==='notificationPreferences'?'notification_preferences_changed':'profile_changed',actorUID:uid,targetUID:uid,context:{source:'self'}}).catch(()=>null);
  if(phoneChanged)await notify({uid,eventType:'user.mobile_number_changed',eventId:`user:${uid}:phone:${phone}`,subject:'Your PropBank mobile number changed',title:'Mobile number changed',body:'The verified mobile number for your PropBank account was changed.'});
  if(changed.includes('name'))await notify({uid,eventType:'user.full_name_changed',eventId:`user:${uid}:name:${String(updates.updatedAt instanceof Date?updates.updatedAt.getTime():Date.now())}`,subject:'Your PropBank profile name changed',title:'Profile name changed',body:'The full name on your PropBank profile was changed.'});
  if(s(profile.role)==='agent'&&changed.some(key=>['agencyName','agencyPhone','agencyWebsite'].includes(key)))await notify({uid,eventType:'agent.profile_changed',eventId:`agent:${uid}:profile:${String(updates.updatedAt instanceof Date?updates.updatedAt.getTime():Date.now())}`,subject:'Your PropBank agency profile changed',title:'Agency profile changed',body:'Important agency details on your PropBank profile were updated.'});
  await discoverFor(identity);
  return jsonResponse({success:true,message:'Account profile updated'});
}

export async function recordAccountSecurityEvent(request:Request){
  const {uid,identity}=await self(request);let body:RecordData;try{const raw:unknown=await request.json();if(!isRecord(raw))throw new Error();body=raw;}catch{throw new ApiError(400,'Invalid security event');}
  const action=s(body.action),operationId=clean(body.operationId,100),authenticatedAt=Number(identity.token.auth_time||0);
  if(!/^[0-9a-f-]{36}$/i.test(operationId))throw new ApiError(400,'A valid security operation reference is required');
  if(!authenticatedAt||Date.now()/1000-authenticatedAt>300)throw new AccessError(403,'Recent authentication is required for security changes');
  if(action==='password_changed'){
    await recordAuthActivity({eventType:'password_changed',actorUID:uid,targetUID:uid,context:{source:'firebase-client'}});
    await notify({uid,eventType:'user.password_changed',eventId:`user:${uid}:password:${operationId}`,subject:'Your PropBank password changed',title:'Password changed',body:'The password for your PropBank account was changed successfully.'});
  }else if(action==='email_change_requested'){
    await recordAuthActivity({eventType:'email_change_requested',actorUID:uid,targetUID:uid,context:{source:'firebase-client'}});
    await notify({uid,eventType:'user.email_change_requested',eventId:`user:${uid}:email-request:${operationId}`,subject:'PropBank email change requested',title:'Email change requested',body:'A request was made to change the email address for your PropBank account. The address will not change until Firebase verification is completed.'});
  }else throw new ApiError(400,'Unsupported security event');
  return jsonResponse({success:true,message:'Security activity recorded'});
}
