export const CONNECTION_STATES = [
  'verification_required', 'pending_owner_authorization', 'pending_tenant_acceptance',
  'pending_admin_verification', 'linked', 'rejected', 'expired',
] as const;
export type ConnectionState = typeof CONNECTION_STATES[number];
export const CONNECTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const aliases: Record<string, ConnectionState> = {
  awaiting_owner_request: 'pending_owner_authorization',
  awaiting_owner_approval: 'pending_owner_authorization',
  awaiting_confirmation: 'pending_tenant_acceptance',
  awaiting_admin_verification: 'pending_admin_verification',
};

export function connectionState(value: unknown): ConnectionState {
  if (typeof value !== 'string') return 'expired';
  return aliases[value] || (CONNECTION_STATES.includes(value as ConnectionState) ? value as ConnectionState : 'expired');
}

export function connectionTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value);
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().getTime();
  return NaN;
}

export function connectionExpiry(record: Record<string, unknown>): number {
  if ('expiresAt' in record) return connectionTime(record.expiresAt);
  return connectionTime(record.createdAt) + CONNECTION_TTL_MS;
}

export function currentConnectionState(record: Record<string, unknown>, now = Date.now()): ConnectionState {
  const state = connectionState(record.status);
  // Expiry governs pending discovery, never an already established UID link.
  if (['linked', 'rejected', 'expired'].includes(state)) return state;
  const expires = connectionExpiry(record);
  return Number.isFinite(expires) && expires > now ? state : 'expired';
}

export const connectionPending = (state: string) => !['linked', 'rejected', 'expired'].includes(state);

export const CONNECTION_LABELS: Record<ConnectionState, string> = {
  verification_required: 'Verification Required',
  pending_owner_authorization: 'Awaiting Owner Approval',
  pending_tenant_acceptance: 'Awaiting Tenant Acceptance',
  pending_admin_verification: 'Awaiting Admin Verification',
  linked: 'Linked', rejected: 'Rejected', expired: 'Expired',
};
