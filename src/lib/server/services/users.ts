import 'server-only';
import { AccessError, completedProfile, requireUser, verifyFirebaseIdentity } from '../auth';
import { COLLECTIONS, getDatabase } from '../firestore';
import { getFirebaseAdminAuth } from '../firebase-admin';
import { ApiError, jsonResponse } from '../http';
import {indianMobile} from '@/lib/indian-phone';
import { persistUserEvent } from './transactional-email';
import { authMetadata, recordAuthActivity } from './auth-activity';
import { model, storeModel, stringValue, wireModel, wireValue, type RecordData, isRecord } from './contracts';
import { discoverFor, verifiedMobile, validContact, throttleRelationshipAction } from './relationship-links';

export const normalizePhone = (phone: string) => phone.replace(/[^0-9+]/g,'');
const duplicateMessage = 'This phone number is already registered with another account';
const userCollection = () => getDatabase().collection(COLLECTIONS.users);
export async function getUser(uid: string): Promise<RecordData | null> {
  const doc = await userCollection().doc(uid).get();
  if (!doc.exists) return null;
  const raw=doc.data()||{};
  const user:RecordData = {...raw,...model('User',raw),isActive:raw.isActive!==false};
  user.uid = doc.id;
  return user;
}
export async function findUser(field: 'phoneNumber' | 'email', value: string): Promise<RecordData | null> {
  const docs = await userCollection().where(field,'==',value).limit(1).get();
  if (!docs.docs.length) return null;
  const user = model('User',docs.docs[0].data());
  user.uid = docs.docs[0].id;
  return user;
}
export async function saveUser(user: RecordData) {
  await userCollection().doc(stringValue(user.uid)).set({...user,...storeModel('User',user)},{merge:true});
}
// Resolve tenant links against Firebase Auth, never editable profile contacts.
export async function resolveTenantIdentity(email:string,uid=''):Promise<string> {
  try {
    const account=uid?await getFirebaseAdminAuth().getUser(uid):await getFirebaseAdminAuth().getUserByEmail(email);
    if(account.disabled || !account.email || account.email.toLowerCase()!==email.toLowerCase())throw new AccessError(403,'Tenant UID and Firebase email must match');
    const profile=await getUser(account.uid);
    if(!profile || profile.isActive===false) {if(uid)throw new AccessError(403,'Active tenant profile required');return '';}
    return account.uid;
  } catch(error) {
    if((error as {code?:string}).code==='auth/user-not-found') {if(uid)throw new AccessError(403,'Tenant account not found');return '';}
    throw error;
  }
}
export async function userIdentity(request: Request, target?: string,allowUnverifiedOnboarding=false) {
  const token = allowUnverifiedOnboarding?await verifyFirebaseIdentity(request):(await requireUser(request)).token;
  const existing = await getUser(token.uid);
  if (existing?.isActive === false) throw new AccessError(403,'Active user profile required');
  const admin = !allowUnverifiedOnboarding&&existing?.role === 'admin';
  if (target && target !== token.uid && !admin) throw new AccessError(403,'Access denied');
  return {token,admin,existing};
}
const fail = (message:string,status:number) => jsonResponse({success:false,message},status);
const success = (message:string,user:RecordData,status=200) => jsonResponse({success:true,message,user:wireModel('User',user)},status);
async function parseUser(request: Request): Promise<RecordData | null> {
  try {
    const data: unknown = await request.json();
    // Go permits JSON null as a zero struct.
    if (data !== null && !isRecord(data)) return null;
    const result: RecordData = {};
    for (const key of ['uid','email','name','photoURL','phoneNumber','role']) {
      const source = Object.keys(data || {}).find(k=>k.toLowerCase()===key.toLowerCase());
      const value = source ? (data as RecordData)[source] : null;
      if (value != null && typeof value !== 'string') return null;
      result[key] = value ?? '';
    }
    const activeKey=Object.keys(data||{}).find(key=>key.toLowerCase()==='isactive');
    if(activeKey){if(typeof (data as RecordData)[activeKey]!=='boolean')return null;result.isActive=(data as RecordData)[activeKey];}
    return result;
  } catch { return null; }
}
async function checkPhone(uid:string,phone:string) {
  const other = await findUser('phoneNumber',phone);
  return !!other && other.uid !== uid;
}
function checkRole(admin:boolean,requested:unknown,existing:RecordData|null,initialRegistration=false) {
  if (!admin && requested === 'agent' && existing?.role !== 'agent' && !initialRegistration) throw new AccessError(403,'Agent role may only be selected during initial registration');
  if (!admin && requested === 'admin' && existing?.role !== 'admin') throw new AccessError(403,'Administrator access required to assign admin role');
  if (!admin && existing?.role === 'admin' && requested && requested !== existing.role) throw new AccessError(403,'Administrator access required to change admin role');
}

export async function listUsers(request:Request) {
  const identity = await userIdentity(request);
  if (!identity.admin) throw new AccessError(403,'Administrator access required');
  const docs = await userCollection().get();
  const users: RecordData[] = [];
  for (const doc of docs.docs) {
    try { const user=model('User',doc.data()); if(!user.uid) user.uid=doc.id;let authentication:RecordData={};try{authentication=authMetadata(await getFirebaseAdminAuth().getUser(doc.id));}catch{authentication={accountStatus:'missing_auth_account',providerIds:[],emailVerified:false};}users.push({...wireModel('User',user),...authentication}); } catch { /* Skip invalid documents. */ }
  }
  return jsonResponse({success:true,message:'Users fetched successfully',...(users.length?{data:users}:{})});
}
export async function searchUsersForAdmin(request:Request) {
  const caller=await requireUser(request);
  if(caller.role!=='admin')throw new AccessError(403,'Administrator access required');
  const query=(new URL(request.url).searchParams.get('q')||'').trim().toLowerCase();
  if(query.length<2)return fail('Enter at least 2 characters',400);
  if(query.length>100)return fail('Search is too long',400);
  const docs=await userCollection().get();
  const matches:RecordData[]=[];
  for(const doc of docs.docs) {
    const raw=doc.data();
    const fields=[stringValue(raw.name),stringValue(raw.email),stringValue(raw.phoneNumber)].map(value=>value.toLowerCase());
    if(!fields.some(value=>value.includes(query)))continue;
    let authActive=false;
    try { authActive=!(await getFirebaseAdminAuth().getUser(doc.id)).disabled; } catch { authActive=false; }
    matches.push({uid:doc.id,name:raw.name,email:raw.email,phoneNumber:raw.phoneNumber,role:raw.role,isActive:raw.isActive!==false&&authActive});
    if(matches.length===20)break;
  }
  return jsonResponse({success:true,users:matches});
}
export async function readUser(request:Request,uid:string) {
  const identity=await userIdentity(request);
  const user=await getUser(uid);
  if(user && !identity.admin && uid!==identity.token.uid)return jsonResponse({success:true,message:'User fetched successfully',user:{uid:user.uid,name:user.name,photoURL:user.photoURL,role:user.role}});
  if(!user)return jsonResponse({success:false,message:'User not registered'});
  if(identity.admin){let authentication:RecordData={};try{authentication=authMetadata(await getFirebaseAdminAuth().getUser(uid));}catch{authentication={accountStatus:'missing_auth_account',providerIds:[],emailVerified:false};}const properties=await getDatabase().collection(COLLECTIONS.properties).get(),owned:string[]=[],rented:string[]=[];for(const doc of properties.docs){const property=doc.data();if(property.ownerUID===uid)owned.push(doc.id);if(Array.isArray(property.tenants)&&property.tenants.some((tenant:RecordData)=>tenant.isActive===true&&tenant.userUID===uid))rented.push(doc.id);}const activity=await getDatabase().collection('auth_activity').where('targetUID','==',uid).get();const authActivity=activity.docs.map(doc=>wireValue({...doc.data(),id:doc.id})).sort((a,b)=>+new Date((b as RecordData).createdAt as string)-+new Date((a as RecordData).createdAt as string)).slice(0,100);return jsonResponse({success:true,message:'User fetched successfully',user:{...wireModel('User',user),...authentication,relationships:{ownedPropertyIds:owned,rentedPropertyIds:rented},authActivity}});}
  return success('User fetched successfully',user);
}
export async function searchUser(request:Request) {
  const caller=await requireUser(request);
  await throttleRelationshipAction(caller.uid,'lookup',30);
  if(caller.role!=='admin')return jsonResponse({success:true,verificationRequired:true,message:'Add the contact to create a pending invitation. Account details are not disclosed by phone lookup.'});
  const phone = new URL(request.url).searchParams.get('phone') || '';
  if (!phone) return fail('Phone number is required',400);
  const user=await findUser('phoneNumber',normalizePhone(phone));
  if(user) {
    const account=await getFirebaseAdminAuth().getUser(stringValue(user.uid));
    if(account.disabled)return fail('User account is inactive',404);
    user.email=account.email||'';
  }
  if(user&&caller.role!=='admin'&&caller.uid!==user.uid)return jsonResponse({success:true,message:'User found successfully',user:Object.fromEntries(['uid','name','email','phoneNumber','photoURL','role'].map(key=>[key,user[key]||'']))});
  return user ? success('User found successfully',user) : fail('User is not found. Please ask to sign up with our platform to continue.',404);
}

/** Only the signed-in UID's onboarding state; accepts no lookup identifiers. */
export async function registrationProfile(request:Request){
  const {existing,token}=await userIdentity(request,undefined,true);
  const profileExists=!!existing,profileComplete=completedProfile(existing||undefined,token);
  return jsonResponse({success:true,profileExists,profileComplete,status:profileComplete?'complete':'incomplete'});
}
export async function createUser(request:Request,authRegistration=false) {
  const identity=await userIdentity(request,undefined,authRegistration);
  const req=await parseUser(request);
  if (!req) return fail(authRegistration?'Invalid request body':'Invalid JSON',400);
  if (!req.uid || !req.email || !req.name) return fail('Missing required fields: uid, email, name',400);
  const uid=stringValue(req.uid);
  if (uid!==identity.token.uid && !identity.admin) throw new AccessError(403,'Access denied');
  req.role ||= 'individual';
  if (!['admin','agent','individual'].includes(stringValue(req.role))) return fail("Invalid role. Must be 'admin', 'agent', or 'individual'",400);
  const existing=await getUser(uid);
  if(!existing&&stringValue(req.name).trim().length<2)return fail('Enter your full name',400);
  if(authRegistration&&existing?.role)req.role=existing.role;
  checkRole(identity.admin,req.role,existing,authRegistration&&!existing?.role);
  if(identity.admin&&uid===identity.token.uid&&(req.role&&req.role!==existing?.role||'isActive' in req&&req.isActive!==existing?.isActive))throw new AccessError(403,'Use another administrator to change your own role or account status');
  if(uid===identity.token.uid && stringValue(req.email).toLowerCase()!==identity.token.email?.toLowerCase())return fail('Email must match Firebase identity',400);
  const phone=indianMobile(stringValue(existing?.phoneNumber))||indianMobile(req.phoneNumber);
  if(!phone&&(req.role!=='admin'||req.phoneNumber))return jsonResponse({success:false,message:'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9',fieldErrors:{phoneNumber:'Mobile number is required and must contain 10 digits starting with 6, 7, 8 or 9'}},400);
  if (phone && await checkPhone(uid,phone)) return fail(duplicateMessage,409);
  const now=new Date();
  let metadata:RecordData={};try{metadata=authMetadata(await getFirebaseAdminAuth().getUser(uid));}catch{/* Identity token validation remains authoritative. */}
  const user={...existing,...metadata,...model('User',{...req,phoneNumber:phone,isActive:existing?.isActive!==false,createdAt:existing?.createdAt||now,updatedAt:now})};
  if(!identity.admin && existing?.role)user.role=existing.role;
  if (authRegistration && existing) {
    user.createdAt=existing.createdAt;
    if (existing.phoneNumber && existing.role) { user.phoneNumber=existing.phoneNumber; user.role=existing.role; }
    else if (existing.role && req.role==='individual') user.role=existing.role;
  }
  if(!existing)await getDatabase().runTransaction(async tx=>{
    const ref=userCollection().doc(uid);
    if((await tx.get(ref)).exists)throw new ApiError(409,'Account profile already exists. Please sign in again.');
    tx.create(ref,{...user,...storeModel('User',user)});
  });else await saveUser(user);
  if(uid===identity.token.uid && identity.token.email_verified===true)await discoverFor({uid,token:identity.token,role:user.role as 'admin'|'agent'|'individual',email:stringValue(user.email),phoneNumber:''});
  if(authRegistration&&!existing)await recordAuthActivity({eventType:'registration',actorUID:uid,targetUID:uid,context:{providerIds:metadata.providerIds||[],emailVerified:metadata.emailVerified===true,source:'firebase'}}).catch(()=>null);
  if(authRegistration&&!existing)await persistUserEvent({eventType:'user.registration_welcome',eventId:`user:${uid}:registered`,recipients:[{uid,role:'user'}],recordId:uid,templateId:'registration-welcome',subject:'Welcome to PropBank',title:'Welcome to PropBank',bodyHtml:'<p>Your PropBank account is ready. You can now manage property and rental activity from your secure account.</p>',bodyText:'Your PropBank account is ready. You can now manage property and rental activity from your secure account.',action:{label:'Open your account',path:'/manage-property'}}).catch(()=>null);
  if(authRegistration&&!existing&&user.role==='agent')await persistUserEvent({eventType:'agent.registration',eventId:`agent:${uid}:registered`,recipients:[{uid,role:'agent'},{role:'admin',email:process.env.ADMIN_EMAIL}],recordId:uid,templateId:'agent-registration',subject:'Real estate agent account registered',title:'Agent account registered',bodyHtml:'<p>A Real Estate Agent account was registered with PropBank. Email verification is required before protected access.</p>',bodyText:'A Real Estate Agent account was registered with PropBank. Email verification is required before protected access.',action:{label:'Open PropBank',path:'/manage-property'}}).catch(()=>null);
  return success(authRegistration?(existing?'User updated successfully':'User created successfully'):'User created/updated successfully',user,authRegistration?200:201);
}
export async function updateUser(request:Request,uid:string) {
  const identity=await userIdentity(request,uid);
  const req=await parseUser(request);
  if (!req) return fail('Invalid JSON',400);
  if (req.role && !['admin','agent','individual'].includes(stringValue(req.role))) return fail("Invalid role. Must be 'admin', 'agent', or 'individual'",400);
  const existing=await getUser(uid);
  checkRole(identity.admin,req.role,existing);
  if(req.email && (uid!==identity.token.uid || stringValue(req.email).toLowerCase()!==identity.token.email?.toLowerCase()))return fail('Email must match Firebase identity',400);
  if (!existing) {
    if (!req.name) return fail('Creating new user requires a name',400);
    if (!req.email) return fail('Creating new user requires an email',400);
    const phone=indianMobile(req.phoneNumber);
    if(!phone&&(req.role!=='admin'||req.phoneNumber))return fail('A valid 10-digit Indian mobile number is required for a new profile',400);
    const now=new Date();
    const user=model('User',{...req,uid,role:req.role||'individual',phoneNumber:phone,isActive:true,createdAt:now,updatedAt:now});
    await saveUser(user);
    return success('User created successfully',user,201);
  }
  const previousRole=stringValue(existing.role),previousStatus=existing.isActive!==false;let phoneChanged=false;
  for (const key of ['name','photoURL','email']) if(req[key]) existing[key]=req[key];
  if (req.phoneNumber) {
    const phone=normalizePhone(stringValue(req.phoneNumber));
    if (await checkPhone(uid,phone)) return fail(duplicateMessage,409);
    if(phone!==normalizePhone(stringValue(existing.phoneNumber))){
      if(uid!==identity.token.uid)return fail('Only the account owner can change the registered mobile number',403);
      const authenticatedAt=Number(identity.token.auth_time||0),verifiedPhone=normalizePhone(stringValue(identity.token.phone_number));
      if(!authenticatedAt||Date.now()/1000-authenticatedAt>300)return fail('Recent authentication is required to change the mobile number',403);
      validContact(phone);
      if(!verifiedPhone||verifiedPhone!==phone||await verifiedMobile({uid,token:identity.token,role:existing.role as 'admin'|'agent'|'individual',email:stringValue(existing.email),phoneNumber:''})!==phone)return fail('Verified phone ownership is not configured or the new number has not been verified',503);
      phoneChanged=true;
    }
    existing.phoneNumber=phone;
  }
  if (['admin','agent','individual'].includes(stringValue(req.role))) existing.role=req.role;
  if('isActive' in req){if(!identity.admin)throw new AccessError(403,'Administrator access required to change account status');existing.isActive=req.isActive;await getFirebaseAdminAuth().updateUser(uid,{disabled:req.isActive===false});}
  existing.updatedAt=new Date();
  await saveUser(existing);
  if(previousRole!==existing.role)await recordAuthActivity({eventType:'role_changed',actorUID:identity.token.uid,targetUID:uid,context:{previousRole,role:existing.role,source:'admin'}}).catch(()=>null);
  if(previousStatus!==(existing.isActive!==false))await recordAuthActivity({eventType:'account_status_changed',actorUID:identity.token.uid,targetUID:uid,context:{previousStatus:previousStatus?'active':'inactive',status:existing.isActive===false?'inactive':'active',source:'admin'}}).catch(()=>null);
  if(['name','photoURL','email'].some(key=>req[key]))await recordAuthActivity({eventType:'profile_changed',actorUID:identity.token.uid,targetUID:uid,context:{source:identity.admin?'admin':'self'}}).catch(()=>null);
  if(uid===identity.token.uid)await discoverFor({uid,token:identity.token,role:existing.role as 'admin'|'agent'|'individual',email:stringValue(existing.email),phoneNumber:''});
  if(phoneChanged){
    const phone=normalizePhone(stringValue(req.phoneNumber)),eventId=`user:${uid}:phone:${phone}`;
    const audit=getDatabase().collection(COLLECTIONS.adminNotifications).doc(eventId.replaceAll(':','-'));
    await Promise.allSettled([
      persistUserEvent({eventType:'user.mobile_number_changed',eventId,recipients:[{uid,role:'user'},{role:'admin',email:process.env.ADMIN_EMAIL}],recordId:uid,templateId:'mobile-number-changed',subject:'Your PropBank mobile number changed',title:'Mobile number updated',bodyHtml:'<p>The verified mobile number on this PropBank account was changed.</p><p>If you did not make this change, review your account immediately.</p>',bodyText:'The verified mobile number on this PropBank account was changed. If you did not make this change, review your account immediately.',action:{label:'Review account',path:'/manage-property'}}),
      audit.set({id:audit.id,type:'security_mobile_changed',title:'Verified mobile number changed',message:'A user changed their verified mobile number.',userId:uid,timestamp:new Date(),createdAt:new Date(),updatedAt:new Date(),isRead:false,priority:'high'}),
    ]);
  }
  return success('User updated successfully',existing);
}
