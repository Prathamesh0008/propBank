import 'server-only';
import { indianMobile } from '@/lib/indian-phone';
import { getDatabase, COLLECTIONS } from './firestore';
import { ApiError } from './http';
import { getFirebaseAdminAuth } from './firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { MOBILE_REGISTRY, MOBILE_REGISTRY_STATE, MOBILE_REGISTRY_VERSION, MOBILE_REGISTRY_ACCOUNTS, MOBILE_RESERVATION_POLICY, mobileKey } from './mobile-registry-policy';
export { MOBILE_REGISTRY, MOBILE_REGISTRY_STATE, MOBILE_REGISTRY_VERSION, MOBILE_REGISTRY_ACCOUNTS, MOBILE_RESERVATION_POLICY, mobileKey } from './mobile-registry-policy';
export const MOBILE_CONFLICT_MESSAGE = 'Number already registered. Use a different number.';

export function canonicalMobile(value: unknown): string {
  const phone = indianMobile(value);
  if (!phone) throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9', 'INVALID_MOBILE_NUMBER');
  return phone;
}
const unresolved = () => new ApiError(409, 'Your registered mobile requires a separately authorized account resolution. Contact support.', 'MOBILE_RESOLUTION_REQUIRED');
const inconsistent = () => new ApiError(503, 'Mobile ownership requires administrator reconciliation.', 'MOBILE_REGISTRY_INCONSISTENT');
const owned = (data: FirebaseFirestore.DocumentData | undefined, uid: string) => data?.version === MOBILE_REGISTRY_VERSION && data?.status === 'owned' && data?.ownerUID === uid;
const legacyConflict = () => new ApiError(409, 'This number is reserved because of an unresolved legacy account conflict. Use a different number or contact support.', 'MOBILE_LEGACY_CONFLICT');

export async function requireActiveRegistry(tx: Transaction, db: Firestore) {
  if (process.env.PROPBANK_MOBILE_BACKEND === 'mongodb') {
    const {withMongoMobile} = await import('./mongo-mobile-store');
    await withMongoMobile(store => store.checkReady());
    return;
  }
  if (process.env.NODE_ENV === 'production') throw new ApiError(503, 'Mobile ownership configuration is not ready.', 'MONGO_MOBILE_NOT_READY');
  const control = (await tx.get(db.collection(MOBILE_REGISTRY_STATE).doc('main'))).data();
  if (control?.status !== 'active' || control.version !== MOBILE_REGISTRY_VERSION || control.reservationPolicy !== MOBILE_RESERVATION_POLICY) {
    throw new ApiError(503, 'Mobile registration is not activated for this environment. Contact support; your number has not been marked as registered.', 'MOBILE_REGISTRY_NOT_READY');
  }
}

/** Mongo mode uses its own verified control gate; the existing WAF freeze is
 * released separately. Legacy Firestore readiness never opens Mongo writes. */
export async function requireMobileRegistrationUnfrozen() {
  if (process.env.PROPBANK_MOBILE_BACKEND === 'mongodb') {
    const {withMongoMobile} = await import('./mongo-mobile-store');
    await withMongoMobile(store => store.checkReady());
    return;
  }
  const db = getDatabase();
  await db.runTransaction(tx => requireActiveRegistry(tx, db));
}

export async function reconcileMobileConfirmation(uid: string, profile: FirebaseFirestore.DocumentData) {
  if (process.env.PROPBANK_MOBILE_BACKEND !== 'mongodb' || typeof profile._mobileClaimOperation !== 'string') return;
  const {withMongoMobile} = await import('./mongo-mobile-store');
  await withMongoMobile(store => store.reconcile(uid, profile._mobileClaimOperation, indianMobile(profile.phoneNumber), requireMobileRegistrationUnfrozen));
}

/** A missing claim is not evidence that a legacy contact is free. Exact-value
 * queries cannot cover arbitrary historical spacing or national prefixes. Until
 * every legacy writer is retired, read canonical profile contacts in the same
 * transaction before making a NEW claim. Normal login/metadata edits never scan.
 */
async function readAvailableClaim(tx: Transaction, db: Firestore, phone: string, uid: string) {
  const claim = await tx.get(db.collection(MOBILE_REGISTRY).doc(mobileKey(phone))), target = claim.data();
  if (claim.exists) {
    if (uid && owned(target, uid)) return claim;
    if (target?.version === MOBILE_REGISTRY_VERSION && target.status === 'blocked' && !('ownerUID' in target) && Number.isInteger(target.memberCount) && target.memberCount >= 2 && /^[a-f0-9]{64}$/.test(target.membersFingerprint)) throw legacyConflict();
    if (target?.version === MOBILE_REGISTRY_VERSION && target.status === 'owned' && typeof target.ownerUID === 'string' && target.ownerUID && target.ownerUID !== uid) {
      const owner = (await tx.get(db.collection(COLLECTIONS.users).doc(target.ownerUID))).data();
      if (!owner || indianMobile(owner.phoneNumber) !== phone) throw inconsistent();
      throw new ApiError(409, MOBILE_CONFLICT_MESSAGE, 'MOBILE_ALREADY_REGISTERED');
    }
    throw inconsistent();
  }
  const profiles = await tx.get(db.collection(COLLECTIONS.users).select('phoneNumber'));
  const owners = profiles.docs.filter(doc => doc.id !== uid && indianMobile(doc.data().phoneNumber) === phone);
  if (owners.length > 1) throw legacyConflict();
  if (owners.length === 1) throw new ApiError(409, MOBILE_CONFLICT_MESSAGE, 'MOBILE_ALREADY_REGISTERED');
  return claim;
}

/** Anonymous read-only gate before the browser creates a password identity.
 * This is not a reservation or an authorization to write: the final profile
 * transaction repeats every ownership/readiness check, including under races.
 */
export async function preflightMobileRegistration(value: unknown) {
  if (process.env.PROPBANK_MOBILE_BACKEND === 'mongodb') {
    await requireMobileRegistrationUnfrozen();
    const phone = canonicalMobile(value);
    const {withMongoMobile} = await import('./mongo-mobile-store');
    await withMongoMobile(store => store.available(phone));
    await checkAuthPhone('', phone);
    return;
  }
  const phone = canonicalMobile(value), db = getDatabase();
  await db.runTransaction(async tx => {
    await requireActiveRegistry(tx, db);
    await readAvailableClaim(tx, db, phone, '');
  });
  await checkAuthPhone('', phone);
}
export type WriteOptions = { createOnly?: boolean; expectedPhone: unknown; repairContact?: boolean; metadataOnly?: boolean; confirmPending?: boolean; stage?: (tx: Transaction) => Promise<() => void> };

export function authorizeContactRepair(token: DecodedIdToken) {
  const age = Date.now() / 1000 - Number(token.auth_time || 0);
  if (token.email_verified !== true || !Number(token.auth_time) || age < -30 || age > 300) {
    throw new ApiError(403, 'Sign in again with your verified email to correct your mobile number.', 'MOBILE_CORRECTION_REAUTH_REQUIRED');
  }
}

async function checkAuthPhone(uid: string, phone: string) {
  try {
    const account = await getFirebaseAdminAuth().getUserByPhoneNumber(phone);
    if (account.uid !== uid) throw new ApiError(409, MOBILE_CONFLICT_MESSAGE, 'MOBILE_ALREADY_REGISTERED');
  } catch (error) {
    if ((error as {code?: string}).code !== 'auth/user-not-found') throw error;
  }
}

/** Callers still authorize the UID. A metadata edit never changes a contact or
 * touches claims, so inactive controls and legacy conflicts cannot block it. */
export async function writeUserMetadata(uid: string, data: FirebaseFirestore.DocumentData, expectedPhone: unknown, checkPhone=true, stage?: WriteOptions['stage']) {
  const db = getDatabase(), ref = db.collection(COLLECTIONS.users).doc(uid);
  const metadata = {...data}; delete metadata.phoneNumber;
  // Ownership generations belong to the mobile-write saga. A stale generic
  // profile save must not replace its marker, including after an A -> B -> A edit.
  delete metadata._mobileClaimOperation;
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) throw new ApiError(409, 'Account profile changed. Refresh and try again.', 'MOBILE_PROFILE_CHANGED');
    if (checkPhone && (current.data()?.phoneNumber ?? '') !== (expectedPhone ?? '')) throw new ApiError(409, 'Your account changed. Refresh and try again.', 'MOBILE_PROFILE_CHANGED');
    const writeIntent = stage ? await stage(tx) : () => {};
    writeIntent();
    tx.set(ref, metadata, {merge:true});
  });
}

/** Trusted primitive: callers authorize UID and verified phone changes first.
 * Account state is separate from historical profiles, which migration never edits.
 * Ordinary requests cannot resolve a quarantine or release a blocked reservation.
 */
export async function writeUserWithMobile(uid: string, data: FirebaseFirestore.DocumentData, options: WriteOptions) {
  if (process.env.PROPBANK_MOBILE_BACKEND === 'mongodb') {
    const {writeMongoMobileProfile} = await import('./mongo-mobile-profile');
    return writeMongoMobileProfile(uid, data, options);
  }
  if (options.metadataOnly) {
    await writeUserMetadata(uid, data, options.expectedPhone, true, options.stage);
    return {phone: data.phoneNumber, created:false};
  }
  const phone = canonicalMobile(data.phoneNumber), key = mobileKey(phone);
  // Firebase's verified phone identity is also a reservation. Infrastructure
  // failures propagate; only user-not-found means this identity is available.
  if (!oldSamePhone(options.expectedPhone, phone)) await checkAuthPhone(uid, phone);
  const db = getDatabase(), userRef = db.collection(COLLECTIONS.users).doc(uid);
  const claimRef = db.collection(MOBILE_REGISTRY).doc(key);
  const accountRef = db.collection(MOBILE_REGISTRY_ACCOUNTS).doc(uid);
  const created = await db.runTransaction(async tx => {
    await requireActiveRegistry(tx, db);
    const current = await tx.get(userRef), before = current.data();
    const account = await tx.get(accountRef), state = account.data();
    if (options.createOnly && current.exists) {
      // An interrupted/concurrent registration for this UID may already have
      // committed. Return success without replaying stale profile fields.
      if (oldSamePhone(before?.phoneNumber, phone) && state?.state === 'owned' && state.version === MOBILE_REGISTRY_VERSION && state.phoneKey === key) {
        const priorClaim = (await tx.get(claimRef)).data();
        if (owned(priorClaim, uid)) return false;
      }
      throw new ApiError(409, 'Account profile already exists. Refresh and sign in again.', 'MOBILE_PROFILE_CHANGED');
    }
    if ((before?.phoneNumber ?? '') !== (options.expectedPhone ?? '')) throw new ApiError(409, 'Your account changed. Refresh and try again.', 'MOBILE_PROFILE_CHANGED');
    const oldPhone = indianMobile(before?.phoneNumber);
    if (current.exists) {
      if (state?.version !== MOBILE_REGISTRY_VERSION) throw inconsistent();
      if (state.state === 'missing' || state.state === 'invalid') {
        const raw = before?.phoneNumber;
        const kind = raw === undefined || raw === null || raw === '' ? 'missing' : 'invalid';
        if (oldPhone || state.state !== kind || 'phoneKey' in state) throw inconsistent();
        if (!options.repairContact) throw new ApiError(403, 'Sign in again with your verified email to correct your mobile number.', 'MOBILE_CORRECTION_REAUTH_REQUIRED');
      }
      if (state.state === 'conflicted') {
        // Allow already-authorized non-phone edits, retaining the EXACT legacy
        // contact value and never updating/releasing its blocked claim or state.
        if (!oldPhone || phone !== oldPhone) throw unresolved();
        const blocked = (await tx.get(claimRef)).data();
        if (state.phoneKey !== key || blocked?.version !== MOBILE_REGISTRY_VERSION || blocked.status !== 'blocked' || 'ownerUID' in blocked) throw inconsistent();
        const metadata = {...data}; delete metadata.phoneNumber;
        const writeIntent = options.stage ? await options.stage(tx) : () => {};
        writeIntent();
        tx.set(userRef, metadata, {merge:true});
        return false;
      }
      if (!['missing', 'invalid'].includes(state.state) && (state.state !== 'owned' || !oldPhone || state.phoneKey !== mobileKey(oldPhone))) throw inconsistent();
    } else if (account.exists) {
      // Deleting/recreating a profile cannot erase its unresolved account state.
      throw unresolved();
    }
    const claim = await readAvailableClaim(tx, db, phone, uid), target = claim.data();
    const oldRef = oldPhone && oldPhone !== phone ? db.collection(MOBILE_REGISTRY).doc(mobileKey(oldPhone)) : null;
    const oldClaim = oldRef ? await tx.get(oldRef) : null;
    // A second claim for this UID or a claim without its profile is drift, not
    // permission to resurrect/transfer a historical reservation.
    if (claim.exists && oldPhone !== phone) throw inconsistent();
    if (oldPhone && !(oldRef ? owned(oldClaim?.data(), uid) : owned(target, uid))) throw inconsistent();
    const now = new Date();
    const writeIntent = options.stage ? await options.stage(tx) : () => {};
    writeIntent();
    tx.set(claimRef, {version:MOBILE_REGISTRY_VERSION,status:'owned',ownerUID:uid,createdAt:target?.createdAt || now,updatedAt:now});
    if (oldRef) tx.delete(oldRef); // Only the verified OWNED claim above can reach this.
    tx.set(accountRef, {version:MOBILE_REGISTRY_VERSION,state:'owned',phoneKey:key,createdAt:state?.createdAt || now,updatedAt:now});
    tx.set(userRef, {...data,phoneNumber:phone}, {merge:true});
    return !current.exists;
  });
  return {phone,created:!!created};
}

function oldSamePhone(value: unknown, phone: string) { return indianMobile(value) === phone; }
