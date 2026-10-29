import { indianMobile } from './indian-phone';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const INDIA_TIME_ZONE = 'Asia/Kolkata';

export function indiaCalendarDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value);
}

export function indiaLocalDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const parsed = new Date(`${date}T${time}:00+05:30`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function indiaDateTimeParts(value: string | Date): { date: string; time: string } {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

export function validateIndianContact(value: string): string | null {
  return indianMobile(value) ? null : 'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
}
