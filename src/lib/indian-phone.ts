/** Contact normalization is validation, never identity verification. */
export function indianMobile(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s()-]+$/.test(value)) return null;
  const compact = value.replace(/[\s()-]/g, '');
  const national = compact.startsWith('+91') ? compact.slice(3) : compact;
  return /^[6-9]\d{9}$/.test(national) ? `+91${national}` : null;
}
