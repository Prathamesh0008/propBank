/** Plain decimal API amounts only: never coerce null, booleans, hex or Infinity. */
export function validPropertyMoney(value: unknown, positive = true): boolean {
  if (typeof value !== 'string' || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return false;
  const amount = Number(value);
  return Number.isFinite(amount) && (positive ? amount > 0 : amount >= 0);
}
