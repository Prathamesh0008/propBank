import 'server-only';

import { AccessError, type AuthenticatedUser } from './auth';

export interface PropertyRelationships {
  ownerUID?: string;
  tenants?: Array<{ userUID?: string; email?: string; phone?: string; isActive?: boolean }>;
}

export function requireAdmin(user: AuthenticatedUser) {
  if (user.role !== 'admin') throw new AccessError(403, 'Administrator access required');
}

export function requireSelfOrAdmin(user: AuthenticatedUser, uid: string) {
  if (user.uid !== uid && user.role !== 'admin') throw new AccessError(403, 'Access denied');
}

export function requireOwnerOrAdmin(user: AuthenticatedUser, property: PropertyRelationships) {
  if (user.uid !== property.ownerUID && user.role !== 'admin') {
    throw new AccessError(403, 'Property owner access required');
  }
}

export function isPropertyTenant(user: AuthenticatedUser, property: PropertyRelationships) {
  return (property.tenants || []).some(tenant => tenant.isActive === true && (
    tenant.userUID ? tenant.userUID === user.uid
      : user.token?.email_verified === true && !!user.token.email && tenant.email?.toLowerCase() === user.token.email.toLowerCase()
  ));
}

export function requirePropertyMember(user: AuthenticatedUser, property: PropertyRelationships) {
  if (user.role !== 'admin' && user.uid !== property.ownerUID && !isPropertyTenant(user, property)) {
    throw new AccessError(403, 'Property access required');
  }
}
