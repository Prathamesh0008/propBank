/** Display-safe advertisement contract. Storage keys and uploader identities stay server-only. */
export interface PropertyAdvertisementContent {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  destinationUrl: string;
}
export interface AdminAdvertisement extends PropertyAdvertisementContent {
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  pending: boolean;
  needsCleanup: boolean;
}
export const ADVERTISEMENT_MAX_BYTES = 4 * 1024 * 1024;
export const ADVERTISEMENT_LIMIT = 40;
export const ACTIVE_ADVERTISEMENT_LIMIT = 8;
export const ADVERTISEMENT_MIME_TYPES = ['image/jpeg','image/png','image/webp'] as const;
export function advertisementDestination(input: unknown): string {
  if (input === '' || input === undefined) return '';
  if (typeof input !== 'string' || input.length > 2048 || input.includes('\\') || Array.from(input).some(c => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127)) throw new Error('Enter a valid HTTPS destination URL, or leave it blank.');
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Invalid destination');
    return url.href;
  } catch { throw new Error('Enter a valid HTTPS destination URL, or leave it blank.'); }
}
