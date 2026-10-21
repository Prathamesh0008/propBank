import 'server-only';

import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdminAuth } from './firebase-admin';
import { COLLECTIONS, getDatabase } from './firestore';

export type UserRole = 'admin' | 'agent' | 'individual';

export interface AuthenticatedUser {
  uid: string;
  role: UserRole;
  email: string;
  phoneNumber: string;
  token: DecodedIdToken;
}

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
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
  const profile = await getDatabase().collection(COLLECTIONS.users).doc(token.uid).get();
  const data = profile.data();
  if (!data || data.isActive === false) throw new AccessError(403, 'Active user profile required');
  if (!['admin', 'agent', 'individual'].includes(data.role)) {
    throw new AccessError(403, 'Valid persisted user role required');
  }
  return {
    uid: token.uid,
    role: data.role,
    email: data.email || token.email || '',
    phoneNumber: data.phoneNumber || '',
    token,
  };
}
