"use client";
import {useId} from 'react';
import {indianMobile} from '@/lib/indian-phone';
import styles from './AuthAccount.module.css';

export default function RegistrationMobileField({value,onChange,touched,onTouch}:{value:string;onChange:(value:string)=>void;touched:boolean;onTouch:()=>void}){
  const id=useId(),invalid=!/^[6-9]\d{9}$/.test(value);
  const national=(input:string)=>{
    const phone=indianMobile(input);if(phone)return phone.slice(3);
    const digits=input.replace(/\D/g,'');
    return (input.trim().startsWith('+91')||/^91\d{10}$/.test(digits)?digits.slice(2):digits).slice(0,10);
  };
  return <label htmlFor={id}><span>Mobile number</span><span className={styles.mobileControl}><span aria-hidden="true">+91</span><input id={id} name="phoneNumber" type="tel" inputMode="numeric" autoComplete="tel-national" aria-label="Mobile number, India +91" required maxLength={10} pattern="[6-9][0-9]{9}" value={value} onChange={event=>onChange(national(event.target.value))} onPaste={event=>{const input=event.clipboardData.getData('text');if(indianMobile(input)||input.trim().startsWith('+91')||/^91\d{10}$/.test(input.replace(/\D/g,''))){event.preventDefault();onChange(national(input));}}} onBlur={onTouch} onInvalid={onTouch} aria-invalid={touched&&invalid} aria-describedby={touched&&invalid?`${id}-error`:undefined}/></span>{touched&&invalid&&<span id={`${id}-error`} className={styles.mobileError} role="alert">{value?'Enter 10 digits starting with 6, 7, 8 or 9.':'Mobile number is required.'}</span>}</label>;
}
