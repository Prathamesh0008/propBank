import {validPropertyMoney} from './property-money';
import {indianMobile} from './indian-phone';
// Additive purposes: retain legacy sell_rent records unchanged.
export const PROPERTY_PURPOSES = ['rent', 'sell', 'pre_leased', 'manage'] as const;
export const purposeLabel = (value: string) => ({rent:'For Rent',sell:'For Sale',sell_rent:'For Sale / Rent',pre_leased:'Pre-Leased',manage:'To Manage'}[value] || value);
export const purposeFields = ['preLeased','managementServices','managementDescription'] as const;
export function purposeToday(now = new Date()) { return new Date(now.getTime()+19800000).toISOString().slice(0,10); }
const date = (v: unknown): v is string => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
export function leaseExpired(property: Record<string, any>, today=purposeToday()) { return property.listingType==='pre_leased' && (!date(property.preLeased?.leaseEndDate) || property.preLeased.leaseEndDate<today); }
export function leaseSummary(property: Record<string, any>) {
  const p=property.preLeased || {}, price=Number(property.sellingPrice), rent=Number(p.monthlyRentalIncome);
  return {monthlyRentalIncome:rent,annualRentalIncome:rent*12,grossYield:price>0?rent*1200/price:0,leaseEndDate:p.leaseEndDate,leaseReviewRequired:leaseExpired(property),verificationStatus:p.verificationStatus==='verified'?'verified':'pending'};
}
// Shared validation and hidden-field cleanup. Never maps evidence to tenants.
export function normalizePurpose(input: Record<string, any>, previous?: Record<string, any>, today=purposeToday()): Record<string, any> {
  const result={...input}, type=input.listingType??previous?.listingType;
  // Ignore obsolete registration inputs; existing Firestore metadata is retained.
  delete result.managementServices;delete result.managementDescription;
  const switched=!!previous && type!==previous.listingType;
  if(type==='pre_leased') {
    const p=input.preLeased??previous?.preLeased??{};
    if(!p || typeof p!=='object' || Array.isArray(p))throw Error('Invalid pre-leased details');
    const allowed=['tenantOccupied','monthlyRentalIncome','leaseStartDate','leaseEndDate','securityDeposit','paymentFrequency','lockInPeriod','escalation','leaseType','priceNegotiable','verificationStatus','existingTenant'];
    if(Object.keys(p).some(k=>!allowed.includes(k)))throw Error('Unsupported pre-leased field');
    const tenant=p.existingTenant??previous?.preLeased?.existingTenant;
    let existingTenant;
    if(tenant!==undefined){
      if(!tenant||typeof tenant!=='object'||Array.isArray(tenant)||Object.keys(tenant).some(key=>!['type','name','mobile','email','occupancyStartDate'].includes(key)))throw Error('Invalid existing tenant details');
      if(!['individual','company'].includes(tenant.type))throw Error('Select the existing tenant type');
      if(typeof tenant.name!=='string'||tenant.name.trim().length<2||tenant.name.trim().length>200)throw Error('Enter the tenant full name or company name (2?200 characters)');
      const mobile=indianMobile(tenant.mobile);if(!mobile)throw Error('Enter a valid Indian tenant mobile number');
      if(tenant.email!==undefined&&(typeof tenant.email!=='string'||tenant.email.length>254||tenant.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tenant.email.trim())))throw Error('Enter a valid tenant email');
      if(!date(tenant.occupancyStartDate)||tenant.occupancyStartDate>today)throw Error('Enter a valid tenant occupancy start date that is not in the future');
      existingTenant={type:tenant.type,name:tenant.name.trim(),mobile,email:(tenant.email||'').trim().toLowerCase(),occupancyStartDate:tenant.occupancyStartDate};
    }else if(!previous||previous.listingType!=='pre_leased'||'preLeased' in input){throw Error('Existing tenant details are required');}
    if((!previous||previous.listingType!=='pre_leased'||'sellingPrice' in input&&input.sellingPrice!==previous.sellingPrice)&&!validPropertyMoney(input.sellingPrice??previous?.sellingPrice))throw Error('sellingPrice: enter a finite positive decimal amount');
    if((!previous||previous.listingType!=='pre_leased'||p.monthlyRentalIncome!==previous.preLeased?.monthlyRentalIncome)&&!validPropertyMoney(p.monthlyRentalIncome))throw Error('preLeased.monthlyRentalIncome: enter a finite positive decimal amount');
    if(p.tenantOccupied!==true)throw Error('Confirm an existing occupying tenant');
    if(!date(p.leaseStartDate)||!date(p.leaseEndDate)||p.leaseStartDate>today||p.leaseEndDate<today||p.leaseEndDate<p.leaseStartDate)throw Error('An active lease with valid start and end dates is required');
    if(!['registered','other'].includes(p.leaseType))throw Error('Select the lease type');
    if(p.securityDeposit!==undefined&&p.securityDeposit!==''&&(!previous||p.securityDeposit!==previous.preLeased?.securityDeposit)&&!validPropertyMoney(p.securityDeposit,false))throw Error('preLeased.securityDeposit: enter a finite non-negative decimal amount');
    if(p.paymentFrequency&&!['monthly','quarterly','annually'].includes(p.paymentFrequency))throw Error('Invalid rent payment frequency');
    if(['lockInPeriod','escalation'].some(k=>p[k]!==undefined&&(typeof p[k]!=='string'||p[k].length>1000)))throw Error('Invalid lease details');
    if(p.priceNegotiable!==undefined&&typeof p.priceNegotiable!=='boolean')throw Error('Invalid negotiable price confirmation');
    const {verificationStatus:ignored,...details}=p;
    const unchanged=previous?.preLeased && JSON.stringify({...previous.preLeased,verificationStatus:undefined})===JSON.stringify({...p,verificationStatus:undefined});
    result.preLeased={...details,...(existingTenant?{existingTenant}:{}),paymentFrequency:p.paymentFrequency||'monthly',verificationStatus:unchanged&&previous.preLeased.verificationStatus==='verified'?'verified':'pending'};
    result.isPreLeased=true;result.isSold=false;result.isRented=false;result.rentalStatus='';result.monthlyRent='';result.expectedRent='';
  } else if(type==='manage') {
    for(const key of ['sellingPrice','monthlyRent','expectedRent','rentalStatus','projectCondition','possessionDate','specificComments'])result[key]='';
    result.price=0;result.isPreLeased=false;result.isSold=false;result.isRented=false;
  }
  if(type==='manage'||type==='pre_leased') {
    // Hidden listing inputs cannot accidentally establish internal tenancy.
    for(const key of ['tenantFirstName','tenantLastName','tenantEmail','tenantName','mobileNumber','buyerFirstName','buyerLastName','buyerPhone','saleStatus','agreementPeriod','agreementStartDate','agreementEndDate','securityDeposit','paymentDueDate','lockInPeriod','noticePeriod'])delete result[key];
    delete result.nextAgreementDraft;delete result.rentSchedule;delete result.tenants;delete result.buyers;
  }
  if(type!=='pre_leased'&&(switched||'preLeased' in result)){result.preLeased=null;result.isPreLeased=false;}
  return result;
}
