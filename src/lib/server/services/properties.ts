import 'server-only';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { Query, DocumentSnapshot } from 'firebase-admin/firestore';
import {publicListing} from '../../listing-policy';
import { AccessError, requireUser } from '../auth';
import { COLLECTIONS, SITE_SETTINGS_DOCUMENT, getDatabase } from '../firestore';
import { requireOwnerOrAdmin, requireSelfOrAdmin, isPropertyTenant } from '../permissions';
import { ApiError, jsonResponse } from '../http';
import { projections } from './go-contracts';
import { model, storeModel, propertyResponse, publicPropertyResponse, isRecord, stringValue as s, type RecordData } from './contracts';
import { schemas } from './go-contracts';
import { resolveTenantIdentity, getUser } from './users';
import { uploadPropertyImages } from './property-images';
import {prepareMediaBindings,restoreFileReferences} from './media';
import {readObject} from './domain-contracts';
import { propertyNotificationEvents, bestEffort, propertyCreatedEffects, propertyUpdatedEffects } from './property-effects';

import { writeEmailOutbox, dispatchEmailOutbox, type TransactionalEmailEvent } from './transactional-email';

const propertyError=(message:string,status:number)=>jsonResponse({success:false,message},status);

const properties = () => getDatabase().collection(COLLECTIONS.properties);
function fromDocument(doc:DocumentSnapshot,defaults=true):RecordData {
  const property={...doc.data(),...model('Property',doc.data() || {})};
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
  return publicListing({...property,isSold:raw.isSold,isRented:raw.isRented});
}
async function tenantProperties(uid:string,email='') {
  const rows=await queryProperties(properties());
  return rows.filter(({property})=>Array.isArray(property.tenants) && property.tenants.some(t=>isRecord(t)&&t.isActive===true&&(t.userUID ? !!uid&&t.userUID===uid : !!email&&s(t.email).toLowerCase()===email.toLowerCase()))).map(row=>row.property);
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
    const rented=await tenantProperties(ownerUID,user.uid===ownerUID&&user.token.email_verified===true?user.token.email||'':'');
    const merged=new Map(own.map(({property})=>[s(property.id),propertyResponse(property,'normal','owner')]));
    for (const property of rented) if(!merged.has(s(property.id))) merged.set(s(property.id),propertyResponse(property,'tenant','tenant'));
    return listResponse([...merged.values()],{ownerUID});
  }
  if(params.get('admin')==='true') {
    const user=await requireUser(request);if(user.role!=='admin')throw new AccessError(403,'Administrator access required');
    const rows=await queryProperties(properties());return listResponse(rows.map(row=>propertyResponse(row.property,'normal','admin')));
  }
  const listingType=params.get('listingType')||'';
  let query:Query=properties().where('isActive','==',true);
  if (listingType) query=query.where('listingType','==',listingType);
  const rows=await queryProperties(query);
  const filtered=rows.filter(row=>available(row.property,row.raw)).map(row=>publicPropertyResponse(row.property));
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
    if (!available(property,raw)) return false;
    if (!term) return true;
    const fields=['location','address','city','state','title','propertyType','configuration','unitNumber','floor'];
    return fields.some(key=>!!s(property[key])&&s(property[key]).toLowerCase().includes(search)) || ['bhk','rk'].some(tag=>search.includes(tag)&&s(property.configuration).toLowerCase().includes(tag));
  }).map(row=>publicPropertyResponse(row.property));
  return listResponse(filtered,{query:term,...(listingType?{listingType}:{})});
}
export async function listTenantProperties(request:Request) {
  const params=new URL(request.url).searchParams;
  const tenantUID=params.get('tenantUID')||'';
  const headerUID=request.headers.get('X-User-ID')||'';
  const email=params.get('userEmail')||'';
  if (!tenantUID&&!headerUID&&!email) return propertyError('tenantUID, X-User-ID header, or userEmail parameter is required',400);
  const user=await requireUser(request);
  const uid=tenantUID||headerUID;
  if (uid) requireSelfOrAdmin(user,uid);
  const effectiveEmail=tenantUID?email:headerUID?'':email;
  if (effectiveEmail && user.role!=='admin' && (user.token.email_verified!==true || user.token.email?.toLowerCase()!==effectiveEmail.toLowerCase())) throw new AccessError(403,'Access denied');
  const rows=await tenantProperties(uid || (user.role==='admin'?'':user.uid),effectiveEmail);
  return listResponse(rows.map(property=>propertyResponse(property,'normal','tenant')));
}
export async function readProperty(request:Request,id:string) {
  const property=await getProperty(id);
  if(!property)return propertyError('Property not found',404);
  if(request.headers.has('authorization')) {
    const user=await requireUser(request);
    const tenants=Array.isArray(property.tenants)?property.tenants:[];
    const relationships={ownerUID:s(property.ownerUID),tenants:(tenants.some(t=>isRecord(t)&&t.isActive===true)?tenants:[{email:s(property.tenantEmail),isActive:property.rentalStatus==='rented'}]) as Parameters<typeof isPropertyTenant>[1]['tenants']};
    const role=user.role==='admin'?'admin':user.uid===property.ownerUID?'owner':isPropertyTenant(user,relationships)?'tenant':'';
    if(role)return jsonResponse({success:true,property:propertyResponse(property,'normal',role)});
  }
  if(!available(property,property))return propertyError('Property not found',404);
  return jsonResponse({success:true,property:publicPropertyResponse(property)});
}
const additiveFields=['propertyCategory','buildingName','plotArea','areaUnit','carpetAreaUnit','constructedAreaUnit','plotAreaUnit','expectedRent','structure'];
function validateProperty(input:RecordData) {
  for(const key of Object.keys(input))if(key.includes('.')||key.includes('/')||key.startsWith('__'))throw new Error('Invalid property field');
  for(const key of additiveFields)if(key in input&&typeof input[key]!=='string')throw new Error('Invalid property field');
  for(const [key,values] of Object.entries({listingType:['rent','sell','manage'],rentalStatus:['available','rented'],status:['active','inactive'],maintenanceToBePaidBy:['owner','tenant'],propertyCategory:['residential','commercial','industrial']}))if(input[key]) {const normalized=s(input[key]).toLowerCase();if(!values.includes(normalized))throw new Error(`Invalid ${key}`);input[key]=normalized;}
  for(const key of ['isActive','isSold','isRented'])if(key in input&&typeof input[key]!=='boolean')throw new Error(`Invalid ${key}`);
  if(input.paymentDueDate&&(!/^\d{1,2}$/.test(s(input.paymentDueDate))||Number(input.paymentDueDate)<1||Number(input.paymentDueDate)>31))throw new Error('Invalid payment due day');
  if(Array.isArray(input.tenants)&&input.tenants.length>50)throw new Error('At most 50 tenant relationships per property');
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
  let submissionFingerprint='';
  let body:unknown;
  try {body=await readObject(request,20<<20);}catch {return propertyError('Invalid JSON request body',400);}
  try {
    if (body!==null&&!isRecord(body)) throw new Error('invalid request object');
    const raw=(body||{}) as RecordData;
    if(Object.keys(raw).some(key=>key.startsWith('moderation')))throw new Error('Moderation fields are server controlled');
    validateProperty(raw);
    const canonical=(value:unknown):unknown=>Array.isArray(value)?value.map(canonical):isRecord(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
    submissionFingerprint=createHash('sha256').update(JSON.stringify([user.uid,canonical(raw)])).digest('hex');
    if(raw.createdAs!==undefined&&!['owner','tenant'].includes(s(raw.createdAs)))throw new Error('Invalid property relationship');
    req={...model('CreatePropertyRequest',raw,true),...Object.fromEntries(additiveFields.filter(key=>key in raw).map(key=>[key,raw[key]]))};
    if(raw.createdAs==='tenant') {
      const details=raw.reportedOwner;
      if(!isRecord(details))throw new Error('Owner details are required');
      const keys=['companyName','personName','phone','alternatePhone','email','workingProfile'];
      if(Object.keys(details).some(key=>!keys.includes(key))||Object.values(details).some(value=>typeof value!=='string'||value.length>500))throw new Error('Invalid owner details');
      if(!s(details.personName).trim()&&!s(details.companyName).trim()||!s(details.phone).trim())throw new Error('Owner name and contact number are required');
      if(details.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(details.email)))throw new Error('Invalid owner email');
      req.createdAs='tenant';req.reportedOwner=details;
    }
  } catch(error) { return propertyError(`Invalid property data: ${error instanceof Error?error.message:'invalid request'}`,400); }
  const tenantCreated=req.createdAs==='tenant';
  if(tenantCreated) {
    if(!s(req.monthlyRent).trim()||!Number.isFinite(Number(req.monthlyRent))||Number(req.monthlyRent)<=0||!req.paymentDueDate||!req.agreementPeriod)return propertyError('Rent, payment due day and agreement period are required',400);
    const dates=[s(req.agreementStartDate),s(req.agreementEndDate)];
    if(dates.some(value=>!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value)))||dates[1]<dates[0])return propertyError('Valid agreement start and end dates are required',400);
  }
  if (!req.propertyTitle||!req.propertyType||!req.location||(!tenantCreated&&!req.ownerUID)) return propertyError('Missing required fields: propertyTitle, propertyType, location, ownerUID',400);
  if(!tenantCreated)requireSelfOrAdmin(user,s(req.ownerUID));
  const owner=await getUser(tenantCreated?user.uid:s(req.ownerUID));
  if (!owner) return propertyError('Owner not found',400);
  const submissionRef=getDatabase().collection('property_submissions').doc(submissionFingerprint);
  const previous=await submissionRef.get();
  if(previous.exists) {
    const saved=await getProperty(s(previous.data()?.propertyId));
    if(!saved)throw new ApiError(409,'Submission already processed; contact support');
    return jsonResponse({success:true,message:'Property already submitted',property:propertyResponse(saved,'create',tenantCreated?'tenant':'owner')});
  }
  const id=await generateID();
  const property=model('Property',{});
  for(const key of additiveFields)if(key in req)property[key]=req[key];
  for(const [to,from] of projections.request) property[to]=req[from];
  property.rentSchedule=req.rentSchedule;
  property.internalImages=await uploadPropertyImages((req.internalImages as string[]|null)||[],id,user,true);
  Object.assign(property,{id,title:req.propertyTitle,address:req.location,tenantName:`${s(req.tenantFirstName)} ${s(req.tenantLastName)}`,images:await uploadPropertyImages((req.images as string[]|null)||[],id,user,tenantCreated),ownerUID:req.ownerUID,ownerName:owner.name,ownerEmail:owner.email,ownerPhone:owner.phoneNumber,ownerRole:owner.role,status:'active',isActive:true});
  if(tenantCreated) {
    Object.assign(property,{createdAs:'tenant',submittedByUID:user.uid,ownershipVerification:'pending',reportedOwner:req.reportedOwner,ownerUID:'',ownerName:'',ownerEmail:'',ownerPhone:'',ownerRole:'',listingType:'rent',rentalStatus:'rented',isSold:false});
    req.rentalStatus='rented';req.isSold=false;req.tenantEmail=user.token.email||'';
    property.tenantEmail=req.tenantEmail;
  }
  const now=new Date();
  if(req.rentalStatus==='rented') {
    let first=s(req.tenantFirstName),last=s(req.tenantLastName);
    if(!first&&!last&&req.tenantName) { const parts=s(req.tenantName).split(' '); first=parts[0];last=parts.slice(1).join(' '); }
    const tenant=model('TenantInfo',{firstName:first,lastName:last,email:req.tenantEmail,phone:req.mobileNumber,paymentDueDate:req.paymentDueDate,monthlyRent:req.monthlyRent,leaseStartDate:req.agreementStartDate,leaseEndDate:req.agreementEndDate,noticePeriod:req.noticePeriod,emergencyContact:req.tenantEmergencyContact,previousAddress:req.tenantPreviousAddress,employmentStatus:req.tenantEmploymentStatus,employer:req.tenantEmployer,monthlyIncome:req.tenantMonthlyIncome,isMarried:req.tenantIsMarried,spouse:req.tenantSpouse,rentSchedule:req.rentSchedule,isActive:true,createdAt:now.toISOString().slice(0,19)+'Z',updatedAt:now.toISOString().slice(0,19)+'Z'});
    if(tenantCreated){tenant.userUID=user.uid;tenant.email=user.token.email||'';}
    else if(req.tenantEmail)tenant.userUID=await resolveTenantIdentity(s(req.tenantEmail));
    property.tenants=[tenant];
  }
  if(req.isSold) property.buyers=[model('BuyerInfo',{id:`buyer_${BigInt(now.getTime())*1000000n}`,firstName:req.buyerFirstName,lastName:req.buyerLastName,phone:req.buyerPhone,isActive:true,createdAt:now,updatedAt:now})];
  property.createdAt=now;property.updatedAt=now;
  Object.assign(property,{moderationStatus:'pending_review',moderationRevision:1,moderationSubmittedAt:now,moderationHistory:[{action:'submitted',actorUID:user.uid,at:now,revision:1}]});
  // Atomic create avoids overwriting a property on a race or infrastructure failure.
  const data={...storeModel('Property',property),...Object.fromEntries(additiveFields.filter(key=>key in property).map(key=>[key,property[key]]))};
  if(tenantCreated)for(const key of ['createdAs','submittedByUID','ownershipVerification','reportedOwner'])data[key]=property[key];
  for(const key of moderationFields)if(key in property)data[key]=property[key];
  const events=propertyNotificationEvents(property,await getUser(user.uid)||owner);
  const created=await writeProperty(id,data,user,true,{ref:submissionRef,events});
  if(!created){const receipt=await submissionRef.get(),saved=await getProperty(s(receipt.data()?.propertyId));return jsonResponse({success:true,message:'Property already submitted',property:propertyResponse(saved!,'create',tenantCreated?'tenant':'owner')});}
  property.tenants=data.tenants;
  dispatchEmailOutbox(events);
  await propertyCreatedEffects(property);
  return jsonResponse({success:true,message:'Property created successfully',property:propertyResponse(property,'create',tenantCreated?'tenant':'owner')});
}
export async function updateProperty(request:Request,id:string) {
  const user=await requireUser(request);
  let req:RecordData;
  try { const body:unknown=await readObject(request,20<<20); if(body!==null&&!isRecord(body)) throw new Error(); req=(body||{}) as RecordData; } catch { return propertyError('Invalid JSON',400); }
  const existing=await getProperty(id);
  if(!existing) return propertyError('Property not found',404);
  requireOwnerOrAdmin(user,{ownerUID:s(existing.ownerUID)});
  if('moderationAction' in req)return moderateListing(req,id,user);
  if(Object.keys(req).some(key=>key.startsWith('moderation')))return propertyError('Moderation fields are server controlled',400);
  restoreFileReferences('properties',id,req,existing);
  if(typeof req.ownerUID==='string' && req.ownerUID!==existing.ownerUID) return propertyError('Unauthorized: You can only update your own properties',403);
  // A malformed owner field must not remove ownership while other flexible keys remain supported.
  if ('ownerUID' in req && typeof req.ownerUID!=='string') return propertyError('Unauthorized: You can only update your own properties',403);
  try {validateProperty(req);model('Property',{...existing,...req},true);}catch{return propertyError('Invalid property fields',400);}
  const allowed=new Set([...schemas.Property.map(field=>field.name),...additiveFields,'isRented']);
  for(const key of Object.keys(req))if(!allowed.has(key))return propertyError(`Unsupported property field: ${key}`,400);
  let images=existing.images;
  if(Array.isArray(req.images)) {
    const strings=req.images.filter((v):v is string=>typeof v==='string');
    images=strings.length?await uploadPropertyImages(strings,id,user,existing.createdAs==='tenant',(existing.images as string[])||[]):[];
  }
  if(Array.isArray(req.internalImages))req.internalImages=await uploadPropertyImages(req.internalImages as string[],id,user,true,(existing.internalImages as string[])||[]);
  const updates:RecordData={};
  for(const [key,value] of Object.entries(req)) {
    if(['id','createdAt','ownerUID','ownerName','ownerEmail','ownerPhone','ownerRole','agreementHistory','agreementRequest'].includes(key)) continue;
    if(key==='images') { updates[key]=images;continue; }
    if(key==='status'&&typeof value==='string'&&!['active','inactive'].includes(value)) continue;
    if(['isActive','isRented','isSold'].includes(key)) { updates[key]=value;continue; }
    if(key==='tenants'&&Array.isArray(value)) {
      const valid=value.filter(t=>isRecord(t)&&['email','firstName','lastName','phone'].some(k=>s(t[k]).trim()));
      for(const tenant of valid as RecordData[])if(tenant.email)tenant.userUID=await resolveTenantIdentity(s(tenant.email),s(tenant.userUID));
      if((valid as RecordData[]).some(t=>t.userUID&&!t.email))return propertyError('Tenant Firebase email is required when linking a UID',400);
      updates[key]=valid;continue;
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
  if(req.status==='inactive'||req.isActive===false)Object.assign(updates,{status:'inactive',isActive:false});
  else if(req.status==='active'||req.isActive===true)Object.assign(updates,{status:'active',isActive:true});
  await writeProperty(id,updates,user);
  const updated=await getProperty(id);
  if(!updated) throw new Error('Property disappeared after update');
  await propertyUpdatedEffects(existing,updated,updates);
  return jsonResponse({success:true,message:'Property updated successfully',property:propertyResponse(updated,'normal',user.role==='admin'?'admin':'owner')});
}
async function writeProperty(id:string,updates:RecordData,user:Awaited<ReturnType<typeof requireUser>>,create=false,submission?:{ref:FirebaseFirestore.DocumentReference;events:TransactionalEmailEvent[]}) {
  const db=getDatabase(),ref=properties().doc(id);
  if(Array.isArray(updates.tenants))for(const tenant of updates.tenants as RecordData[]) {tenant.id ||= randomUUID();tenant.createdAt ||= new Date();tenant.updatedAt=new Date();}
  return db.runTransaction(async tx=>{
    if(submission&&(await tx.get(submission.ref)).exists)return false;
    const before=await tx.get(ref);
    if(create&&before.exists)throw new Error('Property ID conflict');
    if(!create) {if(!before.exists)throw new Error('Property not found');requireOwnerOrAdmin(user,{ownerUID:s(before.data()?.ownerUID)});}
    if(!create)applyListingEdit(before.data()||{},updates,user.uid);
    const records=Array.isArray(updates.tenants)?await tx.get(db.collection(COLLECTIONS.tenants).where('propertyId','==',id)):null;
    const bindMedia=await prepareMediaBindings(tx,user,'properties',id,id,{...(before.data()||{}),...updates},before.data()||{});
    if(!create&&['agreementStartDate','agreementEndDate','monthlyRent','tenants'].some(key=>key in updates)) {
      const history=Array.isArray(before.data()?.agreementHistory)?before.data()!.agreementHistory:[];
      if(history.length>=500)throw new Error('Agreement history limit reached');
      updates.agreementHistory=[...history,{action:'property_terms_updated',actorUID:user.uid,at:new Date(),previousTerms:Object.fromEntries(['monthlyRent','agreementStartDate','agreementEndDate','securityDeposit'].map(key=>[key,before.data()?.[key]??''])),previousTenants:before.data()?.tenants||[]}];
    }
    if(Array.isArray(updates.tenants)) {
      const tenantRefs=await Promise.all((updates.tenants as RecordData[]).map(t=>tx.get(db.collection(COLLECTIONS.tenants).doc(s(t.id)))));
      for(const tenantRef of tenantRefs)if(tenantRef.exists&&tenantRef.data()?.propertyId!==id)throw new AccessError(403,'Tenant belongs to another property');
      for(const record of records?.docs||[])if(!(updates.tenants as RecordData[]).some(t=>t.id===record.id))tx.update(record.ref,{isActive:false,updatedAt:new Date()});
      for(const tenant of updates.tenants as RecordData[])tx.set(db.collection(COLLECTIONS.tenants).doc(s(tenant.id)),storeModel('Tenant',model('Tenant',{...tenant,propertyId:id,ownerUID:updates.ownerUID||before.data()?.ownerUID})),{merge:true});
      if(!create)updates.rentalStatus=(updates.tenants as RecordData[]).some(t=>t.isActive===true)?'rented':'available';
    }
    bindMedia();
    if(create)tx.create(ref,updates);else tx.update(ref,updates);
    if(submission){tx.create(submission.ref,{propertyId:id,submitterUID:user.uid,createdAt:new Date()});writeEmailOutbox(tx,submission.events);}
    return true;
  });
}

const moderationFields=['moderationStatus','moderationRevision','moderationSubmittedAt','moderationReviewedAt','moderationReviewerUID','moderationReason','moderationHistory'];
// Operational tenancy and archive changes retain approval. Changes to published
// listing content require another review, including edits to legacy listings.
const listingContentFields=['title','description','address','location','city','state','zipCode','propertyType','propertyCategory','listingType','configuration','unitNumber','floor','carpetArea','constructedArea','plotArea','areaUnit','carpetAreaUnit','constructedAreaUnit','plotAreaUnit','squareFeet','buildingName','structure','bedrooms','bathrooms','monthlyRent','sellingPrice','price','images','amenities','projectCondition','isPreLeased','preLeasedType','rentalIncome','purpose','specificRequirement'];
function applyListingEdit(before:RecordData,updates:RecordData,uid:string) {
  if(before.createdAs==='tenant'||!['rent','sell'].includes(s(updates.listingType??before.listingType)))return;
  const changed=listingContentFields.some(key=>key in updates&&JSON.stringify(updates[key])!==JSON.stringify(before[key]));
  if(!changed)return;
  const revision=Number(before.moderationRevision||0)+1,at=new Date();
  const history=Array.isArray(before.moderationHistory)?before.moderationHistory:[];
  if(history.length>=500)throw new ApiError(409,'Listing decision history limit reached');
  Object.assign(updates,{moderationStatus:'pending_review',moderationRevision:revision,moderationSubmittedAt:at,moderationReason:'',moderationHistory:[...history,{action:'resubmitted',actorUID:uid,at,revision}]});
}
async function moderateListing(req:RecordData,id:string,user:Awaited<ReturnType<typeof requireUser>>) {
  if(Object.keys(req).some(key=>!['moderationAction','reason','expectedRevision'].includes(key)))throw new ApiError(400,'Submit moderation separately from property edits');
  const action=s(req.moderationAction),reason=s(req.reason).trim();
  if(!['approve','reject','request_changes','resubmit'].includes(action)||('reason' in req&&typeof req.reason!=='string')||reason.length>2000)throw new ApiError(400,'Invalid moderation decision');
  if(['reject','request_changes'].includes(action)&&!reason)throw new ApiError(400,'A reason is required');
  if(action!=='resubmit'&&user.role!=='admin')throw new AccessError(403,'Administrator access required');
  const ref=properties().doc(id);
  const current=await getProperty(id);
  const recipient=await getUser(s(current?.ownerUID||current?.submittedByUID));
  let events:TransactionalEmailEvent[]=[];
  await getDatabase().runTransaction(async tx=>{
    const doc=await tx.get(ref),before=doc.data();
    if(!before)throw new ApiError(404,'Property not found');
    requireOwnerOrAdmin(user,{ownerUID:s(before.ownerUID)});
    if(!Number.isInteger(req.expectedRevision)||req.expectedRevision!==Number(before.moderationRevision||0))throw new ApiError(409,'Listing changed; refresh before deciding');
    if(action==='resubmit'?!['rejected','changes_requested'].includes(s(before.moderationStatus)):before.moderationStatus!==undefined&&before.moderationStatus!=='pending_review')throw new ApiError(409,'Invalid listing moderation transition');
    const history=Array.isArray(before.moderationHistory)?before.moderationHistory:[];
    if(history.length>=500)throw new ApiError(409,'Listing decision history limit reached');
    const at=new Date(),revision=Number(before.moderationRevision||0)+1;
    const status=action==='approve'?'approved':action==='reject'?'rejected':action==='request_changes'?'changes_requested':'pending_review';
    events=propertyNotificationEvents({...before,id,moderationRevision:revision,moderationReason:reason},recipient||{},status);
    writeEmailOutbox(tx,events);
    tx.update(ref,{moderationStatus:status,moderationRevision:revision,moderationReason:reason,updatedAt:at,...(action==='resubmit'?{moderationSubmittedAt:at}:{moderationReviewedAt:at,moderationReviewerUID:user.uid}),moderationHistory:[...history,{action,actorUID:user.uid,reason,at,revision}]});
  });
  dispatchEmailOutbox(events);
  const property=await getProperty(id);
  return jsonResponse({success:true,message:'Listing moderation updated',property:propertyResponse(property!,'normal',user.role==='admin'?'admin':'owner')});
}

// Keep the legacy native adapter's plain-text responses out of property API clients.
export function propertyJsonRoute<T extends unknown[]>(handler:(request:Request,...args:T)=>Promise<Response>|Response) {
  return async(request:Request,...args:T)=>{
    const response=await handler(request,...args);
    if(request.method==='OPTIONS'||request.method==='HEAD'||response.headers.get('content-type')?.includes('application/json'))return response;
    const message=response.ok?'Unexpected property API response':(await response.text()).trim();
    return jsonResponse({success:false,message:message||'Property request failed'},response.ok?502:response.status);
  };
}
