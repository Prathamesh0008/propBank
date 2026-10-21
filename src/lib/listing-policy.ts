// Missing moderation metadata is a read-only compatibility rule for legacy listings.
// New public listings always persist an explicit status; unknown states fail closed.
export function listingApproved(property: Record<string, unknown>): boolean {
  return property.moderationStatus === undefined || property.moderationStatus === 'approved';
}
export function publicListing(property: Record<string, unknown>): boolean {
  return listingApproved(property) && property.createdAs !== 'tenant' && property.isActive === true &&
    property.status !== 'inactive' && ['rent', 'sell'].includes(String(property.listingType)) &&
    !(property.listingType === 'rent' && property.rentalStatus === 'rented') && !property.isSold && !property.isRented;
}
