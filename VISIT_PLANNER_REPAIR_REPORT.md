# PropBank Visit Planner Repair Report

Date: 23 October 2026  
Branch: `feature/property-management-improvements`

## Root cause

The visit-list endpoint queried Firestore with `where('userId', '==', uid)` plus `orderBy('visitDate')`. That compound query requires a deployed composite index. This repository contains no `firestore.indexes.json`, so an environment without that manually created index returns an SDK error which the API correctly sanitizes to HTTP 500 `Failed to retrieve visits`.

The UI then compounded the problem: it showed a toast but did not retain a load-error state. Once loading ended, the failed request was rendered as a successful empty list with zero Active, Visited, and Cancelled counts.

The requester filter already bounds the query. The repair uses the single-field `userId` query and sorts the results after retrieval, removing the unnecessary composite-index dependency without broadening access. Empty success responses now explicitly return `visits: []`.

Authentication configuration was checked read-only and is internally consistent:

- Browser and server Firebase Auth project: `propbank-7601b`.
- Auth credential project: `propbank-7601b`.
- Firestore data project: `propbank-944fc`.
- Data credential project: `propbank-944fc`.

No authentication check was weakened. Verified email, active profile, persisted role, requester scope, and administrator authorization remain enforced server-side.

## Implemented repairs

### Visit listing

- Removed the unnecessary compound Firestore query and retained chronological in-memory sorting.
- Added exact `active`, `completed`, and `cancelled` status validation and grouping.
- Always returns `visits: []` for a valid empty result.
- Preserves `managementVersion` in API responses for concurrency-safe updates.
- Uses the shared verified-auth context instead of a second raw Firebase auth listener.
- Cancels superseded requests and ignores stale responses.
- Keeps a visible error state with the actual safe API message and a working Retry button.
- Does not display empty-state counts as successful data when loading failed.

### Scheduling and management

- Rejects invalid and past visit dates on both client and server.
- Preserves requester UID and property association on creation and update.
- Added inline Reschedule, Visited, and Cancel actions for active visits.
- Cancellation changes status instead of deleting the record, retaining visit history.
- Updates the local visit list and tab counts immediately after successful changes.
- Sends `expectedVersion` on UI updates and returns the new version, preventing stale updates from overwriting newer changes.
- Retains the established server-side status values: `scheduled`, `completed`, and `cancelled`.

### Notifications and administration

- Scheduled, rescheduled, completed, and cancelled events use the centralized transactional notification path.
- The original requester and the property owner are selected from persisted records.
- Admin updates retain the original requester and add actor/timestamp history.
- Stable event identities include visit ID, management version, and status.
- Concurrent stale updates yield one successful change and one HTTP 409, so they do not create duplicate event records.
- The retired duplicate legacy “Visit Scheduled” email remains suppressed.
- Visit reminders retain their lease/idempotency behavior; cancelled and completed visits remain ineligible.
- Persisted administrators can list and filter all visits. Ordinary users remain requester-scoped and cannot read or modify unrelated visits. Owners receive notifications for their properties but do not gain private requester-record access through `/api/visits/[id]`.

## Files modified

- `src/lib/server/services/visits.ts`
- `src/services/visitService.ts`
- `src/features/visit-planner/VisitPlanner.tsx`
- `src/features/visit-planner/VisitPlanner.module.css`
- `tests/visit-planner-repair.test.cjs`
- `tests/native-group2.test.cjs`

The homepage hero, navigation, global typography, Firebase projects, production data, and scheduler were not changed.

## Functional status

| Area | Status | Evidence |
|---|---|---|
| Own-visit listing | PASS | Exact API contract and requester query tested |
| Empty visit list | PASS | Returns HTTP 200 with `visits: []` |
| Active / Visited / Cancelled grouping | PASS | All three filters tested |
| Loading / error / retry UX | PASS (code/typecheck) | Persistent error state and abort-safe retry implemented; browser E2E prohibited |
| Schedule valid visit | PASS | Route creation and property/requester persistence tested |
| Reject past/invalid dates | PASS | Server and focused route tests |
| Reschedule | PASS | Versioned response and new date tested |
| Mark visited/completed | PASS | Status and `isCompleted` synchronization tested |
| Cancel | PASS | Status update and history retention tested |
| Admin list/filter/update | PASS | Persisted-admin tests passed |
| Original requester preservation | PASS | Admin update regression test passed |
| Unrelated-user denial | PASS | Read and update both return 403 |
| Unverified/expired identity denial | PASS | 403 verification code and 401 expired token tested |
| Visit notifications | PASS | Requester/owner recipients and centralized events tested |
| Duplicate prevention | PASS | Concurrent update produces 200/409 and one event identity |
| Reminder suppression | PASS | Cancelled/completed and repeated reminder checks passed |

## Verification results

- `npm run typecheck`: **PASS**.
- New visit-planner route suite: **6 passed, 0 failed**.
- Focused admin/visit/reminder suite: **12 passed, 0 failed**.
- Existing native visit contract subset: **3 passed, 0 failed**.
- An earlier focused run exposed one fixture with the requester and owner set to the same UID; the outbox correctly deduplicated it. The fixture was corrected to use distinct roles and passed.
- An existing native assertion expected the retired duplicate legacy email. It was updated to require the centralized event and prove the duplicate is absent; the rerun passed.

No Playwright, browser E2E, full suite, production build, real email, SMS, live scheduler, deployment, or production Firebase mutation was performed.

## Remaining live verification

The deployed Firestore index list and the authenticated browser request were not accessed because that would require live-environment inspection or a user browser session. The source-level failing query and missing local index definition establish the unsafe dependency, and the repaired endpoint no longer needs that composite index.

A controlled manual browser check should reload `/visit-planner` with a verified test account and confirm the current deployed visit records and responsive controls. This report does not claim that manual browser verification occurred.
