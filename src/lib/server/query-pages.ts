import {recordRead} from './read-budget';
import 'server-only';
import {FieldPath} from 'firebase-admin/firestore';
import {ApiError} from './http';
import {getDatabase,COLLECTIONS} from './firestore';
import {isPropertyTenant} from './permissions';
import type {AuthenticatedUser} from './auth';
import type {RecordData} from './services/contracts';
export const validId=(id:string)=>!!id&&id.length<=1500&&!id.includes('/');
export function pageOptions(params:URLSearchParams,maximum=100){const size=Number(params.get('pageSize')||50),cursor=params.get('cursor')||'';if(!Number.isInteger(size)||size<1||size>maximum||cursor&&!validId(cursor))throw new ApiError(400,'Invalid page size or cursor');return {size,cursor};}
export async function documentPage(query:FirebaseFirestore.Query,size:number,cursor='',direction:'asc'|'desc'='asc'){
 let q=query.orderBy('__name__',direction).limit(size+1);if(cursor)q=q.startAfter(cursor);const result=await q.get();recordRead('query_page',result.docs.length);const docs=result.docs.slice(0,size);return {docs,nextCursor:result.docs.length>size?docs.at(-1)!.id:null,examined:result.docs.length};
}
/** Request-local only: batched reads never cache another account's documents. */
export async function documentsById(collection:string,ids:string[]){const result=new Map<string,RecordData>();const unique=[...new Set(ids)].filter(validId);for(let i=0;i<unique.length;i+=30){const page=await getDatabase().collection(collection).where(FieldPath.documentId(),'in',unique.slice(i,i+30)).get();for(const doc of page.docs)result.set(doc.id,{...doc.data(),id:doc.id});}return result;}
type AccessCursor={own:string|null;submitted:string|null;tenant:string|null;legacy:string|null};
/** Canonical indexed paths first; legacy embedded-only memberships retain bounded continuation. */
export async function memberPropertyPage(user:AuthenticatedUser,cursor='',includeOwned=true,size=25,legacyRoot=false){
 if(cursor.length>10000)throw new ApiError(400,'Invalid membership cursor');
 const member=(p:RecordData)=>isPropertyTenant(user,{...p,tenants:Array.isArray(p.tenants)&&p.tenants.length?p.tenants:legacyRoot?[{email:p.tenantEmail,isActive:p.rentalStatus==='rented'}]:[]});
 const db=getDatabase(),base=db.collection(COLLECTIONS.properties);let state:AccessCursor={own:includeOwned?'':null,submitted:includeOwned&&user.role==='agent'?'':null,tenant:'',legacy:''};
 if(cursor){try{const value=JSON.parse(Buffer.from(cursor,'base64url').toString());if(value.uid!==user.uid||value.owned!==includeOwned||!value.state||Array.isArray(value.state)||Object.keys(value.state).length!==4||!includeOwned&&value.state.own!==null||!(includeOwned&&user.role==='agent')&&value.state.submitted!==null||Object.keys(state).some(k=>value.state[k]!==null&&typeof value.state[k]!=='string'||value.state[k]&&!validId(value.state[k])))throw Error();state=value.state;}catch{throw new ApiError(400,'Invalid membership page cursor');}}
 const rows=new Map<string,RecordData>();
 if(state.own!==null){const page=await documentPage(base.where('ownerUID','==',user.uid),size,state.own);for(const d of page.docs)rows.set(d.id,{...d.data(),id:d.id});state.own=page.nextCursor;}
 if(state.submitted!==null){const page=await documentPage(base.where('submittedByUID','==',user.uid),size,state.submitted);for(const d of page.docs){const p=d.data();if(p.ownerUID!==user.uid&&p.listingType!=='manage')rows.set(d.id,{...p,id:d.id});}state.submitted=page.nextCursor;}
 if(state.tenant!==null){let query=db.collection(COLLECTIONS.tenants).where('userUID','==',user.uid).where('isActive','==',true).orderBy('propertyId').limit(size+1);if(state.tenant){let value:unknown;try{value=JSON.parse(Buffer.from(state.tenant,'base64url').toString());if(typeof value!=='string'&&typeof value!=='number'&&value!==null)throw Error();}catch{throw new ApiError(400,'Invalid tenancy page cursor');}query=query.startAfter(value);}const page=await query.get(),docs=page.docs.slice(0,size),linked=await documentsById(COLLECTIONS.properties,docs.map(d=>String(d.data().propertyId||'')));for(const [id,p] of linked)if(p.listingType!=='manage'&&!(includeOwned&&p.ownerUID===user.uid)&&!(includeOwned&&user.role==='agent'&&p.submittedByUID===user.uid)&&member(p))rows.set(id,p);state.tenant=page.docs.length>size?Buffer.from(JSON.stringify(docs.at(-1)!.data().propertyId)).toString('base64url'):null;}
 if(state.legacy!==null){const page=await documentPage(base,size,state.legacy);state.legacy=page.nextCursor;const candidates=page.docs.filter(d=>{const p=d.data();return p.listingType!=='manage'&&!(includeOwned&&p.ownerUID===user.uid)&&!(includeOwned&&user.role==='agent'&&p.submittedByUID===user.uid)&&member(p);});
  const canonical=new Set<string>();for(let offset=0;offset<candidates.length;offset+=30){const ids=candidates.slice(offset,offset+30).map(d=>d.id),links=await db.collection(COLLECTIONS.tenants).where('userUID','==',user.uid).where('isActive','==',true).where('propertyId','in',ids).limit(1501).get();if(links.docs.length===1501)throw new ApiError(409,'Too many matching tenancy records; refine the membership query');for(const d of links.docs)canonical.add(String(d.data().propertyId));}
  for(const d of candidates)if(!canonical.has(d.id))rows.set(d.id,{...d.data(),id:d.id});
 }
 const nextCursor=Object.values(state).some(v=>v!==null)?Buffer.from(JSON.stringify({uid:user.uid,owned:includeOwned,state})).toString('base64url'):null;
 return {properties:[...rows.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id))),nextCursor,coverageComplete:!nextCursor,legacyCompatibilityScan:true};
}
