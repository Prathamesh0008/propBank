/** Display only: keep persisted address components unchanged. */
export function formatAddress(...components: unknown[]): string {
  return components
    .flatMap(value => typeof value === 'string' ? value.split(',') :
      typeof value === 'number' && Number.isFinite(value) ? [String(value)] : [])
    .map(value => value.trim())
    .filter(Boolean)
    .join(', ');
}
