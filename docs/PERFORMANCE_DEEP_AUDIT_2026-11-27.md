# Deep source-level performance audit — 27 November 2026

## Current-source follow-up

Rechecked the working tree after the prior audit. The sorting memoization and independent first-page reads remain present. This follow-up does not repeat or supersede those changes.

### Additional measured cost and minimal change — PASS

ManageProperty.tsx:301 and SearchResults.tsx:148 previously constructed an identical `Intl.NumberFormat` for every priced card on every render. Each module now owns one formatter (ManageProperty.tsx:43; SearchResults.tsx:24). Locale, currency, rounding, monthly suffix, descriptive labels and missing-price handling are unchanged. The formatter contains no user/property data and does not cache prices. Property pricing still runs against current records.

The focused test extracts and executes the actual formatting expressions with synthetic resolved-price inputs and the real JavaScript Intl formatter, counting constructor calls. It does not execute the complete pricing resolver or browser page. Three batches of 500 formats plus three non-null equivalence examples constructed 1,503 formatters before and one afterward. Median times in this local process:

| Presentation expression | Before, 500 formats | After, 500 formats |
| --- | ---: | ---: |
| Manage Properties | 27.994 ms | 1.650 ms |
| Search Results | 23.729 ms | 0.743 ms |

These are microbenchmarks, not real-world navigation/load-time improvements. CPU scheduling, warmup and machine load affect timings; operation count and identical text are the stronger evidence. Zero, fractional sale price, missing price and monthly contractual-price examples retained exact output. No API or Firestore request-count change is claimed.

### Reconfirmed unresolved paths — REVIEWED

- Mandatory initial account gate: ApplicationShell.tsx:29 → AuthContext.tsx:54 → loadAuthProfile. Fresh admin gate remains RouteGuard.tsx:34. File readiness is already started independently at AuthContext.tsx:65. No checks were bypassed.
- Potential overlapping same-user summary GETs remain SiteHeader.tsx:42 and PropertyDetails.tsx:330. They use different transports/abort lifetimes. Sharing a privileged profile cache without identity/cancellation/freshness proof is outside this low-risk patch.
- ManageProperty.tsx:270 still writes derived filters in an effect. Importantly, its existing action handler also changes filtered-owned state (around line 413). Replacing that state with a memo without reconciling action behavior could alter business semantics, so it was not done.
- query-pages.ts:24-28 retains sequential bounded membership/legacy lanes. Server-side listing count, cursors, authorization and legacy completeness remain untouched.
- SearchResults.tsx:47 already fetches purposes concurrently; :69 memoizes sorting. Public first-page properties/settings reads remain concurrent at services/properties.ts:108. Property details remain identity-keyed with existing stale time in useProperties.ts:18.
- AdminPortal.tsx:51-61 retains tab-gated overview, directory and notification-count queries. Existing dynamic workspace imports remain. No polling/freshness or notification behavior was changed.
- HeroImageCarousel.tsx:57-58 and PropertyAdvertisement.tsx:35 still eagerly prepare rotating images. Workflow static imports and actual bundle weights remain runtime profiling candidates, not measured faults.

### Follow-up verification — PASS

- `node --test tests/property-price-render-performance.test.cjs tests/manage-property-render.test.cjs tests/manage-property-workspace.test.cjs tests/property-discovery.test.cjs tests/public-list-loading-performance.test.cjs`: 35 passed, zero failed.
- `npm run typecheck`: passed.
- `git diff --check`: passed. Existing LF/CRLF normalization warning is not an error.

Tests cover current Manage render stability, owner/tenant visibility, cursor deduplication, pending/server-confirmed toggles, archive conflict handling, notification mark-as-read behavior, search URL/filter/pagination semantics and the prior concurrency fix. All API/storage/notification operations in those tests are mocked and isolated.

Files changed by this follow-up only: src/features/properties/ManageProperty.tsx, src/features/search/SearchResults.tsx, tests/property-price-render-performance.test.cjs, and this document. All earlier/unrelated local changes remain preserved. UI/design, authentication, forms, data schema and service contracts are unchanged. Production latency, browser/device rerenders, bundle transfer, network/cache behavior and live Firebase remain NOT VERIFIED. No production access, commit, push or deployment occurred.

## Scope and evidence

Audited the current working tree, including the earlier performance improvements and unrelated approved pending changes. No production requests, localhost calls backed by production, browser automation, emulators, uploads, jobs or emails were used. Read the installed Next.js page convention guide before editing. No UI, form, authentication, search-scope, schema or configuration changes were made.

Source references below describe current code, not a claim that each path is slow in production. An await chain is not proof of a measured latency problem. Tests execute actual source modules/components with isolated mocked dependencies, not a real browser or Firestore.

## Loading flows and exact potential costs

| Area / status | Current loading flow and source evidence | Assessment |
| --- | --- | --- |
| Routing — REVIEWED | src/app/layout.tsx:25 wraps route children in Providers and ApplicationShell. src/lib/navigation.tsx:8 uses the Next router; :50 wraps Next Link. src/app/properties/page.tsx:1 and src/app/property/[propertyId]/page.tsx:1 render client features. | Cold client navigation needs route JS, hydration/auth readiness and then API results. App Router owns navigation; no fake transition was added. No segment loading.tsx was found. Real cold/warm timings and route chunks remain unmeasured. |
| Auth initialization — REVIEWED | src/components/ApplicationShell.tsx:15 and :29 withhold normal page content during initialization. src/contexts/AuthContext.tsx:43 deduplicates in-flight profile checks; :54 awaits loadAuthProfile; :65 starts private-file setup without blocking account readiness. | The profile request is on the cold authenticated critical path. File-session setup is already independent. Mandatory checks were retained. File-ready invalidations at :82 can cause a legitimate second property/media fetch after initial data arrives. |
| Login — REVIEWED | src/features/auth/GoogleAuth.tsx:40 establishes a fresh token, then /auth/login, then refreshProfile before navigation. src/lib/api-client.ts:6 waits for auth readiness and :9 obtains the current token; :65 deduplicates profile discovery; :78 can wait 350 ms before retrying a transient server error. | Session/profile work is sequential for correctness. No session calls, retries or token checks were removed. Token retrieval is not necessarily a network request because Firebase can reuse a valid token. Real auth latency unverified. |
| Admin guard — REVIEWED | src/components/RouteGuard.tsx:19 performs the effect; :34 requests fresh users/{uid}?summary=true before mounting admin content. | A mandatory additional role round trip precedes dashboard queries. No stale role cache or bypass was introduced. |
| Homepage — REVIEWED / optimized server read | src/features/landing-page/useLandingProperties.ts:63 fetches one cached public first page with settings; :109 exposes filtering; :186 installs the intersection observer; :204 reapplies local search. src/features/landing-page/LandingPage.tsx:116 calls getFilteredProperties for the displayed count. | Public property and settings reads were sequential inside the API; fixed below. Repeated local filtering and callback/effect work remain candidates, but no profiler evidence justifies broader hook surgery. Existing cursor continuation and loaded-page filtering remain unchanged. |
| All Properties — PASS for tested change | src/features/search/SearchResults.tsx:45 already uses Promise.all across purpose queries and query-cache keys include category and cursor. :52 replays applied URL changes with generation guards; :67 previously sorted on every render. | Fixed redundant sorting on unchanged data. URL navigation, category/budget semantics, loaded-page sorting and pagination are preserved in executed component tests. Draft filter changes still do not trigger a new API request. |
| Manage Properties — REVIEWED | src/hooks/useProperties.ts:9 uses one bounded infinite query; :12 splits the same response into owned/tenant lists. src/features/properties/ManageProperty.tsx:207 installs a local auth observer; :230 computes derived filters; :268 stores them via an effect; :283 and :291 memoize sorting. | Filtering changes cause a second render to store derived lists. This is code evidence of extra work, not measured device slowness. No mutation/pending/conflict logic was altered. No second tenant endpoint is fetched. |
| Membership backend — REVIEWED | src/lib/server/query-pages.ts:24-28 processes owned, agent-submitted, tenant-link and legacy lanes sequentially. :26 necessarily loads linked properties after link IDs are read. :27 scans one bounded legacy page; :28 checks canonical links before merging legacy records. :15 batches ID lookups in groups of 30. | Legacy completeness costs reads even when canonical memberships exist. Parallelizing all lanes would need stronger cursor/merge/failure equivalence evidence. Removing legacy reads or truncating results would trade correctness for speed, so unchanged. |
| Property Details — REVIEWED | src/hooks/useProperties.ts:18 caches a property by ID and identity for five minutes. src/features/properties/PropertyDetails.tsx:298 starts details; :325 observes auth and fetches role summary; :347 starts request history only once user and property scope are known. :1129 mounts authorized reviews/service/inspection queries; :1130 mounts negotiations for signed-in users. | Initial details, role lookup and header profile lookup can overlap. Role summary GET can duplicate SiteHeader's same-UID summary GET (SiteHeader.tsx:42); transport/cache/abort ownership differ, so no global shared auth-request cache was introduced. History correctly depends on property authorization. |
| Admin dashboard — REVIEWED | src/features/admin/AdminPortal.tsx:31-41 lazy-loads major workspaces. :51 loads overview on dashboard; :52 independently polls unread count every 60 seconds; :58 loads properties for dashboard/property tabs; :61 enables user directory only on relevant tabs. :95-110 loads legacy notifications for visits/services. | Overview, directory and count queries are independent. The overview route already runs its two count queries concurrently (src/app/api/admin/overview/route.ts:10). Legacy notification requests feed real legacy UI and are not redundant with the newer request directory. Deep-link initialization can briefly enable default dashboard queries before switching tabs; observed statically, not measured. |
| Context/rerenders — REVIEWED | src/contexts/AuthContext.tsx:96 constructs the provider value on render; file-session subscriptions update that provider. Manage/landing/details also keep local UI state. | Context updates and local state can cause consumer rerenders. No React profiler or device trace was collected; changing provider boundaries is not justified in this patch. |
| Images/bundles — REVIEWED | src/features/landing-page/HeroImageCarousel.tsx:46 retains 3-second rotation; :57-58 preloads the first image and eagerly prepares the others. src/features/properties/PropertyAdvertisement.tsx:12 loads active ads, :16 polls every 60 seconds, :29 rotates, :35 eagerly prepares images. PropertyDetails.tsx:16-18 and :27 statically import authorized workflow panels; ManageProperty.tsx:15 imports PropertyHub. | Eager loading may compete for bandwidth; static feature imports may increase JS. Actual optimized response sizes, chunk weights, long tasks, LCP and cache hit rates were not measured. Changing these without evidence risks flicker, altered workflow timing or lost functionality, so preserved. |

Existing FIRESTORE_READ_OPTIMIZATION.md and docs/FIRESTORE_PERFORMANCE_PHASE4.md were consulted. Their old project-name examples are historical documentation, not evidence of current effective production bindings.

## Low-risk optimizations implemented

### 1. Reuse the current sorted list

SearchResults.tsx:67 now memoizes sortDiscoveryProperties by the properties array and sort selection. Unrelated state changes reuse the result; data replacement, continuation, refresh or sort changes recompute it. No data cache, freshness interval or API behavior changed. React is permitted to discard a memo; correctness never depends on its retention.

Executed before/after component fixture: two forced unchanged renders performed two sorter invocations before, zero afterward. The test also executes continuation and sort changes and confirms those invalidate the memo. API count is unchanged: one initial request, then one continuation request. This is a work-count result, not a browser speed claim.

### 2. Overlap independent public first-page reads

src/lib/server/services/properties.ts:107-111 now starts the bounded property query and first-page site-settings read with Promise.all after validating query parameters. Previously settings were awaited only after property results were mapped. Both results still must complete before returning the same public response. Continuations never request settings. Owner/admin branches and authorization are unchanged.

A controlled promise barrier held the real service's mocked property query pending. Before: no settings read had started. After: the settings read had started before releasing the property query. This demonstrates elimination of the dependency edge, not live elapsed-time improvement. Successful first-page read count remains one property query plus one settings point read; no read-count reduction is claimed. On a failed property query, the already-started settings read may now complete; its failure fallback remains unchanged and Promise.all observes both operations. There are no writes.

## Verification

- `node --test tests/property-discovery.test.cjs tests/public-list-loading-performance.test.cjs tests/portfolio-category-discovery.test.cjs tests/performance-regression.test.cjs`: 26 passed, zero failed.
- `node --test --test-name-pattern='fresh reads deduplicate|role-only|Manage Property makes one request' tests/firestore-read-budget.test.cjs`: 3 passed, zero failed. Total: 29 focused tests passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed; existing line-ending normalization warning on property-discovery.test.cjs is not a whitespace error.

The two new checks were executed before implementation and failed specifically on extra sorting (2 instead of 0) and sequential settings start (false instead of true). They passed after the targeted changes. Tests cover immutable/stable sorting, budget/category filtering, direct URL initialization and restoration, retries, continuation, public unit redaction, unchanged fixture response content, invalid-request read avoidance and zero emails/writes. Query fixtures replace Firebase, storage and delivery providers; no live integration verification is claimed.

## Changes attributable to this follow-up

- src/features/search/SearchResults.tsx — memoization only; pre-existing pending changes retained.
- src/lib/server/services/properties.ts — independent read concurrency only; pre-existing pending category/address changes retained.
- tests/property-discovery.test.cjs — memo-aware fixture and render-count regression; prior tests retained.
- tests/public-list-loading-performance.test.cjs — isolated scheduling/read/privacy checks.
- docs/PERFORMANCE_DEEP_AUDIT_2026-11-27.md — this report.

Earlier local performance changes and all other pending work remain intact. No commit, push or deployment occurred.

## Unverified runtime bottlenecks

Production/API RTT, Firestore contention and billing, WAF latency, token refresh RTT, deployment cold starts, development compilation overhead, browser hydration, rerender durations, actual bundle transfer/parse cost and image contention remain NOT VERIFIED. No real-world speedup is claimed from fixture timings or operation counts. A safely isolated browser/network profile is required to rank these remaining candidates.
