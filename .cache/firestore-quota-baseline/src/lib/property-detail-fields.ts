type Data = Record<string, unknown>;
export interface PropertyDetailField {label:string;value:string;isCurrency?:boolean}

export function detailText(value:unknown):string|undefined {
  if(value===null||value===undefined)return;
  if(typeof value==='boolean')return value?'Yes':'No';
  if(Array.isArray(value))return value.map(detailText).filter(Boolean).join(', ')||undefined;
  if(typeof value==='object')return Object.entries(value as Data).map(([key,item])=>item===true?key:item===false?undefined:detailText(item)?`${key}: ${detailText(item)}`:undefined).filter(Boolean).join(', ')||undefined;
  const text=String(value).trim();
  return text&&!/^(?:n\/a|not provided|not supplied|null|undefined)$/i.test(text)?text:undefined;
}
export function detailDate(value:unknown):string|undefined {
  const text=detailText(value);if(!text||text.startsWith('0001-'))return;
  const date=new Date(text);return Number.isFinite(date.getTime())?date.toLocaleDateString('en-GB'):undefined;
}
export function detailAmount(value:unknown):string|undefined {
  const text=detailText(value);if(!text)return;
  const amount=Number(text.replace(/[₹,]/g,''));
  return Number.isFinite(amount)?`₹${amount.toLocaleString('en-IN')}`:text;
}
export function detailArea(value:unknown,unit:unknown):string|undefined {
  const text=detailText(value);if(!text)return;
  return /[a-z]/i.test(text)?text:[text,detailText(unit)].filter(Boolean).join(' ');
}
const record=(value:unknown):Data=>value&&typeof value==='object'&&!Array.isArray(value)?value as Data:{};
const fields=(data:Data,definitions:ReadonlyArray<readonly [string,string,('currency'|'date')?]>):PropertyDetailField[]=>definitions.flatMap(([label,key,format])=>{
  const value=format==='date'?detailDate(data[key]):detailText(data[key]);
  return value===undefined?[]:[{label,value,...(format==='currency'?{isCurrency:true}:{})}];
});

export function propertyDetailFields(property:Data) {
  const specifications=fields(property,[
    ['Property Category','propertyCategory'],['Property Type','structure'],['Configuration','configuration'],
    ['Unit Number','unitNumber'],['Floor','floor'],['Total Floors','totalFloors'],['Building / Society Name','buildingName'],
    ['Location','location'],['City','city'],['State','state'],['PIN Code','zipCode'],
    ['Parking','parking'],['Parking Details','parkingDetails'],['Parking Spaces','parkingSpaces'],
    ['Amenities','amenities'],['Facilities','facilities'],
  ]).filter(field=>field.label!=='Building / Society Name'||field.value!==detailText(property.title));
  if(!property.propertyCategory&&detailText(property.propertyType))specifications.unshift({label:'Property Category',value:String(property.propertyType)});
  for(const [label,key]of [['Bedrooms','bedrooms'],['Bathrooms','bathrooms']])if(Number(property[key])>0)specifications.push({label,value:String(property[key])});
  const financial=fields(property,[
    ['Expected Monthly Rent','expectedRent','currency'],['Monthly Rent','monthlyRent','currency'],['Selling Price','sellingPrice','currency'],
    ['Security Deposit','securityDeposit','currency'],['Maintenance Charges','maintenanceCharges','currency'],
    ['Agreement Period','agreementPeriod'],['Agreement Start Date','agreementStartDate','date'],['Agreement End Date','agreementEndDate','date'],
    ['Notice Period','noticePeriod'],['Lock-in Period','lockInPeriod'],['Rent Due Day','paymentDueDate'],
    ['Annual Escalation (%)','escalationPercentage'],['Escalation Amount','escalationAmount','currency'],
    ['1st Year Rent','monthlyRent1stYear','currency'],['2nd Year Rent','monthlyRent2ndYear','currency'],
    ['3rd Year Rent','monthlyRent3rdYear','currency'],['4th Year Rent','monthlyRent4thYear','currency'],
    ['First Rent Period From','rentFromDate1','date'],['First Rent Period To','rentToDate1','date'],
    ['Second Rent Period From','rentFromDate2','date'],['Second Rent Period To','rentToDate2','date'],
    ['Pre-leased Type','preLeasedType'],['Pre-leased Agreement Term','agreementTerm'],['Pre-leased Lock-in Period','lockInPeriodPreLeased'],
    ['Rental Income','rentalIncome','currency'],['Pre-leased Escalation','escalation'],
  ]);
  financial.push(...fields(record(property.nextAgreementDraft),[
    ['Next Agreement Duration (months)','durationMonths'],['Next Agreement Start','startDate','date'],['Next Agreement End','endDate','date'],
    ['Next Agreement Monthly Rent','monthlyRent','currency'],['Next Agreement Security Deposit','securityDeposit','currency'],
    ['Next Agreement Notice Period','noticePeriod'],['Next Agreement Lock-in Period','lockInPeriod'],
  ]));
  const maintenance=fields(property,[
    ['Unit Condition','unitCondition'],['Maintenance To Be Paid By','maintenanceToBePaidBy'],
    ['Rental Status','rentalStatus'],['Project Condition','projectCondition'],['Agreement Status','agreementStatus'],
  ]);
  if(property.isPreLeased===true)maintenance.push({label:'Pre-leased',value:'Yes'});
  if(!(property.listingType==='rent'&&property.rentalStatus==='rented'))maintenance.push(...fields(property,[['Possession Date','possessionDate','date']]));
  const reported=record(property.reportedOwner);
  const owner=fields({
    name:property.ownerName||reported.personName,
    email:property.ownerEmail||reported.email,phone:property.ownerPhone||reported.phone,
    company:reported.companyName,alternatePhone:reported.alternatePhone,workingProfile:reported.workingProfile,
  },[['Owner Name','name'],['Owner Email','email'],['Owner Phone','phone'],['Owner Company','company'],['Alternate Contact','alternatePhone'],['Working Profile','workingProfile']]);
  const additional=fields(property,[['Comments','specificComments'],['Purpose','purpose'],['Specific Requirements','specificRequirement'],['Pre-leased Tenant Details','tenantDetails']]);
  return {specifications,financial,maintenance,owner,additional};
}

export function tenantDetailFields(value:unknown):PropertyDetailField[] {
  const tenant=record(value);
  return [...fields(tenant,[
    ['Phone','phone'],['Primary Contact','primaryPhone'],['Alternate Contact','alternatePhone'],['Monthly Rent','monthlyRent','currency'],['Security Deposit','securityDeposit','currency'],
    ['Lease Start','leaseStartDate','date'],['Lease End','leaseEndDate','date'],['Rent Due Day','paymentDueDate'],
    ['Notice Period','noticePeriod'],['Lock-in Period','lockInPeriod'],['Annual Escalation (%)','escalationPercentage'],['Escalation Amount','escalationAmount','currency'],
    ['Emergency Contact','emergencyContact'],['Previous Address','previousAddress'],['Employment Status','employmentStatus'],
    ['Employer','employer'],['Monthly Income','monthlyIncome','currency'],['Last Modified','updatedAt','date'],
  ]),...fields(record(tenant.spouse),[
    ['Spouse First Name','firstName'],['Spouse Last Name','lastName'],['Spouse Email','email'],['Spouse Phone','phone'],
    ['Spouse Employment Status','employmentStatus'],['Spouse Employer','employer'],['Spouse Notes','notes'],
  ])];
}

export function managePropertiesReturn(value:unknown,tab='owned'):string {
  const fallback=`/manage-property?tab=${tab==='tenant'?'tenant':'owned'}`;
  if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return fallback;
  const url=new URL(value,'https://propbank.invalid');
  if(url.pathname!=='/manage-property')return fallback;
  return url.pathname+url.search;
}
