# Permanent native API cleanup

9 October 2026. This report supersedes the earlier migration rollout instructions.

The Next.js application has no HTTP dependency on the external backend. All 40 specific native API route files remain. The request inventory still covers 47 active operations (42 unique method/path pairs), plus five unused serviceApi source operations with native handlers.

## Removed files

- src/lib/server/go-proxy.ts
- src/app/api/[...path]/route.ts
- src/app/api/route.ts
- playwright.proxy.config.ts
- tests/proxy.spec.ts
- tests/fixtures/go-reference.mjs
- scripts/check-group2-readonly.cjs
- scripts/test-migration-fail-closed.cjs

The /api root has no active caller in the complete frontend request inventory, so it was removed. Unmatched /api paths and /api itself now return the standard Next.js 404 response. No replacement catch-all was added. The specialized files/[...path] native R2 deletion route remains.

## Modified files

Runtime source:

- src/lib/server/native-group1.ts: removed rollback import and feature-flag check; retained every local collection-path validation response.
- src/lib/server/native-group2.ts: removed rollback import and feature-flag check; retained validation, redirects and exact local trailing-slash compatibility responses.
- src/utils/config.ts: retained API_BASE_URL='/api'; removed obsolete migration comments and the dead public API environment reference.

Configuration:

- .env.example, .env.local, .env.production: removed only obsolete API-origin/migration flags and related comments. Firebase, Firestore, email, JWT and R2 configuration values were retained.
- package.json: retired proxy/fail-closed test commands and added test:native-routing.
- tsconfig.json: removed generated proxy-test type includes.
- README.md: documented permanently native operation, standard 404 behavior and current verification commands.

Tests and tooling:

- tests/server-foundation.test.cjs: removed tests for the deleted proxy and fail-closed switch; retained Firebase, permission and R2 tests.
- tests/native-group1.test.cjs, tests/native-group2.test.cjs: removed rollback expectations and proxy stubs; retained native contracts, permissions, storage and compatibility assertions.
- tests/fixtures/native-server.cjs: removed migration flags and the proxy stub.
- tests/migration-remainder.test.cjs: removed obsolete proxy-call assertions; retained all request/response, persistence and permission tests.
- tests/parity.spec.ts: API interception now targets /api without an external-backend URL.
- tests/group2-routing.spec.ts: removed tests for deleted catch-all/rollout behavior; retained native route and validation tests.
- scripts/test-group2-routing.cjs: uses the native Playwright configuration.
- scripts/audit-active-api.cjs: reports missing handlers without assuming a catch-all implementation; retired external endpoints are marked REMOVED.
- migration-audit/API_INVENTORY.md, api-inventory.json, unused-legacy-go.json: regenerated from the cleaned route set.
- migration-audit/VERIFICATION_REPORT.md and TRAILING_SLASH_AUDIT.md: marked as historical checkpoints with this report taking precedence.

Added replacements:

- playwright.native.config.ts: starts only Next.js for native routing tests.
- scripts/test-native-routing.cjs: starts the production build with normal configuration; verifies native routes, compatibility responses and standard 404 behavior.
- migration-audit/native-compatibility-results.json: production routing results.
- This report.

Old generated proxy-test output and stale development route validators were cleared inside next-frontend. They referenced deleted route files and caused the first TypeScript build attempt to fail. The rebuilt route table contains neither removed API route.

## Verification

| Check | Result |
| --- | --- |
| Proxy imports/functions in src | None |
| Railway references/URL in src | None |
| Obsolete API-origin/migration environment references in src | None |
| Obsolete settings in application environment files | None |
| General API catch-all | Removed |
| Native wrappers | Permanently native; no fallback or flags |
| Specific native API routes | All 40 retained and compiled |
| npm run build | Passed |
| npm run test:server | 46 passed |
| Production next start routing | Passed without migration flags |
| Specific route preflights | 40 routes returned HTTP 200 |
| Nine upload/agreement trailing-slash paths across seven methods | All 63 returned the unchanged local HTTP 200 contract |
| Root/unmatched/retired endpoint probes | Seven returned standard HTTP 404 |

The runtime change removes only the compatibility layer. No frontend UI, authentication policy, Firebase projects, Firestore collections/data, R2 keys/public URLs or specific service implementation was changed. No live storage operation, customer email or database mutation was performed. The external project folder, its compiled Go model test oracle, and the Railway deployment were not removed or stopped. Historical audit evidence remains documentation rather than executable rollback logic.
