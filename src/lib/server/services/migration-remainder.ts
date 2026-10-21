import 'server-only';
import { randomUUID } from 'node:crypto';
import { AccessError, verifyFirebaseIdentity } from '../auth';
import { COLLECTIONS, getDatabase, SITE_SETTINGS_DOCUMENT } from '../firestore';
import { requireAdmin, requireSelfOrAdmin, isPropertyTenant } from '../permissions';
import { ApiError, jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, wireValue, isRecord, stringValue as s, type RecordData } from './contracts';
import { identity, propertyMember, readObject, readModel, knownFields, getRecords, getRecord } from './domain-contracts';
import { getUser } from './users';
import { getProperty } from './properties';
import { createNotification } from './notifications';
import { bestEffort, queueEmail, escapeHtml } from './property-effects';
import {prepareFile,saveMediaRecord,prepareMediaBindings,restoreFileReferences} from './media';
import {fileFields} from '../file-projection';

const fail = (message:string,status:number) => jsonResponse({success:false,message},status);
async function strings(request:Request,fields:string[]) {
  const data=knownFields(await readObject(request),fields);
  for(const field of fields) { if(data[field]!=null&&typeof data[field]!=='string')throw new Error('Invalid string'); data[field]=s(data[field]); }
  return data;
}
export async function login(request:Request) {
  let req:RecordData;try{req=await strings(request,['uid']);}catch{return fail('Invalid request body',400);}
  if(!req.uid)return fail('UID is required',400);
  const tokenIdentity=await verifyFirebaseIdentity(request);
  if(tokenIdentity.uid!==req.uid)throw new AccessError(403,'Access denied');
  const profile=await getUser(s(req.uid));if(!profile)return fail('User not found',401);
  if(profile.isActive===false)throw new AccessError(403,'Active user profile required');
  // Native APIs accept Firebase ID tokens, never legacy application JWTs.
  return jsonResponse({success:true,token:request.headers.get('authorization')!.replace(/^Bearer\s+/i,''),user:wireModel('User',profile),message:'Login successful'});
}

const clientServices=Object.fromEntries([
  ['plumbing','Plumbing Issue','maintenance'],['leakage','Leakage / Seepage Issue','maintenance'],['fixtures','Fixtures Issue','maintenance'],['painting','Painting Work','maintenance'],['electrical','Electrical Issue','maintenance'],['other','Any Other','maintenance'],
  ['rent-agreement-registration','Rent Agreement Registration','legal'],['sale-agreement-procedure','Sale Agreement Procedure','legal'],['legal-consultation','Other Legal Work / Consultation','legal'],['society-procedure','Society Procedure / Service','related'],['pre-rental','Pre-rental Services','related'],
].map(([id,name,category])=>[id,model('Service',{id,name,category,isActive:true})]));
export async function listServices() {
  const stored=await getRecords(getDatabase().collection(COLLECTIONS.services),'Service',true);
  const data=[...new Map([...Object.values(clientServices),...stored].map(service=>[s(service.id),service])).values()].filter(service=>service.isActive===true);
  return jsonResponse({success:true,message:'Services fetched successfully',...(data.length?{data:data.map(v=>wireModel('Service',v))}:{})});
}
export async function listServiceRequests(request:Request) {
  const user=await identity(request),params=new URL(request.url).searchParams;
  let query:FirebaseFirestore.Query=getDatabase().collection(COLLECTIONS.serviceRequests);
  if(params.get('propertyId')) {const property=await propertyMember(user,params.get('propertyId')!);if(!property)return fail('Property not found',404);query=query.where('propertyId','==',params.get('propertyId'));}
  else if(params.get('admin')==='true')requireAdmin(user);
  else if(params.get('userUID')) {requireSelfOrAdmin(user,params.get('userUID')!);query=query.where('userUID','==',params.get('userUID'));}
  else return fail('Missing userUID parameter or admin access',400);
  const snapshot=await query.get();let records=snapshot.docs.map(doc=>({...doc.data(),id:doc.id} as RecordData));
  if(params.get('propertyId')&&user.role!=='admin') {const property=await getProperty(params.get('propertyId')!);if(property?.ownerUID!==user.uid)records=records.filter(record=>record.userUID===user.uid);}
  const data=records.map(wireValue);
  return jsonResponse({success:true,message:'Service requests fetched successfully',data});
}
function notificationContext(property:RecordData|null,user:RecordData,uid:string,propertyId:string) {
  const tenants=(property?.tenants as RecordData[]|null)||[];const tenant=tenants.find(t=>t.isActive)||{};
  return {propertyId,ownerId:s(property?.ownerUID),ownerName:s(property?.ownerName),ownerEmail:s(property?.ownerEmail),ownerPhone:s(property?.ownerPhone),
    tenantName:tenant.firstName?`${s(tenant.firstName)} ${s(tenant.lastName)}`:'',tenantEmail:s(tenant.email),tenantPhone:s(tenant.phone),
    buyers:Array.isArray(property?.buyers)&&property.buyers.length?JSON.stringify(property.buyers):'',
    userId:uid,userName:s(user.name),userEmail:s(user.email),userPhone:s(user.phoneNumber),timestamp:new Date().toISOString(),isRead:false,priority:'medium'};
}
export async function createServiceRequest(request:Request) {
  const user=await identity(request);let req:RecordData;
  try{req=await strings(request,['userUID','serviceId','propertyId','message','image']);}catch{return fail('Invalid request body',400);}
  if(!req.userUID||!req.serviceId)return fail('Missing required fields: userUID, serviceId',400);
  requireSelfOrAdmin(user,s(req.userUID));
  const profile=await getUser(s(req.userUID));if(!profile)return fail('User not found',404);
  const service=await getRecord(COLLECTIONS.services,s(req.serviceId),'Service')||clientServices[s(req.serviceId)];if(!service)return fail('Service not found',404);
  if(service.isActive===false)return fail('Service is inactive',400);
  const property=req.propertyId?await propertyMember(user,s(req.propertyId)):null;
  if(req.propertyId&&!property)return fail('Property not found',404);
  const image=req.image?await prepareFile(s(req.image),user,s(req.propertyId),'service-request'):'';
  const now=new Date();const value=model('ServiceRequest',{...req,id:randomUUID(),userName:profile.name,userEmail:profile.email,userPhone:profile.phoneNumber,serviceName:service.name,image,status:'pending',createdAt:now,updatedAt:now});
  await saveMediaRecord(COLLECTIONS.serviceRequests,s(value.id),{...storeModel('ServiceRequest',value),history:[{status:'pending',actorUID:user.uid,at:now}]},user,true);
  await bestEffort(async()=>{
    await createNotification({...notificationContext(property,profile,s(req.userUID),s(req.propertyId)),relatedId:value.id,type:'service_request',title:'New Service Request',message:`Service request from ${s(profile.name)} for ${s(service.name)}`,serviceType:service.name,serviceComment:req.message,serviceImage:image});
  });
  return jsonResponse({success:true,message:'Service request created successfully. One of our members will reach out to you soon!',serviceRequest:wireModel('ServiceRequest',value)},201);
}
export async function updateServiceRequest(request:Request,id:string) {
  const user=await identity(request);requireAdmin(user);let req:RecordData;
  try{req=await strings(request,['status','adminNotes','resolutionReport','adminImage','action']);}catch{return fail('Invalid request body',400);}
  if(req.status&&!['pending','in_progress','completed','cancelled','resolved'].includes(s(req.status)))return fail('Invalid service request status',400);
  if(req.action&&!['archive','unarchive'].includes(s(req.action)))return fail('Invalid archive action',400);
  const ref=getDatabase().collection(COLLECTIONS.serviceRequests).doc(id);let updated:RecordData={};
  const existing=await ref.get();if(!existing.exists)throw new ApiError(404,'Service request not found');
  restoreFileReferences(COLLECTIONS.serviceRequests,id,req,existing.data()!);
  if(req.adminImage)req.adminImage=await prepareFile(s(req.adminImage),user,s(existing.data()?.propertyId),'resolution',s(existing.data()?.adminImage));
  await getDatabase().runTransaction(async tx=>{
    const snapshot=await tx.get(ref);if(!snapshot.exists)throw new ApiError(404,'Service request not found');
    const before=snapshot.data()!,now=new Date();const updates:RecordData={updatedAt:now};
    for(const key of ['status','adminNotes','resolutionReport','adminImage'])if(req[key])updates[key]=req[key];
    if(req.action)updates.isArchived=req.action==='archive';
    if(['completed','resolved'].includes(s(req.status)))updates.completedAt=now;
    updates.history=[...(Array.isArray(before.history)?before.history:[]),{status:req.status||before.status,action:req.action||'update',actorUID:user.uid,comment:req.adminNotes,at:now}];
    updated={...before,...updates};const bind=await prepareMediaBindings(tx,user,COLLECTIONS.serviceRequests,id,s(before.propertyId),updated,before);
    bind();tx.update(ref,updates);
  });
  const profile=await getUser(s(updated.userUID));if(profile?.email)queueEmail({to:s(profile.email),subject:'Service request updated',html:`<p>${escapeHtml(s(updated.serviceName))}: ${escapeHtml(s(updated.status))}</p><p>${escapeHtml(s(updated.adminNotes))}</p>`});
  return jsonResponse({success:true,message:'Service request updated successfully'});
}

export async function createReportOrReview(request:Request,kind:'report'|'review') {
  const user=await identity(request,true);let req:RecordData;
  try{req=await readModel(request,kind==='report'?'CreateInspectionReportRequest':'CreateReviewRequest');}catch{return plainError('Invalid request body',400);}
  if(kind==='report'&&!['on_possession','on_handover'].includes(s(req.reportType)))return plainError("Invalid report type. Must be 'on_possession' or 'on_handover'",400);
  if(kind==='review'&&!['tenant','owner'].includes(s(req.reviewerType)))return plainError("Invalid reviewer type. Must be 'tenant' or 'owner'",400);
  const profile=await getUser(user.uid);if(!profile)return plainError('User not found',404);
  const property=await getProperty(s(req.propertyId));if(!property)return plainError('Property not found',404);
  await propertyMember(user,s(req.propertyId));
  if(kind==='report'&&!s(req.report).trim())return plainError('Inspection report details are required',400);
  if(kind==='review') {
    const answers=req.reviewerType==='tenant'?req.tenantPart:req.ownerPart;
    if(!isRecord(answers)||!Object.values(answers).some(value=>typeof value==='string'&&value.trim()))return plainError('At least one review response is required',400);
  }
  if(kind==='review') {
    const reviewerType=user.uid===property.ownerUID?'owner':'tenant';
    if(user.role!=='admin'&&req.reviewerType!==reviewerType)return plainError('Reviewer relationship does not match property',403);
  }
  if(kind==='report')for(const field of fileFields.inspection_reports){if(Array.isArray(req[field]))req[field]=await Promise.all((req[field] as string[]).map(value=>prepareFile(value,user,s(req.propertyId),field)));else if(req[field])req[field]=await prepareFile(s(req[field]),user,s(req.propertyId),field);}
  const now=new Date(),name=kind==='report'?'InspectionReport':'Review',collection=kind==='report'?COLLECTIONS.inspectionReports:COLLECTIONS.reviews;
  const active=((property.tenants as RecordData[]|null)||[]).filter(t=>t.isActive===true);
  const tenant=active.find(t=>t.userUID===user.uid)||active[0]||{};
  const value=model(name,{...req,id:randomUUID(),propertyTitle:property.title,createdAt:now,updatedAt:now,
    ...(kind==='report'?{userId:user.uid,userName:profile.name,userEmail:profile.email,userPhone:profile.phoneNumber}:
      {reviewerId:user.uid,reviewerName:profile.name,reviewerEmail:profile.email,reviewerPhone:profile.phoneNumber,ownerId:property.ownerUID,ownerName:property.ownerName,ownerEmail:property.ownerEmail,ownerPhone:property.primaryNo,tenantId:s(tenant.id),tenantName:tenant.firstName?`${s(tenant.firstName)} ${s(tenant.lastName)}`:''})});
  await saveMediaRecord(collection,s(value.id),storeModel(name,value),user,true);
  await bestEffort(async()=>{
    const context=notificationContext(property,profile,user.uid,s(req.propertyId));
    const formatted=req.reportType==='on_handover'?'On Handover':'On Possession';
    const part=(req.reviewerType==='tenant'?req.tenantPart:req.ownerPart) as RecordData;
    const fields=req.reviewerType==='tenant'?
      [['Owner Understandable','ownerUnderstandable'],['Soft Nature','softNature'],['Owner Transparent','ownerTransparent'],['Problem Solver','problemSolver'],['Easy on Refund Money','easyOnRefundMoney'],['Overall Experience','overallExperience']]:
      [['Tenant Understandable','tenantUnderstandable'],['Soft Nature','softNature'],['Tenant Transparent','tenantTransparent'],['Problem Solver','problemSolver'],['Punctual on Payment','punctualOnPayment'],['Overall Experience','overallExperience']];
    const details=kind==='review'?[req.reviewerType==='tenant'?'A. Reviewing Owner:':'B. Reviewing Tenant:',...fields.map(([label,key])=>`- ${label}: ${s(part[key])}`)].join('\n'):'';
    await createNotification({...context,type:kind==='report'?'inspection_report':'review',title:kind==='report'?'New Inspection Report Submitted':'New Review Submitted',
      message:kind==='report'?`${s(profile.name)} submitted an inspection report (${formatted}) for property: ${s(property.title)}\nProperty ID: ${s(req.propertyId)}\nReport Type: ${formatted}`:
        `${s(profile.name)} (${s(req.reviewerType)}) submitted a review for property: ${s(property.title)}\nProperty ID: ${s(req.propertyId)}\nReviewer: ${s(profile.name)} (${s(profile.email)})\n\n${details}`,
      propertyTitle:property.title,propertyAddress:property.address,propertyListingType:property.listingType,
      ...(kind==='review'?{ownerPhone:property.primaryNo,reviewerType:req.reviewerType,tenantPart:req.tenantPart,ownerPart:req.ownerPart,tenantName:'',tenantEmail:'',tenantPhone:'',buyers:''}:{})});
  });
  return jsonResponse({success:true,message:kind==='report'?'Inspection report created successfully':'Review submitted successfully and admin has been notified',[kind]:wireModel(name,value)},201);
}
export async function listReports(request:Request,field:'propertyId'|'userId',id:string) {
  const user=await identity(request);
  if(field==='userId')requireSelfOrAdmin(user,id);
  else if(!await propertyMember(user,id))return plainError('Property not found',404);
  let data=await getRecords(getDatabase().collection(COLLECTIONS.inspectionReports).where(field,'==',id).orderBy('createdAt','desc'),'InspectionReport');
  if(field==='userId'&&user.role!=='admin') {
    const visible:RecordData[]=[];for(const report of data) {try{if(await propertyMember(user,s(report.propertyId)))visible.push(report);}catch(error){if(!(error instanceof AccessError))throw error;}}data=visible;
  }
  return jsonResponse({success:true,reports:data.length?data.map(v=>wireModel('InspectionReport',v)):null});
}
export async function listReviews(request:Request) {
  const user=await identity(request),id=new URL(request.url).searchParams.get('propertyId')||'';
  if(!id)return fail('Property ID required',400);if(!await propertyMember(user,id))return fail('Property not found',404);
  const reviews=await getRecords(getDatabase().collection(COLLECTIONS.reviews).where('propertyId','==',id),'Review');
  return jsonResponse({success:true,reviews:reviews.map(review=>wireModel('Review',review))});
}

export async function siteSettings(request:Request) {
  const ref=getDatabase().collection(COLLECTIONS.siteSettings).doc(SITE_SETTINGS_DOCUMENT);
  if(request.method==='GET') {
    // Go returns defaults for every document-read error, then reports parse errors.
    const doc=await bestEffort(()=>ref.get());const value=doc?.exists?model('SiteSettings',{...doc.data(),id:doc.id}):model('SiteSettings',{id:SITE_SETTINGS_DOCUMENT,quote:'Manage your properties and plan visits with ease',heroTitle:'Your Smart Hub for Property Management',heroSubtitle:'Manage, list your properties and find your dream house— all in one platform',bannerImages:[],updatedAt:new Date()});
    return jsonResponse({success:true,settings:wireModel('SiteSettings',value)});
  }
  const user=await identity(request);requireAdmin(user);let req:RecordData;
  try{req=await readModel(request,'SiteSettings');}catch{return plainError('Invalid JSON',400);}
  const value=model('SiteSettings',{...req,id:SITE_SETTINGS_DOCUMENT,updatedAt:new Date(),updatedBy:user.uid});
  await saveMediaRecord(COLLECTIONS.siteSettings,SITE_SETTINGS_DOCUMENT,storeModel('SiteSettings',value),user);
  return jsonResponse({success:true,message:'Site settings updated successfully',settings:wireModel('SiteSettings',value)});
}
