import 'server-only';
import { indianMobile } from '@/lib/indian-phone';
import { getDatabase, COLLECTIONS } from './firestore';
import { ApiError } from './http';
import { MOBILE_REGISTRY, MOBILE_REGISTRY_STATE, MOBILE_REGISTRY_VERSION, MOBILE_REGISTRY_ACCOUNTS, MOBILE_RESERVATION_POLICY, mobileKey } from './mobile-registry-policy';
export { MOBILE_REGISTRY, MOBILE_REGISTRY_STATE, MOBILE_REGISTRY_VERSION, MOBILE_REGISTRY_ACCOUNTS, MOBILE_RESERVATION_POLICY, mobileKey } from './mobile-registry-policy';
export const MOBILE_CONFLICT_MESSAGE = 'This mobile number is already registered. Please use a different mobile number.';

export function canonicalMobile(value: unknown): string {
  const phone = indianMobile(value);
  if (!phone) throw new ApiError(400, 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9', 'INVALID_MOBILE_NUMBER');
  return phone;
}
const unresolved = () => new ApiError(409, 'Your registered mobile requires a separately authorized account resolution. Contact support.', 'MOBILE_RESOLUTION_REQUIRED');
const inconsistent = () => new ApiError(503, 'Mobile ownership requires administrator reconciliation.', 'MOBILE_REGISTRY_INCONSISTENT');
const owned = (data: FirebaseFirestore.DocumentData | undefined, uid: string) => data?.version === MOBILE_REGISTRY_VERSION && data?.status === 'owned' && data?.ownerUID === uid;
type WriteOptions = { createOnly?: boolean; expectedPhone: unknown; stage?: (tx:FirebaseFirestore.Transaction)=>Promise<()=>void> };

/** Trusted primitive: callers authorize UID and verified phone changes first.
 * Account state is separate from historical profiles, which migration never edits.
 * Ordinary requests cannot resolve a quarantine or release a blocked reservation.
 */
export async function writeUserWithMobile(uid: string, data: FirebaseFirestore.DocumentData, options: WriteOptions) {
  const phone = canonicalMobile(data.phoneNumber), key = mobileKey(phone);
  const db = getDatabase(), userRef = db.collection(COLLECTIONS.users).doc(uid);
  const claimRef = db.collection(MOBILE_REGISTRY).doc(key);
  const accountRef = db.collection(MOBILE_REGISTRY_ACCOUNTS).doc(uid);
  await db.runTransaction(async tx => {
    const control = (await tx.get(db.collection(MOBILE_REGISTRY_STATE).doc('main'))).data();
    if (control?.status !== 'active' || control.version !== MOBILE_REGISTRY_VERSION || control.reservationPolicy !== MOBILE_RESERVATION_POLICY) {
      throw new ApiError(503, 'Mobile registration is temporarily unavailable. Please try again later.', 'MOBILE_REGISTRY_NOT_READY');
    }
    const current = await tx.get(userRef), before = current.data();
    const account = await tx.get(accountRef), state = account.data();
    if (options.createOnly && current.exists) throw new ApiError(409, 'Account profile already exists. Please sign in again.');
    if ((before?.phoneNumber ?? '') !== (options.expectedPhone ?? '')) throw new ApiError(409, 'Your account changed. Refresh and try again.', 'MOBILE_PROFILE_CHANGED');
    const oldPhone = indianMobile(before?.phoneNumber);
    if (current.exists) {
      if (state?.version !== MOBILE_REGISTRY_VERSION) throw inconsistent();
      if (state.state === 'missing' || state.state === 'invalid') throw unresolved();
      if (state.state === 'conflicted') {
        // Allow already-authorized non-phone edits, retaining the EXACT legacy
        // contact value and never updating/releasing its blocked claim or state.
        if (!oldPhone || phone !== oldPhone) throw unresolved();
        const blocked = (await tx.get(claimRef)).data();
        if (state.phoneKey !== key || blocked?.version !== MOBILE_REGISTRY_VERSION || blocked.status !== 'blocked' || 'ownerUID' in blocked) throw inconsistent();
        const metadata = {...data}; delete metadata.phoneNumber;
        const writeIntent=options.stage?await options.stage(tx):()=>{};
        writeIntent();tx.set(userRef, metadata, {merge:true});
        return;
      }
      if (state.state !== 'owned' || !oldPhone || state.phoneKey !== mobileKey(oldPhone)) throw inconsistent();
    } else if (account.exists) {
      // Deleting/recreating a profile cannot erase its unresolved account state.
      throw unresolved();
    }
    const claim = await tx.get(claimRef), target = claim.data();
    const oldRef = oldPhone && oldPhone !== phone ? db.collection(MOBILE_REGISTRY).doc(mobileKey(oldPhone)) : null;
    const oldClaim = oldRef ? await tx.get(oldRef) : null;
    if (claim.exists && !owned(target, uid)) throw new ApiError(409, MOBILE_CONFLICT_MESSAGE, 'MOBILE_ALREADY_REGISTERED');
    if (oldPhone && !(oldRef ? owned(oldClaim?.data(), uid) : owned(target, uid))) throw inconsistent();
    const writeIntent=options.stage?await options.stage(tx):()=>{};
    const now = new Date();
    writeIntent();tx.set(claimRef, {version:MOBILE_REGISTRY_VERSION,status:'owned',ownerUID:uid,createdAt:target?.createdAt || now,updatedAt:now});
    if (oldRef) tx.delete(oldRef); // Only the verified OWNED claim above can reach this.
    tx.set(accountRef, {version:MOBILE_REGISTRY_VERSION,state:'owned',phoneKey:key,createdAt:state?.createdAt || now,updatedAt:now});
    tx.set(userRef, {...data,phoneNumber:phone}, {merge:true});
  });
  return phone;
}
