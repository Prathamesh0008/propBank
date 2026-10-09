# Enabled native-group Go dependency audit

Historical checkpoint: the subsequent permanent cleanup removed the proxy and rollout flags. See NATIVE_CLEANUP_REPORT.md. The local trailing-slash contract documented here is retained permanently.

9 October 2026. Re-scanned active TypeScript source with the request AST inventory and direct upload/agreement caller searches. Active trailing-slash upload/agreement callers: **zero**. No frontend UI or .env.local changes were needed.

| Trailing-slash path | Active caller | Local behavior with Group 2 enabled |
| --- | --- | --- |
| /api/upload/ | None | Original Go root response |
| /api/upload/image/ | None | Original Go root response |
| /api/upload/document/ | None | Original Go root response |
| /api/upload/property-images/ | None | Original Go root response |
| /api/upload/service-request-image/ | None | Original Go root response |
| /api/agreements/renew/ | None | Original Go root response |
| /api/agreements/terminate/ | None | Original Go root response |
| /api/agreements/request-renewal/ | None | Original Go root response |
| /api/agreements/request-termination/ | None | Original Go root response |

Upload URL construction is in services/uploadService.ts. Agreements are constructed in features/services/RenewAgreement.tsx, features/services/TerminateAgreement.tsx and features/properties/PropertyDetails.tsx. All use forms without the final slash. Renew/termination conditional URL branches were included in the AST audit. See [API_INVENTORY.md](API_INVENTORY.md) for caller line numbers.

Go main.go registers upload/agreement handlers with exact paths without final slashes. These trailing-slash paths instead match its registered root `/` handler, which calls enableCORS and writes:

```json
{"message": "ShoPROP Backend API is running! (v2)", "status": "success"}
```

The native wrapper preserves HTTP 200, application/json, exact body spacing and absence of an appended newline. OPTIONS returns empty HTTP 200 with the same CORS headers; HEAD returns empty HTTP 200 with application/json. Query parameters do not change the response. These requests do not verify identity, parse an upload body, change agreements, invoke storage, or contact Railway. Paths without the final slash retain their existing native business handlers.

The only proxyGoRequest call in each wrapper is now behind its flag-disabled branch:

| Wrapper | Can reach Go with its flag exactly true? | Disabled rollback |
| --- | --- | --- |
| native-group1.ts | No | Retained |
| native-group2.ts | No | Retained |

No service module imports or invokes proxyGoRequest. Native errors are never retried through Go. General catch-all/root proxy routes remain installed outside these enabled groups.

PROPBANK_DISABLE_GO_PROXY=true now always returns local HTTP 501 JSON for every attempted Go fallback, including feature-flag-disabled wrappers, before origin validation or fetch. This explicit migration test switch works with NODE_ENV=production under next start; the earlier secondary PROPBANK_MIGRATION_TEST_MODE flag is no longer needed.

Verification:

- npm run build: passed.
- npm run test:server: 48 passed, including all nine trailing-slash paths across seven methods, exact response bodies/CORS, no identity checks/writes/storage/proxy calls, disabled rollback, and the shared fail-closed guard.
- node scripts/test-migration-fail-closed.cjs --wrappers-only: passed against the production build. All 63 trailing-slash method/path combinations returned HTTP 200; unmigrated catch-all probes returned local HTTP 501; monitored Go upstream received zero requests. No live Firebase/R2 calls were needed. Results: [wrapper-fail-closed-results.json](wrapper-fail-closed-results.json).
