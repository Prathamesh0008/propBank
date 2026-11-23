import {z} from 'zod';
import {mergeAddress,readAddress,type AddressValue} from './structured-address';
import {propertyAddressSchema,propertyAddressDisplay} from './property-address';

/** Tenant previous addresses are optional and never populate the property's location. */
export const personalAddressSchema=propertyAddressSchema.innerType().superRefine((value,ctx)=>{
  if(!value.legacyText.trim()&&!Object.values(value.structured).some(v=>v?.trim()))return;
  const result=propertyAddressSchema.safeParse(value);
  if(!result.success)for(const issue of result.error.issues)ctx.addIssue(issue);
});
export function readPreviousAddress(tenant:Record<string,unknown>):AddressValue {
  return readAddress(tenant.previousAddressStructured || (typeof tenant.previousAddress==='string'?tenant.previousAddress:''));
}
export function resolvePreviousAddress(input:unknown,previous?:Record<string,unknown>) {
  const patch=personalAddressSchema.innerType().partial().safeParse(input);
  if(!patch.success)throw new Error(`Previous address: ${patch.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const value=previous?mergeAddress(readPreviousAddress(previous),patch.data):readAddress(patch.data);
  const result=personalAddressSchema.safeParse(value);
  if(!result.success)throw new Error(`Previous address: ${result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const canonical=readAddress(result.data);
  return {previousAddressStructured:canonical,previousAddress:propertyAddressDisplay(canonical)};
}
export function assertPersonalAddressKeys(value:Record<string,unknown>) {
  const names=['previousAddress','previousAddressStructured','previousAddressVersion','expectedPreviousAddressVersion'];
  if(Object.keys(value).some(key=>names.some(name=>name.toLowerCase()===key.replace(/[_-]/g,'').toLowerCase()&&key!==name)))throw new Error('Previous address field aliases are not supported');
}
export function createPreviousAddress(value:Record<string,unknown>) {
  assertPersonalAddressKeys(value);
  if('previousAddressVersion' in value || 'expectedPreviousAddressVersion' in value)throw new Error('Previous address version is server controlled on creation');
  return 'previousAddressStructured' in value?{...resolvePreviousAddress(value.previousAddressStructured),previousAddressVersion:1}:{};
}
const privateNames=new Set(['previousaddress','previousaddressstructured','previousaddressversion','expectedpreviousaddressversion','tenantpreviousaddress','currentaddress','currentaddressstructured','currentaddressversion']);
/** Pure read redaction. Owner/admin authorization is decided by the caller, never the payload. */
export function redactPersonalAddresses<T>(value:T):T {
  if(Array.isArray(value))return value.map(item=>redactPersonalAddresses(item)) as T;
  if(!value||typeof value!=='object'||value instanceof Date||typeof (value as {toDate?:unknown}).toDate==='function')return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!privateNames.has(key.replace(/[_-]/g,'').toLowerCase())).map(([key,item])=>[key,redactPersonalAddresses(item)])) as T;
}
