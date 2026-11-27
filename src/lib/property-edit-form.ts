import {propertyCategory,structureUsesPlotArea,PROPERTY_STRUCTURES,LEGACY_PROPERTY_STRUCTURES} from './property-category';
import {readPropertyAddress} from './property-address';
import {normalizePurpose} from './property-purpose';
import {rentContract} from './rent-resolution';
import {normalizeNextAgreementDraft,validateNextAgreementDraft} from './next-agreement-draft';

type Data=Record<string,any>;
const text=(value:unknown)=>value==null?'':String(value);
/** Read legacy values without rewriting records or choosing between independent tenancies. */
export function propertyEditDefaults(property:Data):Data {
  const fields=['configuration','unitNumber','floor','location','carpetArea','plotArea','constructedArea','buildingName','structure','areaUnit','carpetAreaUnit','constructedAreaUnit','plotAreaUnit','expectedRent','monthlyRent','sellingPrice','paymentDueDate','escalationPercentage','escalationAmount','monthlyRent1stYear','monthlyRent2ndYear','monthlyRent3rdYear','monthlyRent4thYear','rentFromDate1','rentToDate1','rentFromDate2','rentToDate2','securityDeposit','agreementPeriod','agreementStartDate','agreementEndDate','noticePeriod','lockInPeriod','unitCondition','maintenanceToBePaidBy','rentalStatus','projectCondition','possessionDate','specificComments'];
  const result:Data=Object.fromEntries(fields.map(key=>[key,text(property[key])]));
  const category=propertyCategory(property.propertyCategory)||propertyCategory(property.propertyType);
  Object.assign(result,{propertyTitle:text(property.title??property.propertyTitle),propertyCategory:category||text(property.propertyCategory),propertyType:category||text(property.propertyType),listingType:text(property.listingType),location:text(property.location||property.address),expectedRent:text(property.expectedRent??property.expected_rent),preLeased:property.preLeased?structuredClone(property.preLeased):null,nextAgreementDraft:property.nextAgreementDraft?structuredClone(property.nextAgreementDraft):null,images:[...(property.images||[])],internalImages:[...(property.internalImages||[])],furnishedChecklist:structuredClone(property.furnishedChecklist||[])});
  if(category==='residential'||category==='commercial')result.structuredAddress=readPropertyAddress(property);
  for(const key of ['carpetAreaUnit','constructedAreaUnit','plotAreaUnit'])result[key]=text(property[key]||property.areaUnit||'sq ft');
  const active=(property.tenants||[]).filter((tenant:Data)=>tenant.isActive===true);
  if(active.length===1){const aliases:Data={agreementStartDate:'leaseStartDate',agreementEndDate:'leaseEndDate'},contract=rentContract(property,active[0]);for(const key of ['monthlyRent','securityDeposit','paymentDueDate','agreementStartDate','agreementEndDate','noticePeriod','lockInPeriod','escalationPercentage','escalationAmount'])result[key]=text(['monthlyRent','paymentDueDate','agreementStartDate','agreementEndDate'].includes(key)?contract[key]:active[0][aliases[key]||key]??property[key]);}
  for(const key of ['noticePeriod','lockInPeriod']){const match=/^(\d+)\s+months?$/i.exec(result[key]);if(match)result[key]=match[1];}
  if(result.nextAgreementDraft)result.nextAgreementDraft=normalizeNextAgreementDraft(result.nextAgreementDraft,result.agreementEndDate);
  const buyer=property.buyers?.at(-1)||{};
  Object.assign(result,{saleStatus:property.saleStatus|| (property.isSold?'sold':'available'),buyerFirstName:text(buyer.firstName),buyerLastName:text(buyer.lastName),buyerPhone:text(buyer.phone)});
  if(result.preLeased)for(const key of ['monthlyRentalIncome','securityDeposit'])if(result.preLeased[key]!=null)result.preLeased[key]=text(result.preLeased[key]);
  return result;
}
export function propertyEditStepError(data:Data,dirty:Data,previous:Data,step:number):{field:string;message:string}|null {
  const changed=(...fields:string[])=>fields.some(field=>!!dirty[field]);
  const error=(field:string,message:string)=>({field,message});
  const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(step===1){
    const category=propertyCategory(data.propertyCategory||data.propertyType);
    if(category&&changed('propertyCategory','propertyType')&&![...PROPERTY_STRUCTURES[category],...LEGACY_PROPERTY_STRUCTURES[category]].includes(data.structure))return error('structure','Select a property type for the selected category.');
    if(changed('structure','propertyCategory','propertyType')&&!text(data.structure).trim())return error('structure','Select the property type.');
    if(propertyCategory(data.propertyCategory||data.propertyType)==='residential'&&!structureUsesPlotArea(data.structure)&&changed('configuration','structure','propertyCategory','propertyType')&&!text(data.configuration).trim())return error('configuration','Select the residential layout.');
  }
  const rental=['rent','sell_rent'].includes(data.listingType),sale=['sell','sell_rent'].includes(data.listingType),occupied=rental&&data.rentalStatus==='rented';
  if(step===2){
    const rentField=occupied?'monthlyRent':'expectedRent';
    if(rental&&changed('listingType','rentalStatus',rentField)&&(!text(data[rentField]).trim()||!Number.isFinite(Number(data[rentField]))||Number(data[rentField])<=0))return error(rentField,'Enter a finite positive monthly rent.');
    if(rental&&changed('listingType','rentalStatus','securityDeposit')&&(!text(data.securityDeposit).trim()||!Number.isFinite(Number(data.securityDeposit))||Number(data.securityDeposit)<0))return error('securityDeposit','Enter a non-negative security deposit.');
    if(sale&&changed('listingType','sellingPrice')&&(!text(data.sellingPrice).trim()||!Number.isFinite(Number(data.sellingPrice))||Number(data.sellingPrice)<=0))return error('sellingPrice','Enter a finite positive selling price.');
    if(sale&&data.saleStatus==='sold'&&changed('listingType','saleStatus','buyerFirstName','buyerLastName','buyerPhone'))for(const field of ['buyerFirstName','buyerLastName','buyerPhone'])if(!text(data[field]).trim())return error(field,'Complete the buyer information.');
    if(changed('listingType','preLeased','sellingPrice'))try{normalizePurpose({...data},previous);}catch(issue){return error(data.listingType==='pre_leased'?'preLeased':'listingType',issue instanceof Error?issue.message:'Check the property purpose.');}
  }
  if(step===4&&occupied){
    if(dirty.paymentDueDate&&(!/^\d+$/.test(data.paymentDueDate)||Number(data.paymentDueDate)<1||Number(data.paymentDueDate)>31))return error('paymentDueDate','Choose a payment day from 1 to 31.');
    if(dirty.agreementPeriod&&(!/^\d+$/.test(data.agreementPeriod)||Number(data.agreementPeriod)<1))return error('agreementPeriod','Enter the agreement duration in months.');
    for(const field of ['noticePeriod','lockInPeriod'])if(dirty[field]&&data[field]!==''&&(!/^\d+$/.test(data[field])||Number(data[field])>120))return error(field,'Enter a whole number from 0 to 120 months.');
    if(changed('agreementStartDate','agreementEndDate')&&(!validDate(data.agreementStartDate)||!validDate(data.agreementEndDate)||data.agreementEndDate<data.agreementStartDate))return error('agreementEndDate','Enter valid chronological agreement dates.');
    if(dirty.nextAgreementDraft&&data.nextAgreementDraft){const issue=validateNextAgreementDraft(data.nextAgreementDraft,data.agreementEndDate||'');if(issue)return error('nextAgreementDraft',issue);}
  }
  return null;
}

/** Validate the full edit without coupling validation groups to navigation. */
export function propertyEditError(data:Data,dirty:Data,previous:Data) {
  for(let group=1;group<=5;group++){
    const issue=propertyEditStepError(data,dirty,previous,group);
    if(issue)return issue;
  }
  return null;
}

export function focusEditPropertyError(form:HTMLFormElement|null,field:string,section:number,schedule:(callback:FrameRequestCallback)=>number=callback=>requestAnimationFrame(callback)) {
  if(!form)return;
  schedule(()=>{
    const scope=form.querySelector<HTMLElement>(`[data-edit-section="${section}"]`)||form;
    const controls=Array.from(scope.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement|HTMLButtonElement>('input,select,textarea,button[role="combobox"]')).filter(control=>!control.matches(':disabled')&&control.type!=='hidden'&&control.type!=='file');
    const leaf=field.split('.').at(-1);
    const target=controls.find(control=>control.name===field||control.name.startsWith(field+'.')||!!leaf&&control.id.endsWith('-'+leaf))
      ||controls.find(control=>control.getAttribute('aria-invalid')==='true')
      ||controls.find(control=>!control.checkValidity())||controls[0];
    target?.scrollIntoView({block:'center'});
    target?.focus({preventScroll:true});
  });
}
