# FEATURE INVENTORY

> Source audit: 2026-11-06 (Asia/Calcutta). Branch `main`, commit `fa98b7e0e53d29053365be4c1a1b8230a313f686`. Static inspection only; no production database access, external service health checks, browser tests, migrations, push or deployment. ?Implemented? means a source-complete path with identifiable validation and authorization; it does not certify successful runtime operation. Historical reports are secondary evidence only.

Counting unit: one named capability entry below, including partial/missing capabilities. **50 entries**. APIs count method/path operations separately in API_REFERENCE. All statuses are static implementation assessments, not successful live tests.

## Public website

### F01. Public brand and information pages

- **Purpose:** Landing, about, contact, services, FAQ, terms/privacy/support and static property journal.
- **Source files:** src/app/page.tsx; src/features/landing-page/LandingPage.tsx; src/app/blog/page.tsx
- **API routes:** None for static content; GET /api/properties
- **Database dependencies:** siteSettings; properties
- **Authorization:** Public
- **Implementation status:** Implemented
- **Known limitations:** Blog is fixed page content, not a CMS or publishing system.

### F02. Public catalogue and filters

- **Purpose:** Display approved available properties and filter by listing/category/location.
- **Source files:** src/features/search/SearchResults.tsx; src/lib/server/services/properties.ts
- **API routes:** GET /api/properties; GET /api/properties/search
- **Database dependencies:** properties; siteSettings
- **Authorization:** Public
- **Implementation status:** Implemented
- **Known limitations:** Server search filters matching text in memory; no full-text engine or public pagination.

### F03. Public property details

- **Purpose:** Allowlisted property details and cover image.
- **Source files:** src/features/properties/PropertyDetails.tsx; src/lib/server/services/contracts.ts
- **API routes:** GET /api/properties/[id]; GET /api/media/[id]
- **Database dependencies:** properties; storage_objects
- **Authorization:** Public eligibility; expanded fields only for authorized relationships
- **Implementation status:** Implemented
- **Known limitations:** Static source path verified; runtime and external dependencies not exercised.

### F04. General enquiry

- **Purpose:** Collect buy/rent/sell interests and optional visit preference.
- **Source files:** src/features/landing-page/GeneralInquiryForm.tsx; src/lib/server/services/notifications.ts
- **API routes:** POST /api/admin/notifications
- **Database dependencies:** admin_notifications; enquiry_controls
- **Authorization:** Public for general_inquiry with no userId/bearer
- **Implementation status:** Implemented
- **Known limitations:** Preferred visit is enquiry data; it does not itself create a visits record. Email best effort.

## Registration and login

### F05. Email registration and verification

- **Purpose:** Firebase identity plus required profile completion.
- **Source files:** src/features/auth/GoogleAuth.tsx; src/lib/server/services/users.ts
- **API routes:** GET/POST /api/auth/user; POST /api/auth/login
- **Database dependencies:** users; auth_activity; email_deliveries
- **Authorization:** Own Firebase UID; onboarding can precede email verification
- **Implementation status:** Implemented
- **Known limitations:** Profile failure can leave Auth-only identity; phone uniqueness is not atomic.

### F06. Password sign-in and recovery

- **Purpose:** Firebase sign-in, reset link request and PropBank session metadata.
- **Source files:** src/features/auth/GoogleAuth.tsx; src/lib/server/services/auth-activity.ts
- **API routes:** POST /api/auth/login; POST /api/auth/activity
- **Database dependencies:** users; auth_activity
- **Authorization:** Firebase; password-reset activity branch is public
- **Implementation status:** Implemented
- **Known limitations:** Static source path verified; runtime and external dependencies not exercised.

### F07. Google sign-in and provider linking

- **Purpose:** Popup identity and explicit credential linking after existing password login.
- **Source files:** src/features/auth/GoogleAuth.tsx; src/firebase.ts
- **API routes:** GET/POST /api/auth/user; POST /api/auth/activity
- **Database dependencies:** users; auth_activity
- **Authorization:** Firebase provider credential
- **Implementation status:** Implemented
- **Known limitations:** Google/provider configuration and cross-provider email behavior need console verification.

### F08. Profile completion gating and retry

- **Purpose:** Block protected app until verified complete profile; expose retry for service outage.
- **Source files:** src/contexts/AuthContext.tsx; src/components/RouteGuard.tsx
- **API routes:** GET /api/auth/user
- **Database dependencies:** users
- **Authorization:** Self profile status
- **Implementation status:** Implemented
- **Known limitations:** Client guard is UX only; endpoints separately authorize.

## User profile

### F09. Self profile and agency details

- **Purpose:** Edit name, photo, bio, agency and preferences.
- **Source files:** src/features/account/MyAccount.tsx; src/lib/server/services/account.ts
- **API routes:** GET/PATCH /api/account
- **Database dependencies:** users; auth_activity; email_deliveries
- **Authorization:** Completed self identity
- **Implementation status:** Implemented
- **Known limitations:** Profile/Firebase updates cross service boundaries; rollback covers only some fields.

### F10. Password/email account changes

- **Purpose:** Firebase reauthentication and security event logging.
- **Source files:** src/features/account/MyAccount.tsx; src/lib/server/services/account.ts
- **API routes:** POST /api/account/security-event; GET /api/account
- **Database dependencies:** users; auth_activity; email_deliveries
- **Authorization:** Recent self authentication
- **Implementation status:** Partially implemented
- **Known limitations:** Verified-email profile mismatch is rejected before GET account synchronization; see known issues. Client-reported security event is not server proof of Firebase mutation.

### F11. Mobile contact requirement

- **Purpose:** Normalize and require Indian mobile at onboarding.
- **Source files:** src/lib/indian-phone.ts; src/features/auth/RegistrationMobileField.tsx
- **API routes:** POST /api/auth/user
- **Database dependencies:** users.phoneNumber
- **Authorization:** Self onboarding
- **Implementation status:** Implemented
- **Known limitations:** Syntactic contact validation only, no ownership proof.

### F12. Phone OTP and mobile change enrollment

- **Purpose:** Verify a new mobile through an application OTP flow.
- **Source files:** src/lib/server/services/account.ts; src/lib/server/services/relationship-links.ts
- **API routes:** PATCH /api/account (requires already verified phone)
- **Database dependencies:** users; external Firebase Auth phone
- **Authorization:** Recent self auth
- **Implementation status:** Not implemented
- **Known limitations:** Backend checks exist but no integrated phone verification UI; API reports unavailable.

## Owner dashboard

### F13. Portfolio and archive

- **Purpose:** Owned/tenant property directory, lifecycle actions and archived records.
- **Source files:** src/features/properties/ManageProperty.tsx; src/features/properties/ArchivedProperties.tsx
- **API routes:** GET /api/properties?ownerUID=...; PUT/PATCH /api/properties/[id]
- **Database dependencies:** properties
- **Authorization:** Self/admin; owner/editor for mutation
- **Implementation status:** Implemented
- **Known limitations:** Agent submitted-property projection can be omitted by owned-only client hook; see issues.

## Tenant dashboard

### F14. Tenant workspace and property intake

- **Purpose:** Tenant-first property entry and member workspace before owner verification.
- **Source files:** src/features/properties/TenantPropertyForm.tsx; src/features/properties/PropertyHub.tsx
- **API routes:** POST /api/properties; GET /api/property-hub
- **Database dependencies:** properties; tenants; relationship_links
- **Authorization:** Verified complete user; active tenant membership
- **Implementation status:** Implemented
- **Known limitations:** Reported owner is not legal owner until admin review.

## Admin dashboard

### F15. Administrator portal

- **Purpose:** Tabbed properties, accounts/agents, enquiries, visits, services, archives and settings.
- **Source files:** src/features/admin/AdminPortal.tsx
- **API routes:** GET /api/properties?admin=true; GET /api/users; GET /api/admin/notifications
- **Database dependencies:** properties; users; admin_notifications
- **Authorization:** Admin
- **Implementation status:** Implemented
- **Known limitations:** Tab-dependent agent loading can leave enquiry assignment options empty on first entry.

### F16. Account role/status management

- **Purpose:** Inspect account metadata/activity and update role/status with Firebase disable-state synchronization.
- **Source files:** src/features/admin/AdminUserDetailsDialog.tsx; src/lib/server/services/users.ts
- **API routes:** GET/PUT/PATCH /api/users/[id]; GET /api/admin/users/search
- **Database dependencies:** users; auth_activity
- **Authorization:** Admin; POST upsert blocks self role/status changes, but PUT/PATCH lacks that guard
- **Implementation status:** Implemented
- **Known limitations:** Cross-project Auth/data writes are not a single transaction.

## Property management

### F17. Property creation/categories/pricing

- **Purpose:** Residential/commercial/industrial structures, units, furnishing and rent/sale pricing.
- **Source files:** src/features/properties/AddPropertyForm.tsx; src/lib/server/services/properties.ts
- **API routes:** POST /api/properties
- **Database dependencies:** properties; property_submissions; storage_objects
- **Authorization:** Self/admin owner; agent separate owner
- **Implementation status:** Implemented
- **Known limitations:** Content fingerprint deduplicates equivalent submissions without a documented expiration.

### F18. Property editing and archive state

- **Purpose:** Edit permitted fields and preserve relationship/terms history.
- **Source files:** src/features/properties/EditProperty.tsx; src/lib/server/services/properties.ts
- **API routes:** PUT/PATCH /api/properties/[id]
- **Database dependencies:** properties; tenants; relationship_links; storage_objects
- **Authorization:** Owner/admin; submitting agent restricted content
- **Implementation status:** Implemented
- **Known limitations:** No property DELETE endpoint; archive via status flags.

### F19. Agent listing submission

- **Purpose:** Agent lists for a separate active verified owner account.
- **Source files:** src/features/properties/AddPropertyForm.tsx; src/lib/server/services/properties.ts
- **API routes:** POST /api/properties; PUT/PATCH /api/properties/[id]
- **Database dependencies:** properties; users
- **Authorization:** Agent and its submittedByUID scope
- **Implementation status:** Implemented
- **Known limitations:** Submitting a listing does not grant general private file or property membership rights.

## Property listing and moderation

### F20. Publication review

- **Purpose:** Approve/reject/request changes/resubmit with revision and reason.
- **Source files:** src/features/properties/ListingModeration.tsx; src/lib/server/services/properties.ts
- **API routes:** PUT/PATCH /api/properties/[id]
- **Database dependencies:** properties; email_deliveries
- **Authorization:** Admin decision; editor resubmission
- **Implementation status:** Implemented
- **Known limitations:** Legacy records lacking explicit approved moderation are not public.

## Tenant relationships

### F21. Tenant add/update/remove

- **Purpose:** Maintain standalone and embedded tenant details and active state.
- **Source files:** src/features/services/AddTenant.tsx; src/lib/server/services/tenants.ts
- **API routes:** GET/POST /api/tenants; GET/PUT/DELETE /api/tenants/[id]
- **Database dependencies:** tenants; properties; relationship_links
- **Authorization:** Owner/admin writes; own tenant/member reads
- **Implementation status:** Implemented
- **Known limitations:** Deletion is deactivation, not record erasure; historical denormalized fields need consistency.

### F22. Pending connections and identity discovery

- **Purpose:** Discover own verified email/phone claims and confirm/authorize/reject relationships.
- **Source files:** src/features/properties/PendingConnections.tsx; src/features/account/RelationshipLinks.tsx; src/lib/server/services/relationship-links.ts
- **API routes:** GET/POST /api/relationship-links
- **Database dependencies:** relationship_links; relationship_link_limits; tenants; properties
- **Authorization:** Current verified identity; recent auth for actions
- **Implementation status:** Implemented
- **Known limitations:** 30-day pending expiry; per-state result caps; phone-only claims require externally verified Auth phone.

### F23. Administrator tenancy assignment

- **Purpose:** Assign/replace/remove registered tenant with revision guards.
- **Source files:** src/features/admin/AdminPropertyOperations.tsx; src/lib/server/services/tenants.ts
- **API routes:** POST /api/admin/properties/[id]/tenancy
- **Database dependencies:** properties; tenants; users; relationship_links
- **Authorization:** Admin
- **Implementation status:** Implemented
- **Known limitations:** Relationship effects must be distinguished from a global tenant role.

## Rent management

### F24. Rent schedules and escalation

- **Purpose:** Legacy year fields and additional validated dated periods.
- **Source files:** src/lib/rent-schedule.ts; src/features/properties/AddPropertyForm.tsx
- **API routes:** POST /api/properties; PUT/PATCH /api/properties/[id]
- **Database dependencies:** properties; tenants
- **Authorization:** Authorized editor
- **Implementation status:** Implemented
- **Known limitations:** Money is frequently string data; schedule dates are not payment confirmation.

### F25. Rent ledger and receipts

- **Purpose:** Versioned monthly expected rent and manually recorded due/paid state with linked receipt.
- **Source files:** src/features/properties/PropertyHub.tsx; src/lib/server/services/property-hub.ts
- **API routes:** GET/PATCH /api/property-hub
- **Database dependencies:** properties.rentLedger; documents
- **Authorization:** Owner/admin write; member read
- **Implementation status:** Implemented
- **Known limitations:** 120 entries/500 history cap; no payment gateway or bank reconciliation.

### F26. Payment collection integration

- **Purpose:** Charge or settle rent electronically.
- **Source files:** src/lib/server/services/property-hub.ts
- **API routes:** None
- **Database dependencies:** None beyond manual ledger
- **Authorization:** N/A
- **Implementation status:** Not implemented
- **Known limitations:** Manual payment-recorded email is not an electronic payment transaction.

## Rental agreements

### F27. Renewal requests and decisions

- **Purpose:** Tenant/owner request renewal, exact owner accepts/rejects pending terms.
- **Source files:** src/features/services/RenewAgreement.tsx; src/lib/server/services/agreements.ts
- **API routes:** POST /api/agreements/renew; POST /api/agreements/request-renewal
- **Database dependencies:** properties; tenants; admin_notifications; email_deliveries
- **Authorization:** Active tenant requests; exact owner decisions
- **Implementation status:** Implemented
- **Known limitations:** 500 history cap; electronic signatures/legal registration are not implemented.

### F28. Termination and notice

- **Purpose:** Tenant requests, owner notice or immediate termination, deactivate tenancy.
- **Source files:** src/features/services/TerminateAgreement.tsx; src/lib/server/services/agreements.ts
- **API routes:** POST /api/agreements/terminate; POST /api/agreements/request-termination
- **Database dependencies:** properties; tenants; admin_notifications; email_deliveries
- **Authorization:** Active tenant requests; exact owner decisions
- **Implementation status:** Implemented
- **Known limitations:** Notice does not schedule automatic effective-date termination; history retained.

### F29. Next agreement drafts

- **Purpose:** Store future draft terms with validation and reuse.
- **Source files:** src/components/NextAgreementFields.tsx; src/lib/next-agreement-draft.ts
- **API routes:** POST /api/properties; PUT/PATCH /api/properties/[id]; PUT /api/tenants/[id]
- **Database dependencies:** properties; tenants
- **Authorization:** Authorized editor
- **Implementation status:** Implemented
- **Known limitations:** Draft is not a signed/executed agreement.

## Property enquiries

### F30. Authenticated property enquiry

- **Purpose:** Save customer/property context and admin email intent with replay controls.
- **Source files:** src/features/properties/PropertyDetails.tsx; src/lib/server/services/notifications.ts
- **API routes:** POST /api/admin/notifications
- **Database dependencies:** admin_notifications; enquiry_controls; email_deliveries
- **Authorization:** Completed user; private property requires membership
- **Implementation status:** Implemented
- **Known limitations:** Stored in notifications, not an enquiries collection.

## Broker assignment

### F31. Enquiry assignment and status history

- **Purpose:** Admin assigns active agent; assigned agent updates private tracking.
- **Source files:** src/features/enquiries/EnquiryInbox.tsx; src/lib/server/services/enquiries.ts
- **API routes:** GET /api/enquiries; PATCH /api/enquiries/[id]
- **Database dependencies:** enquiry_assignments; admin_notifications; email_deliveries
- **Authorization:** Admin or assigned agent; expectedVersion
- **Implementation status:** Implemented
- **Known limitations:** Enquiry inbox has N+1 reads; no cursor pagination.

## Property visits

### F32. Requester visit planner

- **Purpose:** Schedule, reschedule, cancel, mark completed, list/filter own visits.
- **Source files:** src/features/visit-planner/VisitPlanner.tsx; src/lib/server/services/visits.ts
- **API routes:** GET/POST /api/visits; GET/PUT/DELETE /api/visits/[id]
- **Database dependencies:** visits; admin_notifications; email_deliveries
- **Authorization:** Self/admin; creation validates listing availability
- **Implementation status:** Implemented
- **Known limitations:** ADMIN_EMAIL needed on creation; future dates; reminders forced to email/30 minutes; elapsed time does not mark completion.

### F33. Admin visit operations

- **Purpose:** View all visits and requester/property context, update with management version.
- **Source files:** src/features/admin/AdminVisits.tsx; src/lib/server/services/visits.ts
- **API routes:** GET /api/admin/visits; PUT /api/visits/[id]
- **Database dependencies:** visits; users; properties
- **Authorization:** Admin
- **Implementation status:** Implemented
- **Known limitations:** All-visits scans and related lookups; no cursor pagination.

## Negotiations

### F34. Offer and broker/owner/customer state machine

- **Purpose:** Versioned offers, broker proposals, owner counter/approval, customer acceptance and completion.
- **Source files:** src/features/negotiations/NegotiationPanel.tsx; src/lib/negotiation.ts; src/lib/server/services/negotiations.ts
- **API routes:** GET/POST /api/negotiations; PATCH /api/negotiations/[id]
- **Database dependencies:** negotiations; properties; users; admin_notifications; email_deliveries
- **Authorization:** Participants/admin; action-specific owner/customer/agent constraints
- **Implementation status:** Implemented
- **Known limitations:** 100-history cap and bounded queries; combined sell_rent listings fail negotiation creation; agreement/payment settlement is separate.

## Owner verification

### F35. Evidence-backed ownership review

- **Purpose:** Approve/reject/reconsider reported owner and preserve audit trail.
- **Source files:** src/features/admin/OwnerVerification.tsx; src/lib/server/services/owner-verification.ts
- **API routes:** POST /api/owner-verification
- **Database dependencies:** properties; documents; users; tenants; relationship_links
- **Authorization:** Admin; active verified owner; evidence
- **Implementation status:** Implemented
- **Known limitations:** Manual review; UI has verified/approved status inconsistency in directory.

## Email notifications

### F36. Transactional notifications and outbox

- **Purpose:** Persist deterministic email events, lease delivery and provider idempotency.
- **Source files:** src/lib/server/services/transactional-email.ts; src/lib/server/services/resend.ts
- **API routes:** Business mutations; GET /api/admin/email-deliveries; POST /api/admin/email-deliveries/[id]/retry
- **Database dependencies:** email_deliveries
- **Authorization:** Server events; admin listing/retry
- **Implementation status:** Partially implemented
- **Known limitations:** Provider delivery untested; some effects remain best effort; no automatic general outbox drain or delivery webhook.

### F37. Relationship invitation email

- **Purpose:** Privacy-preserving invitation at owner-authorized claim creation/authorization.
- **Source files:** src/lib/server/services/relationship-invitation-email.ts
- **API routes:** Property/tenant/link mutations
- **Database dependencies:** email_deliveries; email_invitation_limits; relationship_links
- **Authorization:** Authorized current inviter; quotas
- **Implementation status:** Implemented
- **Known limitations:** Invitation email conveys no authorization; sending depends on configured origin/provider.

### F38. Delivery monitoring interface

- **Purpose:** Admin delivery list/retry component.
- **Source files:** src/features/admin/AdminEmailDeliveries.tsx; src/lib/server/services/transactional-email.ts
- **API routes:** GET /api/admin/email-deliveries; POST /api/admin/email-deliveries/[id]/retry
- **Database dependencies:** email_deliveries
- **Authorization:** Admin
- **Implementation status:** Partially implemented
- **Known limitations:** Component exists but no active import/use in admin portal found; API is implemented. sent means provider acceptance.

## Reminder workflows

### F39. Visit reminders

- **Purpose:** Lease and send upcoming due reminder emails and configured admin copy.
- **Source files:** src/lib/server/services/reminders.ts
- **API routes:** GET/POST /api/cron/reminders
- **Database dependencies:** visits; users; email_deliveries
- **Authorization:** CRON_SECRET bearer
- **Implementation status:** Partially implemented
- **Known limitations:** External schedule unknown; query caps 1000 upcoming visits and 20 due visits per invocation.

### F40. Rent due and agreement expiry reminders

- **Purpose:** Rent offsets 7/1/0 days; agreement expiry 30/15/7 days; tenant and owner recipients.
- **Source files:** src/lib/server/services/reminders.ts
- **API routes:** GET/POST /api/cron/reminders?propertyCursor=...
- **Database dependencies:** properties; email_deliveries
- **Authorization:** CRON_SECRET bearer
- **Implementation status:** Partially implemented
- **Known limitations:** 250-property pages, 20 event attempts, signed continuation cursor requires external follow-through; no backfill guarantee.

## File management

### F41. Managed private uploads/downloads

- **Purpose:** R2 objects with scoped binding metadata, cookie/bearer download access.
- **Source files:** src/lib/server/services/media.ts; src/lib/server/services/uploads.ts
- **API routes:** POST /api/upload; POST /api/upload/document; POST /api/upload/image; POST /api/upload/property-images; POST /api/upload/service-request-image; GET /api/media/[id]; GET/POST/DELETE /api/media/session
- **Database dependencies:** storage_objects; relevant bound records
- **Authorization:** Authenticated uploader; property/field permissions; eligible public cover/banner
- **Implementation status:** Implemented
- **Known limitations:** 20 MiB object limit; document policy tighter for supporting files; actual bucket privacy/IAM unknown.

### F42. Documents and supporting reports

- **Purpose:** Attach agreement/receipts/supporting files, TDS/payment metadata, admin review and deletion.
- **Source files:** src/features/services/AttachDocuments.tsx; src/lib/server/services/documents.ts
- **API routes:** GET/POST /api/documents; GET /api/documents/property/[propertyId]; GET/PATCH/DELETE /api/documents/[id]
- **Database dependencies:** documents; storage_objects; legacy_storage_cleanup
- **Authorization:** Property member; admin review; uploader/owner/admin delete
- **Implementation status:** Implemented
- **Known limitations:** Supporting max 5 files, 5 MiB each, 20 MiB total is checked outside final transaction; race risk.

### F43. Storage cleanup and legacy bridge

- **Purpose:** Lease managed deletion, reconcile stranded uploads, proxy approved historic URLs.
- **Source files:** src/lib/server/services/media.ts; src/lib/server/services/uploads.ts
- **API routes:** GET /api/media/legacy; DELETE /api/files; DELETE /api/files/[...path]; GET/POST /api/admin/storage-reconciliation
- **Database dependencies:** storage_objects; legacy_storage_cleanup
- **Authorization:** Uploader/admin cleanup; property-scoped legacy read
- **Implementation status:** Implemented
- **Known limitations:** Legacy metadata deletion cannot revoke historic public object URL; migration requires separate authorization.

## Other modules

### F44. Maintenance/legal/related service requests

- **Purpose:** Catalogue, member requests, admin resolution, attachments and archive.
- **Source files:** src/features/services/ServiceRequestWorkflow.tsx; src/lib/server/services/migration-remainder.ts
- **API routes:** GET /api/services; GET/POST /api/service-requests; PUT /api/service-requests/[id]; POST /api/admin/notifications
- **Database dependencies:** services; service_requests; admin_notifications; storage_objects; email_deliveries
- **Authorization:** Public catalogue; self/property member requests; admin resolution
- **Implementation status:** Implemented
- **Known limitations:** Some legal/other flows use notification records rather than service_requests; no provider fulfilment integration.

### F45. Inspection reports

- **Purpose:** Possession/handover report, policy-specific attachments and history.
- **Source files:** src/features/services/InspectionReport.tsx; src/lib/server/services/migration-remainder.ts
- **API routes:** POST /api/inspection-reports; GET /api/inspection-reports/property/[propertyId]; GET /api/inspection-reports/user/[userId]
- **Database dependencies:** inspection_reports; storage_objects; admin_notifications
- **Authorization:** Property member; self/admin user-filter read
- **Implementation status:** Implemented
- **Known limitations:** Submitted report is user-authored, not a certified inspection integration.

### F46. Relationship reviews

- **Purpose:** Owner/tenant questionnaire linked to actual property relationship.
- **Source files:** src/features/services/Review.tsx; src/lib/server/services/migration-remainder.ts
- **API routes:** GET/POST /api/reviews
- **Database dependencies:** reviews; admin_notifications
- **Authorization:** Active owner/tenant; member listing
- **Implementation status:** Implemented
- **Known limitations:** No public ratings marketplace/moderation workflow verified.

### F47. Property hub timeline and operational metrics

- **Purpose:** Aggregate lifecycle, documents, visits, negotiations, rent and maintenance actions.
- **Source files:** src/features/properties/PropertyHub.tsx; src/lib/server/services/property-hub.ts
- **API routes:** GET/PATCH /api/property-hub
- **Database dependencies:** properties; documents; inspection_reports; service_requests; visits; negotiations; admin_notifications
- **Authorization:** Member/admin; note action admin; rent owner/admin
- **Implementation status:** Implemented
- **Known limitations:** Global property read before authorization filtering; output capped to 250 after scan.

### F48. Site settings and banners

- **Purpose:** Edit hero text, quote, announcement and banner references.
- **Source files:** src/features/admin/AdminSiteSettingsTab.tsx; src/lib/server/services/migration-remainder.ts
- **API routes:** GET/PUT/PATCH /api/admin/site-settings
- **Database dependencies:** siteSettings/main_settings; storage_objects
- **Authorization:** GET public in service despite admin path; mutations admin
- **Implementation status:** Implemented
- **Known limitations:** Some read failures return defaults, masking dependency errors.

### F49. PWA and offline fallback

- **Purpose:** Register service worker, manifest, icon/static caching and offline page.
- **Source files:** src/components/PwaRegistration.tsx; public/sw.js; public/manifest.webmanifest
- **API routes:** None
- **Database dependencies:** None
- **Authorization:** Public
- **Implementation status:** Implemented
- **Known limitations:** No offline transactional writes or push notification delivery; API/private responses are not cached by service worker.

### F50. Demo form autofill

- **Purpose:** Populate demonstration property fields under explicit client demo conditions.
- **Source files:** src/components/DemoFormAutofill.tsx; src/lib/demo-form-data.ts
- **API routes:** Normal property APIs when submitted
- **Database dependencies:** Normal property collections if user submits
- **Authorization:** Existing form/user permissions
- **Implementation status:** Implemented
- **Known limitations:** Demo inputs do not isolate persistence automatically; never use against production without authorization.
