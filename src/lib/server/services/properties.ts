import 'server-only';
import { randomInt } from 'node:crypto';
import type { Query, DocumentSnapshot } from 'firebase-admin/firestore';
import { AccessError, requireUser } from '../auth';
import { COLLECTIONS, SITE_SETTINGS_DOCUMENT, getDatabase } from '../firestore';
import { requireOwnerOrAdmin, requireSelfOrAdmin } from '../permissions';
import { jsonResponse, plainError } from '../http';
import { projections } from './go-contracts';
import { model, storeModel, propertyResponse, isRecord, stringValue as s, type RecordData } from './contracts';
import { findUser, getUser } from './users';
import { uploadPropertyImages } from './property-images';
import { bestEffort, propertyCreatedEffects, propertyUpdatedEffects } from './property-effects';

const properties = () => getDatabase().collection(COLLECTIONS.properties);
function fromDocument(doc:DocumentSnapshot,defaults=true):RecordData {
  const property=model('Property',doc.data() || {});
  if (defaults) {
    property.id=doc.id;
    if (!property.status) property.status=property.isActive?'active':'inactive';
  }
  return property;
}
async function queryProperties(query:Query,defaults=true):Promise<Array<{property:RecordData;raw:RecordData}>> {
  const snapshot=await query.get();
  const result:Array<{property:RecordData;raw:RecordData}>=[];
  for (const doc of snapshot.docs) {
    try { result.push({property:fromDocument(doc,defaults),raw:doc.data()}); } catch { /* Go skips invalid documents. */ }
  }
  return result;
}
export async function getProperty(id:string):Promise<RecordData|null> {
  const doc=await properties().doc(id).get();
  return doc.exists?fromDocument(doc):null;
}
const listResponse=(rows:RecordData[],extra:RecordData={})=>jsonResponse({success:true,properties:rows.length?rows:null,count:rows.length,...extra});
function available(property:RecordData,raw:RecordData) {
  return property.status!=='inactive' && property.isActive===true && !(property.listingType==='rent' && property.rentalStatus==='rented') && raw.isSold!==true && raw.isRented!==true;
}
async function tenantProperties(uid:string,email='') {
  const rows=await queryProperties(properties());
  return rows.filter(({property})=>Array.isArray(property.tenants) && property.tenants.some(t=>isRecord(t)&&t.isActive===true&&((uid&&t.userUID===uid)||(email&&s(t.email).toLowerCase()===email.toLowerCase())))).map(row=>row.property);
}
async function siteSettings():Promise<RecordData|null> {
  const defaults={quote:'Manage your properties and plan visits with ease',quoteAuthor:'',heroTitle:'Your Smart Hub for Property Management',heroSubtitle:'Manage, list your properties and find your dream house— all in one platform',announcementText:'',isAnnouncementActive:false,bannerImages:[]};
  try {
    const doc=await getDatabase().collection(COLLECTIONS.siteSettings).doc(SITE_SETTINGS_DOCUMENT).get();
    if (!doc.exists) return defaults;
    const data=doc.data() || {};
    const result:RecordData={};
    for (const key of ['quote','quoteAuthor','heroTitle','heroSubtitle','announcementText']) {
      if (data[key]!=null && typeof data[key]!=='string') return null;
      result[key]=data[key]??'';
    }
    if (data.isAnnouncementActive!=null && typeof data.isAnnouncementActive!=='boolean') return null;
    if (data.bannerImages!=null && (!Array.isArray(data.bannerImages)||data.bannerImages.some(v=>typeof v!=='string'))) return null;
    return {...result,isAnnouncementActive:data.isAnnouncementActive??false,bannerImages:data.bannerImages??[]};
  } catch { return defaults; }
}
export async function listProperties(request:Request) {
  const params=new URL(request.url).searchParams;
  const ownerUID=params.get('ownerUID') || '';
  if (ownerUID) {
    const user=await requireUser(request);
    requireSelfOrAdmin(user,ownerUID);
    const own=await queryProperties(properties().where('ownerUID','==',ownerUID));
    const rented=await bestEffort(()=>tenantProperties(ownerUID)) || [];
    const merged=new Map(own.map(({property})=>[s(property.id),propertyResponse(property,'normal','owner')]));
    for (const property of rented) if(!merged.has(s(property.id))) merged.set(s(property.id),propertyResponse(property,'tenant','tenant'));
    return listResponse([...merged.values()],{ownerUID});
  }
  const listingType=params.get('listingType')||'';
  let query:Query=properties().where('isActive','==',true);
  if (listingType) query=query.where('listingType','==',listingType);
  const rows=await queryProperties(query);
  const filtered=rows.filter(row=>params.get('all')==='true'||available(row.property,row.raw)).map(row=>propertyResponse(row.property));
  return listResponse(filtered,{...(await siteSettings() || {}),...(listingType?{listingType}:{})});
}
export async function searchProperties(request:Request) {
  const params=new URL(request.url).searchParams;
  const term=params.get('q')||'';
  const listingType=params.get('listingType')||'';
  const projectCondition=params.get('projectCondition')||'';
  let query:Query=properties().where('isActive','==',true);
  if (listingType) query=query.where('listingType','==',listingType);
  if (projectCondition) query=query.where('projectCondition','==',projectCondition);
  const rows=await queryProperties(query,false);
  const search=term.trim().toLowerCase();
  const filtered=rows.filter(({property,raw})=>{
    if (params.get('all')!=='true' && !available(property,raw)) return false;
    if (!term) return true;
    const fields=['location','address','city','state','title','propertyType','configuration','unitNumber','floor'];
    return fields.some(key=>!!s(property[key])&&s(property[key]).toLowerCase().includes(search)) || ['bhk','rk'].some(tag=>search.includes(tag)&&s(property.configuration).toLowerCase().includes(tag));
  }).map(row=>propertyResponse(row.property));
  return listResponse(filtered,{query:term,...(listingType?{listingType}:{})});
}
export async function listTenantProperties(request:Request) {
  const params=new URL(request.url).searchParams;
  const tenantUID=params.get('tenantUID')||'';
  const headerUID=request.headers.get('X-User-ID')||'';
  const email=params.get('userEmail')||'';
  if (!tenantUID&&!headerUID&&!email) return plainError('tenantUID, X-User-ID header, or userEmail parameter is required',400);
  const user=await requireUser(request);
  const uid=tenantUID||headerUID;
  if (uid) requireSelfOrAdmin(user,uid);
  const effectiveEmail=tenantUID?email:headerUID?'':email;
  if (effectiveEmail && user.role!=='admin' && user.token.email?.toLowerCase()!==effectiveEmail.toLowerCase()) throw new AccessError(403,'Access denied');
  const rows=await tenantProperties(uid,effectiveEmail);
  return listResponse(rows.map(property=>propertyResponse(property,'normal','tenant')));
}
export async function readProperty(_request:Request,id:string) {
  const property=await getProperty(id);
  return property?jsonResponse({success:true,property:propertyResponse(property)}):plainError('Property not found',404);
}
async function generateID() {
  for(let attempt=0;attempt<10;attempt++) {
    const id=Array.from({length:4},()=>String.fromCharCode(65+randomInt(26))).join('')+Array.from({length:4},()=>randomInt(10)).join('');
    if (!(await properties().doc(id).get()).exists) return id;
  }
  return properties().doc().id;
}
export async function createProperty(request:Request) {
  const user=await requireUser(request);
  let req:RecordData;
  try {
    const body:unknown=await request.json();
    if (body!==null&&!isRecord(body)) throw new Error('invalid request object');
    req=model('CreatePropertyRequest',(body||{}) as RecordData,true);
  } catch(error) { return plainError(`Invalid JSON: ${error instanceof Error?error.message:'invalid request'}`,400); }
  if (!req.propertyTitle||!req.propertyType||!req.location||!req.ownerUID) return plainError('Missing required fields: propertyTitle, propertyType, location, ownerUID',400);
  requireSelfOrAdmin(user,s(req.ownerUID));
  const owner=await getUser(s(req.ownerUID));
  if (!owner) return plainError('Owner not found',400);
  const id=await generateID();
  const property=model('Property',{});
  for(const [to,from] of projections.request) property[to]=req[from];
  Object.assign(property,{id,title:req.propertyTitle,address:req.location,tenantName:`${s(req.tenantFirstName)} ${s(req.tenantLastName)}`,images:await uploadPropertyImages((req.images as string[]|null)||[],id),ownerUID:req.ownerUID,ownerName:owner.name,ownerEmail:owner.email,ownerPhone:owner.phoneNumber,ownerRole:owner.role,status:'active',isActive:true});
  const now=new Date();
  if(req.rentalStatus==='rented') {
    let first=s(req.tenantFirstName),last=s(req.tenantLastName);
    if(!first&&!last&&req.tenantName) { const parts=s(req.tenantName).split(' '); first=parts[0];last=parts.slice(1).join(' '); }
    const tenant=model('TenantInfo',{firstName:first,lastName:last,email:req.tenantEmail,phone:req.mobileNumber,paymentDueDate:req.paymentDueDate,monthlyRent:req.monthlyRent,leaseStartDate:req.agreementStartDate,leaseEndDate:req.agreementEndDate,noticePeriod:req.noticePeriod,emergencyContact:req.tenantEmergencyContact,previousAddress:req.tenantPreviousAddress,employmentStatus:req.tenantEmploymentStatus,employer:req.tenantEmployer,monthlyIncome:req.tenantMonthlyIncome,isMarried:req.tenantIsMarried,spouse:req.tenantSpouse,rentSchedule:req.rentSchedule,isActive:true,createdAt:now.toISOString().slice(0,19)+'Z',updatedAt:now.toISOString().slice(0,19)+'Z'});
    if(req.tenantEmail) { const linked=await bestEffort(()=>findUser('email',s(req.tenantEmail))); if(linked) tenant.userUID=linked.uid; }
    property.tenants=[tenant];
  }
  if(req.isSold) property.buyers=[model('BuyerInfo',{id:`buyer_${BigInt(now.getTime())*1000000n}`,firstName:req.buyerFirstName,lastName:req.buyerLastName,phone:req.buyerPhone,isActive:true,createdAt:now,updatedAt:now})];
  property.createdAt=now;property.updatedAt=now;
  // Atomic create avoids overwriting a property on a race or infrastructure failure.
  await properties().doc(id).create(storeModel('Property',property));
  await propertyCreatedEffects(property);
  return jsonResponse({success:true,message:'Property created successfully',property:propertyResponse(property,'create')});
}
export async function updateProperty(request:Request,id:string) {
  const user=await requireUser(request);
  let req:RecordData;
  try { const body:unknown=await request.json(); if(body!==null&&!isRecord(body)) throw new Error(); req=(body||{}) as RecordData; } catch { return plainError('Invalid JSON',400); }
  const existing=await getProperty(id);
  if(!existing) return plainError('Property not found',404);
  requireOwnerOrAdmin(user,{ownerUID:s(existing.ownerUID)});
  if(typeof req.ownerUID==='string' && req.ownerUID!==existing.ownerUID) return plainError('Unauthorized: You can only update your own properties',403);
  // A malformed owner field must not remove ownership while other flexible keys remain supported.
  if ('ownerUID' in req && typeof req.ownerUID!=='string') return plainError('Unauthorized: You can only update your own properties',403);
  let images=existing.images;
  if(Array.isArray(req.images)&&req.images.length) {
    const strings=req.images.filter((v):v is string=>typeof v==='string');
    if(strings.length) images=await uploadPropertyImages(strings,id);
  }
  const updates:RecordData={};
  for(const [key,value] of Object.entries(req)) {
    if(key==='id'||key==='createdAt') continue;
    if(key==='images') { updates[key]=images;continue; }
    if(key==='status'&&typeof value==='string'&&!['active','inactive'].includes(value)) continue;
    if(['isActive','isRented','isSold'].includes(key)) { if(value===true||value==='true') updates[key]=true;continue; }
    if(key==='tenants'&&Array.isArray(value)) {
      const valid=value.filter(t=>!isRecord(t)||['email','firstName','lastName','phone'].some(k=>s(t[k]).trim()));
      updates[key]=valid.length?valid:null;continue;
    }
    updates[key]=value;
  }
  const now=new Date();
  for(const key of ['tenants','buyers']) if(Array.isArray(updates[key])) {
    for(const entry of updates[key] as unknown[]) if(isRecord(entry)) {
      if(!('createdAt' in entry)) entry.createdAt=now;
      if(!('updatedAt' in entry)) entry.updatedAt=now;
    }
  }
  updates.updatedAt=now;
  await properties().doc(id).update(updates);
  const updated=await getProperty(id);
  if(!updated) throw new Error('Property disappeared after update');
  await propertyUpdatedEffects(existing,updated,updates);
  return jsonResponse({success:true,message:'Property updated successfully',property:propertyResponse(updated)});
}
