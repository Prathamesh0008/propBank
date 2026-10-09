import 'server-only';
import { createHmac, randomUUID } from 'node:crypto';
import { AccessError, verifyFirebaseIdentity } from '../auth';
import { COLLECTIONS, getDatabase, SITE_SETTINGS_DOCUMENT } from '../firestore';
import { requireAdmin, requireSelfOrAdmin } from '../permissions';
import { jsonResponse, plainError } from '../http';
import { model, storeModel, wireModel, stringValue as s, type RecordData } from './contracts';
import { identity, readObject, readModel, knownFields, getRecords, getRecord } from './domain-contracts';
import { getUser } from './users';
import { getProperty } from './properties';
import { createNotification } from './notifications';
import { bestEffort } from './property-effects';
import { uploadBase64 } from './r2-storage';

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
  const secret=process.env.JWT_SECRET;
  // Go never registered this endpoint. The migrated frontend's apiFetch always
  // uses Firebase identity, overriding its old localStorage JWT. Preserve the
  // login envelope without requiring a legacy signing secret for native auth.
  if(!secret)return jsonResponse({success:true,token:request.headers.get('authorization')!.replace(/^Bearer\s+/i,''),user:wireModel('User',profile),message:'Login successful'});
  const iat=Math.floor(Date.now()/1000);
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const payload=`${encode({alg:'HS256',typ:'JWT'})}.${encode({uid:profile.uid,role:profile.role,iat,exp:iat+48*3600})}`;
  const token=`${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
  return jsonResponse({success:true,token,user:wireModel('User',profile),message:'Login successful'});
}

export async function listServices() {
  // Go's iterator ends on any read error and returns its accumulated slice.
  const data=await bestEffort(()=>getRecords(getDatabase().collection(COLLECTIONS.services).where('isActive','==',true),'Service'))||[];
  return jsonResponse({success:true,message:'Services fetched successfully',...(data.length?{data:data.map(v=>wireModel('Service',v))}:{})});
}
export async function listServiceRequests(request:Request) {
  const user=await identity(request),params=new URL(request.url).searchParams;
  let query:FirebaseFirestore.Query=getDatabase().collection(COLLECTIONS.serviceRequests);
  if(params.get('admin')==='true')requireAdmin(user);
  else if(params.get('userUID')) {requireSelfOrAdmin(user,params.get('userUID')!);query=query.where('userUID','==',params.get('userUID'));}
  else return fail('Missing userUID parameter or admin access',400);
  const data=await bestEffort(()=>getRecords(query.orderBy('createdAt','desc'),'ServiceRequest'))||[];
  return jsonResponse({success:true,message:'Service requests fetched successfully',...(data.length?{data:data.map(v=>wireModel('ServiceRequest',v))}:{})});
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
  const service=await getRecord(COLLECTIONS.services,s(req.serviceId),'Service');if(!service)return fail('Service not found',404);
  let image='';if(req.image)image=await bestEffort(async()=>{
    const value=s(req.image);return /^https?:\/\//.test(value)?value:uploadBase64(value,`service-requests/${randomUUID()}`,'image');
  })||'';
  const now=new Date();const value=model('ServiceRequest',{...req,id:randomUUID(),userName:profile.name,userEmail:profile.email,userPhone:profile.phoneNumber,serviceName:service.name,image,status:'pending',createdAt:now,updatedAt:now});
  await getDatabase().collection(COLLECTIONS.serviceRequests).doc(s(value.id)).set(storeModel('ServiceRequest',value));
  await bestEffort(async()=>{
    const property=await getProperty(s(req.propertyId));
    await createNotification({...notificationContext(property,profile,s(req.userUID),s(req.propertyId)),type:'service_request',title:'New Service Request',message:`Service request from ${s(profile.name)} for ${s(service.name)}`,serviceType:service.name,serviceComment:req.message,serviceImage:image});
  });
  return jsonResponse({success:true,message:'Service request created successfully. One of our members will reach out to you soon!',serviceRequest:wireModel('ServiceRequest',value)},201);
}
export async function updateServiceRequest(request:Request,id:string) {
  requireAdmin(await identity(request));let req:RecordData;
  try{req=await strings(request,['status','adminNotes']);}catch{return fail('Invalid request body',400);}
  await getDatabase().collection(COLLECTIONS.serviceRequests).doc(id).update({status:req.status,updatedAt:new Date(),...(req.adminNotes?{adminNotes:req.adminNotes}:{})});
  return jsonResponse({success:true,message:'Service request updated successfully'});
}

export async function createReportOrReview(request:Request,kind:'report'|'review') {
  const user=await identity(request,true);let req:RecordData;
  try{req=await readModel(request,kind==='report'?'CreateInspectionReportRequest':'CreateReviewRequest');}catch{return plainError('Invalid request body',400);}
  if(kind==='report'&&!['on_possession','on_handover'].includes(s(req.reportType)))return plainError("Invalid report type. Must be 'on_possession' or 'on_handover'",400);
  if(kind==='review'&&!['tenant','owner'].includes(s(req.reviewerType)))return plainError("Invalid reviewer type. Must be 'tenant' or 'owner'",400);
  const profile=await getUser(user.uid);if(!profile)return plainError('User not found',404);
  const property=await getProperty(s(req.propertyId));if(!property)return plainError('Property not found',404);
  // The Go handlers allow any registered user to submit; retain that permission.
  const now=new Date(),name=kind==='report'?'InspectionReport':'Review',collection=kind==='report'?COLLECTIONS.inspectionReports:COLLECTIONS.reviews;
  const tenant=((property.tenants as RecordData[]|null)||[])[0]||{};
  const value=model(name,{...req,id:randomUUID(),propertyTitle:property.title,createdAt:now,updatedAt:now,
    ...(kind==='report'?{userId:user.uid,userName:profile.name,userEmail:profile.email,userPhone:profile.phoneNumber}:
      {reviewerId:user.uid,reviewerName:profile.name,reviewerEmail:profile.email,reviewerPhone:profile.phoneNumber,ownerId:property.ownerUID,ownerName:property.ownerName,ownerEmail:property.ownerEmail,ownerPhone:property.primaryNo,tenantId:s(tenant.id),tenantName:tenant.firstName?`${s(tenant.firstName)} ${s(tenant.lastName)}`:''})});
  await getDatabase().collection(collection).doc(s(value.id)).set(storeModel(name,value));
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
  // Original read handlers are available to registered users, including admin dialogs.
  if(field==='userId')requireSelfOrAdmin(user,id);
  const data=await getRecords(getDatabase().collection(COLLECTIONS.inspectionReports).where(field,'==',id).orderBy('createdAt','desc'),'InspectionReport');
  return jsonResponse({success:true,reports:data.length?data.map(v=>wireModel('InspectionReport',v)):null});
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
  await ref.set(storeModel('SiteSettings',value));
  return jsonResponse({success:true,message:'Site settings updated successfully',settings:wireModel('SiteSettings',value)});
}
