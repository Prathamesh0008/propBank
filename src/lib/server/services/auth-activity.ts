import 'server-only';
import {randomUUID} from 'node:crypto';
import type {DecodedIdToken,UserRecord} from 'firebase-admin/auth';
import {AccessError,requireUser} from '../auth';
import {COLLECTIONS,getDatabase} from '../firestore';
import {getFirebaseAdminAuth} from '../firebase-admin';
import {ApiError,jsonResponse} from '../http';
import {isRecord,stringValue as s,type RecordData,wireValue} from './contracts';

const collection=()=>getDatabase().collection('auth_activity');
const permitted=new Set(['registration','session_established','password_reset_requested','password_changed','account_linked','profile_changed','phone_changed','email_change_requested','email_changed','notification_preferences_changed','account_status_changed','role_changed']);

export async function recordAuthActivity(event:{eventType:string;actorUID?:string;targetUID?:string;context?:RecordData}){
  if(!permitted.has(event.eventType))throw new Error('Unsupported authentication activity');
  const now=new Date(),id=randomUUID(),context=Object.fromEntries(Object.entries(event.context||{}).filter(([key,value])=>['providerIds','emailVerified','previousRole','role','previousStatus','status','source'].includes(key)&&(['string','boolean'].includes(typeof value)||Array.isArray(value))));
  const value={id,eventType:event.eventType,actorUID:event.actorUID||'',targetUID:event.targetUID||'',context,createdAt:now};
  await collection().doc(id).create(value);
  if(event.targetUID){const snapshot=await collection().where('targetUID','==',event.targetUID).get(),rows=snapshot.docs.map(doc=>({doc,at:+new Date(doc.data().createdAt?.toDate?.()||doc.data().createdAt||0)})).sort((a,b)=>b.at-a.at);for(const row of rows.slice(100))await row.doc.ref.delete();}
  return value;
}

export function authMetadata(account:UserRecord){return {emailVerified:account.emailVerified,accountStatus:account.disabled?'disabled':'active',providerIds:[...new Set(account.providerData.map(provider=>provider.providerId))],createdAt:account.metadata.creationTime||'',lastSuccessfulSignInAt:account.metadata.lastSignInTime||''};}

export async function syncAuthenticationProfile(uid:string,token:DecodedIdToken,eventType:'registration'|'session_established'|'account_linked'){
  const account=await getFirebaseAdminAuth().getUser(uid),metadata=authMetadata(account),now=new Date(),ref=getDatabase().collection(COLLECTIONS.users).doc(uid),snapshot=await ref.get();
  if(!snapshot.exists)throw new AccessError(403,'Complete account registration before signing in');
  await ref.set({...metadata,lastSuccessfulSignInAt:eventType==='session_established'?now:metadata.lastSuccessfulSignInAt,updatedAt:now},{merge:true});
  await recordAuthActivity({eventType,actorUID:uid,targetUID:uid,context:{providerIds:metadata.providerIds,emailVerified:metadata.emailVerified,source:'firebase'}});
  return metadata;
}

export async function authenticationActivity(request:Request){
  let body:RecordData;try{const raw:unknown=await request.json();if(!isRecord(raw))throw new Error();body=raw;}catch{throw new ApiError(400,'Invalid authentication activity request');}
  const action=s(body.action);
  if(action==='password_reset_requested'){
    const email=s(body.email).trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return jsonResponse({success:true,message:'If the account exists, password reset instructions will be sent.'});
    try{const account=await getFirebaseAdminAuth().getUserByEmail(email);await recordAuthActivity({eventType:'password_reset_requested',targetUID:account.uid,context:{source:'firebase-client-request'}});}catch(error){if((error as {code?:string}).code!=='auth/user-not-found')throw error;}
    return jsonResponse({success:true,message:'If the account exists, password reset instructions will be sent.'});
  }
  if(!['session_established','account_linked'].includes(action))throw new ApiError(400,'Unsupported authentication activity');
  const user=await requireUser(request),token=user.token;const metadata=await syncAuthenticationProfile(token.uid,token,action as 'session_established'|'account_linked');
  return jsonResponse({success:true,authentication:wireValue(metadata)});
}

