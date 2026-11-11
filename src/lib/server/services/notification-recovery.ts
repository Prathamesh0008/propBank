import 'server-only';
import {COLLECTIONS,getDatabase} from '../firestore';
import {jsonResponse} from '../http';
import {identity} from './domain-contracts';
import {requireAdmin} from '../permissions';
import {requireCron} from './reminders';
import {recoverNotification} from './transactional-email';
import {wireValue} from './contracts';
/** No scheduler is activated by this module. Each call has a fixed read/send budget. */
export async function recoveryEndpoint(request:Request){
 requireCron(request);const db=getDatabase(),collection=db.collection(COLLECTIONS.emailDeliveries||'email_deliveries'),now=new Date(),state=collection.doc('_recovery_state');
 const report={attempted:0,failed:0,legacyScanned:0};
 const ready=await collection.where('status','in',['pending','failed','sending']).where('recoveryAt','<=',now).orderBy('recoveryAt').limit(8).get();
 for(const doc of ready.docs){if(report.attempted>=8)break;report.attempted++;try{const outcome=await recoverNotification(doc.id,false);if(outcome==='failed')report.failed++;if(outcome==='skipped')await db.runTransaction(async tx=>{const fresh=await tx.get(doc.ref),value=fresh.data();if(!value)return;const at=value.status==='sending'?value.deliveryLeaseUntil:value.status==='failed'?value.nextRetryAt:null;if(at&&new Date(wireValue(at) as string).getTime()>now.getTime())tx.update(doc.ref,{recoveryAt:at});});}catch{report.failed++;}}
 // A bounded resumable compatibility lane discovers pre-worker rows once. New rows
 // always have recoveryAt; the checkpoint never skips equal timestamps.
 const previous=(await state.get()).data()||{};let next=String(previous.legacyCursor||''),complete=previous.legacyComplete===true;
 if(!complete){let query=collection.orderBy('__name__').limit(10);if(next)query=query.startAfter(next);const page=await query.get();for(const doc of page.docs){report.legacyScanned++;const v=doc.data();if(['pending','failed','sending'].includes(v.status)&&!v.recoveryAt){try{await db.runTransaction(async tx=>{const fresh=await tx.get(doc.ref),value=fresh.data();if(value&&!value.recoveryAt&&['pending','failed','sending'].includes(value.status))tx.update(doc.ref,{recoveryAt:value.nextRetryAt||value.deliveryLeaseUntil||now});});}catch{report.failed++;break;}}next=doc.id;}complete=page.docs.length<10&&report.failed===0;}
 await state.set({kind:'recovery_monitor',lastRunAt:now,...(report.failed===0?{lastSuccessfulRunAt:now}:{}),report,legacyCursor:next,legacyComplete:complete},{merge:true});
 return jsonResponse({success:true,...report,legacyComplete:complete});
}
export async function recoveryOverview(request:Request){requireAdmin(await identity(request));const collection=getDatabase().collection(COLLECTIONS.emailDeliveries||'email_deliveries'),counts:Record<string,number>={};
 await Promise.all(['pending','sending','sent','failed','exhausted','permanent_failure','reconciliation_required'].map(async status=>{counts[status]=(await collection.where('status','==',status).count().get()).data().count;}));
 const retryEligible=(await collection.where('status','in',['pending','failed','sending']).where('recoveryAt','<=',new Date()).count().get()).data().count;
 const intents=(await collection.where('kind','==','notification_intent').where('status','in',['pending','failed','sending']).count().get()).data().count;
 const state=(await collection.doc('_recovery_state').get()).data()||{};return jsonResponse({success:true,counts,retryEligible,unprocessedIntents:intents,lastRunAt:wireValue(state.lastRunAt||null),lastSuccessfulRunAt:wireValue(state.lastSuccessfulRunAt||null),legacyComplete:state.legacyComplete===true});}
