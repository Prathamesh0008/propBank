/** Public text is accepted whole or omitted whole, never repaired by removing
 * guessed identifiers. This does not change stored property/address values. */
export type PropertyData=Record<string,unknown>;
const record=(v:unknown):PropertyData=>v&&typeof v==='object'&&!Array.isArray(v)?v as PropertyData:{};
export function storedAddressParts(property:PropertyData):PropertyData {
  const address=record(property.structuredAddress);return 'structured'in address?record(address.structured):address;
}
const text=(v:unknown)=>typeof v==='string'?v.normalize('NFKC').trim():typeof v==='number'&&Number.isFinite(v)?String(v):'';
const escaped=(v:string)=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function publicPropertyText(value:unknown,property:PropertyData={},kind:'name'|'component'|'postal'|'notice'='component'):string {
  if(typeof value!=='string'||!value.trim()||value.length>4000||/[\p{Cc}\p{Cf}]/u.test(value)||(kind!=='notice'&&/[<>@]|https?:|www\./iu.test(value)))return '';
  const normalized=text(value).replace(/\s+/g,' ');
  const searchable=normalized.replace(/([\p{Ll}])([\p{Lu}])/gu,'$1 $2');
  const a=storedAddressParts(property);
  // Recognize every known identifier, including punctuation/case variants.
  const units=[property.unitNumber,a.unitNumber,property.flatNumber,property.flatNo,property.roomNumber,property.doorNumber,property.houseNumber];
  const quantity=/\b\d+(?:\.\d+)?\s*(?:[-+]\s*)?(?:bhk|rk|bedrooms?|beds?|bathrooms?|baths?|sq\.?\s*(?:ft|feet|m)|square\s*(?:feet|metres?|meters?))\b/giu;
  const forUnitCheck=searchable.replace(quantity,' quantity ');
  for(const raw of units){const unit=text(raw).replace(/[^\p{L}\p{N}]/gu,'');if(!unit)continue;const pattern=new RegExp('(?:^|[^\\p{L}\\p{N}])'+[...unit].map(escaped).join('[\\s\\-/#.]*')+'(?=$|[^\\p{L}\\p{N}])','iu');if(pattern.test(forUnitCheck))return '';}
  if(kind==='postal')return /^[\p{L}\p{N}][\p{L}\p{N} -]{0,31}$/u.test(normalized)?normalized:'';
  if(/\b(?:flat|room|unit|door|house|apartment|apt)\b\s*(?:(?:no\.?|number|#|:)\s*\S+|[a-z]*[-/\s]*\d+[a-z]*\b|[a-z]\b)|\b(?:flat|room|unit|door|house|apartment|apt)\b\s*[-:]\s*\S+/iu.test(forUnitCheck))return '';
  let remainder=searchable.replace(quantity,' quantity ');
  // Public building/street designations and explicit PIN values may have digits.
  // These substitutions are for classification only; output remains unchanged.
  remainder=remainder.replace(/\b(?:tower|building|wing|block|sector|phase|street|road|floor)\s*(?:no\.?\s*)?\d+[a-z]?\b|\b\d+(?:st|nd|rd|th)\s+(?:street|road|avenue|floor)\b/giu,' designation ');
  const postal=text(a.postalCode||property.zipCode||property.postalCode);if(postal&&/^[\p{L}\p{N} -]+$/u.test(postal))remainder=remainder.replace(new RegExp('(?:^|[\\s,])'+escaped(postal)+'(?=$|[\\s,])','giu'),' postcode ');
  // An unexplained number/code could be a unit. Omit this entire fragment rather
  // than guessing how to split "704 Regency Park" or an unlabelled "A-704".
  if(/\d/u.test(remainder))return '';
  return normalized;
}
