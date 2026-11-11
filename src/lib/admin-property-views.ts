import {publicListing} from './listing-policy';
export type AdminPropertySection='all'|'pending'|'rented'|'available'|'archived';
type Row={ownerUID?:string;isActive?:boolean;status?:string;moderationStatus?:string;agreementStatus?:string;listingType?:string;rentalStatus?:string;isSold?:boolean;isRented?:boolean;createdAs?:string;tenants?:unknown[]};
export const archivedAdminProperty=(p:Row)=>p.isActive===false||p.status==='inactive';
export function confirmedAdminTenants(p:Row):Array<Record<string,unknown>> {
  if(archivedAdminProperty(p)||!p.ownerUID||['terminated','expired','cancelled'].includes(p.agreementStatus||''))return [];
  return (p.tenants||[]).filter((t):t is Record<string,unknown>=>!!t&&typeof t==='object'&&(t as Record<string,unknown>).isActive===true&&typeof(t as Record<string,unknown>).userUID==='string'&&!!(t as Record<string,unknown>).userUID&&(t as Record<string,unknown>).linkConfirmationRequired!==true);
}
export function adminAvailability(p:Row):'available'|'unavailable'|'unknown' {
  if(archivedAdminProperty(p)||p.moderationStatus!=='approved'||p.isSold||p.isRented||p.createdAs==='tenant'||confirmedAdminTenants(p).length)return 'unavailable';
  if((p.tenants||[]).some(t=>!!t&&typeof t==='object'&&(t as Record<string,unknown>).isActive===true))return 'unknown';
  if(!['rent','sell','sell_rent'].includes(p.listingType||''))return 'unavailable';
  if(p.rentalStatus==='rented')return 'unknown';
  if(p.isActive!==true||(['rent','sell_rent'].includes(p.listingType||'')&&p.rentalStatus!=='available'))return 'unknown';
  return publicListing(p as Record<string,unknown>)?'available':'unavailable';
}
export function matchesAdminPropertySection(p:Row,section:AdminPropertySection):boolean {
  if(section==='archived')return archivedAdminProperty(p);
  if(section==='pending')return !archivedAdminProperty(p)&&p.moderationStatus==='pending_review';
  if(section==='rented')return confirmedAdminTenants(p).length>0;
  if(section==='available')return adminAvailability(p)!=='unavailable';
  return true;
}
