type Data = Record<string, any>;
/** Form defaults must not overwrite unrelated stored information. */
export function propertyEditPayload(candidate: Data, dirty: Data, previous: Data) {
  const result: Data = {expectedRentTermsVersion:previous.rentTermsVersion ?? 0};
  for (const key of Object.keys(dirty)) {
    const storedKey = key === 'propertyTitle' ? 'title' : key;
    if (storedKey in candidate) result[storedKey] = candidate[storedKey];
  }
  if (dirty.structuredAddress) result.expectedAddressVersion = previous.addressVersion ?? 0;
  if (dirty.propertyTitle && !previous.structuredAddress && !dirty.structuredAddress && (!previous.buildingName || previous.buildingName === previous.title)) result.buildingName = candidate.title;
  for (const key of ['images','internalImages','furnishedChecklist']) if (key in candidate && JSON.stringify(candidate[key]) !== JSON.stringify(previous[key] ?? [])) result[key] = candidate[key];
  const terms = ['monthlyRent','securityDeposit','paymentDueDate','agreementStartDate','agreementEndDate','noticePeriod','lockInPeriod','escalationPercentage','escalationAmount'];
  if (terms.some(key=>dirty[key]) && previous.tenants?.some((t:Data)=>t.isActive===true)) {
    if (previous.tenants.filter((t:Data)=>t.isActive===true).length > 1) throw new Error('Edit rental terms for each tenancy separately; multiple active contracts exist.');
    const aliases:Data = {agreementStartDate:'leaseStartDate',agreementEndDate:'leaseEndDate'};
    result.tenants = previous.tenants.map((tenant:Data)=>tenant.isActive!==true?tenant:{...tenant,...Object.fromEntries(terms.filter(key=>dirty[key]).map(key=>[aliases[key]||key,candidate[key]]))});
  }
  if (['saleStatus','buyerFirstName','buyerLastName','buyerPhone'].some(key=>dirty[key])) {result.buyers=candidate.buyers;result.isSold=candidate.isSold;}
  return result;
}
