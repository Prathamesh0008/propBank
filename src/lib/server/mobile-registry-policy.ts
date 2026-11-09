import { createHash } from 'node:crypto';
import { indianMobile } from '../indian-phone';

// Shared with the offline migration. No credentials, database access or side effects.
export const MOBILE_REGISTRY = 'mobile_number_registry';
export const MOBILE_REGISTRY_STATE = 'mobile_number_registry_state';
export const MOBILE_REGISTRY_VERSION = 2;
export const MOBILE_REGISTRY_ACCOUNTS = 'mobile_number_registry_accounts';
export const MOBILE_RESERVATION_POLICY = 'legacy-conflict-reservations-v1';
export const registryPhone = indianMobile;

// Hashing avoids cleartext phone document IDs, but does not anonymize a small
// phone-number space. These collections must be inaccessible to browser clients.
export function mobileKey(phone: string): string {
  const canonical = indianMobile(phone);
  if (!canonical) throw new Error('Invalid registry phone');
  return createHash('sha256').update(`propbank:mobile:v1:${canonical}`).digest('hex');
}
