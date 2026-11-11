# Phase 4 — local Firestore performance changes

Branch `fix/mobile-number-uniqueness`. No production queries, writes, index deployment,
cloud configuration changes, provider sends or scheduler activation were performed.

## Measured fixture baseline and comparison

The isolated native-server fixture contains 500 approved active properties: 20 Rent,
480 Sale, five owned by the current owner, no tenancies or related activity. Counts
below are returned query documents, excluding the authentication profile point read.
They are not production billing estimates. Pagination includes one lookahead record.

| Hotspot | Before query RPCs / returned documents | After query RPCs / returned documents | Coverage |
|---|---:|---:|---|
| Public Rent discovery | 1 / 500 | 1 / 20 | Complete for this fixture; listing-type filter now indexed |
| Owner Property Hub | 8 / 500 | 10 / 31 | Indexed owner results plus bounded legacy-membership window; continuation provided |
| Tenant Properties | 1 / 500 | 2 / 26 | Canonical tenancy query plus bounded legacy window; continuation provided |
| Admin Rented Properties, empty tenancy fixture | 26 / 25 | 2 / 26 | One property page plus one batched tenancy lookup; one extra lookahead document |
| Admin user directory, separate 204-user fixture | 1 / 204 | 1 / 51 | 50 users plus lookahead; continuation provides all 204 without duplicates |
| Admin notification feed, 25 different property references | 26 data RPCs / 50 documents | 2 data RPCs / 50 documents | Reference validation is batched; two unread aggregation queries remain separate |
| Outbox eligible/legacy candidate queries, sufficiently populated fixture | 2 / 30 maximum | 2 / 18 maximum | Timed candidate budget 20 → 8; legacy lane stays at 10 |

Public/owner/tenant/rented baselines were measured before editing the queries. The
204-user and 25-reference comparisons replay the former query shapes in isolated
fixtures. Point reads, transaction/lease reads, SDK retries and provider calls are
separate. The in-memory mock examines its collection to emulate an indexed query;
that CPU work is **not** a measurement of Firestore index entries examined. No live
Query Explain, quota or billing metrics were collected.

## Query and pagination behavior

- Public discovery applies active/moderation filters and canonical Rent/Sale variant
  filters before a stable document-ID page. Default 50, maximum 100 candidates, plus
  one lookahead. Public projections and expired Pre-Leased policy remain enforced.
- Substring search retains its existing semantics within each candidate page.
  `coverageComplete:false` and `nextCursor` mean the search is not exhausted; an empty
  page is not a global no-match result. Search UI continues all selected listing-type
  streams and deduplicates property IDs. Price sorting covers loaded results only.
- Rented search examines at most four 25-property windows per call, continuing until
  a matching rented page or exhaustion. Canonical active tenancy documents remain
  authoritative. One `propertyId in [...]` + `isActive` query replaces the per-property
  queries. At most 50 active candidate tenants per property remain supported; overflow
  fails explicitly rather than returning a silently incomplete tenant list.
- Payment state comes from the current local billing month's embedded `rentLedger`,
  never the tenant's cached summary. For multiple tenants, a shared property's ledger
  status is labelled as a property-ledger status rather than individual payment proof.
  Missing ledger records are “Not recorded”; no payment history is rewritten.
- Membership pages combine indexed ownership, authorized agent submissions, canonical
  active tenancy lookups and a bounded legacy embedded-membership compatibility lane.
  Matching canonical properties are excluded from the legacy lane to prevent duplicates.
  Cursor state cannot enable a source the caller is not authorized to use. Every returned
  tenant property is checked against current property membership. Manage remains private.
- Legacy embedded-only memberships cannot be globally indexed without changing stored
  schema. They retain explicit continuation, not an unbounded fallback. Common indexed
  matches appear immediately even when their document IDs are late in the collection.
- Property Hub operates on the current membership/property page. Related collection
  queries are bounded. A detail hub exposes 50-record category pages and next/first links.
  Non-owner/admin document continuation uses the existing authorized document library,
  so a cursor can never disclose a private evidence document ID. Pre-Leased evidence
  is not queried for unauthorized members. Mixed legacy document bindings remain a
  bounded Hub view with an explicit library link; ordinary document permissions are
  unchanged. The existing standalone document library is still property-scoped and
  unpaginated; it is not an automatic fallback query and remains a separate optimization
  limit for very large ordinary-document histories. Portfolio activity limits are labelled; open a property hub for full category history.
  Incomplete inspection/document checklists report unknown instead of incorrectly
  claiming an unseen item is not recorded. Assigned/customer offers have separate bounded continuations. Metrics describe the
  current property/activity page, not global totals.
- User lists are admin-only, default 50/max 100. Role filters are indexed. List responses
  contain directory fields, not full profiles; full details still require the authorized
  detail endpoint. Auth status reads run with bounded concurrency, without caching across
  accounts. Substring user search is explicitly paged; exact UID/email/phone modes are
  indexable and preserve stored-field matching. No full-text/prefix index is invented.
- User detail relationship discovery is paged; subsequent relationship pages omit the
  unrelated authentication activity query. Activity history is limited to the latest
  100 dated records. Role-only callers request `summary=true` instead of the dossier.
- Normalized property/user IDs always come from authoritative document IDs, not stale
  stored aliases. Document-ID cursors do not need to reread an anchor and survive anchor
  deletion. As with ordinary live cursors, concurrent inserts before a cursor require a
  refresh; pagination is not a frozen database snapshot.

## Client fetch behavior

| Surface | Before | After |
|---|---|---|
| Rented directory | 30-second polling | Mutation refresh + manual refresh, 60-second freshness |
| Notification feed open | Sidebar and feed each poll every 30 seconds | Feed polls every 60 seconds; sidebar poll disabled while feed is mounted |
| Unread aggregation calls with feed open | Up to eight calls/minute from those two pollers | Two calls/minute; exact counts retained |
| Other admin tabs | Sidebar every 30 seconds | Sidebar every 60 seconds; email-history tab still refreshes badge |
| Owner/archived directory | Separate cache entries/fetches | Shared UID-scoped paged source with view-specific filtering |
| All Properties / Users | Entire list per load | Infinite queries with explicit Load more and loaded-scope labels |
| Admin profile/user search | Stale responses could replace newer selection | Cancellation and generation guards |
| Public home/visit options | Full property payload | Bounded first page and explicit server-page continuation |

Paged React Query keys include identity and a shape version; prefix mutation
invalidations are retained. Fetch signals cancel obsolete directory requests. No
private data is cached globally. Public first-page settings are reused; subsequent
property pages do not reread site settings. Existing unused array-only property-service
helpers fail explicitly on incomplete results rather than quietly discarding a cursor;
all active website discovery callers use the paged methods.

## Outbox safeguards

The eligibility query retains status + recoveryAt ordering and atomic per-record leases,
backoff, retry limits, provider keys and reconciliation protections. It now fetches only
the eight records it can process. Legacy discovery is still bounded and checkpointed.
If an inconsistent legacy row has a future lease/retry time but an already-due recoveryAt,
the worker aligns that timestamp transactionally instead of repeatedly blocking the queue
head. No scheduler was activated. Monitoring count requests run independent aggregates
concurrently and never download delivery bodies for counting.

## Consolidated index plan — local READY, deployed UNKNOWN

`firestore.indexes.json` contains ten collection-scope composite definitions used by
actual query shapes:

1. Four public property shapes: active/moderation, with listing type and/or condition.
2. Canonical membership: tenants userUID + isActive + propertyId.
3. Rented lookup: tenants propertyId + isActive.
4. User activity: targetUID + createdAt descending.
5. Open service count: status + isArchived.
6. Both Phase 3 outbox eligibility/monitoring definitions.

Owner IDs, submission IDs, role, propertyId, document ID, notification timestamp and
readByUIDs use existing automatic single-field indexes. The old
`docs/ADMIN_LIFECYCLE.indexes.json` remains untouched for historical reference; its global
isRead/timestamp definition is not used by the current per-admin feed and is not added
as an unnecessary new index. No deployed legacy indexes are removed. The Phase 3 index
definitions are retained in the consolidated manifest.

Server initialization still calls default-database `getFirestore(dataApp)`. The intended
database is `(default)` in `asia-south1`; actual location and deployed index readiness
were **not** inspected. Index creation targets the database, not a client-selected region.
The batching stays within documented Firestore query limits; see the
[query documentation](https://firebase.google.com/docs/firestore/query-data/queries).

### Operator commands — do not execute without separate production approval

Read-only identity/location and index inspection:

```powershell
gcloud firestore databases describe --project=propbank-944fc '--database=(default)' --format='yaml(name,locationId,type)'
gcloud firestore indexes composite list --project=propbank-944fc '--database=(default)' --format=json
```

Stop if database identity/location differs. Compare existing definitions with the local
manifest and obtain approval for **missing indexes only**. The following additive method
preserves all unrelated deployed indexes and field exemptions:

```powershell
$indexPlan = Get-Content -LiteralPath .\firestore.indexes.json -Raw | ConvertFrom-Json
$approvedMissingIndexes = @() # Fill only with separately approved zero-based manifest positions.
foreach ($indexPosition in $approvedMissingIndexes) {
    $indexDefinition = $indexPlan.indexes[$indexPosition]
    if ($null -eq $indexDefinition) { throw 'Invalid approved index position' }
    $indexArguments = @('firestore','indexes','composite','create',
        '--project=propbank-944fc','--database=(default)',
        "--collection-group=$($indexDefinition.collectionGroup)",
        '--query-scope=collection','--async')
    foreach ($indexField in $indexDefinition.fields) {
        $indexOrder = if ($indexField.order -eq 'DESCENDING') { 'descending' } else { 'ascending' }
        $indexArguments += "--field-config=field-path=$($indexField.fieldPath),order=$indexOrder"
    }
    & gcloud @indexArguments
    if ($LASTEXITCODE -ne 0) { throw 'Index creation failed; stop and reconcile before continuing' }
}
gcloud firestore indexes composite list --project=propbank-944fc '--database=(default)' --format='table(name,state,collectionGroup,fields)'
```

Wait for READY and perform separately authorized bounded live query verification.
Commands follow the [Google Cloud create-index reference](https://docs.cloud.google.com/sdk/gcloud/reference/firestore/indexes/composite/create).

`firebase.indexes-only.json` is an optional, explicitly selected local deployment
configuration; it does not replace existing Firebase configuration. After merging all
deployed definitions and obtaining approval, its CLI command would be:

```powershell
firebase deploy --project propbank-944fc --config firebase.indexes-only.json --only firestore:indexes
```

Do not approve any index deletion proposed by the Firebase CLI. Prefer the additive
gcloud method when deployed definitions are not yet consolidated. No index, rule,
IAM, environment, database or mobile-ownership configuration was changed in this task.

## Verification boundaries

Isolated tests cover late matches, stable pagination, scoped cursors, canonical/legacy
membership, public privacy, active tenancy status, ledger precedence, bounded reads,
notification pagination/read state, and recovery behavior. Phase 1–3 regressions use
isolated providers and database fixtures. Browser behavior, real index selection,
network latency, production quota/billing and deployed indexes remain unverified.

## Exact Phase 4 file manifest

Created:
- `src/lib/server/query-pages.ts`
- `firestore.indexes.json`
- `firebase.indexes-only.json`
- `tests/firestore-performance-phase4.test.cjs`
- `docs/FIRESTORE_PERFORMANCE_PHASE4.md`

Modified (earlier uncommitted changes preserved):
- `src/lib/server/read-budget.ts`
- `src/lib/server/services/properties.ts`
- `src/lib/server/services/users.ts`
- `src/lib/server/services/property-hub.ts`
- `src/lib/server/services/admin-directories.ts`
- `src/lib/server/services/notification-recovery.ts`
- `src/app/api/admin/overview/route.ts`
- `src/services/propertyService.ts`
- `src/hooks/useProperties.ts`
- `src/hooks/useUsers.ts`
- `src/features/admin/AdminPortal.tsx`
- `src/features/admin/AdminRentedProperties.tsx`
- `src/features/admin/AdminNotificationFeed.tsx`
- `src/features/admin/AdminPropertyOperations.tsx`
- `src/features/admin/AdminUserDetailsDialog.tsx`
- `src/features/properties/ManageProperty.tsx`
- `src/features/properties/ArchivedProperties.tsx`
- `src/features/properties/PropertyHub.tsx`
- `src/features/properties/AddPropertyForm.tsx` (summary lookup only)
- `src/features/services/AddTenant.tsx` (summary lookup only)
- `src/features/navbar/SiteHeader.tsx`
- `src/features/search/SearchResults.tsx`
- `src/features/landing-page/LandingPage.tsx`
- `src/features/landing-page/useLandingProperties.ts`
- `src/features/visit-planner/VisitPlanner.tsx`
- `tests/fixtures/native-server.cjs`
- `tests/admin-lifecycle-directory.test.cjs` (one-document lookahead bound)

## Local verification result

- TypeScript `--noEmit --incremental false`: PASS.
- Phase 4: 37 distinct targeted tests PASS.
- Relevant Phase 1?3, agreement/inventory and lifecycle regressions: 189 distinct tests PASS.
- Total unique checks across the consolidated pass and focused correction runs: 226 PASS.
- Initial pagination failure was a mock's inconsistent locale/binary ID ordering; the
  fixture now uses byte ordering for both sorting and cursor comparisons.
- `git diff --check`: PASS. No production verification or browser E2E was performed.
