# Local performance audit — 27 November 2026

## Scope and safety

Working baseline: main, 79eb98eaf02fe2def2b679cb8dcdb258aa3f36aa, plus existing uncommitted application changes. Those changes were preserved. No production services, application data, credentials, configuration, jobs or emails were accessed. No commit, push or deployment was performed.

Reviewed the existing Firestore optimization documentation, query-pages/read-budget utilities, query provider, authentication initialization, RouteGuard, public discovery, Manage Properties, Property Details, admin query gating and image/carousel loading. Existing bounded pagination, identity-scoped caching, invalidation and authorization were retained.

## Confirmed bottlenecks and fixes — PASS

1. Discovery sorting recalculated pricing twice per comparison, including for Recommended ordering. It now returns a copied list immediately for Recommended and decorates each record with its price once for price sorting. Stable ties, unknown prices last, record references and input immutability remain intact. Filtering and server pagination are unchanged.
2. The shared pricing function eagerly computed the local rent date for sales, asking prices and management properties. Date resolution now happens only when contractual rent needs it; explicit billing dates and independent-tenancy handling remain unchanged.
3. Property Details requested the full current-user dossier to obtain only the role. For administrators this also queried relationship and authentication history. It now uses the existing summary endpoint. Current token/profile checks still execute on every request; no new authentication cache or permission shortcut was introduced.

## Measurements

Synthetic fixtures only. Actual current TypeScript modules were transpiled and executed in-process. Before-source snapshots were taken from the working tree, including existing pending discovery changes. Sorting used 250 deterministic synthetic sale/asking-rent records and three executions per ordering; numbers below are median elapsed CPU-side execution times, not browser/network latency. Ordered-ID checksums matched before and after for all three orderings.

| Operation | Before | After | Pricing calls before → after | Date calls before → after |
| --- | ---: | ---: | ---: | ---: |
| Recommended | 42.286 ms | 0.065 ms | 498 → 0 | 498 → 0 |
| Price ascending | 285.059 ms | 0.818 ms | 3,282 → 250 | 3,282 → 0 |
| Price descending | 287.454 ms | 0.344 ms | 3,310 → 250 | 3,310 → 0 |

Contractual records still resolve the required date and rent through the existing resolver; the timing fixture intentionally isolates the noncontractual listing workload. Timings vary by machine and dataset.

The native-server fixture executed the real readUser service with mocked Firebase/Auth. The admin role-only consumer changes from one HTTP request using the full endpoint to one request using summary: five mocked database read operations → one (users only). Extra collections avoided: properties, tenants, properties legacy lane and auth_activity. This sparse fixture returned 520 → 268 JSON bytes. Zero writes and zero emails occurred. These counts are not production billing estimates; real dossier size and latency vary. Ordinary nonadmin self-profile reads already used one database read, so no reduction is claimed for them.

## Verification — PASS

- `node --test tests/performance-regression.test.cjs tests/property-discovery.test.cjs tests/property-data-integrity.test.cjs tests/property-details-layout.test.cjs`: 35 passed, zero failed.
- `node --test --test-name-pattern='role-only|fresh reads deduplicate|Manage Property makes one request' tests/firestore-read-budget.test.cjs`: 3 passed, zero failed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.

Coverage includes canonical/legacy pricing, zero and absent amounts, separate contractual rents, price ordering/ties/unknowns, URL restoration, category filtering and continuation, retries, loaded-page sorting, public privacy, owner/tenant/admin detail gates, gallery behavior, fresh role checks, query deduplication and mutation invalidation. Persistence tests use isolated mocked services, not live Firebase.

## Reviewed architecture and unresolved measurements

- REVIEWED: Manage Properties already combines owned/tenant requests; admin tabs gate directory reads; public and relationship queries use bounded continuation. No unbounded scan or new index/schema was added.
- REVIEWED: authentication and route guards retain mandatory initialization and fresh permission checks. No bypass was used to make navigation appear faster.
- REVIEWED: hero and advertisement image readiness, rotation, visibility pause and authorized media recovery are unchanged. The four hero source files total about 1.59 MB; this is not an actual Next Image network-transfer measurement. No compression-quality or animation change was justified by measured browser evidence.
- NOT VERIFIED: cold/warm route response latency, browser navigation waterfalls, main-thread profiling, rerender frequency, actual production bundle/download size, LCP/image transfer, live Firestore latency and login timings. Localhost can be production-connected, so no live service calls were made for these measurements. No broad claim that every slow route is fixed is justified.
- Remaining work, if slowness persists: profile a safely isolated browser/server environment with timing instrumentation before changing auth gates, media loading, query concurrency or import boundaries.

## Files attributable to this audit

- src/features/properties/PropertyDetails.tsx
- src/features/search/discovery-filters.ts (existing pending category work preserved)
- src/lib/property-presentation.ts
- tests/performance-regression.test.cjs
- docs/PERFORMANCE_AUDIT_2026-11-27.md

All other previously modified/untracked files, including local-only .gitignore, next-env.d.ts and firebase-debug.log, remain uncommitted and preserved.
