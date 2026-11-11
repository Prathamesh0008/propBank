import 'server-only';
import {AccessError, type AuthenticatedUser} from '../auth';
import type {RecordData} from './contracts';

// Treat every document on a Pre-Leased property as private evidence regardless of
// the client-supplied type. A server-stamped scope survives later purpose changes.
export const PRE_LEASED_EVIDENCE = 'pre_leased_evidence';
export function privateLeaseEvidence(document: RecordData, property: RecordData) {
  return property.listingType === 'pre_leased' || document.accessScope === PRE_LEASED_EVIDENCE;
}
export function canReadLeaseEvidence(user: AuthenticatedUser, property: RecordData) {
  return user.role === 'admin' || !!property.ownerUID && property.ownerUID === user.uid;
}
export function requireDocumentAccess(user: AuthenticatedUser, document: RecordData, property: RecordData) {
  if (privateLeaseEvidence(document, property) && !canReadLeaseEvidence(user, property)) throw new AccessError(403, 'Document access required');
}
