import {reconcileVerifiedEmail} from './verified-email';
import {createHash} from 'node:crypto';
import 'server-only';
import {verifiedMobile,validContact,discoverFor} from './relationship-links';
import {indianMobile} from '@/lib/indian-phone';
import {authorizeContactRepair,canonicalMobile,reconcileMobileConfirmation,writeUserWithMobile} from '../mobile-registry';
import {AccessError,requireUser} from '../auth';
import {COLLECTIONS,getDatabase} from '../firestore';
import {getFirebaseAdminAuth} from '../firebase-admin';
import {ApiError,jsonResponse} from '../http';
import {authMetadata,recordAuthActivity} from './auth-activity';
import {isRecord,stringValue as s,wireValue,type RecordData} from './contracts';
import {stageUserEvent,dispatchNotificationIntents} from './transactional-email';

const users=()=>getDatabase().collection(COLLECTIONS.users);
const clean=(value:unknown,max:number)=>s(value).trim().replace(/\s+/g,' ').slice(0,max);
const url=(value:unknown)=>{const candidate=clean(value,500);if(!candidate)return '';try{const parsed=new URL(candidate);if(parsed.protocol!=='https:')throw new Error();return parsed.href;}catch{throw new ApiError(400,'Profile photo and website links must use a valid HTTPS URL');}};
const displayRole=(role:string)=>role==='admin'?'Administrator':role==='agent'?'Real Estate Agent':'Individual';
const notify=async(input:{uid:string;eventType:string;eventId:string;subject:string;title:string;body:string;previousEmail?:string})=>{
  const recipients:Array<{uid?:string;role:string;email?:string}>=[{uid:input.uid,role:'user'}];
  if(input.previousEmail)recipients.push({role:'previous_email',email:input.previousEmail});
  const event={eventType:input.eventType,eventId:input.eventId,recipients,recordId:input.uid,templateId:'account-security',subject:input.subject,title:input.title,bodyHtml:`<p>${input.body}</p><p>If you did not make this change, reset your password and contact PropBank support.</p>`,bodyText:`${input.body} If you did not make this change, reset your password and contact PropBank support.`,action:{label:'Review your account',path:'/my-account'}};
  const id=createHash('sha256').update(input.eventId).digest('hex');let intentId='';
  await getDatabase().runTransaction(async tx=>{const ref=getDatabase().collection('auth_activity').doc(id),existing=await tx.get(ref),intent=await stageUserEvent(tx,event);intentId=intent.id;intent.write();if(!existing.exists)tx.create(ref,{id,eventType:input.eventType.replace('user.',''),actorUID:input.uid,targetUID:input.uid,context:{source:'firebase-client'},createdAt:new Date()});});dispatchNotificationIntents([intentId]);
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
  await reconcileVerifiedEmail(request);
  const {uid,profile,account,identity}=await self(request);const current={...profile};
  const firebaseEmail=(account.email||'').trim().toLowerCase();
  const metadata=authMetadata(account),activity=await activityFor(uid);
  return jsonResponse({success:true,account:wireValue({name:s(current.name),email:firebaseEmail||s(current.email),phoneNumber:s(current.phoneNumber),phoneVerified:!!await verifiedMobile(identity),photoURL:s(current.photoURL),role:s(current.role),roleLabel:displayRole(s(current.role)),isActive:current.isActive!==false,agencyName:s(current.agencyName),agencyPhone:s(current.agencyPhone),agencyWebsite:s(current.agencyWebsite),bio:s(current.bio),notificationPreferences:isRecord(current.notificationPreferences)?current.notificationPreferences:{productUpdates:true,activitySummaries:true,security:true},...metadata,activity})});
}

export async function updateMyAccount(request:Request){
  const {uid,ref,profile,account,identity}=await self(request);let body:RecordData;
  try{const raw:unknown=await request.json();if(!isRecord(raw))throw new Error();body=raw;}catch{throw new ApiError(400,'Invalid account update');}
  const allowed=new Set(['name','phoneNumber','photoURL','bio','agencyName','agencyPhone','agencyWebsite','notificationPreferences']);
  if(Object.keys(body).some(key=>!allowed.has(key)))throw new ApiError(400,'Account role, status and email cannot be changed through profile settings');
  const name=clean(body.name,100);if(name.length<2)throw new ApiError(400,'Enter a valid full name');
  const submitted='phoneNumber' in body?body.phoneNumber:profile.phoneNumber;
  const unchanged=submitted===profile.phoneNumber||!!indianMobile(submitted)&&indianMobile(submitted)===indianMobile(profile.phoneNumber);
  const phone=unchanged?s(profile.phoneNumber):canonicalMobile(submitted);
  const oldPhone=s(profile.phoneNumber),phoneChanged=phone!==oldPhone&&(!indianMobile(phone)||indianMobile(phone)!==indianMobile(oldPhone));
  if(phoneChanged){
    if(!indianMobile(oldPhone))authorizeContactRepair(identity.token);
    else {
    const authenticatedAt=Number(identity.token.auth_time||0),verifiedPhone=clean(identity.token.phone_number,20).replace(/[^0-9+]/g,'');
    if(!authenticatedAt||Date.now()/1000-authenticatedAt>300)throw new AccessError(403,'Recent authentication is required to change the mobile number');
    validContact(phone);
    if(!verifiedPhone||indianMobile(verifiedPhone)!==indianMobile(phone)||await verifiedMobile(identity)!==indianMobile(phone))throw new ApiError(503,'Phone verification is not configured or the new number has not been verified');
    }
  }
  const preferences=isRecord(body.notificationPreferences)?{productUpdates:body.notificationPreferences.productUpdates!==false,activitySummaries:body.notificationPreferences.activitySummaries!==false,security:true}:isRecord(profile.notificationPreferences)?profile.notificationPreferences:{productUpdates:true,activitySummaries:true,security:true};
  const updates:RecordData={name,phoneNumber:phone,photoURL:url(body.photoURL),bio:clean(body.bio,500),notificationPreferences:preferences,updatedAt:new Date()};
  if(s(profile.role)==='agent')Object.assign(updates,{agencyName:clean(body.agencyName,120),agencyPhone:clean(body.agencyPhone,20).replace(/[^0-9+]/g,''),agencyWebsite:url(body.agencyWebsite)});
  const changed=Object.keys(updates).filter(key=>key!=='updatedAt'&&JSON.stringify(updates[key])!==JSON.stringify(profile[key]));
  if(!changed.length){await reconcileMobileConfirmation(uid,profile);return jsonResponse({success:true,message:'No account changes were needed'});}
  const intentIds:string[]=[];await writeUserWithMobile(uid,updates,{expectedPhone:profile.phoneNumber,repairContact:phoneChanged&&!indianMobile(oldPhone),metadataOnly:!phoneChanged,stage:async tx=>{const intent=await stageUserEvent(tx,{actorUID:uid,eventType:phoneChanged?'user.mobile_number_changed':'user.profile_changed',eventId:`${uid}:${(updates.updatedAt as Date).getTime()}`,recipients:[{uid,role:'user'},{role:'admin',email:process.env.ADMIN_EMAIL}],recordId:uid,templateId:'account-security',subject:'Your PropBank profile changed',title:'Account profile updated',bodyHtml:'<p>Your PropBank account profile was changed. If this was unexpected, review your account.</p>',bodyText:'Your PropBank account profile was changed. If this was unexpected, review your account.',action:{label:'Review account',path:'/my-account'}});intentIds.push(intent.id);return intent.write;}});dispatchNotificationIntents(intentIds);
  try{if(name!==account.displayName||updates.photoURL!==account.photoURL)await getFirebaseAdminAuth().updateUser(uid,{displayName:name,photoURL:s(updates.photoURL)||null});}
  catch(error){await ref.set({name:profile.name||'',photoURL:profile.photoURL||'',updatedAt:profile.updatedAt||new Date()},{merge:true});throw error;}
  await recordAuthActivity({eventType:phoneChanged?'phone_changed':changed.length===1&&changed[0]==='notificationPreferences'?'notification_preferences_changed':'profile_changed',actorUID:uid,targetUID:uid,context:{source:'self'}}).catch(()=>null);
  await discoverFor(identity);
  return jsonResponse({success:true,message:'Account profile updated'});
}

export async function recordAccountSecurityEvent(request:Request){
  const {uid,identity}=await self(request);let body:RecordData;try{const raw:unknown=await request.json();if(!isRecord(raw))throw new Error();body=raw;}catch{throw new ApiError(400,'Invalid security event');}
  const action=s(body.action),operationId=clean(body.operationId,100),authenticatedAt=Number(identity.token.auth_time||0);
  if(!/^[0-9a-f-]{36}$/i.test(operationId))throw new ApiError(400,'A valid security operation reference is required');
  if(!authenticatedAt||Date.now()/1000-authenticatedAt>300)throw new AccessError(403,'Recent authentication is required for security changes');
  if(action==='password_changed'){
    await notify({uid,eventType:'user.password_changed',eventId:`user:${uid}:password:${operationId}`,subject:'Your PropBank password changed',title:'Password changed',body:'The password for your PropBank account was changed successfully.'});
  }else if(action==='email_change_requested'){
    await notify({uid,eventType:'user.email_change_requested',eventId:`user:${uid}:email-request:${operationId}`,subject:'PropBank email change requested',title:'Email change requested',body:'A request was made to change the email address for your PropBank account. The address will not change until Firebase verification is completed.'});
  }else throw new ApiError(400,'Unsupported security event');
  return jsonResponse({success:true,message:'Security activity recorded'});
}
