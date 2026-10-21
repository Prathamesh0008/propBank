import 'server-only';
import {createHash} from 'node:crypto';
import {getDatabase} from '../firestore';
import {ApiError} from '../http';

// Distributed Firestore transactions: limits and replay decisions survive restarts/instances.
// Raw IPs are never stored. Only trust an ingress header explicitly configured and stripped by the edge.
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function persistInquiry(request:Request,data:FirebaseFirestore.DocumentData,now=Date.now()) {
  const db=getDatabase(),minute=Math.floor(now/60000);
  const configured=process.env.ENQUIRY_TRUSTED_IP_HEADER;
  const header=configured&&['cf-connecting-ip','x-real-ip'].includes(configured)?configured:'';
  const peer=header?(request.headers.get(header)||'unknown').slice(0,100):'shared-untrusted-ingress';
  const contact=String(data.userEmail||'').trim().toLowerCase();
  const fields=['userId','userName','userEmail','userPhone','inquiryType','propertyType','requestVisit','visitDate','visitTime','message'];
  const fingerprint=hash(JSON.stringify(fields.map(key=>typeof data[key]==='string'?data[key].trim():data[key]??'')));
  const supplied=request.headers.get('Idempotency-Key');
  if(supplied&&!/^[a-zA-Z0-9_-]{16,128}$/.test(supplied))throw new ApiError(400,'Invalid enquiry idempotency key');
  const replay=db.collection('enquiry_controls').doc('replay-'+hash(contact+':'+(supplied||fingerprint)));
  const windows=[{key:'global',limit:60},{key:'peer:'+hash(peer),limit:header?10:60},{key:'contact:'+hash(contact),limit:5}];
  return db.runTransaction(async tx=>{
    const refs=windows.map(w=>db.collection('enquiry_controls').doc(hash(w.key+':'+minute)));
    const controls=await Promise.all(refs.map(ref=>tx.get(ref)));
    const previous=await tx.get(replay),old=previous.data();
    const stored=old?.notificationId?await tx.get(db.collection('admin_notifications').doc(old.notificationId)):null;
    for(let i=0;i<controls.length;i++)if((controls[i].data()?.count||0)>=windows[i].limit)throw new ApiError(429,'Too many enquiries. Please wait one minute before retrying');
    const duplicate=old&&Number(old.expiresAt)>now&&stored?.exists;
    if(duplicate&&old.fingerprint!==fingerprint)throw new ApiError(409,'Idempotency key was already used with different enquiry details');
    for(let i=0;i<controls.length;i++)tx.set(refs[i],{count:(controls[i].data()?.count||0)+1,expiresAt:new Date((minute+2)*60000),ttlAt:new Date((minute+2)*60000)});
    if(duplicate)return {notification:stored!.data()!,duplicate:true};
    tx.create(db.collection('admin_notifications').doc(data.id),data);
    tx.set(replay,{fingerprint,notificationId:data.id,expiresAt:now+10*60000,ttlAt:new Date(now+10*60000)});
    return {notification:data,duplicate:false};
  });
}
