import {displayCalendarDate, parseCalendarDate} from './calendar-date';

export const DATE_DISPLAY_FORMAT = 'dd/MM/yyyy';
export const DATE_PLACEHOLDER = 'DD/MM/YYYY';
export const DEFAULT_DATE_TIME_ZONE = 'Asia/Kolkata';

// Display only: never use these strings for persistence, sorting or calculations.
// Date-only strings describe civil dates and must not pass through UTC parsing.
function civil(value: unknown): string | undefined {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
function instant(value: unknown): Date | undefined {
  try {
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'string') {
      if (value.startsWith('0001-') || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !parseCalendarDate(value.slice(0, 10))) return;
    }
    if (typeof value === 'object' && !(value instanceof Date)) {
      const stamp = value as {toDate?: () => Date; seconds?: number; _seconds?: number; nanoseconds?: number; _nanoseconds?: number};
      if (typeof stamp.toDate === 'function') value = stamp.toDate();
      else {
        const seconds = stamp.seconds ?? stamp._seconds;
        if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return;
        value = seconds * 1000 + (stamp.nanoseconds ?? stamp._nanoseconds ?? 0) / 1e6;
      }
    }
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') return;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : undefined;
  } catch { return; }
}
function formatter(options: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat('en-GB', options); }
  catch { return new Intl.DateTimeFormat('en-GB', {...options, timeZone: DEFAULT_DATE_TIME_ZONE}); }
}
export function formatDisplayDate(value: unknown, options: Intl.DateTimeFormatOptions = {}, fallback = '—'): string {
  const day = civil(value);
  if (day !== undefined) return day.startsWith('0001-') ? fallback : displayCalendarDate(day) || fallback;
  const date = instant(value);
  if (!date) return fallback;
  const parts = formatter({timeZone: options.timeZone || DEFAULT_DATE_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric'}).formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  return `${part('day')}/${part('month')}/${part('year')?.padStart(4, '0')}`;
}
export function formatDisplayDateTime(value: unknown, options: Intl.DateTimeFormatOptions = {}, fallback = '—'): string {
  if (civil(value) !== undefined) return formatDisplayDate(value, options, fallback);
  const date = instant(value);
  if (!date) return fallback;
  return `${formatDisplayDate(date, options, fallback)} ${formatDisplayTime(date, options, fallback)}`;
}
export function formatDisplayTime(value: unknown, options: Intl.DateTimeFormatOptions = {}, fallback = '—'): string {
  const date = instant(value);
  if (!date) return fallback;
  return formatter({timeZone: options.timeZone || DEFAULT_DATE_TIME_ZONE, hour: '2-digit', minute: '2-digit',
    ...(options.timeStyle ? {timeStyle: options.timeStyle, hour: undefined, minute: undefined} : {}),
    ...(options.second ? {second: options.second} : {}), hour12: options.hour12 ?? true}).format(date);
}
// A billing month is not a full calendar date; preserve its granularity.
export function formatDisplayMonth(value: unknown, fallback = '—'): string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value.slice(5)}/${value.slice(0, 4)}` : fallback;
}
