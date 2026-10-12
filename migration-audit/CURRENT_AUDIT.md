# Go to Next.js audit — 9 October 2026

## Scope and evidence

Inspected the App Router pages, all API route dispatchers, retained React feature modules, server services, Firebase clients/Admin initialization, Firestore contracts, R2 dependencies, email templates, frontend callers, tests and migration records. This report precedes implementation changes for this audit. Historical reports describe earlier work and do not establish current production readiness.

The original Go application is **not present**. `tests/go-reference/main.go` contains extracted model/projection/storage comparisons, not the application or scheduler. Its go.mod references the missing `../../../propbank-server`. No Go executable is on PATH. Original controller/scheduler equivalence cannot be certified from extracted contracts. Requested the original source location and staging details.

## Architecture

- Next.js 16.4 / React 19 App Router in `src/app`; retained React screens in `src/features`, UI primitives in `src/ui`.
- Public `/`, `/auth`; existing property, tenancy, service, inspection, agreement, visit and archive paths preserved. Protected layouts use client RouteGuard; every private API must separately enforce authorization.
- 40 specific API routes invoke native services. No general proxy, Go HTTP client, Next middleware, Railway runtime URL or frontend external API base found. Browser base is `/api`. Specialized `/api/files/[...path]` handles R2 deletion.
- Firebase Auth project `propbank-7601b`, separate DATA project `propbank-944fc`; lazy named Admin apps, revoked-token checks, persisted admin role. Browser gets only NEXT_PUBLIC Firebase settings.
- Roles `admin`, `agent`, `individual`; owner and tenant are property relationships, not mutually exclusive global roles. Existing dashboard already separates owned/rented views.
- R2 preserves existing bucket/public prefix; legacy property base64 uploads also use Firebase DATA GCS bucket. Public object URLs are not private access controls.
- Emails use Resend, mostly best effort with Next `after`. Missing key silently disables sending. No native scheduler, payment gateway, offer or negotiation service found. Rent and payment due fields are metadata, not payments.

## Migration matrix

| Old functionality / available evidence | Next implementation | Status | Problem | Required fix |
|---|---|---|---|---|
| Firebase auth / extracted contracts | auth.ts, firebase-admin.ts, api-client.ts | PARTIAL | Profile email/phone can affect relationship access; authenticated UAT absent | Bind identity to verified Firebase claims; test self/admin/tenant access |
| User profiles | services/users.ts | PARTIAL | Broad peer profile reads; arbitrary email updates; replacement writes discard unknown fields | Restrict peer data; validate identity; merge updates |
| Property lists/search/CRUD | services/properties.ts | PARTIAL | Public private-field exposure; inactive admin records excluded; false updates ignored; arbitrary update fields | Public projection, member detail, admin scope, safe updates |
| Owner query | properties?ownerUID | NEEDS TESTING | Correct self/admin check exists; live owner token not supplied | Regression and authenticated UAT |
| Owner also tenant | listProperties, dashboard hooks | PARTIAL | Duplicate queries; email-dependent lookup misses UID-linked tenancies | Return merged owned/rented records using verified identity |
| Tenants | services/tenants.ts | PARTIAL | Phone/profile fallback; peer tenant details; unrestricted update fields | Relationship-based permissions, validation |
| Agreements | services/agreements.ts | PARTIAL | UID assignment ignored for tenant requests; phone fallback; live flow unverified | Shared trusted tenant helper, preserve owner control |
| Documents | services/documents.ts | NEEDS TESTING | Membership enforced but public URLs remain reachable; storage errors may leak details | Safe errors, scoped uploads; private storage strategy needed |
| Inspection/review | migration-remainder.ts | BROKEN | Unrelated registered users can submit/read property inspections | Require property membership and correct reviewer relationship |
| Visits | services/visits.ts | PARTIAL | CRUD exists; no reminders; missing-record update creates records | Native protected scheduler; validation/no upsert |
| Inquiries/leads | admin_notifications | PARTIAL | Client can forge notification facts/types; anonymous intake unbounded | Derive identity/property facts; limit types/input |
| Offers/negotiation/owner approval | None | MISSING | No API, collection contract or UI workflow | Add scoped state machine/history with explicit owner acceptance; additive schema |
| Admin | admin components/native services | BROKEN | Agents stub throws; property query misses archived records; no negotiation management | Repair hooks/admin scope; minimal workflow additions |
| R2 files | services/uploads.ts, r2-storage.ts | PARTIAL | Generic folder namespaces not authorized; existing documents prefix can be targeted; second-based filenames overwrite | Scope reserved folders; unique keys; storage UAT |
| Email | property-effects.ts, group2-mail.ts | NEEDS TESTING | Templates interpolate raw user HTML; silent failures; no delivery verification | Escape substitutions; require configuration for scheduler; staging delivery |
| Go reminder jobs | None | MISSING | Source absent; exact visit/rent/agreement job semantics unknown | Secure native visit scheduler; obtain Go source before retirement |
| Payments | No gateway found | COMPLETE | No migrated payment feature identified | Do not invent payment processing |
| General proxy / Railway HTTP dependency | Removed | COMPLETE | Historical/test references only | Retain Go evidence; do not stop Railway scheduler |

## Actual collections and relationships

`users` (document UID), `properties` (ownerUID, embedded tenants/buyers, agreement/rent fields), `tenants` (propertyId, ownerUID, optional userUID), `visits` (userId), `services`, `service_requests` (userUID/propertyId), `documents` (userId/propertyId/fileUrl), `reviews`, `inspection_reports`, `admin_notifications`, `siteSettings/main_settings`. No separate owners, customers, agreements, inquiries, reminders or negotiation collection is currently declared. Owner/tenant membership must remain property-specific. No destructive backfill or existing collection rename is proposed.

## Configuration inventory (names only)

Browser: NEXT_PUBLIC_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID (each prefixed NEXT_PUBLIC_FIREBASE_).

Server: FIREBASE_AUTH_PROJECT_ID/CREDENTIALS; FIREBASE_DATA_PROJECT_ID/CREDENTIALS/STORAGE_BUCKET; retained DATA aliases FIREBASE_CREDENTIALS, FIREBASE_PROJECT_ID, STORAGE_BUCKET, FIREBASE_STORAGE_BUCKET. CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME/PUBLIC_URL. RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL, optional JWT_SECRET. PROPBANK_TEST_DIST_DIR is testing configuration. Environment values/credentials were not copied to this report.

## Baseline verification

- Production build and TypeScript passed.
- ESLint: 0 errors, 90 warnings.
- Browser: 8 tests passed (18 protected URLs, responsive public/auth pages at 1440/768/390, assets, 404, native API preflight and rejection).
- Server: 41 passed, 5 failed because Go/original dependency unavailable.
- Read-only live probes: properties returned 9 entries; settings succeeded; service catalogue returned no entries (could be empty or hidden read failure).
- No authenticated live writes, live storage operations, account creation or email delivery performed. Existing production datasets must not serve as disposable test fixtures.

## Retirement gate

NOT READY. Keep the old Go/Railway scheduler until exact job semantics, scheduler deployment, mail delivery, authenticated browser flows and all security regressions are verified. Existence of native routes and historical parity results is insufficient.
