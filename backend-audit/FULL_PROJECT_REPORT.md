> Historical backend-phase document. Frontend ownership changed and integration/routing work followed. See [FINAL_CLIENT_IMPLEMENTATION_REPORT.md](../FINAL_CLIENT_IMPLEMENTATION_REPORT.md) for current implementation and validation; earlier frontend/build blockers below are superseded.

# Full Project Audit & Implementation Report

## 1. Completed

Audited current source rather than treating the older migration report as authoritative. The inventory covers 43 API route files, 100 expanded request expressions, 55 normalized caller operations, 47 reachable-module operations and 42 active method/path pairs. All 47 reachable operations map to native handlers; no missing active handler was found. Mapping does not prove live provider behavior.

See `API_INVENTORY.md`, `api-inventory.json`, `API_SECURITY_MATRIX.md`, and the repository-root `FRONTEND_HANDOFF.md` for callers, methods, authorization and request/response contracts. Initial uncommitted work is recorded in `INITIAL_GIT_STATUS.txt`.

Current-source classification after implementation:

| Requirement | Backend classification | Evidence / limit |
| --- | --- | --- |
| A Manage Property | COMPLETE; NEEDS LIVE UAT | Existing property identifiers, images, unit/building data, relationship and action APIs reused |
| B owner categories | COMPLETE | sell/rent/manage plus available/rented and active/inactive; no duplicate category system |
| C property details | COMPLETE | Existing schema plus additive category/building/area/structure/expected-rent fields; unknown stored fields retained |
| D rental details | COMPLETE; NEEDS LIVE UAT | Existing rent, deposit, due day, periods, furnishing, payer, contact/employment and rent-schedule data; no automatic escalation calculation |
| E tenant assignment | COMPLETE; NEEDS LIVE UAT | Trusted Firebase identity, atomic embedded/collection updates, property-scoped access |
| F renewal | COMPLETE; NEEDS LIVE UAT | Pending request, prefilled terms, owner decision, prior snapshots; terms unchanged until approval |
| G termination | COMPLETE; NEEDS LIVE UAT | Tenant request, owner notice/rejection/finalization, inactive relationship and history; no automatic legal notice completion |
| H maintenance | COMPLETE; NEEDS LIVE UAT | Existing requests, categories, media/comments, resolution/archive/history |
| I inspections | COMPLETE; NEEDS LIVE UAT | Property-member/admin write/read checks and history retrieval |
| J TDS | COMPLETE generic tracking; PARTIAL tax semantics | Existing documents support supplied report/period/amount/status metadata; tax interpretation intentionally unresolved |
| K reviews | COMPLETE; NEEDS LIVE UAT | Server identity, relationship context, history GET and admin notification |
| L legal services | COMPLETE request tracking | Existing service requests plus catalog categories; no automated legal advice |
| M related services | COMPLETE request/visit tracking | Existing service requests, visits and notifications reused |
| N documents | COMPLETE API authorization; NEEDS LIVE UAT | Metadata/list/delete/report status protected; historical public storage URLs remain a risk |
| O receipts/due information | COMPLETE tracking | Documents and existing due fields; no gateway or settlement |
| P reminders | COMPLETE email/admin/cron logic; NEEDS LIVE UAT; MISSING external mobile delivery | Existing visit scheduler extended for rent and expiry; secure/idempotent; deployment credentials/schedule required |
| Q negotiation | COMPLETE; NEEDS LIVE UAT | Existing approval/version/history state machine retained and tested |
| R admin | COMPLETE existing backend operations; NEEDS LIVE UAT | Stored-role permissions; archived properties, request resolution, documents and notifications |
| S public privacy | COMPLETE API projection | Allowlisted browsing fields; private contacts, tenants, agreement/history/media excluded |
| T file security | COMPLETE new-object authorization; NEEDS LIVE UAT | UUID keys, namespace isolation, uploader metadata, bounded payloads; historic public links preserved |
| U profiles | COMPLETE | Token UID/email, no self promotion, minimal peer profiles, unknown stored fields retained |
| V visits | COMPLETE; NEEDS LIVE UAT | Partial updates, validation, missing-record rejection, requester permissions and owner notifications |
| W email | COMPLETE helper/template safety; NEEDS LIVE UAT | Escaped substitutions, safe error responses and provider idempotency |
| X Firestore safety | COMPLETE implementation constraint | Additive fields/collection mapping; no live migrations or disposable production writes |
| Y API audit | COMPLETE source audit; NEEDS LIVE UAT | Native routing, auth/authorization, input/output/error review and isolated tests; built-server checks blocked |
| Z Go retirement | PARTIAL; NOT READY | Original Go reference source unavailable; browser/build and live checks remain outstanding |

These classifications describe backend contracts, not completed frontend delivery or production certification.

## 2. Fixed

- Preserved prior Firebase ID-token login and invalid-role fixes. Active property relationships, not exclusive global owner/tenant roles, determine access.
- Prevented editable profile email/phone and unverified email from granting tenant access; explicit UID takes precedence.
- Prevented self promotion to agent/admin and profile email forgery. Peer profile reads expose only the necessary identity fields.
- Made tenant assignment/update/removal consistent across embedded property relationships and `tenants`, with transactional authorization and cross-property ID checks.
- Retained stored additive/unknown compatible fields. Validated property updates, ownership, enum states, booleans and payment due days. Archive/restore synchronizes visibility fields.
- Separated public browsing from authenticated property detail; private agreement/tenant/contact/media data does not appear in public projection.
- Restricted inspection/review/document/request operations to appropriate identities and property relationships. Requester/reviewer identity and owner context are server-derived.
- Removed unsafe visit upsert behavior; partial updates preserve omitted completion fields and accept zero-minute reminders. Invalid date/status or unsupported mobile reminder is rejected.
- Isolated upload namespaces, used UUID object names, rejected traversal/unsafe MIME and cross-property deletion, retained historic URLs.
- Prevented internal notification spoofing and escaped email substitutions. Configuration/internal failures do not expose secrets.
- Preserved the existing negotiation state machine, owner approval and customer acceptance; added unavailable-property checks and existing admin-notification delivery.

## 3. New Client Features Added

- Additive property category/building/plot/area-unit/structure/expected-rent support.
- Owner-controlled renewal requests, approval/rejection, proposed and previous terms, agreement status/history and tenant-term synchronization.
- Tenant termination requests and owner rejection, notice dates, final termination and inactive tenancy/history retention.
- Service catalog fallback for client maintenance/legal/related categories without seeding live Firestore. Request resolution report/media, archive/unarchive and status history.
- Authorized review history query and document list/type filtering plus admin report status updates.
- Generic TDS and payment receipt metadata using existing documents; no tax computation or payment gateway.
- Monthly rent reminders with supplied amounts and IST month-end due-day handling; 90/60-day agreement expiry phases to tenant and owner; persisted delivery state and deterministic admin notifications.

## 4. Existing Features Reused

Reused properties, tenants, agreements endpoints, service_requests/services, documents, reviews, inspection_reports, visits, admin_notifications, siteSettings, negotiations, Firebase Admin, R2/GCS, email helpers and the existing cron reminder architecture. No duplicate negotiation, request, reminder or payment system was introduced.

## 5. Frontend Handoff

`FRONTEND_HANDOFF.md` contains feature-specific endpoint, method, request body, response envelope, UI states, suggested frontend files and client requirement references. Developer 2 must wire renewal/termination decisions and history, service resolution/archive, report tracking, review history, private projections and newly supported fields. Backend changes do not implement those views.

Resolve existing duplicate page paths before production/browser testing: `src/app/(protected)/property/[propertyId]` conflicts with `src/app/property`, and `src/app/(protected)/search` conflicts with `src/app/search`. No frontend/CSS file was edited in this task.

## 6. Files Changed

The following exact list includes earlier Module 1/shared-contract changes retained in the working tree. Some files were already untracked; they are not claimed as newly invented by this task.

Backend/API:

```text
src/app/api/documents/[id]/route.ts
src/app/api/documents/route.ts
src/app/api/reviews/route.ts
src/lib/server/firestore.ts
src/lib/server/http.ts
src/lib/server/permissions.ts
src/lib/server/services/agreements.ts
src/lib/server/services/contracts.ts
src/lib/server/services/documents.ts
src/lib/server/services/domain-contracts.ts
src/lib/server/services/migration-remainder.ts
src/lib/server/services/negotiations.ts
src/lib/server/services/notifications.ts
src/lib/server/services/properties.ts
src/lib/server/services/property-effects.ts
src/lib/server/services/property-images.ts
src/lib/server/services/r2-storage.ts
src/lib/server/services/reminders.ts
src/lib/server/services/tenants.ts
src/lib/server/services/uploads.ts
src/lib/server/services/users.ts
src/lib/server/services/visits.ts
```

Tests:

```text
tests/client-backend.test.cjs
tests/fixtures/native-server.cjs
tests/group2-routing.spec.ts
tests/migration-remainder.test.cjs
tests/native-group1.test.cjs
tests/native-group2.test.cjs
tests/security-workflows.test.cjs
tests/server-foundation.test.cjs
```

Audit/docs:

```text
FRONTEND_HANDOFF.md
scripts/audit-backend-current.cjs
backend-audit/API_INVENTORY.md
backend-audit/API_SECURITY_MATRIX.md
backend-audit/INITIAL_GIT_STATUS.txt
backend-audit/api-inventory.json
backend-audit/FULL_PROJECT_REPORT.md
```

Generated testing effects: `.next-backend-build/`, existing `.next-acceptance-test/`, and `test-results/.last-run.json`. Playwright default output cleanup removed the six pre-existing untracked auth/landing screenshots at widths 390/768/1440; their original contents cannot be recovered from Git. This was disclosed during work. Next's generated TypeScript configuration changes were restored; `tsconfig.json` is clean. Existing unrelated frontend, acceptance and migration files remain outside the authored change list.

## 7. Firestore Changes

No collection rename/deletion, project change, bulk rewrite, destructive backfill, or production test records. `COLLECTIONS.negotiations = 'negotiations'` is additive and was already completed before this audit.

New fields are additive: property category/building/area/structure/expected-rent fields; agreementRequest/agreementStatus/agreementHistory/notice dates/termination dates; property reminderDeliveries; request resolution/archive/history fields; document financialYear/period/amount/receiptDate/status/statusHistory; linked tenant identity and timestamps. Existing `admin_notifications` stores workflow/reminder events. No new collection was required by this task. Existing records are normalized on reads or changed only through authorized operations; no live data migration was executed.

## 8. Security

Isolated tests cover Firebase token verification, stored roles, owner/tenant/admin access, cross-owner rejection, owner also tenant, spoofed profile contacts, relationship assignment, public privacy, private resource access, upload/delete isolation, notification spoofing, owner approval, optimistic concurrency and cron delivery leases.

Remaining risks: historical public R2/GCS URLs remain public to URL holders; API metadata authorization cannot revoke them. Live storage IAM/bucket policy, Firebase projects/indexes/token behavior and provider email delivery remain unverified. Anonymous inquiry abuse controls/rate limiting require deployment review. History/delivery records need production monitoring for growth and reconciliation.

## 9. Notifications

Email and existing admin notifications support tenant assignment, agreement changes, visits, requests, negotiation and reminder events where the existing workflows provide recipients. Reminder emails use stable provider keys, frozen retry payloads, transactional leases and sent-state deduplication. Ambiguous delivery older than 23 hours requires reconciliation instead of blind resend.

GET/POST `/api/cron/reminders` requires a server-only CRON_SECRET of at least 32 characters. Existing visit processing remains; property processing is bounded/paginated. Deployment must schedule external invocations, follow property cursors and rerun limited batches. No long-running Next.js process is required.

No mobile/SMS/WhatsApp/push provider exists. Unsupported mobile visit reminders return a clear validation error. Local RESEND_API_KEY, FROM_EMAIL, CRON_SECRET and R2 account/access/secret/bucket configuration are absent; live configuration and scheduling are integration work, not proven delivery.

## 10. Tests

Final combined isolated command:

```powershell
node --test tests/server-foundation.test.cjs tests/native-group1.test.cjs tests/native-group2.test.cjs tests/migration-remainder.test.cjs tests/negotiations-reminders.test.cjs tests/security-workflows.test.cjs tests/client-backend.test.cjs
```

Result: 83 tests, 78 passed, 0 failed, 5 skipped. The five skips require unavailable original Go reference source; their assertion bodies were retained and they are not represented as passing compatibility evidence. All providers are isolated/mocked; no production disposable data or external email delivery was used.

`npx playwright test --config playwright.acceptance.config.ts`: failed during webServer readiness after 120000ms; zero browser tests executed because duplicate page routes prevent startup. Built-server routing tests were not run against a stale build or a live production backend. They must follow resolution of the build blocker.

`git diff --check`: passed (line-ending conversion warnings are not whitespace errors).

## 11. TypeScript / Lint / Build

- `npm run typecheck`: PASS, exit 0, zero errors.
- `npm run lint`: PASS, exit 0, zero errors and 90 warnings in existing frontend/hooks/service/UI source.
- `$env:PROPBANK_TEST_DIST_DIR='.next-backend-build'; npm run build`: FAIL, exit 1, two existing page-route conflicts:

```text
./src/app/property
Error: You cannot have two parallel pages that resolve to the same path. Please check /(protected)/property/[propertyId] and /property.
./src/app/search
Error: You cannot have two parallel pages that resolve to the same path. Please check /(protected)/search and /search.
```

No frontend redesign or routing fix was made across Developer 2's ownership boundary.

## 12. Live UAT Still Required

Fresh/expired/revoked real Firebase login; distinct Auth/Data projects and real UID/email linkage; owner also tenant; off-platform tenant onboarding; Firestore transactions/indexes; property create/update/archive and industrial fields; renewal/notice/termination history; requests/resolution/media/archive; private inspection/review/document access; real R2/GCS upload/delete and historical links; email recipients/content/delivery; cron scheduling, provider deduplication and reconciliation; negotiation concurrent approvals; browser integration and supported screen sizes after routing fixes.

Use controlled staging accounts/data; isolated passes do not authorize disposable production writes.

## 13. Go/Railway Retirement

**NOT READY.** Current-source active API inventory shows native Next.js coverage and no active general Go HTTP dependency, but original Go source is unavailable for five reference checks. Build/browser blockers and live Firebase/storage/email/cron validation remain. Older migration evidence was retained; a build or mock test pass alone cannot prove retirement safety.

## 14. Remaining Blockers

1. Developer 2 must resolve duplicate `/property` and `/search` routes and integrate the frontend handoff.
2. Deployment/staging credentials, bucket policies, scheduler and real email delivery must be validated. Mobile requires a provider/integration decision.
3. Client must specify exact TDS verification semantics and any automatic notice-finalization/escalation policy; current support only tracks supplied information and explicit owner decisions.
4. Missing original Go source prevents final legacy parity/retirement verification.

The screenshot artifact loss is a disclosed testing mistake, not a backend functionality blocker.

## 15. Git Status

Branch: `feature/property-management-improvements`. Working tree remains uncommitted with prior and current changes. No branch creation/switch, reset, clean, merge, rebase, pull, commit or push was performed. No frontend/CSS source file was edited. Generated test output and existing unrelated untracked files require review before the eventual end-of-day commit.

## Follow-up: route build error resolved

The subsequent user-reported build error was fixed by removing only the duplicate route wrappers `src/app/(protected)/property/[propertyId]/page.tsx` and `src/app/(protected)/search/page.tsx`. Existing public routes and feature components were retained, matching the guest-browsing acceptance requirements. Production build using `.next-backend-build` passed with exit 0, including TypeScript and static page generation. The build-conflict statements above describe the earlier validation run and are now superseded. Browser acceptance has not yet been rerun. Next regenerated `next-env.d.ts` for the isolated build directory; generated tsconfig include additions were removed. No UI/CSS changes, commit or push.
