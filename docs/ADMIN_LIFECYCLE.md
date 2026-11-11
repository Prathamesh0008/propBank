# Admin rented properties and lifecycle notifications

## Directory

The existing All Properties and Pending Approvals views remain unchanged. Rented Properties uses the admin-only GET /api/admin/rented-properties endpoint and canonical tenants collection documents, not listing purpose, manual rentalStatus or embedded tenant counts. It includes committed isActive tenancy records owned by the property's current owner and excludes expired/terminated tenancy records. Pending relationship confirmation is labelled explicitly; it is not presented as a confirmed identity. Pre-leased investment evidence alone cannot qualify. Missing optional information is shown as not recorded.

Each response inspects at most 25 property documents and at most 50 active tenant records per property, groups every property once, and sorts globally by property ID. Search applies case-insensitive name/ID filtering to each candidate window; sparse result pages can have a continuation cursor. There is no invented global rented-property total: displayed counts are distinct properties on the current page. The screen refreshes every 30 seconds and on existing property/tenancy/agreement/ledger refresh events. No rented flag, duplicate directory collection, historical scan or backfill is introduced.

Current rent comes from the existing rentAmountForDate reader. Payment status is displayed only when explicitly available on the tenancy; this feature does not infer paid/unpaid or write any ledger/payment record. Historical tenancies remain in existing property/agreement history.

## Events and email

New admin lifecycle entries are written into the existing admin_notifications collection within the same Firestore transaction as property creation, tenant assignment/replacement/removal, term edits, tenant relationship confirmation, or agreement requests/approvals/termination. Event IDs and notification/email delivery IDs are deterministic within each operation. Retried or failed transactions do not emit success events. Same-value term updates do not produce change events. Notification previews are short and omit personal contact information; property/tenancy references and actor/event IDs remain traceable to admins.

Admin assignment/replacement emails use the existing transactional email outbox and ADMIN_EMAIL configuration. Property submissions continue using existing propertyNotificationEvents admin/owner email generation. Existing owner/tenant email flows are preserved. Existing owner/tenant invitation templates and the target checkout's agreement-inventory model are preserved. Provider calls happen after commit; delivery failure remains in email_deliveries and does not undo saved business data. An absent configured admin recipient leaves lifecycle notifications present and flags the assignment email unconfigured. No historical notices/emails are backfilled.

The compact feed uses admin-only GET /api/admin/notifications/feed with 25-item timestamp pagination, aggregate unread count, and bounded reference verification. It redacts legacy message previews. New lifecycle entries cannot be read through the existing property-scoped owner notification endpoint. Read/unread uses the existing admin read endpoint. Mark-all updates 200 notifications per transaction; the UI processes up to 20 batches and explicitly reports remaining work beyond 4000, instead of claiming all are read.

## Required manual configuration / verification

- Keep ADMIN_EMAIL set to the explicitly authorized administrative recipient; RESEND_API_KEY and verified FROM_EMAIL are required for delivery. No addresses or credentials are stored in this document.
- Before using Unread or Read/Archived filters, create the collection-scope composite index in ADMIN_LIFECYCLE.indexes.json: admin_notifications, isRead ascending, timestamp descending. The default All feed uses the existing timestamp index. Add this definition to the project's existing index deployment configuration or create the exact index in Firebase Console; nothing is deployed automatically.
- Canonical tenancy lookup uses propertyId and isActive equality filters; verify existing automatic indexes/index merging in the target Firestore database.
- Authorized operators should smoke-test the admin UI, expected Firestore database, index readiness, configured recipient and Resend verified sender before release. Live database reads, provider delivery and browser interactions were not exercised in this implementation.

No authentication settings, security rules, mobile ownership, furniture controls, rental form UI, production data or cloud resources were modified. Tests run entirely against isolated fixtures.

## Consolidation file manifest

Recovered from the uncommitted Admin implementation in Desktop/propBank into Desktop/Rushikesh/propBank on fix/mobile-number-uniqueness at 048ebbb. Backend changes were merged against the target implementation; property-purpose validation, inventory version/immutability checks and all property/tenant form files were preserved. No dependencies or environment values were copied.

Created:
- src/features/admin/AdminRentedProperties.tsx
- src/features/admin/AdminNotificationFeed.tsx
- src/features/admin/AdminLifecycle.module.css
- src/lib/admin-property-views.ts
- src/lib/server/services/admin-directories.ts
- src/lib/server/services/admin-lifecycle.ts
- src/app/api/admin/rented-properties/route.ts
- src/app/api/admin/notifications/feed/route.ts
- src/app/api/admin/overview/route.ts
- tests/admin-lifecycle-directory.test.cjs
- docs/ADMIN_LIFECYCLE.md
- docs/ADMIN_LIFECYCLE.indexes.json

Merged:
- src/features/admin/AdminPortal.tsx
- src/features/admin/AdminPortal.module.css
- src/features/admin/AdminPropertiesTab.tsx
- src/features/admin/AdminArchiveTab.tsx
- src/features/admin/AdminServiceRequestsTab.tsx
- src/lib/server/services/tenants.ts
- src/lib/server/services/properties.ts
- src/lib/server/services/property-effects.ts
- src/lib/server/services/agreements.ts
- src/lib/server/services/relationship-links.ts
- src/lib/server/services/notifications.ts
- tests/agreement-admin-notifications.test.cjs

The pre-existing next-env.d.ts modification is retained separately. The index definition is a manual deployment artifact; no Firebase index/configuration is deployed by this consolidation. The destination checkout's existing participant email flows remain in use; admin assignment email is provided by the lifecycle outbox, with no dependency on the source checkout's different furniture-inventory or invitation implementation.

## Local verification limitations

The existing admin-property-operations suite has three pre-merge failures, reproduced against safety copies of the original services: user-search result count and two property-creation fixtures missing the required residential BHK layout. The merge does not alter user search or relax property validation. Live authenticated browser actions and live email/index readiness remain operator checks.
