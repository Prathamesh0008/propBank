import 'server-only';

import { getFirebaseAdminFirestore } from './firebase-admin';

// Exact names used by Go. This module performs no startup writes or backfills.
export const COLLECTIONS = {
  users: 'users',
  properties: 'properties',
  negotiations: 'negotiations',
  tenants: 'tenants',
  visits: 'visits',
  services: 'services',
  serviceRequests: 'service_requests',
  documents: 'documents',
  reviews: 'reviews',
  inspectionReports: 'inspection_reports',
  adminNotifications: 'admin_notifications',
  siteSettings: 'siteSettings',
} as const;

export const SITE_SETTINGS_DOCUMENT = 'main_settings';

export function getDatabase() {
  return getFirebaseAdminFirestore();
}
