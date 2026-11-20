# Final regression cleanup and readiness

No production services were read or changed in this task. No real records, provider
sends, credential/environment changes, commits, pushes or deployments were performed.
The pre-existing deletion of `firebase-debug.log` is preserved.

## Original twenty failures

| Previous failures | Classification and correction |
| --- | --- |
| 13 property/tenancy cases | Outdated fixtures: valid required residential layouts, deposits and compatible isolated identity/registry state |
| 2 identity cases | Obsolete success expectations: unverified/mismatched identities are denied at the authoritative boundary; recipient failure is simulated after an authorized invitation |
| 2 renewal cases | Required future agreement dates and current lifecycle notification policy supplied in isolated fixtures |
| 1 registry case | Valid schema-2 owned-state fixture for role completion; added explicit regression proving missing-mobile quarantine still rejects ordinary onboarding |
| 2 enquiry cases | Durable intent distinguished from child email records; intent-persistence failure must atomically roll back assignment |

No application validator, Auth gate, private-evidence permission, mobile readiness check
or tenancy confirmation requirement was relaxed. A partial legacy profile with a
missing contact is not automatically repaired through normal onboarding.

## Suite-wide cleanup

The earlier 46-file audit was not the entire repository suite. The first complete
933-case run after the known-twenty corrections exposed 62 additional stale cases:

| File | Failures found | Correction |
| --- | ---: | --- |
| agent-workflow | 2 | Complete identity/registry fixtures, current durable-intent counts |
| automatic-data-refresh | 2 | Current public-property and enquiry invalidation expectations |
| client-backend | 7 | Valid inputs, explicit tenant confirmation, current owner/admin policy, durable participant/admin notices, separate status/archive operations |
| firestore-read-budget | 1 | Assert deterministic keyed delivery lookup rather than an event-collection scan |
| functional-audit | 1 | Repair the static inventory parser and compare endpoint pathnames independently of query strings |
| migration-remainder | 1 | Current service catalog and minimal post-dispatch admin preview |
| native-group1 | 10 | Complete verified identities, schema-2 fixtures, admin-only phone lookup, authorized profile creation, current rent schedule and invitation/notification semantics |
| phase-2c | 5 | Correct verified profile contacts, eligible admin notices, complete role fixture and immutable terminal visits |
| property-admin-integrity | 1 | Current Documents section label |
| property-category-ui | 6 | Complete Hook Form/React mock methods and valid agreement/schedule state; preserve category assertions |
| property-runtime-repair | 5 | Required current property fields supplied so failure-injection tests reach their intended persistence/provider boundary |
| security-workflows | 3 | Canonical schedule fixtures, explicit approved/public state and schema-2 profile fixtures |
| server-foundation | 6 | Current SDK/pure-helper mocks, verified identities, outbox collection mapping and strict email configuration failures |
| verified-email-relationships | 12 | Valid property/registry fixtures; current authoritative identity mismatch fails closed before discovery |

The API inventory tool previously failed to parse parenthesized query fragments,
conditional workflow methods and current parameterized shared fetch paths. Its small
local parser corrections keep unresolved paths failing explicitly; no app route or
backend business workflow changed. Generated audit output is not retained in this diff.

## Actual application change

`enquiries.ts` removes the admin inbox's whole enquiry/outbox scans and assignment
N+1 reads, and the agent inbox's unbounded assignment/notification lookups. Both use
bounded document-ID cursor pages and key-IN joins (maximum 30 IDs per batch).
`EnquiryInbox.tsx` follows continuation, deduplicates rows, retains refresh/error/loading
behavior and uses a versioned query key to avoid mixing old flat and new paged cache
shapes. No automatic fetch-all or additional polling.

API additions: `limit` (25 default, 50 maximum), `cursor`, `hasMore`, `nextCursor`,
`order: record_id`. Existing `enquiries` and PATCH contracts remain. Built-in consumers
are updated. Record-ID order is explicit, includes missing timestamps and is not a
newest-first global feed. New inserts before a cursor appear on Refresh. Orphaned
agent assignments can produce an empty page with continuation, not a false global
empty result. Email-status joins use the current intake's stable delivery key; no
historical outbox scan or backfill occurs.

Measured isolated 500-record replay, excluding authorization profile reads:

| Data access | Before | After, first 25-row page |
| --- | ---: | ---: |
| Query/point RPCs | 502 | 3 |
| Returned/read documents | 1,500 | 76 |

The before shape reads 500 enquiries, 500 delivery records and 500 assignments. The
new shape reads 26 enquiries including lookahead, 25 assignments and 25 delivery
records. This is a bounded page comparison, not a production-billing claim. At the
maximum 50-row page, related joins split into at most two batches each. No extra
composite index or infrastructure change is required with normal single-field indexes.

## Verification

Final complete run: **933 total, 928 passed, 0 failed, 5 pre-existing skips**, zero cancelled.
TypeScript `npx tsc --noEmit --incremental false`: exit 0. Production build
`npm run build`: exit 0 (Next.js 16.4.5, 35 static pages). `git diff --check`: clean.

The final full run covers every
`tests/*.test.cjs`, including the six new pagination/read-budget/security cases and
the new unresolved-profile protection case. All fixtures/providers are isolated.
Five existing Go parity tests remain skipped because `tests/go-reference` is absent
(one native-group1, three native-group2 and one migration-remainder). No new skips,
removed tests or security bypasses were introduced.

Manual browser acceptance, production bindings, retired-writer control, historical
CDN cache invalidation and real email/scheduler execution remain operational gates;
see [PRODUCTION_CUTOVER_CHECKLIST.md](PRODUCTION_CUTOVER_CHECKLIST.md). No live readiness
claim is inferred from mocks or a local build.

## Exact task files

- `scripts/audit-active-api.cjs`
- `src/features/enquiries/EnquiryInbox.tsx`
- `src/lib/server/services/enquiries.ts`
- `tests/agent-workflow.test.cjs`
- `tests/automatic-data-refresh.test.cjs`
- `tests/client-backend.test.cjs`
- `tests/enquiry-assignment.test.cjs`
- `tests/firestore-read-budget.test.cjs`
- `tests/functional-audit.test.cjs`
- `tests/migration-remainder.test.cjs`
- `tests/native-group1.test.cjs`
- `tests/native-group2.test.cjs`
- `tests/pending-connections.test.cjs`
- `tests/phase-2c.test.cjs`
- `tests/profile-completion-authorization.test.cjs`
- `tests/property-admin-integrity.test.cjs`
- `tests/property-category-ui.test.cjs`
- `tests/property-runtime-repair.test.cjs`
- `tests/relationship-links.test.cjs`
- `tests/security-workflows.test.cjs`
- `tests/server-foundation.test.cjs`
- `tests/verified-email-relationships.test.cjs`
- `tests/enquiry-pagination.test.cjs`
- `docs/PRODUCTION_CUTOVER_CHECKLIST.md`
- `docs/REGRESSION_CLEANUP.md`
