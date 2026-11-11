import 'server-only';
import {createHash} from 'node:crypto';
import {AccessError,completedProfile,verifyFirebaseIdentity} from '../auth';
import {getFirebaseAdminAuth} from '../firebase-admin';
import {COLLECTIONS,getDatabase} from '../firestore';
import {brandedEmail,dispatchEmailOutbox,writeEmailOutbox,type TransactionalEmailEvent} from './transactional-email';

/** Only account/bootstrap entry points may reconcile a verified Firebase email.
 * Other protected routes retain the strict completed-profile gate. */
export async function reconcileVerifiedEmail(request:Request) {
 const token=await verifyFirebaseIdentity(request),account=await getFirebaseAdminAuth().getUser(token.uid);
 if(account.disabled)throw new AccessError(403,'Active user profile required','ACCOUNT_DISABLED');
 const email=(account.email||'').trim().toLowerCase();
 if(!account.emailVerified||token.email_verified!==true)throw new AccessError(403,'Verify your email before accessing PropBank','EMAIL_VERIFICATION_REQUIRED');
 if(!email||email!==(token.email||'').trim().toLowerCase())throw new AccessError(401,'Refresh your Firebase ID token before continuing','TOKEN_REFRESH_REQUIRED');
 const db=getDatabase(),ref=db.collection(COLLECTIONS.users).doc(token.uid);let committed:TransactionalEmailEvent[]=[];
 await db.runTransaction(async tx=>{
  committed=[];const snapshot=await tx.get(ref),profile=snapshot.data();
  // Preserve all non-email completion requirements, including role and mobile.
  if(!profile||!completedProfile(profile,{...token,email:profile.email}))throw new AccessError(403,'Complete your account profile before accessing PropBank','ACCOUNT_PROFILE_REQUIRED');
  const previous=String(profile.email||'').trim().toLowerCase();if(previous===email)return;
  const now=new Date(),eventId=`user:${token.uid}:email:${email}:${String(profile.updatedAt?.toDate?.()?.getTime?.()||new Date(profile.updatedAt||0).getTime())}`;
  const id=createHash('sha256').update(eventId).digest('hex'),activity=db.collection('auth_activity').doc(id),existing=await tx.get(activity);
  const content=brandedEmail('Email address changed','<p>Your verified PropBank email address changed. If this was unexpected, reset your password and contact support.</p>','Your verified PropBank email address changed. If this was unexpected, reset your password and contact support.',{label:'Review your account',path:'/my-account'});
  const events:TransactionalEmailEvent[]=[{eventType:'user.email_changed',eventId,recipientUID:token.uid,recipientRole:'user',recipientEmail:email,recordId:token.uid,templateId:'account-security',templateVersion:1,subject:'Your PropBank email address changed',idempotencyKey:`${id}:new`,...content},{eventType:'user.email_changed',eventId,recipientRole:'previous_email',recipientEmail:previous,recordId:token.uid,templateId:'account-security',templateVersion:1,subject:'Your PropBank email address changed',idempotencyKey:`${id}:previous`,...content}];
  if(existing.exists)throw new AccessError(403,'Account email reconciliation requires review');
  tx.update(ref,{email,emailVerified:true,updatedAt:now});
  tx.create(activity,{id,eventType:'email_changed',actorUID:token.uid,targetUID:token.uid,context:{source:'firebase'},createdAt:now});
  writeEmailOutbox(tx,events);committed=events;
 });
 if(committed.length)dispatchEmailOutbox(committed);
}
