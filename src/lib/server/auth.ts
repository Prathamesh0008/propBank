import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdminAuth } from './firebase-admin';
import { COLLECTIONS, getDatabase } from './firestore';
import { indianMobile } from '@/lib/indian-phone';

export type UserRole = 'admin' | 'agent' | 'individual';

export interface AuthenticatedUser {
  uid: string;
  role: UserRole;
  email: string;
  phoneNumber: string;
  token: DecodedIdToken;
}

export const PROFILE_ROLES:readonly UserRole[]=['admin','agent','individual'];

export function completedProfile(data:FirebaseFirestore.DocumentData|undefined,token:DecodedIdToken):boolean {
  if(!data||data.isActive===false||!PROFILE_ROLES.includes(data.role))return false;
  if(typeof data.name!=='string'||data.name.trim().length<2)return false;
  if(!indianMobile(typeof data.phoneNumber==='string'?data.phoneNumber:''))return false;
  const firebaseEmail=typeof token.email==='string'?token.email.trim().toLowerCase():'';
  const profileEmail=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  return token.email_verified===true&&!!firebaseEmail&&profileEmail===firebaseEmail;
}

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403, message: string,public readonly code?:string) {
    super(message);
    this.name = 'AccessError';
  }
}

export async function verifyFirebaseIdentity(request: Request): Promise<DecodedIdToken> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '');
  if (!match) throw new AccessError(401, 'Firebase ID token required');
  // Initialization errors are configuration failures, not invalid user tokens.
  const auth = getFirebaseAdminAuth();
  try {
    return await auth.verifyIdToken(match[1], true);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code && ['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
      'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(code)) {
      throw new AccessError(401, 'Invalid or expired Firebase ID token');
    }
    throw error;
  }
}

export async function requireUser(request: Request): Promise<AuthenticatedUser> {
  const token = await verifyFirebaseIdentity(request);
  return userFromToken(token);
}
export async function userFromToken(token:DecodedIdToken):Promise<AuthenticatedUser> {
  if(token.email_verified!==true)throw new AccessError(403,'Verify your email before accessing PropBank','EMAIL_VERIFICATION_REQUIRED');
  let currentToken=token;
  try{
    const account=await getFirebaseAdminAuth().getUser(token.uid);
    if(account.disabled)throw new AccessError(403,'Active user profile required','ACCOUNT_DISABLED');
    if(!account.emailVerified)throw new AccessError(403,'Verify your email before accessing PropBank','EMAIL_VERIFICATION_REQUIRED');
    currentToken={...token,email:account.email||'',email_verified:account.emailVerified} as DecodedIdToken;
  }catch(error){if(error instanceof AccessError)throw error;const code=(error as {code?:string}).code;if(code==='auth/user-not-found')throw new AccessError(403,'Active user profile required','ACCOUNT_DISABLED');throw error;}
  const profile = await getDatabase().collection(COLLECTIONS.users).doc(token.uid).get();
  const data = profile.data();
  if (!data) throw new AccessError(403, 'Active user profile required','ACCOUNT_PROFILE_REQUIRED');
  if (data.isActive === false) throw new AccessError(403, 'Active user profile required','ACCOUNT_DISABLED');
  if(!completedProfile(data,currentToken))throw new AccessError(403,'Complete your account profile before accessing PropBank','ACCOUNT_PROFILE_REQUIRED');
  return {
    uid: token.uid,
    role: data.role,
    email: data.email || token.email || '',
    phoneNumber: data.phoneNumber || '',
    token:currentToken,
  };
}
