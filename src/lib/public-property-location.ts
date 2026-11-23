import {safePublicPropertyName} from './public-listing-title';
import {publicPropertyText,storedAddressParts,type PropertyData} from './public-unit-privacy';
const record=(v:unknown):PropertyData=>v&&typeof v==='object'&&!Array.isArray(v)?v as PropertyData:{};
const value=(v:unknown)=>typeof v==='string'?v:'';
/** Publish explicit non-unit components. Opaque legacy text is only split at
 * existing delimiters; unsafe fragments are omitted without editing their text. */
export function publicPropertyLocation(property:PropertyData) {
  const a=storedAddressParts(property),safe=(v:unknown)=>publicPropertyText(v,property);
  const buildingName=safe(a.buildingName||property.buildingName),streetLocality=safe(a.streetLocality||property.streetLocality);
  const city=safe(a.city||property.city),district=safe(a.district||property.district),state=safe(a.state||property.state),country=safe(a.country||property.country);
  const zipCode=publicPropertyText(a.postalCode||property.zipCode||property.postalCode,property,'postal');
  const structured=Object.keys(a).some(key=>!['legacyText','address','location'].includes(key)&&!!a[key]);
  const legacy=structured?'':value(record(property.structuredAddress).legacyText)||value(property.address)||value(property.location);
  const fragments=legacy.split(/[,;\n]+/).map(safe).filter(Boolean);
  const seen=new Set<string>();const location=[buildingName,streetLocality,...fragments,city,district,state,zipCode,country].flatMap(part=>part.split(',')).map(part=>part.trim()).filter(part=>{const key=part.toLowerCase().replace(/\s+/g,' ');if(!key||seen.has(key))return false;seen.add(key);return true;}).join(', ')||'Location available on request';
  return {buildingName,streetLocality,city,district,state,zipCode,country,address:location,location};
}
export function formatPublicPropertyLocation(property:PropertyData):string{return publicPropertyLocation(property).location;}
export function publicPropertyTitle(property:PropertyData):string {
  const name=safePublicPropertyName(property);if(name)return name;
  const category=String(property.propertyCategory||property.propertyType||'').toLowerCase();
  return ({residential:'Residential property',commercial:'Commercial property',industrial:'Industrial property'} as Record<string,string>)[category]||'Property';
}
