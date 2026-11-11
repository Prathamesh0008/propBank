import 'server-only';
import {validPropertyMoney} from '@/lib/property-money';
import {additionalRentPeriod, calculateAgreementEndDate, rentYearLabel, validateAdditionalRentSchedule, validateUnifiedRentSchedule, type RentScheduleRow} from '@/lib/rent-schedule';
import {isRecord, type RecordData} from './contracts';

const supplied = (v: unknown) => v !== undefined && v !== '';
export function validatePropertyMoney(input: RecordData, before?: RecordData) {
  const next = {...before, ...input}, purpose = next.listingType;
  if (purpose === 'manage') return;
  const changed = (key: string) => key in input && (!before || input[key] !== before[key]);
  const newPurpose = !before || purpose !== before.listingType;
  const rentalModeChanged = !!before && ['rent', 'sell_rent'].includes(String(purpose)) && 'rentalStatus' in input && input.rentalStatus !== before.rentalStatus;
  if(changed('price') && (typeof input.price!=='number'||!Number.isFinite(input.price)||input.price<0))throw new Error('price: enter a finite non-negative number');
  const check = (key: string, required: boolean, positive = true) => {
    if (!newPurpose && !changed(key) && !(rentalModeChanged && ['monthlyRent', 'expectedRent', 'securityDeposit'].includes(key))) return;
    if (!required && !supplied(next[key])) return;
    if (!validPropertyMoney(next[key], positive)) throw new Error(`${key}: enter a finite ${positive ? 'positive' : 'non-negative'} decimal amount`);
  };
  if (['sell', 'sell_rent', 'pre_leased'].includes(String(purpose))) check('sellingPrice', true);
  if (['rent', 'sell_rent'].includes(String(purpose))) {
    const rentKey = next.createdAs === 'tenant' || next.rentalStatus === 'rented' ? 'monthlyRent' : ('expectedRent' in input || supplied(next.expectedRent)) ? 'expectedRent' : 'monthlyRent';
    check(rentKey, true);
    // Owner listing intake already requires a deposit; tenant-reported intake does not.
    check('securityDeposit', next.createdAs !== 'tenant', false);
  } else check('securityDeposit', false, false);
  // Validate any actively supplied additional rent source as well as the required one.
  for (const key of ['monthlyRent', 'expectedRent', 'sellingPrice']) if (changed(key) && supplied(input[key])) check(key, false);
}

const firstYear = (row: unknown) => isRecord(row) && /^(?:1|1st(?: Year)?|Year 1)$/i.test(String(row.year));
/** Validates raw input before model defaults can erase malformed fields. */
export function validatePropertyRentSchedule(input: RecordData, before?: RecordData) {
  const next = {...before, ...input}, version = input.rentScheduleVersion;
  if ('rentScheduleVersion' in input && version !== 1 && version !== 2) throw new Error('rentScheduleVersion: supported versions are 1 (legacy) and 2 (unified)');
  const changed = ['rentSchedule', 'agreementStartDate', 'agreementEndDate', 'agreementPeriod', 'monthlyRent'].some(k => k in input && JSON.stringify(input[k]) !== JSON.stringify(before?.[k]));
  if (before && !changed && version === undefined) return;
  const schedule = next.rentSchedule;
  if (version === undefined && before && (!Array.isArray(before.rentSchedule) || !before.rentSchedule.length) && (!('rentSchedule' in input) || input.rentSchedule === before.rentSchedule)) return;
  if (schedule === undefined && version === undefined) return;
  if (!Array.isArray(schedule)) throw new Error('rentSchedule: supply an array of rent periods');
  const wasUnified = Array.isArray(before?.rentSchedule) && firstYear(before.rentSchedule[0]);
  if (!schedule.length) {
    if (version === 2 || wasUnified) throw new Error('rentSchedule: Year 1 must cover the agreement');
    return;
  }
  if (schedule.length > 100 || schedule.some(r => !isRecord(r) || ['year', 'amount', 'fromDate', 'toDate'].some(k => typeof r[k] !== 'string') || r.months !== undefined && typeof r.months !== 'string')) throw new Error('rentSchedule: invalid period schema');
  const start = String(next.agreementStartDate || '').slice(0, 10), end = String(next.agreementEndDate || '').slice(0, 10);
  const unified = firstYear(schedule[0]) || schedule[0].fromDate === start;
  if (version === 2 && !unified || version === 1 && unified || wasUnified && !unified) throw new Error('rentScheduleVersion: schedule structure contradicts its format');
  if (unified && schedule.some((r, i) => ![rentYearLabel(i).toLowerCase(), `year ${i + 1}`, String(i + 1)].includes(r.year.toLowerCase()) || typeof r.months !== 'string')) throw new Error('rentSchedule: unified periods require sequential years and explicit months');
  const rows: RentScheduleRow[] = schedule.map((r, i) => ({...r, months: r.months ?? additionalRentPeriod(start, String(next.agreementPeriod || ''), i)?.months ?? ''}));
  if (rows.some(r => !validPropertyMoney(r.amount) || !/^\d+$/.test(r.months))) throw new Error('rentSchedule: amounts must be positive finite decimals and months positive whole numbers');
  if (unified && supplied(next.agreementPeriod) && (!/^\d+$/.test(String(next.agreementPeriod)) || calculateAgreementEndDate(start, String(next.agreementPeriod)) !== end)) throw new Error('rentSchedule: agreement duration and dates must match');
  const error = unified ? validateUnifiedRentSchedule(rows, start, end) : validateAdditionalRentSchedule(rows, start, String(next.agreementPeriod || ''), end);
  if (error) throw new Error(`rentSchedule: ${error}`);
  if (unified) {
    if ('price' in input && input.price !== 0 && (typeof input.price !== 'number' || input.price !== Number(rows[0].amount))) throw new Error('price: must match the first rent schedule period or use the legacy zero fallback');
    if (supplied(next.monthlyRent) && (!validPropertyMoney(next.monthlyRent) || Number(next.monthlyRent) !== Number(rows[0].amount))) throw new Error('monthlyRent: must match the first rent schedule period');
    if (!supplied(next.monthlyRent)) input.monthlyRent = rows[0].amount;
  }
  if ('rentSchedule' in input) input.rentSchedule = rows;
}

/** Tenancy APIs use lease dates but can update the same property schedule. */
export function validateTenantRentSchedule(input: RecordData, before?: RecordData) {
  const mapped: RecordData = {...input, ...('leaseStartDate' in input ? {agreementStartDate: input.leaseStartDate} : {}), ...('leaseEndDate' in input ? {agreementEndDate: input.leaseEndDate} : {})};
  validatePropertyRentSchedule(mapped, before ? {...before, agreementStartDate: before.leaseStartDate, agreementEndDate: before.leaseEndDate} : undefined);
  if ('rentSchedule' in input) input.rentSchedule = mapped.rentSchedule;
  if (mapped.monthlyRent !== undefined) input.monthlyRent = mapped.monthlyRent;
  delete input.rentScheduleVersion;
}
