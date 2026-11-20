import {localRentDate, resolveRent} from './rent-resolution';
import {validPropertyMoney} from './property-money';
import {confirmedAdminTenants} from './admin-property-views';
type PropertyRecord = Record<string, any>;
/** Compatible reads only. Incoming API monetary validation remains strict. */
export function readStoredPropertyMoney(value:unknown,allowZero=false):number|null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if(typeof value!=='number'&&typeof value!=='string')return null;
  let text=String(value).trim();
  if(typeof value==='string'&&/^\u20b9?\s*(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d+)?)$/.test(text))text=text.replace(/[\u20b9,\s]/g,'');
  return validPropertyMoney(text,!allowZero)?Number(text):null;
}
const positive=(value:unknown)=>readStoredPropertyMoney(value);
/** Presentation only: asking prices must never become ledger/contract defaults. */
export function propertyPricing(property: PropertyRecord, day = localRentDate(property)) {
  if (property.listingType === 'manage') return {amount:null, label:'Private management', monthly:false};
  if (['sell','pre_leased'].includes(property.listingType)) return {amount:positive(property.sellingPrice) ?? positive(property.selling_price) ?? positive(property.price), label:'Selling price', monthly:false};
  const active = Array.isArray(property.tenants) ? property.tenants.filter((t:PropertyRecord)=>t.isActive===true) : [];
  const contractual = active.length > 0 || property.rentalStatus === 'rented' || property.isRented === true;
  if (contractual) {
    // Independent contracts have separate amounts; never arbitrarily select the first.
    const amount = active.length > 1 ? null : positive(resolveRent(property, day, active[0]).amount);
    return {amount, label:active.length > 1 ? 'Multiple tenancy rents' : 'Current contractual monthly rent', monthly:true};
  }
  const asking = positive(property.expectedRent) ?? positive(property.expected_rent);
  const hasHistory = property.agreementStartDate || property.agreementEndDate || property.agreementHistory?.length || property.rentAgreementSnapshots?.length || property.rentSchedule?.length;
  return {amount:asking ?? (!hasHistory ? positive(property.monthlyRent) ?? positive(property.monthly_rent) ?? positive(property.price) : null), label:'Expected monthly asking rent', monthly:true};
}
export function propertyPriceText(property: PropertyRecord) {
  const price = propertyPricing(property);
  if (property.listingType === 'manage') return 'Private management';
  if (price.amount === null) return price.label === 'Multiple tenancy rents' ? price.label : 'Price not recorded';
  return `₹${price.amount.toLocaleString('en-IN')}${price.monthly ? '/month' : ''} · ${price.label}`;
}
export function propertyOccupancy(property: PropertyRecord) {
  return confirmedAdminTenants(property).length ? 'Confirmed tenancy' : 'Occupancy unknown';
}

export function propertyAreaText(property: PropertyRecord, key:'carpetArea'|'constructedArea'|'plotArea') {
  const amount=validPropertyMoney(String(property[key]))?Number(property[key]):null;
  return amount===null?'Not recorded':`${amount.toLocaleString('en-IN')} ${property[`${key}Unit`]||property.areaUnit||'sq ft'}`;
}
