import 'server-only';
import { indianMobile } from '@/lib/indian-phone';
import { getFirebaseAdminAuth } from './firebase-admin';
import { getDatabase, COLLECTIONS } from './firestore';
import { ApiError } from './http';
import { canonicalMobile, requireActiveRegistry, requireMobileRegistrationUnfrozen, reconcileMobileConfirmation, writeUserMetadata, type WriteOptions } from './mobile-registry';
import { withMongoMobile } from './mongo-mobile-store';
import { MONGO_MOBILE_CONFLICT } from './mongo-mobile-policy';

const changed = () => new ApiError(409, 'Your account changed. Refresh and try again.', 'MOBILE_PROFILE_CHANGED');

/** Reserve -> Firestore CAS -> confirm. Never compensate by deleting Auth users,
 * profiles or reservations. An uncertain outcome retains BOTH numbers until a
 * same-UID retry proves the exact operation committed. */
export async function writeMongoMobileProfile(uid: string, data: FirebaseFirestore.DocumentData, options: WriteOptions) {
  const db = getDatabase(), ref = db.collection(COLLECTIONS.users).doc(uid);
  const snapshot = await ref.get(), before = snapshot.data();
  if (options.metadataOnly) {
    // A successful profile write followed by a failed Mongo confirmation lands
    // here on onboarding retry. Confirm only a matching persisted marker.
    if (options.confirmPending && typeof before?._mobileClaimOperation === 'string') {
      await reconcileMobileConfirmation(uid, before);
    }
    await writeUserMetadata(uid, data, options.expectedPhone, true, options.stage);
    return {phone:before?.phoneNumber,created:false};
  }
  await requireMobileRegistrationUnfrozen();
  const phone = canonicalMobile(data.phoneNumber), previousPhone = indianMobile(before?.phoneNumber);
  if ((before?.phoneNumber ?? '') !== (options.expectedPhone ?? '')) throw changed();
  const identity = await getFirebaseAdminAuth().getUser(uid);
  if (identity.disabled) throw new ApiError(403, 'Active user profile required');
  if (phone !== previousPhone) {
    try {
      const other = await getFirebaseAdminAuth().getUserByPhoneNumber(phone);
      if (other.uid !== uid) throw new ApiError(409, MONGO_MOBILE_CONFLICT, 'MOBILE_ALREADY_REGISTERED');
    } catch (error) { if ((error as {code?:string}).code !== 'auth/user-not-found') throw error; }
  }
  return withMongoMobile(async store => {
    const operation = await store.reserve(uid, phone, previousPhone, snapshot.exists, String(before?._mobileClaimOperation || 'initial'), options.repairContact === true);
    const created = await db.runTransaction(async tx => {
      await requireActiveRegistry(tx, db);
      const current = await tx.get(ref), profile = current.data();
      if (profile?._mobileClaimOperation === operation.id && indianMobile(profile.phoneNumber) === phone) return false;
      if (options.createOnly && current.exists || (profile?.phoneNumber ?? '') !== (options.expectedPhone ?? '') || String(profile?._mobileClaimOperation || 'initial') !== String(before?._mobileClaimOperation || 'initial')) throw changed();
      const writeIntent = options.stage ? await options.stage(tx) : () => {};
      writeIntent();
      tx.set(ref, {...data,phoneNumber:phone,_mobileClaimOperation:operation.id}, {merge:true});
      return !current.exists;
    });
    // Confirm only after the Firestore transaction resolved successfully.
    await store.confirm(uid, operation);
    return {phone,created};
  });
}
