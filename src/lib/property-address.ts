import {z} from 'zod';
import {formatStructuredAddress,mergeAddress,readAddress,structuredAddressSchema,type AddressValue} from './structured-address';

/** Additive property value; legacy source text stays available for owner/admin editing. */
export const propertyAddressSchema=z.object({structured:structuredAddressSchema,legacyText:z.string().max(4000)}).strict().superRefine((value,ctx)=>{
  const a=value.structured;
  if(a.postalCode&&!/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u.test(a.postalCode))ctx.addIssue({code:z.ZodIssueCode.custom,path:['structured','postalCode'],message:'Enter a valid postal code.'});
  // An unparsed historical address remains a legitimate editable fallback.
  if (!a.streetLocality && value.legacyText.trim()) return;
  const required=['streetLocality','city','country',...(/^(in|ind|india)$/i.test(a.country||'')?['state','postalCode']:[])];
  for (const key of required) if (!a[key as keyof typeof a]?.trim()) ctx.addIssue({code:z.ZodIssueCode.custom,path:['structured',key],message:`Enter ${key==='postalCode'?'a PIN code':key==='streetLocality'?'a street, area or locality':key}.`});
});
/** Preserve in-progress spaces in controlled inputs; normalize only for preview/submission. */
export function propertyAddressDraft(value:z.infer<typeof propertyAddressSchema>|undefined):AddressValue {
  return {structured:value?.structured||{},legacyText:value?.legacyText||''};
}
export function readPropertyAddress(property:Record<string,unknown>):AddressValue {
  return property.structuredAddress ? readAddress(property.structuredAddress) : readAddress(property);
}
export function propertyAddressDisplay(value:AddressValue):string {
  // Once a street is explicitly entered, use structured components for display;
  // keep original legacy text in storage without appending a second full address.
  return formatStructuredAddress({...value,legacyText:value.structured.streetLocality?'':value.legacyText});
}
export function resolvePropertyAddress(input:unknown, previous?:Record<string,unknown>) {
  // Parse before merging so malformed values cannot disappear through permissive readers.
  const patch=propertyAddressSchema.innerType().partial().safeParse(input);
  if(!patch.success)throw new Error(`Address: ${patch.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const value=previous?mergeAddress(readPropertyAddress(previous),patch.data):readAddress(patch.data);
  const result=propertyAddressSchema.safeParse(value);
  if(!result.success)throw new Error(`Address: ${result.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const canonical=readAddress(result.data),a=canonical.structured,display=propertyAddressDisplay(canonical);
  return {structuredAddress:canonical,address:display,location:display,...Object.fromEntries(Object.entries({unitNumber:a.unitNumber,buildingName:a.buildingName,city:a.city,state:a.state,zipCode:a.postalCode}).filter(([,v])=>!!v))};
}

/** Display-only source shape: personal previous/current address fields are deliberately absent. */
export interface PropertyAddressSource {
  structuredAddress?:unknown; address?:unknown; location?:unknown;
  unitNumber?:unknown; buildingName?:unknown; city?:unknown; district?:unknown;
  state?:unknown; zipCode?:unknown; postalCode?:unknown; country?:unknown;
}
function displayAddressValue(property:PropertyAddressSource):AddressValue {
  const value=readPropertyAddress(property as Record<string,unknown>);
  return value.legacyText.trim()||Object.values(value.structured).some(Boolean)?value:readAddress(property);
}
/** Never append geography to an opaque full legacy line: it may already contain those values. */
export function formatPropertyAddress(property:PropertyAddressSource):string {
  const value=displayAddressValue(property);
  if(value.structured.streetLocality)return propertyAddressDisplay(value);
  const legacy=formatStructuredAddress({structured:{},legacyText:value.legacyText});
  if(legacy)return legacy;
  return propertyAddressDisplay({...value,legacyText:''});
}
export function propertyAddressRows(property:PropertyAddressSource):Array<{label:string;value:string}> {
  const a=displayAddressValue(property).structured;
  const fields=[['unitNumber','Flat / Unit Number'],['buildingName','Building / Society Name'],['streetLocality','Street / Locality'],['city','City'],['district','District'],['state','State'],['postalCode','PIN / Postal Code'],['country','Country']] as const;
  return fields.flatMap(([key,label])=>a[key]?.trim()&&!/^(undefined|null)$/i.test(a[key]!.trim())?[{label,value:a[key]!.trim()}]:[]);
}
