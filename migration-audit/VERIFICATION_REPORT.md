# PropBank final API migration verification

Historical checkpoint: the subsequent permanent cleanup removed the proxy and rollout flags. See NATIVE_CLEANUP_REPORT.md for current behavior; unmatched routes now return standard Next.js 404.

9 October 2026. The Go proxy remains installed. No frontend UI or local credentials were changed.

## Result

No inventoried active frontend API operation depends on the Go catch-all when both native groups are enabled. Seven active operations were proxy-only before this pass and now have specific native method implementations. This is an API coverage finding, not a claim that the entire application has completed authenticated end-to-end acceptance or that every Railway responsibility is migrated.

| Requested metric | Result |
| --- | --- |
| Total normalized frontend source operations | 52, including query variants |
| Active operations in app-reachable modules | 47; 42 unique method/path pairs |
| Active native operations | 47 |
| Active proxy-only operations | 0 |
| Active method-missing operations | 0 |
| Source operations in unreachable modules | 5, all in serviceApi.ts; native implementations also supplied |
| Unused legacy Go operations | 21 unique method/path operations, counting root and reminder ANY dispatch once each |
| Specific routes guarded by native-group wrappers | 31: 8 Group 1, 23 Group 2 |
| Build | npm run build passed on final implementation |
| Server tests | 48 passed after removing enabled trailing-slash fallback; includes original compiled Go JSON/Firestore model comparisons |
| Built-server fail-closed test | 52 source operations checked; 6 HTTP 200, 45 HTTP 401, 1 HTTP 404; zero upstream Go requests |
| Follow-up enabled wrapper test | 63 trailing-slash method/path combinations returned local HTTP 200; catch-all remained blocked; zero upstream calls. See TRAILING_SLASH_AUDIT.md. |

See [API_INVENTORY.md](API_INVENTORY.md) for the requested METHOD / FRONTEND ENDPOINT / FRONTEND CALLER / NEXT.JS ROUTE / NATIVE SERVICE / STATUS table, before/after statuses, every API route export, explicit 405 methods, and unused legacy operations. Machine-readable data is in [api-inventory.json](api-inventory.json) and [unused-legacy-go.json](unused-legacy-go.json). Query parameters in the table are normalized; search filters and visit status are optional. Import reachability is conservative: helper methods in imported modules are counted even if a particular helper is not invoked by today's UI. Unimported serviceApi operations are marked UNUSED.

## Native work in this pass

| Operation | Specific route | Original handler inspected |
| --- | --- | --- |
| POST /api/auth/login | auth/login/route.ts | AuthHandler.Login and GenerateToken; handler existed but was never registered by Go main |
| GET, PUT /api/admin/site-settings | admin/site-settings/route.ts | GetSiteSettings, UpdateSiteSettings; PATCH implemented as the original shared handler |
| POST /api/reviews | reviews/route.ts | CreateReview and ReviewService.CreateReview |
| POST /api/inspection-reports | inspection-reports/route.ts | CreateInspectionReport and InspectionReportService.CreateInspectionReport |
| GET /api/inspection-reports/property/:propertyId | inspection-reports/property/[propertyId]/route.ts | GetInspectionReportsByProperty |
| GET /api/inspection-reports/user/:userId | inspection-reports/user/[userId]/route.ts | GetInspectionReportsByUser |
| GET /api/services, POST/GET /api/service-requests, PUT /api/service-requests/:id | services/route.ts, service-requests/route.ts, service-requests/[id]/route.ts | Entire ServiceHandler/ServiceService; conservative coverage for unused serviceApi module |

Implementation: [migration-remainder.ts](../src/lib/server/services/migration-remainder.ts). It reuses the existing dual Firebase Admin, authentication, HTTP error, notification, R2, model serialization and collection modules. The generated model schema now includes reviews, inspections, services, requests and settings. Original collection names remain reviews, inspection_reports, services, service_requests, siteSettings/main_settings and admin_notifications. Attachment URLs pass through unchanged; embedded service request uploads retain service-requests/{upload UUID}/image_{unixSeconds}.{extension}, independently of the request record UUID. Original success envelopes, optional-field omissions, timestamps, notification payloads and status codes are tested. Site settings preserve Go's replacement semantics and read-error default behavior. Service lists preserve Go's empty/omitted data behavior on iterator failure.

Native authentication follows the established Firebase migration policy: verified Firebase bearer tokens, persisted roles, self/admin checks on user requests, and admin checks on service-request/status/settings mutations. Go's unchecked admin=true and UID headers do not grant native privileges. Review/inspection submission permits registered users as before; inspection user-history reads use self/admin access. Login preserves the success/token/user/message envelope. When JWT_SECRET is configured it supports the original 48-hour HS256 claims; when absent it returns the already verified Firebase ID token. This is explicit native behavior for the formerly unregistered Go endpoint, and removes an unnecessary JWT_SECRET requirement from the existing Firebase-authenticated frontend. apiFetch continues to override legacy localStorage tokens with a refreshed Firebase ID token.

## Intentionally retained catch-all paths

These have no active frontend caller. The broad catch-all still also handles arbitrary unknown/unmigrated paths and unsupported suffix patterns.

| METHOD | PATH | REASON |
| --- | --- | --- |
| ANY | /api/admin/trigger-reminders | Go reminder administration |
| POST | /api/admin/populate-services | Legacy service seeding administration |
| GET | /api/reviews/property/:propertyId | Unused review list |
| GET | /api/reviews/:id | Unused review detail |
| GET | /api/inspection-reports/:id | Unused report detail |
| PUT, PATCH | /api/admin/site-settings/quote | Unused quote-only update; active full settings update is native |

/api itself separately retains the proxy root/health route for all exported methods. DELETE /api/files/delete is native via the specialized files/[...path] route; this route implements R2 deletion and does not call the general API catch-all.

## native-group1.ts and native-group2.ts audit

With both flags true, Group 1 has **no Go fallback paths**. Its trailing users/properties collection validation stays native.

With both flags true, Group 2 now handles these nine trailing-slash paths locally for every exported method, including OPTIONS, to preserve Go's exact-registration routing. There are **no enabled Group 2 fallback paths**:

- /api/upload/
- /api/upload/image/
- /api/upload/document/
- /api/upload/property-images/
- /api/upload/service-request-image/
- /api/agreements/renew/
- /api/agreements/terminate/
- /api/agreements/request-renewal/
- /api/agreements/request-termination/

No frontend request builds those nine paths. Go's exact upload/agreement registrations miss them and its root handler returns HTTP 200 with the exact body `{"message": "ShoPROP Backend API is running! (v2)", "status": "success"}` and Content-Type application/json, with no appended newline. OPTIONS returns an empty 200 with the existing CORS headers; HEAD returns an empty 200 with application/json. Group 2 reproduces those responses locally, without uploads, agreement mutations, identity verification, or Railway contact. Other Group 2 collection trailing-slash validation and files/documents-property redirects remain native. No wrapper retries a failed native service or mutation through Go.

If its group flag is absent or not exactly true, every exported method on a wrapped route can still use Go. Group 1 guards: auth/user, users, users/search, users/[id], properties, properties/search, properties/tenant, properties/[id]. Group 2 guards: upload, upload/image, upload/document, upload/property-images, upload/service-request-image, files, files/[...path], visits, visits/[id], tenants, tenants/[id], documents, documents/property, documents/property/[propertyId], documents/[id], agreements/renew, agreements/terminate, agreements/request-renewal, agreements/request-termination, admin/notifications, admin/notifications/[id], admin/notifications/[id]/read, admin/notifications/[id]/remarks. Prefix every entry with /api. The nine new remainder route files are directly native and have no rollout fallback.

## Fail-closed mode and verification scope

Development/test mode:

```dotenv
PROPBANK_NATIVE_GROUP1_ENABLED=true
PROPBANK_NATIVE_GROUP2_ENABLED=true
PROPBANK_DISABLE_GO_PROXY=true
```

The explicit PROPBANK_DISABLE_GO_PROXY=true test switch also applies to production builds tested with next start. It blocks every attempted Go fallback regardless of NODE_ENV; no second test flag is required. It defaults to false in .env.example; .env.local was left untouched.

The shared proxyGoRequest checks this mode before resolving GO_API_ORIGIN, reading the body or fetching. Root, general catch-all and wrapper fallbacks all return HTTP 501 with success:false, message:"Go proxy disabled: endpoint is not migrated", method and path. Native handlers keep operating.

Run npm run audit:api, npm run test:server, npm run build, then npm run test:migration-routing. The routing test launches the built app with a local monitored Go origin, both groups true and fail-closed enabled, and shuts down its servers afterward. It checks all 52 inventoried source operations plus root, legacy catch-all and trailing-slash wrapper cases. [fail-closed-results.json](fail-closed-results.json) records zero Go requests. Public Firebase reads worked outside the execution network sandbox. An initial sandbox-only Firestore read returned gRPC UNAVAILABLE; a read-only check outside the sandbox succeeded. No production mutation, storage upload/delete or customer email was performed by the built-server test. Positive authenticated mutations, permission failures, URLs, notifications and Firestore persistence are covered with isolated SDK boundaries and original Go model comparison.

**Can the full active app operate without Railway?** Every inventoried frontend API operation now has native coverage, and no active operation reached Go in routing tests. Full live authenticated workflow acceptance is still pending; the built-server test used anonymous mutation rejection rather than signed-in production mutations. There is also a separate non-proxy Railway dependency: Go main.go starts ReminderScheduler.Start(), which checks every minute for visit and property reminder emails. There is no equivalent Next.js scheduler/cron in this workspace. Disabling the proxy while Go stays deployed tests API independence; shutting down Railway would still remove scheduled reminders. Therefore the full-system migration is not declared complete.
