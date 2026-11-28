"use client";
import {Children,cloneElement,isValidElement,type ReactElement,type ReactNode} from 'react';
import styles from './AdminPropertySections.module.css';

export const ADMIN_PROPERTY_SECTIONS=['Property Classification','Property Information','Property Features & Amenities','Owner Information','Tenant Information','Rental, Pricing & Agreement Details','Property Photos & Documents','Review & Submit'] as const;
const rentedSections=[1,2,3,4,5,6,7,8] as const;
const vacantSections=[1,2,3,4,6,7,8] as const;
export const adminVisibleSections=(rented:boolean):readonly number[]=>rented?rentedSections:vacantSections;
/** Presentation only; canonical controls, conditions and submit values stay in AddPropertyForm. */
export function adminPropertyFieldSection(field:string):number {
  const name=field.split('.')[0];
  if(['propertyCategory','propertyType','structure','listingType','rentalStatus'].includes(name))return 1;
  if(['configuration','unitCondition','furnishedChecklist','amenities','parking'].includes(name))return 3;
  if(name==='adminOwner'||name==='agentOwnerEmail')return 4;
  if(name.startsWith('tenant')||name==='mobileNumber')return 5;
  if(['preLeased','saleStatus','monthlyRent','expectedRent','securityDeposit','sellingPrice','buyerFirstName','buyerLastName','buyerPhone','paymentDueDate','agreementPeriod','agreementStartDate','agreementEndDate','noticePeriod','lockInPeriod','maintenanceToBePaidBy','escalationPercentage','escalationAmount','rentSchedule','nextAgreementDraft'].includes(name))return 6;
  if(['images','internalImages','adminDocuments','specificComments'].includes(name))return 7;
  return 2;
}
type Parts={field:unknown;client:unknown;panel:unknown;owner:unknown;documents:unknown;address:unknown;purpose:unknown;schedule:unknown;nextAgreement:unknown;review:unknown};
/** Move the existing React elements, rather than copying fields or their handlers. */
export function projectAdminSection(nodes:ReactNode,section:number,parts:Parts,origin=2,parentKey=''):ReactNode[] {
  return Children.toArray(nodes).flatMap(node=>{
    if(!isValidElement(node))return origin===section?[node]:[];
    // Children.toArray keys are local to each input list. Include source ancestry
    // before flattening panels so unrelated controls cannot share .0/.1 keys.
    const source=node as ReactElement<Record<string,any>>;
    const key=parentKey+'/'+encodeURIComponent(String(source.key));
    const element=cloneElement(source,{key}),p=element.props;
    if(element.type===parts.panel)return projectAdminSection(p.children,section,parts,({1:2,2:6,3:2,4:6,5:7,6:8} as Record<number,number>)[p.number]||origin,key);
    if(element.type===parts.client){
      const fields=section===1?['structure']:section===2?['propertyTitle']:[];
      return fields.length?[cloneElement(element,{onlyFields:fields,hideLegend:true})]:[];
    }
    if(element.type===parts.field)return adminPropertyFieldSection(String(p.name))===section?[element]:[];
    if(element.type===parts.purpose)return section===6?[cloneElement(element,{section:'details'})]:section===7?[cloneElement(element,{section:'media'})]:[];
    const target=element.type===parts.owner?4:element.type===parts.documents?7:element.type===parts.address?2:[parts.purpose,parts.schedule,parts.nextAgreement].includes(element.type)?6:element.type===parts.review?8:undefined;
    if(target!==undefined)return target===section?[element]:[];
    if(typeof element.type==='string'&&/^h[1-6]$|^legend$/.test(element.type))return [];
    if(!p.children)return origin===section?[element]:[];
    const children=projectAdminSection(p.children,section,parts,origin,key);
    if(!children.length){
      // Preserve standalone help/error text once, without repeating old headings.
      if(element.type==='p'&&origin===section)return [element];
      return [];
    }
    return [cloneElement(element,{},children)];
  });
}
export default function AdminPropertySections({panels,parts,step,rented,categorySelector}:{panels:ReactNode;parts:Parts;step:number;rented:boolean;categorySelector?:ReactNode}){
  return <div className={styles.sections}>{adminVisibleSections(rented).map(section=><fieldset key={section} data-form-step={section} hidden={step!==section} aria-labelledby={`admin-property-section-${section}`} className={styles.section}><h2 id={`admin-property-section-${section}`}>{ADMIN_PROPERTY_SECTIONS[section-1]}</h2>{section===1&&categorySelector}{projectAdminSection(panels,section,parts)}</fieldset>)}</div>;
}
