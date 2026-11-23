"use client";
import {useId} from 'react';
import {ADDRESS_FIELDS,type AddressValue,type AddressField} from '@/lib/structured-address';
import {propertyAddressDisplay,propertyAddressSchema} from '@/lib/property-address';
import {personalAddressSchema} from '@/lib/personal-address';
import styles from './StructuredAddressFields.module.css';
const labels:Record<AddressField,string>={unitNumber:'Flat / House / Unit Number',buildingName:'Building / Society Name',streetLocality:'Street / Area / Locality',city:'City',district:'District',state:'State / Province / Region',postalCode:'PIN / Postal Code',country:'Country'};
const autocomplete:Partial<Record<AddressField,string>>={streetLocality:'address-line1',city:'address-level2',state:'address-level1',postalCode:'postal-code',country:'country-name'};
export default function StructuredAddressFields({value,onChange,disabled=false,error,legend='Property address',optional=false}:{value:AddressValue;onChange:(value:AddressValue)=>void;disabled?:boolean;error?:string;legend?:string;optional?:boolean}){
  const id=useId(),india=/^(in|ind|india)$/i.test(value.structured.country||'');
  const validation=(optional?personalAddressSchema:propertyAddressSchema).safeParse(value);
  const issues=!validation.success&&error?validation.error.issues:[];
  return <fieldset className={styles.section} disabled={disabled} aria-describedby={error?`${id}-error`:undefined}><legend>{legend}</legend>
    {value.legacyText&&<label className={styles.legacy}>Existing address<textarea value={value.legacyText} onChange={e=>onChange({...value,legacyText:e.target.value})} maxLength={4000}/><small>Preserved as entered. You can edit this address or supply structured details below; no components have been guessed.</small></label>}
    <p className={styles.preview}>Unit and district are optional. For a structured address, enter a street/locality, city and country; Indian addresses also need a state and PIN code. Blank fields do not clear previously saved details.</p>
    <div className={styles.grid}>{ADDRESS_FIELDS.map(field=>{const message=issues.find(i=>i.path.at(-1)===field)?.message;return <label key={field} htmlFor={`${id}-${field}`}>{field==='postalCode'&&india?'PIN Code':labels[field]}<input id={`${id}-${field}`} name={`${id}-address-${field}`} value={value.structured[field]||''} maxLength={field==='postalCode'?32:200} autoComplete={autocomplete[field]} inputMode={field==='postalCode'&&india?'numeric':undefined} aria-invalid={!!message} aria-describedby={message?`${id}-${field}-error`:undefined} onChange={e=>onChange({...value,structured:{...value.structured,[field]:e.target.value}})}/>{message&&<small id={`${id}-${field}-error`}>{message}</small>}</label>})}</div>
    <p className={styles.preview}>Address preview: {propertyAddressDisplay(value)||'Enter an address.'}</p>
    {error&&<p id={`${id}-error`} role="alert" className={styles.error}>{error}</p>}
  </fieldset>;
}
