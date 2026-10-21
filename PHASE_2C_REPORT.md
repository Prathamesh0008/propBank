# Phase 2C — Owner verification decisions and admin visits

Implemented locally, limited to these two workflows. Existing local changes are preserved. No deployment, production customer changes, storage changes or real email reminders were performed.

## Owner verification

- Existing `POST /api/owner-verification` approval/linking remains available, with the same independently reviewed same-property evidence, verified Firebase identity, active profile and tenant/owner separation checks. The original audit object and atomic tenant-record ownership synchronization remain intact.
- Added explicit `reject` and `reconsider` actions. Rejection requires a trimmed reason of 1–2,000 characters and cannot transfer ownership, alter tenancy or publish the property. Reconsideration reopens a rejected request to `pending`; a separate evidence-based approval is still required.
- Every decision records persisted administrator UID, server time, reason/review note, previous/new status and version in a bounded decision history. Current reviewer/time/rejection reason are also stored on the property. Rejected or deletion-pending evidence cannot be used for approval.
- Roles, current state, ownership and observed version are checked inside the transaction. Stale/concurrent decisions return 409. Verified/linked requests cannot be rejected or reopened through this endpoint.
- Existing first-review approval callers may omit the version only while the stored version is zero. Once any decision exists, approval requires `expectedVersion`; rejection and reconsideration always require it. This prevents a stale legacy approval from linking an owner after rejection/reopening.
- Admin property details offer rejection, refresh, reconsideration and decision history using existing components. Authorized tenants see verification status and rejection reason in their property management views. Full reviewer history/audit stays admin-only; public/unrelated callers cannot access the private property.

## Admin visit management

- Added a **Visits** tab within the current admin portal and persisted-admin-only `GET /api/admin/visits`.
- Shows requester identity and available profile contact details, linked property title/context, date, current status and administrative history. Missing requester/property records are represented as unavailable context.
- Supports status, property ID and inclusive date-range filtering. Dates are interpreted in IST; invalid/reversed date filters are rejected.
- Uses the existing `PUT /api/visits/[id]` update endpoint and existing `scheduled`, `completed`, `cancelled` states, including explicit reopening to scheduled. No new transition policy was imposed. Contradictory status/completion payloads are rejected, and unmarking a completed visit restores a consistent scheduled state.
- Updates now run transactionally and recheck current requester/admin permissions. New admin controls send `expectedVersion`; conflicts return 409. All edits advance the version, so requester edits invalidate a stale admin save. Existing clients may continue sending their existing update bodies without a version.
- Admin edits append actor UID, server timestamp, previous/new status, changed fields and version to a bounded history. Existing requester-facing visit response shapes and requester-only access remain intact.
- Reminder scheduling, reminder leases and delivery logic were not changed. Updates preserve reminder metadata. Broker tracking statuses still do not create visits. The admin UI manages status/cancellation; existing visit deletion behavior remains unchanged.

## Files changed for this phase

- Server: `src/lib/server/services/owner-verification.ts`, `visits.ts`, `contracts.ts`; new `src/app/api/admin/visits/route.ts`.
- UI: `OwnerVerification.tsx`, new `AdminVisits.tsx`, `AdminPortal.tsx`, `AdminPropertyDetailsDialog.tsx`, `AdminPropertiesTab.tsx`, `ManageProperty.tsx`, `PropertyHub.tsx`; property types in `src/services/propertyService.ts`.
- Tests/inventory: new `tests/phase-2c.test.cjs`, targeted scenarios in `tests/functional-audit.spec.ts`, visit-filter URL normalization in `scripts/audit-active-api.cjs`.
- No theme, typography or page redesign; existing controls and styling were reused.

## Actual test results

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS — exit 0 on the final source. |
| `npm run build` | PASS — exit 0 on the final source; production compilation, TypeScript and all 32 static pages completed. |
| `npm run test` | PASS — **159 total: 154 passed, 0 failed, 5 skipped**. |
| `node --test tests/phase-2c.test.cjs` | PASS — **9 passed, 0 failed, 0 skipped**; included in the full suite above. |
| `node --test tests/owner-verification.test.cjs tests/native-group2.test.cjs` | PASS — **22 passed, 0 failed, 3 skipped**. |
| Targeted Playwright run 1 | PASS — **3 passed**: original owner linking, rejection/reconsideration, admin visit filtering/cancellation and requester visibility. |
| Targeted Playwright run 2 | PASS — **3 passed**: original visit scheduling/date picker, original owner linking, rejection/reconsideration. Two scenarios overlap run 1; **four distinct browser scenarios passed** overall. |
| `git diff --check` | PASS — exit 0; existing line-ending warnings only. |

Browser commands:

```text
npx playwright test --config=playwright.audit.config.ts --grep "admin rejects and explicitly|admin Visits section|admin verifies owner|planner"
npx playwright test --config=playwright.audit.config.ts --grep "visit date picker|admin verifies owner|admin rejects and explicitly"
```

The first grep did not match the original planner test name; the second command explicitly selected it. Tests use real application screens and isolated native handlers with in-memory Firestore/Firebase/storage identities and queued/mock email delivery.

Initial new Node test failures were caused by an invalid `notifiedAt: 'KEEP'` fixture, which the existing typed visit model correctly rejected. The fixture was corrected to a valid timestamp; the tests then passed. No checks were disabled. No unresolved failures remain in the executed local tests.

## Blockers and limits

- **BLOCKED / unverified:** Five original Go-reference comparisons remain skipped because their reference sources are unavailable. They are not counted as passes.
- **BLOCKED / unverified:** Production Firebase/Firestore access, deployed rules and live multi-user behavior were not exercised. Local isolated tests do not establish production readiness.
- No historical backfill, automatic verification, deployment, production reminder run or production record migration was performed.

Work stops after this report.
