import {z} from 'zod';
import {formatAddress} from './address-format';

/** Opt-in value object. Does not replace IDs, location/address aliases or stored records. */
export const ADDRESS_FIELDS = ['unitNumber','buildingName','streetLocality','city','district','state','postalCode','country'] as const;
export type AddressField = typeof ADDRESS_FIELDS[number];
const line = z.string().trim().max(200, 'Use 200 characters or fewer.').optional();
export const structuredAddressSchema = z.object({
  unitNumber:line, buildingName:line, streetLocality:line, city:line,
  district:line, state:line, postalCode:z.string().trim().max(32).optional(), country:line,
}).strict().superRefine((address, context) => {
  if (address.postalCode && /^(in|ind|india)$/i.test(address.country || '') && !/^[1-9]\d{5}$/.test(address.postalCode)) {
    context.addIssue({code:z.ZodIssueCode.custom,path:['postalCode'],message:'Enter a valid six-digit Indian PIN code.'});
  }
});
export type StructuredAddress = z.infer<typeof structuredAddressSchema>;
export interface AddressValue { structured:StructuredAddress; legacyText:string }
export interface AddressValidationOptions { required?:readonly AddressField[]; requireUnit?:boolean }
export type AddressErrors = Partial<Record<AddressField | '_address',string>>;
const text = (value:unknown):string => typeof value === 'string' ? value : '';
const record = (value:unknown):Record<string,unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};

/** No country default: an absent country must never imply an Indian postal requirement. */
export function validateStructuredAddress(input:unknown, options:AddressValidationOptions = {}) {
  const result=structuredAddressSchema.safeParse(input);
  const errors:AddressErrors={};
  if (!result.success) {
    for (const issue of result.error.issues) errors[(ADDRESS_FIELDS as readonly unknown[]).includes(issue.path[0]) ? issue.path[0] as AddressField : '_address']=issue.message;
    return {success:false as const,errors};
  }
  const address=result.data;
  for (const field of options.required || []) if (!address[field]) errors[field]=`Enter ${field.replace(/([A-Z])/g,' $1').toLowerCase()}.`;
  if (options.requireUnit && !address.unitNumber) errors.unitNumber='Enter a flat, house or unit number.';
  return Object.keys(errors).length ? {success:false as const,errors} : {success:true as const,address,errors};
}

/** Recognize explicit field aliases only. Never split opaque historical text into guessed fields. */
export function readAddress(input:unknown):AddressValue {
  if (typeof input === 'string') return {structured:{},legacyText:input};
  const source=record(input), nested=record(source.structured), structured:StructuredAddress={};
  for (const field of ADDRESS_FIELDS) {
    const value=text(nested[field]).trim() || text(source[field]).trim() || (field==='postalCode' ? text(source.zipCode).trim() : '');
    if (value) structured[field]=value;
  }
  // address/location are equivalent legacy aliases, not a street/locality assertion.
  const legacyText=[source.legacyText,source.address,source.location].find(value=>typeof value==='string' && value.trim()) as string|undefined;
  return {structured,legacyText:legacyText || ''};
}

/** Display-only exact component deduplication; no substring matching or inference. */
export function formatStructuredAddress(input:AddressValue|StructuredAddress|string):string {
  const value=readAddress(input), seen=new Set<string>();
  const components=[value.structured.unitNumber,value.structured.buildingName,value.structured.streetLocality,value.legacyText,value.structured.city,value.structured.district,value.structured.state,value.structured.postalCode,value.structured.country];
  return formatAddress(...components).split(',').map(part=>part.trim()).filter(part=>{
    const key=part.replace(/\s+/g,' ').toLocaleLowerCase('en');
    if (!key || key==='undefined' || key==='null' || seen.has(key)) return false;
    seen.add(key);return true;
  }).join(', ');
}

/** Safe additive draft merge: omitted/null/blank fields cannot erase populated information.
 * Clearing a field requires a separately authorized explicit operation in a later phase.
 * Validation is separate and must be called before accepting untrusted request data.
 */
export function mergeAddress(existing:unknown, patch:unknown):AddressValue {
  const before=readAddress(existing), next=readAddress(patch);
  return {structured:{...before.structured,...next.structured},legacyText:next.legacyText || before.legacyText};
}

/** Proposed compatibility projection only; no persistence or API integration in Phase 1.
 * Explicit structured data derives a shared formatted alias. Opaque legacy text is preserved
 * verbatim when no structured values exist. No unrelated source fields are returned.
 */
export function addressCompatibilityFields(input:unknown) {
  const value=readAddress(input);
  const formatted=Object.keys(value.structured).length ? formatStructuredAddress(value) : value.legacyText;
  return {...value,address:formatted,location:formatted};
}
