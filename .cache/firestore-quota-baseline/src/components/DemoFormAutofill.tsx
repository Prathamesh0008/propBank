"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {demoValueFor,isDemoAutofillEnvironment,type DemoField} from '@/lib/demo-form-data';
import styles from './DemoFormAutofill.module.css';

type Supported=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
const relationshipPattern=/(?:property|owner|tenant|agent|broker|user).*\b(?:id|uid)\b|\b(?:id|uid)\b.*(?:property|owner|tenant|agent|broker|user)/i;
function labelFor(element:Supported){return element.labels?.[0]?.textContent?.trim()||element.closest('label')?.textContent?.trim()||'';}
function setValue(element:Supported,value:string|boolean){
  if(element instanceof HTMLInputElement&&(element.type==='checkbox'||element.type==='radio')){
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'checked')?.set;setter?.call(element,Boolean(value));
  }else{
    const prototype=element instanceof HTMLSelectElement?HTMLSelectElement.prototype:element instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value')?.set?.call(element,String(value));
  }
  element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));
}
function eligible(element:Supported){return !element.disabled&&(!(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement)||!element.readOnly)&&!relationshipPattern.test(`${element.name} ${element.id} ${labelFor(element)}`);}
function fill(form:HTMLFormElement,onlyEmpty=false){
  for(const element of Array.from(form.elements)){
    if(!(element instanceof HTMLInputElement||element instanceof HTMLSelectElement||element instanceof HTMLTextAreaElement)||!eligible(element))continue;
    if(onlyEmpty&&('value' in element&&element.value||element instanceof HTMLInputElement&&element.checked))continue;
    const field:DemoField={type:element instanceof HTMLSelectElement?(element.multiple?'select-multiple':'select-one'):element.type,name:element.name,id:element.id,placeholder:'placeholder' in element?element.placeholder:'',label:labelFor(element),options:element instanceof HTMLSelectElement?Array.from(element.options).map(option=>({value:option.value,disabled:option.disabled})):undefined};
    const value=demoValueFor(field);if(value!==null)setValue(element,value);
  }
}
function fillForm(form:HTMLFormElement){
  const hasValues=Array.from(form.elements).some(element=>element instanceof HTMLInputElement?element.type!=='hidden'&&element.type!=='password'&&element.type!=='file'&&(element.value.trim()!==''||element.checked):element instanceof HTMLSelectElement||element instanceof HTMLTextAreaElement?element.value.trim()!=='':false);
  if(hasValues&&!window.confirm('Replace the current editable values with PropBank demo data?'))return;
  fill(form);window.setTimeout(()=>fill(form,true),100);window.setTimeout(()=>fill(form,true),350);
}
export default function DemoFormAutofill(){
  const [mounts,setMounts]=useState<Array<{form:HTMLFormElement;target:HTMLDivElement}>>([]);
  useEffect(()=>{
    if(!isDemoAutofillEnvironment(window.location.hostname,process.env.NODE_ENV))return;
    const refresh=()=>setMounts(current=>{
      const live=new Map(current.filter(item=>item.form.isConnected).map(item=>[item.form,item]));
      for(const form of Array.from(document.forms))if(!live.has(form)&&form.dataset.demoAutofill!=='off'&&form.dataset.demoAutofillMounted!=='true'){
        const target=document.createElement('div');target.dataset.demoAutofillMount='true';form.dataset.demoAutofillMounted='true';form.prepend(target);live.set(form,{form,target});
      }
      return [...live.values()];
    });
    refresh();const observer=new MutationObserver(refresh);observer.observe(document.body,{childList:true,subtree:true});
    return()=>{observer.disconnect();for(const target of Array.from(document.querySelectorAll('[data-demo-autofill-mount="true"]')))target.remove();for(const form of Array.from(document.forms))delete form.dataset.demoAutofillMounted;};
  },[]);
  return <>{mounts.map(({form,target})=>createPortal(<div className={styles.mount}><button type="button" className={styles.button} onClick={()=>fillForm(form)}>Fill Demo Data</button></div>,target))}</>;
}

