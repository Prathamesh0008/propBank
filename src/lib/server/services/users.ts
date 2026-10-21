import 'server-only';
import { AccessError, requireUser, verifyFirebaseIdentity } from '../auth';
import { COLLECTIONS, getDatabase } from '../firestore';
import { getFirebaseAdminAuth } from '../firebase-admin';
import { ApiError, jsonResponse } from '../http';
import { model, storeModel, stringValue, wireModel, type RecordData, isRecord } from './contracts';
import { queueUserEvent } from './transactional-email';

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
export async function userIdentity(request: Request, target?: string) {
  const token = await verifyFirebaseIdentity(request);
  const existing = await getUser(token.uid);
  if (existing?.isActive === false) throw new AccessError(403,'Active user profile required');
  const admin = existing?.role === 'admin';
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
    return result;
  } catch { return null; }
}
async function checkPhone(uid:string,phone:string) {
  const other = await findUser('phoneNumber',phone);
  return !!other && other.uid !== uid;
}
function checkRole(admin:boolean,requested:unknown,existing:RecordData|null) {
  if (!admin && requested === 'agent' && existing?.role !== 'agent') throw new AccessError(403,'Administrator access required to assign agent role');
  if (!admin && requested === 'admin' && existing?.role !== 'admin') throw new AccessError(403,'Administrator access required to assign admin role');
  if (!admin && existing?.role === 'admin' && requested && requested !== existing.role) throw new AccessError(403,'Administrator access required to change admin role');
}

export async function listUsers(request:Request) {
  const identity = await userIdentity(request);
  if (!identity.admin) throw new AccessError(403,'Administrator access required');
  const docs = await userCollection().get();
  const users: RecordData[] = [];
  for (const doc of docs.docs) {
    try { const user=model('User',doc.data()); if(!user.uid) user.uid=doc.id; users.push(wireModel('User',user)); } catch { /* Go skips invalid documents. */ }
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
  return user ? success('User fetched successfully',user) : jsonResponse({success:false,message:'User not registered'});
}
export async function searchUser(request:Request) {
  const caller=await requireUser(request);
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

export async function createUser(request:Request,authRegistration=false) {
  const identity=await userIdentity(request);
  const req=await parseUser(request);
  if (!req) return fail(authRegistration?'Invalid request body':'Invalid JSON',400);
  if (!req.uid || !req.email || !req.name || (authRegistration && !req.phoneNumber)) return fail(authRegistration?'Missing required fields: uid, email, name, phoneNumber':'Missing required fields: uid, email, name',400);
  const uid=stringValue(req.uid);
  if (uid!==identity.token.uid && !identity.admin) throw new AccessError(403,'Access denied');
  req.role ||= 'individual';
  if (!['admin','agent','individual'].includes(stringValue(req.role))) return fail("Invalid role. Must be 'admin', 'agent', or 'individual'",400);
  const existing=await getUser(uid);
  checkRole(identity.admin,req.role,existing);
  if(uid===identity.token.uid && stringValue(req.email).toLowerCase()!==identity.token.email?.toLowerCase())return fail('Email must match Firebase identity',400);
  const phone=normalizePhone(stringValue(req.phoneNumber));
  if (phone && await checkPhone(uid,phone)) return fail(duplicateMessage,409);
  const now=new Date();
  const user={...existing,...model('User',{...req,phoneNumber:phone,isActive:existing?.isActive!==false,createdAt:existing?.createdAt||now,updatedAt:now})};
  if(!identity.admin && existing?.role)user.role=existing.role;
  if (authRegistration && existing) {
    user.createdAt=existing.createdAt;
    if (existing.phoneNumber && existing.role) { user.phoneNumber=existing.phoneNumber; user.role=existing.role; }
    else if (existing.role && req.role==='individual') user.role=existing.role;
  }
  await saveUser(user);
  if(authRegistration&&!existing)queueUserEvent({eventType:'user.registration_welcome',eventId:`user:${uid}:registered`,recipients:[{uid,role:'user'}],recordId:uid,templateId:'registration-welcome',subject:'Welcome to PropBank',title:'Welcome to PropBank',bodyHtml:`<p>Your PropBank account is ready.</p><p>You can now manage property, tenancy, visits and account activity from your secure account.</p>`,bodyText:'Your PropBank account is ready. You can now manage property, tenancy, visits and account activity from your secure account.',action:{label:'Open your account',path:'/manage-property'}});
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
    const now=new Date();
    const user=model('User',{...req,uid,role:req.role||'individual',phoneNumber:normalizePhone(stringValue(req.phoneNumber)),isActive:true,createdAt:now,updatedAt:now});
    await saveUser(user);
    return success('User created successfully',user,201);
  }
  for (const key of ['name','photoURL','email']) if(req[key]) existing[key]=req[key];
  if (req.phoneNumber) {
    const phone=normalizePhone(stringValue(req.phoneNumber));
    if (await checkPhone(uid,phone)) return fail(duplicateMessage,409);
    if(existing.phoneNumber&&phone!==existing.phoneNumber) {
      const authTime=Number(identity.token.auth_time||0),recent=authTime>0&&Date.now()/1000-authTime<=300;
      if(!recent)throw new AccessError(403,'Recent authentication is required to change the mobile number');
      const verified=normalizePhone(stringValue(identity.token.phone_number));
      if(!verified||verified!==phone)throw new ApiError(503,'Mobile number change is blocked until ownership of the new number is verified');
    }
    existing.phoneNumber=phone;
  }
  if (['admin','agent','individual'].includes(stringValue(req.role))) existing.role=req.role;
  existing.updatedAt=new Date();
  await saveUser(existing);
  if(req.phoneNumber&&normalizePhone(stringValue(req.phoneNumber))!==normalizePhone(stringValue(identity.existing?.phoneNumber)))queueUserEvent({eventType:'user.mobile_number_changed',eventId:`user:${uid}:phone:${normalizePhone(stringValue(req.phoneNumber))}`,recipients:[{uid,role:'user'},{role:'admin',email:process.env.ADMIN_EMAIL}],recordId:uid,templateId:'mobile-number-changed',subject:'Your PropBank mobile number changed',title:'Mobile number updated',bodyHtml:'<p>The verified mobile number on this PropBank account was changed.</p><p>If you did not make this change, sign in and review your account immediately.</p>',bodyText:'The verified mobile number on this PropBank account was changed. If you did not make this change, sign in and review your account immediately.',action:{label:'Review account',path:'/manage-property'}});
  return success('User updated successfully',existing);
}
