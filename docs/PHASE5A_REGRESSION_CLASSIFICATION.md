# Phase 5A regression classification

Local isolated baseline: 455 tests; 411 passed, 44 failed, zero skipped. No production services used.

Missing or outdated fixture: 34; Genuine application defect: 2; Obsolete test expectation: 6; Test isolation/harness incompatibility: 2. Environment/external dependency failures: 0 (registry readiness is supplied only in isolated fixtures).

| # | Failed test | Source at baseline | Classification | Correction |
|---|---|---|---|---|
| 1 | profile updates preserve role and status, enforce mandatory security preferences, audit and notify | `tests/account-management.test.cjs:8:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 2 | profile API rejects role escalation and another user cannot act as the owner | `tests/account-management.test.cjs:10:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 3 | phone change requires recent Firebase phone ownership proof | `tests/account-management.test.cjs:12:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 4 | verified Firebase email completion syncs profile and notifies new and previous addresses | `tests/account-management.test.cjs:16:1'
` | Genuine application defect | Verified-email reconciliation blocked by completed-profile guard |
| 5 | persisted admins can search registered users by name, email, or phone while others are denied | `tests/admin-property-operations.test.cjs:10:1'
` | Obsolete test expectation | Substring fixture matches every supplied phone; use a discriminating query |
| 6 | admin-created property belongs to the selected active owner and remains pending review | `tests/admin-property-operations.test.cjs:19:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 7 | non-admin cannot create a property for another account and inactive owners are rejected | `tests/admin-property-operations.test.cjs:29:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 8 | email registration creates one individual profile and server activity without accepting privilege | `tests/auth-phase.test.cjs:13:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 9 | verified Google profile sync preserves an existing persisted admin role | `tests/auth-phase.test.cjs:17:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 10 | only admins change roles or account status and every change is audited | `tests/auth-phase.test.cjs:19:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 11 | new account registration queues one welcome message only for the registered user | `tests/email-events-phase.test.cjs:8:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 12 | one activity event selects each current relationship recipient once | `tests/email-events-phase.test.cjs:39:1'
` | Obsolete test expectation | Expected pre-durable-outbox behavior or retired UI/read-state behavior |
| 13 | mobile changes require recent Firebase phone verification and emit a security event | `tests/email-events-phase.test.cjs:45:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 14 | rental term changes notify only the current owner and active tenant without failing the update on email persistence errors | `tests/email-events-phase.test.cjs:54:1'
` | Obsolete test expectation | Expected pre-durable-outbox behavior or retired UI/read-state behavior |
| 15 | Manage Property makes one request and preserves owned and tenant rows | `tests/firestore-read-budget.test.cjs:5:1'
` | Test isolation/harness incompatibility | Hook harness omitted useInfiniteQuery |
| 16 | user directory is disabled outside Agents tab | `tests/firestore-read-budget.test.cjs:10:1'
` | Test isolation/harness incompatibility | Hook harness omitted useInfiniteQuery |
| 17 | archive query filters in Firestore and still requires administrator authorization | `tests/firestore-read-budget.test.cjs:17:1'
` | Obsolete test expectation | Expected pre-durable-outbox behavior or retired UI/read-state behavior |
| 18 | new owner listings remain pending and private until administrator approval | `tests/listing-approval.test.cjs:18:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 19 | rejection/change requests require reasons and owner edits resubmit while preserving history | `tests/listing-approval.test.cjs:27:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 20 | owner can explicitly resubmit unchanged rejected listings, but not self-approve | `tests/listing-approval.test.cjs:37:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 21 | moderation metadata cannot be forged through creation or ordinary edits | `tests/listing-approval.test.cjs:44:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 22 | stale and concurrent decisions cannot approve a changed submission | `tests/listing-approval.test.cjs:52:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 23 | archival and restoration preserve approval and do not bypass pending moderation | `tests/listing-approval.test.cjs:64:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 24 | pending listing photos cannot be downloaded anonymously and approval publishes only the cover | `tests/listing-approval.test.cjs:78:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 25 | pending listings cannot be used to submit unrelated offers, visits or enquiries | `tests/listing-approval.test.cjs:86:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 26 | submission atomically queues both emails and concurrent resubmission deduplicates | `tests/listing-approval.test.cjs:98:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 27 | review notification contains reason and stale decisions cannot duplicate it | `tests/listing-approval.test.cjs:116:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 28 | provider failure preserves saved property and admin can retry without duplicate successful sends | `tests/listing-approval.test.cjs:124:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 29 | outbox write failure rolls back property and sends no notifications | `tests/listing-approval.test.cjs:134:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 30 | approval and change requests queue owner notifications with the resulting status | `tests/listing-approval.test.cjs:157:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 31 | submission distinguishes malformed JSON from invalid property fields and always returns JSON | `tests/listing-approval.test.cjs:168:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 32 | owner property intake stores a draft without replacing active agreement terms | `tests/next-agreement-draft.test.cjs:33:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 33 | future agreement controls follow current agreement fields and include amount words | `tests/next-agreement-draft.test.cjs:43:1'
` | Obsolete test expectation | Expected pre-durable-outbox behavior or retired UI/read-state behavior |
| 34 | new simplified drafts omit retired inputs while legacy draft metadata remains compatible | `tests/next-agreement-draft.test.cjs:51:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 35 | an exact legacy draft derives and persists its duration | `tests/next-agreement-draft.test.cjs:62:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 36 | residential owner submission persists category and permitted structure on the original property | `tests/property-category.test.cjs:8:84'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 37 | residential tenant submission persists category and permitted structure on the original property | `tests/property-category.test.cjs:8:84'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 38 | commercial owner submission persists category and permitted structure on the original property | `tests/property-category.test.cjs:8:84'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 39 | industrial owner submission persists category and permitted structure on the original property | `tests/property-category.test.cjs:8:84'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 40 | industrial tenant submission persists category and permitted structure on the original property | `tests/property-category.test.cjs:8:84'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 41 | legacy category-only API requests retain compatibility and normalize case | `tests/property-category.test.cjs:18:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 42 | legacy structure values remain accepted without being offered by new creation forms | `tests/property-category.test.cjs:21:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 43 | existing authorized Edit Property category changes remain supported | `tests/property-category.test.cjs:36:1'
` | Missing or outdated fixture | Supply required monetary/category/contact inputs and isolated schema-2 registry as appropriate |
| 44 | repeated or concurrent registration preserves a single profile and one registration event | `tests/registration-mobile.test.cjs:34:1'
` | Obsolete test expectation | Expected pre-durable-outbox behavior or retired UI/read-state behavior |

No tests were deleted or skipped. Monetary, evidence, mobile-readiness and authorization guards remain enabled. New targeted tests cover the schedule-sync and notification defects not detected by the old baseline. Provider `sent` means API acceptance, not confirmed inbox delivery; the admin feed reports `provider_accepted`. Live delivery and browser behavior remain unverified.

Deferred application defect: `properties.ts:listProperties` converts relationship results through `model(Property)` before `propertyResponse`, dropping moderation metadata. No fix or weakened assertion was applied.

## Verification outcome

- Original 37-file set: 455 tests; final latest results **454 passed, 1 failed, zero skipped**.
- Added Phase 5A coverage: **28 passed** (25 server integration tests, three client token-refresh tests).
- Combined latest results: **482 passed, 1 failed, 483 total; zero skipped/cancelled**.
- One consolidated post-fix run was followed only by affected-file checks; totals above merge the latest result for each test, not repeated executions.
- The retained failure is `listing-approval.test.cjs`: owner property directory must retain moderation metadata. It is a newly exposed, out-of-scope projection defect, not a relaxed expectation.
- TypeScript `--noEmit --incremental false` and `git diff --check`: passed.
- No production calls, provider sends, migrations, environment changes, commits, pushes or deployments.

### Fix behavior

Property schedule changes are transactionally synchronized only when active canonical and embedded tenancy relationships identify the same existing contract. Independently negotiated contracts, missing/foreign canonical relationships, finalized terms and stale versions are rejected. Historical effective contracts and payment records remain intact. Notification intents stage in the same transaction and no-op schedules do not emit another event.

Verified-email reconciliation is limited to the authenticated UID, a fresh matching verified ID token, a currently enabled verified Firebase account and an otherwise complete active profile. Profile email, audit record and two address notices commit atomically. Other protected routes retain the original completed-profile gate. Safe GET token-refresh challenges replay once; mutations are never replayed.

Admin lifecycle policy controls requested/configured state, delivery IDs and dispatch. The feed joins only its bounded page's delivery IDs. Stored read state remains per admin. `provider_accepted` means Resend API acceptance, not inbox delivery. Property-submission notifications reference their existing outbox entry without creating a second email.
