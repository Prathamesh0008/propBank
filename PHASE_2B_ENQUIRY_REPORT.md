# Phase 2B — Broker enquiry assignment

Implemented locally. No deployment, production customer writes, storage changes or real notifications were performed.

## Changes

- Existing `property_enquiry` records remain in `admin_notifications`. The new admin **Enquiries** tab lists all of them, including archived and historical records without assignment metadata. General enquiries and the existing notification screens retain their behavior.
- Assignment and private tracking are stored separately in `enquiry_assignments`, keyed by notification ID. Historical enquiries default to **Unassigned / New / version 0**, without a backfill or write on read.
- Admins can assign, reassign or unassign an existing registered, enabled Firebase account with an active persisted `agent` profile. Reassignment/unassignment preserves progress and history.
- Assigned agents see **Your assigned property enquiries** within Manage Property. They can record New, Contacted, Visit Scheduled, Negotiating, Closed Won or Closed Lost, with optional private notes. These are tracking statuses; they do not create visits, send messages or finalize negotiations.
- Assignment/status events record actor UID, server timestamp, previous/new assignment, previous/new status and optional notes. Notes are limited to 2,000 characters; history is capped at 200 events with an explicit conflict response when full.
- Private notes/history are returned only through the admin/current-assigned-agent inbox. Existing owner/customer notification and property responses do not join this collection. Broker responses use an explicit contact/property-context allowlist and exclude owner contacts, existing admin remarks and attachments. Assignment grants no additional property/document/negotiation permissions.
- Transactions recheck current actor role, active profile, assignment, target agent profile and expected version. Stale writes return 409; revoked/unrelated broker writes return 403. Brokers cannot assign, reassign or unassign. No new automatic notifications are triggered.

## API and files

- `GET /api/enquiries`: all property enquiries for persisted admins; only own assigned enquiries for persisted agents. Caller-supplied UID/property filters cannot widen scope.
- `PATCH /api/enquiries/[id]`: `action: assign` with `brokerUID` (empty string unassigns), or `action: status` with a supported status. Both require `expectedVersion`; `notes` is optional. Unknown/mixed fields are rejected.
- New files: `src/lib/enquiry.ts`, `src/lib/server/services/enquiries.ts`, both enquiry route handlers, `src/features/enquiries/EnquiryInbox.tsx`, and `tests/enquiry-assignment.test.cjs`.
- Updated existing screens: `AdminPortal.tsx`, `ManageProperty.tsx`. Existing UI primitives and styling were reused; no dashboard redesign.
- Test integration: acceptance fixture and `tests/acceptance.spec.ts`; API inventory path normalization in `scripts/audit-active-api.cjs`; `package.json` now maps `npm run test` to the existing `test:functional` suite. No checks were disabled.

## Actual verification results

| Command/check | Result |
| --- | --- |
| `npm run typecheck` | PASS — exit 0. |
| `npm run build` | PASS — exit 0; compilation, TypeScript and page generation completed. |
| `npm run test` | PASS — 150 tests: **145 passed, 0 failed, 5 skipped**. |
| `node --test tests/enquiry-assignment.test.cjs` | PASS — **11 passed, 0 failed, 0 skipped**. Included in the full test result above. |
| Targeted existing Playwright scenarios | PASS — negotiation approval/completion and admin agent-role assignment: **2 passed**. |
| Final new assignment Playwright regression | PASS — **1 passed**. |
| `git diff --check` | PASS — exit 0; line-ending warnings only. |

Browser commands:

```text
npx playwright test --config=playwright.acceptance.config.ts --grep "admin assigns a property enquiry|customer offer|admin can assign agent access"
npx playwright test --config=playwright.acceptance.config.ts --grep "admin assigns a property enquiry"
```

The first browser run had 2 passes and 1 failure: the new test incorrectly expected a phone number on a customer fixture that has none. Its assertion was corrected to match that existing fixture; the new scenario then passed on rerun. Initial Node regressions also caught an uninitialized disabled-account fixture and acceptance of an unknown payload field; the fixture and server validation were corrected before the passing full run.

Coverage includes assignment eligibility, reassignment, unassignment, broker isolation, every status, role restrictions, stale/concurrent updates, note privacy, historical/archived enquiries, notification archive/shared-response independence, and regression of existing property/general enquiry submissions. Browser tests use the real Next.js screens with isolated API handlers, database/auth/storage fixtures and fake identities; no live service mutations or email delivery occur.

## Remaining blockers and limits

- **BLOCKED / unverified:** The five skipped functional tests require unavailable original Go reference sources. They are not counted as passes.
- **BLOCKED / unverified:** Deployed Firebase identities, Firestore permissions and live browser behavior were not tested. Before production use, verify that browser clients cannot directly read/write the new private `enquiry_assignments` collection and that its single-field assignment query is permitted by deployed index configuration. No cloud rules or policies were changed here.
- No historical assignment migration, CRM automation, communication channel, visit scheduling integration or negotiation automation was added. All prior local code changes are preserved.

No unresolved failures remain in the executed local tests. Work stops at this scope.
