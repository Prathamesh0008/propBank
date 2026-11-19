import {parseCalendarDate} from './calendar-date';
import {calculateAgreementEndDate} from './rent-schedule';

// Same supported calendar-month horizon as the existing rent schedule helpers.
export const MAX_LEASE_MONTHS = 1200;
export function validLeaseTenure(value: unknown): boolean {
  return (typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value)) &&
    Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) <= MAX_LEASE_MONTHS;
}
export function calculateLeaseEndDate(start: string, months: unknown): string {
  if (!parseCalendarDate(start) || !validLeaseTenure(months)) return '';
  const end = calculateAgreementEndDate(start, Number(months));
  return parseCalendarDate(end) ? end : '';
}
export function leaseTenureError(details: Record<string, unknown>, previous?: Record<string, unknown>): string {
  const tenure = details.leaseTenureMonths;
  const legacyUnchanged = previous && previous.leaseTenureMonths === undefined && tenure === undefined &&
    details.leaseStartDate === previous.leaseStartDate && details.leaseEndDate === previous.leaseEndDate;
  if (legacyUnchanged) return '';
  if (!validLeaseTenure(tenure)) return `preLeased.leaseTenureMonths: enter a whole number of months from 1 to ${MAX_LEASE_MONTHS}`;
  const end = calculateLeaseEndDate(String(details.leaseStartDate || ''), tenure);
  return end && end === details.leaseEndDate ? '' : 'preLeased.leaseEndDate: must match the lease start date and selected tenure';
}
// Infer only exact convention matches for display; never persist inferred tenure
// or round an irregular historical period into an invented duration.
export function recordedLeaseMonths(details?: {leaseStartDate?: string; leaseEndDate?: string; leaseTenureMonths?: unknown}): number | undefined {
  if (!details) return;
  if (validLeaseTenure(details.leaseTenureMonths)) return Number(details.leaseTenureMonths);
  const start = parseCalendarDate(details.leaseStartDate || ''), end = parseCalendarDate(details.leaseEndDate || '');
  if (!start || !end || end < start) return;
  const distance = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  for (const months of [distance, distance + 1]) if (validLeaseTenure(months) && calculateLeaseEndDate(details.leaseStartDate!, months) === details.leaseEndDate) return months;
}
export function leaseTenureLabel(details?: {leaseStartDate?: string; leaseEndDate?: string; leaseTenureMonths?: unknown}): string {
  const total = recordedLeaseMonths(details);
  if (!total) return 'Not recorded';
  return `${total} month${total === 1 ? '' : 's'}` +
    (details?.leaseTenureMonths === undefined ? ' (from recorded dates)' : '');
}
