import 'server-only';
import { schemas, projections } from './go-contracts';

// Mixed interface{} timestamps and nil arrays are part of the existing Go contract.
export type RecordData = Record<string, unknown>;
export const isRecord = (v: unknown): v is RecordData => !!v && typeof v === 'object' && !Array.isArray(v);
export const stringValue = (v: unknown) => typeof v === 'string' ? v : '';
const zeroDate = '0001-01-01T00:00:00Z';

function defaultValue(type: string): unknown {
  if (['string', 'UserRole', 'ServiceCategory', 'ServiceStatus'].includes(type)) return '';
  if (type === 'bool') return false;
  if (type === 'int' || type === 'float64') return 0;
  if (type === 'time.Time') return zeroDate;
  if (type.startsWith('[]') || type.startsWith('*') || type === 'interface{}') return null;
  return model(type, {});
}

function typedValue(type: string, value: unknown, validate: boolean, field: string): unknown {
  if (value == null) return defaultValue(type);
  const fail = () => { throw new Error(`json: cannot unmarshal ${Array.isArray(value) ? 'array' : typeof value==='boolean'?'bool':typeof value} into Go struct field ${field} of type ${type}`); };
  if (['string', 'UserRole', 'ServiceCategory', 'ServiceStatus'].includes(type)) { if (typeof value !== 'string') fail(); return value; }
  if (type === 'bool') { if (typeof value !== 'boolean') fail(); return value; }
  if (type === 'int' || type === 'float64') { if (typeof value !== 'number' || !Number.isFinite(value) || (type === 'int' && !Number.isInteger(value))) fail(); return value; }
  if (type === 'time.Time' || type === '*time.Time') {
    if (value instanceof Date || (isRecord(value) && typeof value.toDate === 'function')) return value;
    if (typeof value === 'string' && (value === zeroDate || !Number.isNaN(Date.parse(value)))) return value;
    fail();
  }
  if (type === 'interface{}') return value;
  if (type.startsWith('[]')) {
    if (!Array.isArray(value)) return fail();
    return value.map(v => typedValue(type.slice(2), v, validate, field));
  }
  if (type.startsWith('*')) return typedValue(type.slice(1), value, validate, field);
  if (!isRecord(value)) return fail();
  return model(type, value, validate);
}

export function model(name: string, input: RecordData, validate = false): RecordData {
  const result: RecordData = {};
  for (const field of schemas[name] || []) {
    const key = Object.keys(input).filter(k => k.toLowerCase() === field.name.toLowerCase()).at(-1);
    result[field.name] = typedValue(field.type, key === undefined ? undefined : input[key], validate, `${name}.${field.name}`);
  }
  return result;
}

function empty(value: unknown) {
  return value == null || value === '' || value === false || value === 0 || (Array.isArray(value) && !value.length);
}

export function storeModel(name: string, input: RecordData): RecordData {
  const result: RecordData = {};
  for (const field of schemas[name]) {
    const value = input[field.name];
    // Firestore Go SDK also considers a zero time.Time empty; encoding/json
    // still emits that time in responses. Keep those two contracts distinct.
    if (field.storeOmit && (empty(value) || (field.type === 'time.Time' && wireValue(value) === zeroDate))) continue;
    result[field.store] = nestedModel(field.type, value, true);
  }
  return result;
}

function nestedModel(type: string, value: unknown, store: boolean): unknown {
  if (value == null) return null;
  if (type.startsWith('[]')) return (value as unknown[]).map(v => nestedModel(type.slice(2), v, store));
  if (schemas[type.replace(/^\*/, '')] && isRecord(value)) return store ? storeModel(type.replace(/^\*/, ''), value) : wireModel(type.replace(/^\*/, ''), value);
  if (store && (type === 'time.Time' || type === '*time.Time') && typeof value === 'string') return new Date(value);
  if (!store && (type === 'time.Time' || type === '*time.Time') && typeof value === 'string') return value.replace(/\.([0-9]*?)0+Z$/, (_,fraction:string)=>fraction ? `.${fraction}Z`:'Z');
  return store ? value : wireValue(value);
}

export function wireValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString().replace(/\.([0-9]*?)0+Z$/, (_,fraction:string)=>fraction ? `.${fraction}Z`:'Z');
  if (isRecord(value) && typeof value.toDate === 'function') {
    const timestamp = value as unknown as { seconds: number; nanoseconds: number; toDate(): Date };
    const base = new Date(timestamp.seconds * 1000).toISOString().slice(0,19);
    const fraction = String(timestamp.nanoseconds).padStart(9,'0').replace(/0+$/, '');
    return `${base}${fraction ? `.${fraction}` : ''}Z`;
  }
  if (Array.isArray(value)) return value.map(wireValue);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,wireValue(v)]));
  return value;
}

export function wireModel(name: string, input: RecordData): RecordData {
  const result: RecordData = {};
  for (const field of schemas[name]) {
    if (field.omit && empty(input[field.name])) continue;
    result[field.name] = nestedModel(field.type,input[field.name],false);
  }
  return result;
}

export function parsePrice(value: unknown) { return Number.parseFloat(stringValue(value).replace(/[₹,]/g,'').trim()); }
export function propertyResponse(property: RecordData, projection = 'normal', userRole?: string) {
  const result = model('PropertyResponse', {});
  for (const [to,from] of projections[projection]) result[to] = property[from];
  if (projection === 'normal') {
    result.price = property.price;
    if (property.price === 0) {
      const fallback = property.listingType === 'rent' ? property.monthlyRent : property.listingType === 'sell' ? property.sellingPrice : '';
      const price = parsePrice(fallback);
      if (Number.isFinite(price)) result.price = price;
    }
  }
  if (userRole) result.userRole = userRole;
  const response=wireModel('PropertyResponse',result);
  if(userRole)for(const field of schemas.Property)if(field.name!=='price')response[field.name]=nestedModel(field.type,property[field.name],false);
  if(userRole)for(const key of ['createdAs','submittedByUID','ownershipVerification','reportedOwner'])if(key in property)response[key]=wireValue(property[key]);
  for(const key of ['propertyCategory','buildingName','plotArea','areaUnit','carpetAreaUnit','constructedAreaUnit','plotAreaUnit','expectedRent','structure','agreementStatus','anticipatedTerminationDate','noticeStartDate','terminationDate','agreementHistory','agreementRequest','isRented'])if(key in property)response[key]=wireValue(property[key]);
  if(Array.isArray(property.rentSchedule))response.rentSchedule=wireValue(property.rentSchedule);
  return response;
}

export function publicPropertyResponse(property:RecordData) {
  const full=propertyResponse(property);
  const allowed=['id','title','description','price','address','city','state','zipCode','propertyType','propertyCategory','listingType','configuration','unitNumber','floor','location','carpetArea','constructedArea','plotArea','areaUnit','carpetAreaUnit','constructedAreaUnit','plotAreaUnit','squareFeet','buildingName','structure','bedrooms','bathrooms','monthlyRent','sellingPrice','rentalStatus','status','isActive','isSold','projectCondition','createdAt','updatedAt','ownerUID','ownerName'];
  const result:RecordData=Object.fromEntries(allowed.filter(key=>key in full).map(key=>[key,full[key]]));
  // Retain empty legacy keys so existing screens can safely render their defaults.
  for(const key of ['ownerEmail','ownerPhone','tenantName','personName','mobileNumber','primaryNo','ultNo','tenantDetails','specificComments','agreementStartDate','agreementEndDate','agreementPeriod','securityDeposit','paymentDueDate'])result[key]='';
  for(const key of ['tenants','buyers','internalImages','rentSchedule'])result[key]=null;
  result.images=Array.isArray(full.images)?full.images.slice(0,1):[];
  return result;
}
