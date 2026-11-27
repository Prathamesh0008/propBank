# Search and advertisement delivery investigation

Baseline: 3e3759131d716b718b5a9068558116ebe983a1b4; production evidence from dpl_DgArXpzwBN1dah15jASvgUmD2Vzx. Changes are local only.

## Findings

Search root cause: **NOT DETERMINED**. Prior production samples were 3,515 ms and 831 ms for the same residential query; both reported a CDN MISS. This does not identify cold start, Firestore, processing or network contribution. The API is force-dynamic and its JSON responses are private/no-store. The public search function does not call requireUser; Firebase data initialization is lazy and separate from Auth initialization. It executes one bounded approved/active property query, then category, availability and public-safe substring filters over that candidate page. Unmatched pages retain continuation. Adding a category-only database constraint would exclude legacy aliases; caching results could delay moderation/privacy changes. Neither was changed.

Ad repeat-delivery overhead: **CONFIRMED in source and local execution**. Each GET revalidated the advertisement document, fetched the object from private R2, buffered it with a size limit, and returned the full body with private/no-store. There was no ETag path. Prior live evidence showed 217,418- and 237,320-byte WebP bodies taking 1,749 and 1,384 ms. These sizes alone do not prove oversized-image latency. The original first-response cause remains **NOT DETERMINED** because storage, startup, document-read and transfer durations were not separately measured.

The image URL goes through the app's authorization-aware /api/advertisements/[id]/image route, with a version query parameter. Upload already re-encodes to WebP quality 85 within 2400x2400, preserves aspect ratio and strips metadata. GET performs no resize/re-encode. The proxy is required to enforce active/deleted/private preview checks; it was retained. Eager carousel loading prepares slides without changing their appearance or timing; it was retained.

## Local change

Active advertisement responses now use a representation ETag derived from ID, version and image key, and `Cache-Control: private, no-cache, must-revalidate`. A browser may retain image bytes but must contact the server before reuse. The server freshly reads the advertisement and validates existence, deletion, active status and namespace/bucket binding before considering If-None-Match. An unchanged representation returns 304 without contacting R2 or returning a body. Weak/list/wildcard validators are supported. Inactive admin previews retain private/no-store and require admin authorization, even with a validator.

No CDN/shared caching, stale-while-revalidate, private-data caching, signed public R2 URLs, metadata caching or Firestore changes were introduced. Replaced images and updated versions produce a new validator; deactivated/deleted ads cannot return 304 to anonymous callers. This improves repeat validation, not initial loading. Browser cache retention is not guaranteed, so real repeat savings remain unverified until separately authorized deployment and observation.

## Measurements

Same isolated native-server fixture before/after, executing the actual image service:

| Two image requests, second conditional | Before | After |
| --- | ---: | ---: |
| R2 GetObject operations | 2 | 1 |
| Second response status | 200 | 304 |
| Second response body | full synthetic body (19 bytes) | 0 bytes |
| Second request Firestore metadata reads | 1 | 1 |

The actual image bytes in this operation-count fixture are synthetic; byte fidelity and valid WebP output are also checked by the existing Sharp-backed upload/API suite. No artificial delay or mock duration is presented as production speedup.

Search diagnosis used 80 synthetic mixed-category records with pageSize=50. Three local handler executions took 28.711, 21.550 and 13.005 ms, with mocked query portions of 1.657, 0.654 and 0.690 ms. Each performed one query, returned 25 residential records, and retained continuation. Zero writes/emails. These numbers exclude network and real Firestore and are not production cold-start measurements. No search code was changed, so no search before/after improvement is claimed.

## Verification

- New repeat-request check failed before implementation (200 plus a second R2 GET) and passes afterward (304, no second R2 GET).
- Image/API tests: 15 passed after updating the intentional active-image cache-header expectation.
- Existing banner rendering and category-continuation tests: 15 passed in the initial combined run. That initial run had one failure solely from the old cache-header expectation; rerunning the affected API and new revalidation suites passed. Total distinct focused cases: 30, no remaining failures.
- npm run typecheck: passed.
- git diff --check: passed.

Coverage includes active/deleted/private authorization before revalidation, replacement/version changes, namespace/bucket rejection, MIME/content validation, unchanged image content, link/rotation behavior, category visibility and pagination completeness. All persistence/storage/email providers were isolated mocks. No production reads or writes were made in this investigation; existing read-only production measurements were reused.

## Files

Inspected: src/app/api/properties/search/route.ts; src/lib/server/native-group1.ts; src/lib/server/services/properties.ts; src/lib/server/query-pages.ts; src/lib/server/http.ts; src/lib/server/firebase-admin.ts; src/lib/server/r2.ts; src/app/api/advertisements/[id]/image/route.ts; src/lib/server/services/advertisements.ts; src/features/properties/PropertyAdvertisement.tsx; related tests.

Changed: src/lib/server/services/advertisements.ts; tests/advertisements-api.test.cjs; tests/advertisement-image-revalidation.test.cjs; this report. Existing local .gitignore, next-env.d.ts and firebase-debug.log changes are preserved. No commit, push, deployment, configuration change, image replacement or live load test occurred.
