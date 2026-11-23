/** Public geography is explicit and coarse. Never parse opaque address/location text,
 * or streetLocality (which deliberately accepts exact streets), into public fields. */
type Data = Record<string, unknown>;
const record = (v:unknown):Data => v && typeof v==='object' && !Array.isArray(v) ? v as Data : {};
const text = (v:unknown) => typeof v==='string' && !/^(null|undefined)$/i.test(v.trim()) ? v.trim() : '';
export function publicPropertyLocation(property:Data) {
  const structured=record(record(property.structuredAddress).structured);
  const city=text(structured.city)||text(property.city), district=text(structured.district)||text(property.district), state=text(structured.state)||text(property.state);
  const seen=new Set<string>();
  const location=[city,district,state].filter(part=>{const key=part.toLowerCase().replace(/\s+/g,' ');if(!key||seen.has(key))return false;seen.add(key);return true;}).join(', ') || 'Location available on request';
  return {city,district,state,address:location,location};
}
export function formatPublicPropertyLocation(property:Data):string { return publicPropertyLocation(property).location; }
/** Listing titles commonly equal building names; descriptions can contain full addresses.
 * Until there is explicit public approval, never publish either free-text field. */
export function publicPropertyTitle(property:Data):string {
  const category=String(property.propertyCategory||property.propertyType||'').toLowerCase();
  return ({residential:'Residential property',commercial:'Commercial property',industrial:'Industrial property'} as Record<string,string>)[category] || 'Property';
}
