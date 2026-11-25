export const OWNER_STEPS=['Property Details','Purpose & Pricing','Location & Areas','Occupancy & Condition','Media & Comments','Review & Submit'] as const;
export const TENANT_STEPS=['Property Details','Agreement Details','Rent Schedule & Furnishing','Reported Owner','Images & Documents','Review & Submit'] as const;
export function ownerFieldStep(name:string):number {
 if(['propertyTitle','propertyType','propertyCategory','structure','configuration','agentOwnerEmail'].includes(name))return 1;
 if(['listingType','rentalStatus','saleStatus','expectedRent','monthlyRent','securityDeposit','sellingPrice','preLeased','buyerFirstName','buyerLastName','buyerPhone'].includes(name))return 2;
 if(['location','structuredAddress','unitNumber','floor','carpetArea','constructedArea','plotArea','areaUnit','carpetAreaUnit','constructedAreaUnit','plotAreaUnit'].includes(name))return 3;
 if(['images','internalImages','specificComments'].includes(name))return 5;
 return 4;
}
