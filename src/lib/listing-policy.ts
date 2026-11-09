import {leaseExpired} from './property-purpose';
// Public listings require an explicit administrator approval.
export function listingApproved(property: Record<string, unknown>): boolean {
  return property.moderationStatus === 'approved';
}
export function publicListing(property: Record<string, unknown>): boolean {
  return !leaseExpired(property) && listingApproved(property) && property.createdAs !== 'tenant' && property.isActive === true &&
    property.status !== 'inactive' && ['rent', 'sell', 'sell_rent', 'pre_leased'].includes(String(property.listingType)) &&
    !(property.listingType === 'rent' && property.rentalStatus === 'rented') && !property.isSold && !property.isRented;
}
