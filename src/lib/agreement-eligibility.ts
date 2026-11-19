type AgreementProperty={isActive?:unknown;status?:unknown;isArchived?:unknown;rentalStatus?:unknown;agreementStatus?:unknown;tenants?:unknown;agreementStartDate?:unknown;agreementEndDate?:unknown;tenantEmail?:unknown};
/** Expired agreements may be renewed; an unrelated property registration may not. */
export function hasEligibleAgreement(property:AgreementProperty):boolean {
  if(property.isActive===false||property.status==='inactive'||property.isArchived===true||property.rentalStatus!=='rented'||['terminated','cancelled'].includes(String(property.agreementStatus||'')))return false;
  return Array.isArray(property.tenants)&&property.tenants.some(t=>t&&t.isActive===true)||
    !!(property.agreementStartDate&&property.agreementEndDate)||typeof property.tenantEmail==='string'&&!!property.tenantEmail.trim();
}
