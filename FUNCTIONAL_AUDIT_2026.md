# PropBank functional audit — 21 October 2026

**Production readiness: FAIL — not ready for production certification or an unconditional handoff to redesign.** Local checks and isolated workflows pass after repairs, but private storage delivery, real user authentication, authenticated Firestore mutations and deployed scheduling remain unverified. Listing moderation and enquiry assignment are not implemented. This is not a 100% completion claim.

Statuses: **PASS** = tested successfully within the stated scope; **FAIL** = reproduced failure or source-confirmed unmet requirement; **BLOCKED** = verification unavailable or unexecuted, with prerequisites below; **NOT IMPLEMENTED** = functionality does not exist. Fixture passes never imply live integration passes. Test-runner skips are BLOCKED.

## Scope and evidence

Reviewed structure, package/README, implementation and handoff reports, route wrappers, client services, authentication/authorization, native business services, provider configuration and existing Node/Playwright suites. Read the installed Next 16 route-handler guide before changes. Actual source supersedes historical reports.

Source inventory: **249 TypeScript modules, 34 page routes, 45 API route files, 27 modules with form/input controls, 18 literal form elements**. Counts include unused preference forms and shared components; button-driven workflows are included below. See [source-inventory.json](functional-audit/source-inventory.json), [complete field/control inventory](functional-audit/FORM_SOURCE_INVENTORY.md), and [API caller inventory](migration-audit/API_INVENTORY.md). The appendices inventory all pages and API routes.

No theme, typography, layout or working component replacement. UI edits address handlers, validation, search selection and explicit unavailable controls. Pre-existing user changes were preserved. No production records were mutated, customer files deleted, accounts created, or real notifications/reminders sent. Provider checks were read-only; authenticated mutations used isolated state.

### Architecture and roles

Next App Router serves pages and native `/api` handlers. `apiFetch` obtains the current Firebase ID token for same-origin APIs. Firebase Auth and Firestore use separate configured projects (README: `propbank-7601b` and `propbank-944fc`); credentials match their configured projects. Firebase Admin bypasses Firestore client rules: service authorization is essential.

Persisted roles: `individual`, `agent`, `admin`. Owner/tenant are property relationships; one account may have both. Registration uses Google sign-in plus profile completion. No separate password flow or broker dashboard exists. Protected layouts use `RouteGuard`; `/admin` checks persisted role. APIs independently enforce access. No middleware/proxy file exists; client guards alone do not secure data.

Verified workflow paths: property intake → embedded/collection tenancy → owner evidence verification; maintenance/legal/related request → admin resolution/archive → tenant history; agreement request → owner decision → retained snapshots; enquiry → admin notification; offer → broker/admin proposal → owner approval/counter → explicit customer confirmation → admin completion.

## Passed functional testing

Final measured totals: **102 Node tests:97 PASS,0 FAIL,5 BLOCKED skips. 46 distinct browser tests PASS across acceptance, audit/routing and focused added regression runs;1 legacy parity test BLOCKED.** Repeat runs are not added to these unique totals. Typecheck/build/API audit/native routing PASS; lint PASS with81 warnings. Remaining product/privacy failures below are not counted as passing tests.

- PASS: isolated server auth, role checks, registration contracts, duplicate phone, expired/revoked fixture token rejection, token refresh transport and same-origin restriction.
- PASS: public listing/search/detail projections, owner-plus-tenant relationships, tenant intake privacy, category/availability filters, property create/edit/archive/restore and authorized records.
- PASS: browser residential property creation/editing, tenant intake/assignment, documents/receipts/TDS, inspection/review history, legal/related requests, maintenance resolution, renewal/termination and recorded rent tracking.
- PASS: browser multi-role negotiation, explicit customer confirmation at both original and revised amounts, assigned broker limits, admin notes privacy, settings persistence and owner verification with matching evidence.
- PASS: public page destinations, guest redirects/direct-load/refresh, unknown-page 404, assets and functional overflow checks at 1440/768/390px. `/sell` intentionally redirects into protected intake; `/buy` and `/rent` redirect to public search.
- PASS: isolated transactions, property-member/owner/admin boundaries, IDOR rejection, upload namespaces, deletion ownership, history/version conflicts, concurrent duplicate tenant assignment, reminder leases/dedup/frozen retry payloads.
- PASS: actual built server native routing, live public Firestore reads and anonymous mutation rejection. This is not an authenticated live persistence test.

## Bugs discovered and fixed

| ID | Baseline failure | Repair and affected filenames | Verification |
| --- | --- | --- | --- |
| F01 | API audit crashed on `/api/negotiations:param`, missing modern helper coverage | `scripts/audit-active-api.cjs`: expand nested conditions/concatenation, correlate URL+method branches, enumerate `workflowRequest`; explicitly record missing legacy comparison; fail if active handler missing | PASS: 63 active operations / 55 method-paths native, regression test |
| F02 | Owner acceptance of original ₹60,000 offer bypassed explicit final customer confirmation | `src/lib/server/services/negotiations.ts`; update `tests/negotiations-reminders.test.cjs` | PASS: owner_approved with null final amount until customer confirms; browser/API/concurrency |
| F03 | Public `all=true` exposed tenant-submitted rental and photo | `src/lib/server/services/properties.ts`: exclude tenant intake from both public list/search regardless of flag | PASS: reproduced before fix, both-endpoint privacy regression |
| F04 | `images:[]` retained last image after refresh | Same properties service: persist explicit empty gallery; update obsolete expectation in `tests/native-group1.test.cjs` | PASS: reproduced before fix, response and persisted empty gallery |
| F05 | Buy/Rent auto-search sent previous value; stale condition/clear callbacks; merged listings lost category filtering | `src/features/search/SearchResults.tsx`: pass fresh overrides, valid nonempty Radix clear sentinel, filter after merge | PASS: browser type/condition/clear; exhaustive merged-category combinations BLOCKED |
| F06 | Property 360 exposed another tenant's request despite canonical request API restrictions | `src/lib/server/services/property-hub.ts`: requester-scope requests before history/actions/response | PASS: tenant sees only own request, owner sees both |
| F07 | Repeated/concurrent assignment duplicated active tenancy | `src/lib/server/services/tenants.ts`: transaction checks active UID/email across old/new batch; positive fixture in `tests/native-group2.test.cjs` starts without same active tenant | PASS: one relationship/document; duplicate/concurrent loser 409 |
| F08 | Subscribe did nothing; social `#` anchors appeared functional | `src/features/footer/SiteFooter.tsx`: explicit disabled subscription and unavailable social semantics, unchanged layout/classes | PASS browser unavailable state; underlying features NOT IMPLEMENTED |
| F09 | DatePicker trigger defaulted to form submit | `src/ui/date-picker.tsx`: type=button | PASS browser picker no submission and visit refresh workflow |
| F10 | Enquiry required-field bypasses; blank review/report API submissions | `src/lib/server/services/notifications.ts`, `migration-remainder.ts`, `src/features/services/Review.tsx`; valid notification fixtures updated | PASS malformed/empty/no-write regressions, enquiry/review browsers |
| F11 | Old guest-routing test incorrectly protected public search/property pages | `tests/routes.spec.ts`: correct access expectations, tenant intake/sell protection, portable home URL | PASS routing without changing application access |
| F12 | Phone lookup exposed other users' stored rental relationships | `src/lib/server/services/users.ts`: require active persisted caller; peer results allowlist onboarding identity fields, preserving self/admin detail | PASS regression: rental metadata omitted, unregistered caller rejected; tenant assignment retained |

New assets: `tests/functional-audit.test.cjs`, `tests/functional-audit.spec.ts`, `playwright.audit.config.ts`, source/environment/read-only provider audit scripts and evidence directory. `package.json` adds `test:functional` to run every Node suite, including regression tests. No failing checks were disabled. Old behavior assertions changed only where they encoded a repaired bug.

### Negotiation business verification

PASS isolated/API/browser: asking ₹70,000; offer ₹60,000; admin proposal ₹65,000; owner counter ₹67,000; customer confirms ₹67,000; admin completes. Original amounts remain in history; property price is not silently rewritten. Owner approval at the original ₹60,000 now also requires explicit customer confirmation. Admin completion is rejected before it. Owner rejection closes proposals; unrelated/assigned agents cannot approve as owner. Concurrent owner/proposal updates produce one winner and a 409 stale action. Notifications and queued mail are tested in fixtures; real delivery is BLOCKED.

Existing stored `accepted` offers were not migrated. Their historical consent cannot be established retrospectively; review in-flight legacy acceptances before release. No destructive consent backfill occurred.

## Environment and integrations

Sanitized evidence: [environment-status.json](functional-audit/environment-status.json), [provider-readonly.json](functional-audit/provider-readonly.json). No secrets printed.

| Check | Status and actual evidence | Remaining prerequisite |
| --- | --- | --- |
| Browser Firebase | PASS presence/consistency: six keys present; browser/Auth project match | BLOCKED Google provider console/authorized domains and real popup |
| Firebase Admin | PASS: Auth/data credential documents parse, include required fields, match configured projects; authenticated lookup of synthetic nonexistent UID returned user-not-found | BLOCKED real user/session lifecycle |
| Firestore read/project | PASS: built native public reads succeeded with configured data credentials | BLOCKED authenticated writes, real contention/retries and staging persistence |
| Firestore rules/indexes | BLOCKED deployment; NOT IMPLEMENTED repository definitions | No firebase.json/firestore.rules/firestore.indexes.json. Need deployed exports and staging compound-query tests. Admin bypasses rules |
| R2 credentials | PASS read-only: all five settings present; signed HEAD of random nonexistent key returned 404; no listing/writes | BLOCKED actual uploads/deletes/current bucket privacy/IAM |
| Legacy GCS storage | BLOCKED: no configured Admin data storage bucket variable | Browser bucket is not Admin data bucket; base64 helper skips failures |
| Resend | PASS read-only: configured key/from; domain GET returned 200, one verified domain | BLOCKED actual trigger/delivery/inbox. ADMIN_EMAIL absent; confirm fallback recipient |
| Cron secret | PASS presence/minimum length, isolated authorization/dedup/retry tests | BLOCKED deployed external schedule, successful run logs, cursor/pagination/reconciliation |
| Mobile/SMS/WhatsApp/push | NOT IMPLEMENTED; unsupported mobile reminder explicitly rejected | Provider/product decision |
| Next configuration | PASS build/routing; async params/native Node handlers; isolated dist dirs; explicit slash compatibility | No general external catch-all fallback |
| PWA/cache | PASS source scope: no API/private page/flight caching; browser logout clears private query data | BLOCKED complete offline/session audit |

Read-only probes created no identities or objects and sent no emails. Oct 12 R2/email reports were inspected as historical evidence, not relabeled as new passes. Live scheduler endpoint was not invoked because it can notify customers.

## Security/privacy concerns and remaining failures

1. **FAIL — confidential storage delivery design.** Metadata APIs enforce membership, but document/private image helpers return direct public R2/GCS URLs and legacy GCS invokes makePublic. URL holders bypass metadata authorization wherever bucket public access is enabled. API projection tests cannot prove private object delivery. Need a private namespace/bucket, authenticated download or short-lived signatures, plus approved historical URL revocation/migration. Current deployed policy is BLOCKED; no customer object/bucket policy was changed.
2. **FAIL — silent/partial storage outcomes.** Legacy GCS/base64 helpers skip failed images; R2 batch image upload may report success for zero successful files. Document deletion is best effort for storage and can orphan an object. Existing paths were preserved; failure UX and reconciliation remain required.
3. **BLOCKED — rules, indexes and IAM.** No deployed configuration export. Public read success does not establish direct SDK restrictions or least privilege.
4. **FAIL / replay-abuse concern.** Anonymous enquiries validate content but lack rate limits/CAPTCHA/idempotency. Most POST resources can create multiple records on replay. Tenant duplicates are fixed; universal exactly-once behavior is not implemented and uniqueness policies remain unresolved.
5. **BLOCKED / remaining privacy decision.** Phone lookup now minimizes peer fields and requires an active profile; it still supports email/phone identity discovery for tenant onboarding. Define narrower lookup permissions/anti-enumeration policy. No live phone directory was queried.
6. **BLOCKED — full negative browser coverage.** Every conditional property field, network failure and auth/session variant was not exercised. Some existing best-effort reads show empty/default state after errors. Lint retains 81 warnings.
7. **BLOCKED — scale.** Some queries scan whole collections; property hub performs per-property reads before 250-item truncation, negotiations cap results at 100, histories/delivery maps grow. Need real Firestore load/size/index/contention and scheduler cursor fairness tests.
8. **BLOCKED — historical accepted offers.** New explicit confirmation does not retroactively prove consent on old records.

## Incomplete workflows

| Requirement | Status | Actual implementation |
| --- | --- | --- |
| Listing submission/approval/rejection | NOT IMPLEMENTED | Owner create sets active immediately. Archive/restore is not listing moderation |
| Enquiry assignment and broker queue | NOT IMPLEMENTED | Admin notifications exist; agent roles and negotiation assignment exist; no enquiry assignee model or broker dashboard |
| Dedicated admin all-visits queue | NOT IMPLEMENTED | Admin API rights/property hub exist; planner is own-user scoped |
| Owner-verification rejection | NOT IMPLEMENTED | Verify/link only, no rejection endpoint/state |
| Newsletter/social destinations | NOT IMPLEMENTED | Now explicitly unavailable |
| Email/password login/reset | NOT IMPLEMENTED | Google sign-in/profile completion is current method |
| Payment settlement/tax computation | NOT IMPLEMENTED | Supplied receipt/TDS metadata/manual paid state, no payment gateway or tax engine |
| Automatic notice finalization/escalation | NOT IMPLEMENTED | Explicit owner decisions/supplied terms |
| Dynamic blog/CMS | NOT IMPLEMENTED | Static informational blog/support/services/legal pages |
| Business contact accuracy | BLOCKED | Footer sample phone/email require business-confirmed replacements; none guessed |

## Form scenario matrix and limitations

The seven requested scenarios have **not all passed for every form**. Live mutation/refresh is BLOCKED across forms. The isolated adapter retains data between requests within a test and resets between tests; it is not Firestore.

| Scenario | PASS scope | Remaining BLOCKED / FAIL scope |
| --- | --- | --- |
| Empty | Enquiry browser/API; review browser/API; inspection API; required registration/property/tenant/document/visit contracts | Every conditional branch/admin browser empty case unexecuted |
| Malformed | JSON/models, forged identities, enums/types, enquiry email/phone/date/time, date/day/rent/negotiation precision, upload namespace/MIME/size | Every field permutation and file-content signature/malware scanning unavailable; MIME claims trusted |
| Valid | Browser create/edit/intake/assignment/offers/agreements/services/docs/inspection/reviews/settings/owner verification/visits | Real Firebase→Firestore/storage/email full end-to-end BLOCKED |
| Duplicate | Phone conflict; tenant concurrent duplicates; stale negotiation/ledger versions; reminder dedup; renewal repeat | Most create endpoints lack idempotency; enquiry/doc/review/report/offer retries can create multiple records |
| Network | Browser enquiry abort preserves input/retries; isolated DB/R2/mail outages and reminder retry | Per-form browser offline/timeout, provider partial success and silent catches incompletely verified |
| Permission | Anonymous rejection, fixture expiry/revocation, stored roles, owner/member/agent IDOR, namespace/delete | Real revoked tokens, browser provider setup, client security rules BLOCKED |
| Refresh | Property edits, ledger/member view, offers, settings, history/guest redirects, scheduled visit | All live sessions/persistence BLOCKED; universal unsaved-input restoration NOT IMPLEMENTED |

## Production gates

1. Provide isolated staging Auth/data/storage and controlled customer/owner/tenant/assigned+unassigned agent/admin/disabled accounts. Approve only clearly namespaced records, then verify browser→Next→real Firestore persistence/transactions/refresh on desktop/mobile.
2. Implement or explicitly defer moderation, enquiry assignment and verification rejection with agreed rules.
3. Resolve private object delivery and historical URLs; validate upload content, IAM, deletion/orphan reconciliation with approved isolated objects.
4. Export deployed Firestore rules/indexes and scheduler configuration. Verify real Auth expiry/revocation and schedule pagination/retry logs.
5. Approve a controlled email recipient for transactional/reminder tests, without notifying customers.
6. Finish remaining negative/browser/category cases; confirm contacts, duplicate policies and lookup minimization/abuse controls.

**No UI/UX redesign started.** These findings and blockers must be reviewed before the next phase.

## Complete form/action inventory

Paths below are relative to `src/`. Exact source fields, line numbers, types, required/min/max/accept constraints and handlers are in [FORM_SOURCE_INVENTORY.md](functional-audit/FORM_SOURCE_INVENTORY.md) and its JSON source. Mapped fields are summarized here. Every mutation row has **BLOCKED live persistence**, even where fixture/browser PASS is recorded. A PASS for a valid submit does not certify all seven scenarios.

| Page and component filename | Purpose; fields and validation | Handler → HTTP endpoint | Permissions → collection/storage | Success / failure behavior; actual result |
| --- | --- | --- | --- | --- |
| `/auth`; `features/auth/GoogleAuth.tsx` | Google popup; name/phone/individual role; Firebase UID/email authoritative, duplicate phone/promotion rejected | `verifyAccount`, registration/sync handlers → POST auth/login, auth/user; GET/PUT users/:uid | Verified identity/self/admin → users/Firebase profile | Profile/account view or registration error/retry. PASS isolated registration/duplicates/token contracts; BLOCKED real popup/relogin/session |
| Header; `features/navbar/UserMenu.tsx` | Account information/logout, no profile edit form | `handleLogout` → Firebase signOut and local token/cookie/cache clearing | Current user → local session | Guest state/private data removed. PASS browser logout/cache; BLOCKED real lifecycle |
| `/`, `/contact`; `features/landing-page/GeneralInquiryForm.tsx` | Buy/rent/sell, category, name/email/phone required; optional visit date/time. Server enum/email/bounded phone/calendar/time validation | `handleSubmit` → POST admin/notifications | Guest/current user → admin_notifications + queued mail | Toast/reset; validation/network error retains input. PASS browser empty/network/valid/reset/fixture persistence and malformed API; delivery BLOCKED |
| `/`; `features/landing-page/SearchFilterSection.tsx`, `features/search/SearchBar.tsx` | Query/listing/category/condition choices | `handleSearch`/toggle/clear → search URL | Public → URL state | Filtered navigation. PASS main search; every landing combination BLOCKED |
| `/search`, `/properties`; `features/search/SearchResults.tsx` | Query, Buy/Rent, condition; URL category/multiple-listing filters | `handleSearch`, `handleTypeChange`, `performSearch` → GET properties/search | Public → properties read | Results/URL/empty state or error toast. PASS latest selection/condition clear/public API privacy; exhaustive combinations BLOCKED |
| Search result enquiry; same file | Selected property, server-derived requester/context | `handleEnquireProperty` → POST admin/notifications | Firebase user → notifications | Success/error toast; guest login redirect. PASS API forged-context/privacy; dedicated browser action BLOCKED |
| Unused `features/search/PropertySearchForm.tsx` | Required location/budget min/max/configuration, optional condition/remarks; only nonempty strings | form handleSubmit → callback | No app route → none | Callback/back. NOT IMPLEMENTED reachable workflow; no numerical budget range validation |
| Unused `CommercialPropertySearchForm.tsx` | Same preferences plus required purpose | form handleSubmit → callback | No app route → none | NOT IMPLEMENTED reachable workflow |
| `/select-property-type`; `features/properties/SelectPropertyType.tsx`, `PropertyTypeSelector.tsx` | Owner/tenant then residential/commercial/industrial | Selection → add-property mode/type params | Signed-in user → navigation | Correct mode. PASS browser owner/tenant choices |
| `/add-property`; `features/properties/AddPropertyForm.tsx`, `ClientPropertyFields.tsx` | Required title/type/configuration/listing/address; category/building/structure/unit/floor/areas+units; price; tenant contacts/employment/spouse; rent/deposit/due/escalation/period/dates/notice/lock-in/payer; rent schedule; buyer/sale status; furnishing/photos/comments. Zod/conditional checks plus server type/enums/ownership | `onSubmit`, uploads → POST properties, upload/image | Self owner/admin → properties/tenants, R2; legacy base64 GCS | Created toast/cache state; validation/upload/API error. PASS residential create and API categories/relationships; every commercial/industrial conditional/browser/live upload BLOCKED |
| `/tenant-property`, `/add-property?as=tenant`; `TenantPropertyForm.tsx` | Title/address/type/structure/areas; positive rent, day 1–31, period/dates; reported owner company/person/phones/email/profile; schedule/photos/checklist. Owner name+phone/date range required | `submit` → POST properties | Verified submitter → private properties + tenants | Tenant tab or inline error. PASS browser intake/admin supplied details; server spoof/terms/private visibility |
| `/edit-property/:id`; `EditProperty.tsx` | Existing property/pricing/buyer/rental fields, images/checklist; required schema/conditional pricing | `onSubmit` → PUT properties/:id | Owner/admin → property + synchronized tenants | Toast/refetch/errors; refresh retains state. PASS browser edit/rented terms; empty gallery persistence/IDOR regression. Stored image deletion separate |
| Shared `FurnishedChecklistModal.tsx` | Checked items, counts/custom names | `handleSave`, add/remove → parent property state | Parent form user → payload | Save/cancel modal. PASS included rendering; exhaustive item interactions BLOCKED |
| `/manage-property`; `ManageProperty.tsx` | Owned/tenant tabs, filters, status/archive, want-to-sell controls | Handlers → GET properties/tenant, PUT properties/:id, POST notifications | Owner/admin changes, tenant read → properties/notifications | Refetch/archive list/toast errors. PASS tabs/archive/restore/server roles; every menu/network branch BLOCKED |
| `/archived-properties`; `ArchivedProperties.tsx` | Restore archived record | Restore → PUT properties/:id | Owner/admin → properties | Restore/refetch/error. PASS browser |
| `/property/:id`; `PropertyDetails.tsx` | Public/member details; tenant termination notice/date dialog | `submitTerminationRequest` → POST agreements/request-termination | Tenant → property agreement request | Pending/error toast. PASS detail/privacy and canonical agreement flow; duplicate dialog variant BLOCKED independently |
| `/property/:id`, admin Offers; `NegotiationPanel.tsx` | Amount >0, ≤1e10, ≤2 decimals; version; broker UID; proposal/counter/owner/customer/complete decisions | `mutate` → POST negotiations, PATCH negotiations/:id; GET list | Action-specific customer/owner/assigned-agent/admin → negotiations/history/notifications/mail | Refetch history; error toast+reload on conflict. PASS browser original/revised offer/broker and API rejection/stale/concurrent/notification cases |
| `/manage-property/:id`; `PropertyHub.tsx` | Rent month/amount/calendar due date/paid-or-due/receipt/notes ≤1000, version; internal note ≤2000 | `save` → PATCH property-hub | Owner/admin ledger, admin notes → properties ledger/history/notes | Saved/refetch or conflict/error. PASS browser ledger/member view/admin note isolation; request privacy regression |
| `/add-tenant/:id`; `features/services/AddTenant.tsx` | Names/email/phone/verified UID search; lease/rent/due/deposit/escalation/income/employment/spouse/notes; required identity, max50, active duplicate rejected | `handleSubmit`, phone search → GET users/search; POST tenants | Owner/admin → tenants/embedded property/user rental hints | Added/view mode or field/API errors. PASS browser assignment, atomic sync, IDOR/duplicate/concurrent/inactivation; all spouse/multitenant branches BLOCKED |
| `/renew-agreement/:id`; `RenewAgreement.tsx` → `AgreementWorkflow.tsx` | Prefilled rent/deposit/due/period/dates/notice/lock-in/escalation/furnishing/payer; dates/rent/day validated | `submit` → POST agreements/request-renewal or agreements/renew | Tenant request/owner approve-reject → property request/history/tenants | Pending/decision/history, current terms retained until approval; error/conflict. PASS browser/API |
| `/terminate-agreement/:id`; `TerminateAgreement.tsx` → `AgreementWorkflow.tsx` | Notice/start/end/request ID, explicit owner final confirmation | `submit` → POST agreements/request-termination or agreements/terminate | Tenant request/owner notice-reject-finalize → properties/inactive tenants/history | Pending/notice/finalized/error. PASS browser rejection/notice/finalization/history and API permissions |
| `/request-services/:id`, `/legal-services/:id`, `/other-services/:id`; wrappers → `ServiceRequestWorkflow.tsx` | Required service category/comment, optional image | `submit`, readFile → GET services; POST service-requests | Property member → service_requests/notifications/R2 | Refresh history or inline error. PASS browser three request groups/tenant response; API catalog/membership |
| Admin request resolution; `ServiceRequestHistory` in same file | Status, resolution report/comment/image/archive | save → PUT service-requests/:id, POST upload/service-request-image | Admin → requests/history/mail | Refetch/inline failure. PASS browser admin resolution/archive and tenant history/API states |
| `/attach-documents/:id`; `AttachDocuments.tsx` | Name/type/file/description; TDS year/period/amount or receipt date; browser image/PDF ≤5MiB, API body bounded; admin status/comment | submit/read/delete/status → POST documents, GET documents/property/:id, PATCH/DELETE documents/:id | Member upload/read, uploader-owner-admin delete, admin verify → documents/R2 | Reset/list/refetch or error. PASS browser docs/receipt/TDS/delete and API scope/size/status; FAIL public URL design; live policy BLOCKED |
| `/inspection-report/:id`; `InspectionReport.tsx`, `InspectionReportList.tsx` | Required possession/handover/report text; letters/keys/meters/bills/receipts/apartment images/other details | handleSubmit → POST inspection-reports; GET property/user report history | Member → inspection_reports/notifications | Reset/history/success or validation/toast. PASS browser text and API attachments/permissions/blank rejection; real attachment/privacy BLOCKED |
| `/review/:id`; `Review.tsx`, `ReviewHistory.tsx` | Auto relationship; six owner/tenant text responses, ≥1 nonblank | handleSubmit → POST reviews, GET reviews?propertyId | Matching member → reviews/notifications | Management/history or validation/error. PASS browser valid/history/empty rejection and API identity |
| `/visit-planner`; `VisitPlanner.tsx` | Required title/date/time, details/email reminder lead; ISO date/status enum/reminder0–10080; mobile rejected | submit/status/cancel/delete → POST/GET visits, PUT/DELETE visits/:id | Requester/admin; private property membership → visits/notifications/mail | Schedule/reset/refetch/error. PASS API CRUD/reminder/roles and browser date picker/schedule/refresh |
| `/admin`; `AdminAgentsTab.tsx`, `AdminUserDetailsDialog.tsx` | Agent toggle/user details | changeRole → PATCH users/:uid, GET users | Admin → users | Refetch/toast error. PASS browser role change/server self-promotion rejection; no user-delete UI |
| `/admin`; `AdminPropertiesTab.tsx`, `AdminPropertyDetailsDialog.tsx` | Full property/docs/inspection detail/navigation | View handlers → GET properties?admin=true, properties/:id/linked records | Admin → collection reads | Dialog/error. PASS browser all-properties/detail; listing approve/reject NOT IMPLEMENTED |
| `/admin`; `OwnerVerification.tsx` | Existing owner UID, same-property evidence document ID, review note, independent confirmation | Inline submit → POST owner-verification | Admin; verified active candidate, not active tenant → ownership audit + tenants | Linked/cache invalidation or inline conflict/error. PASS browser link/tenant preserved, API wrong evidence/unverified/tenant/relink; rejection NOT IMPLEMENTED |
| `/admin`; `AdminServiceRequestsTab.tsx`, `AdminArchiveTab.tsx` | Legacy notification remarks/image/archive/unarchive/delete | Portal handlers → PUT notifications/:id/remarks, :id/read; DELETE :id; upload/image | Admin → admin_notifications/history/mail | Refetch/toasts. PASS API auth/history/enrichment; every legacy notification browser action BLOCKED |
| `/admin`; `AdminSiteSettingsTab.tsx` | Quote/title/subtitle/announcement toggle/text/banner add/remove | update/upload/remove → PUT admin/site-settings; POST upload/image | Admin → siteSettings/main_settings/R2 banners | Settings toast/refetch/refresh/public output or error. PASS browser text persistence/public API and server role; live banners/all network branches BLOCKED |
| Global footer; `SiteFooter.tsx` | Newsletter email/Subscribe, social icons, scroll-to-top | Newsletter no handler/API; scroll handler exists | No subscription destination | NOT IMPLEMENTED subscription/social URLs; PASS explicit unavailable controls. Business contact accuracy BLOCKED |

## Commands executed and actual outcomes

Logs are under `functional-audit/`. Failures are retained or described here; subsequent passes do not erase baseline failures. Diagnostic source reads/searches are not functional tests. PowerShell may format Node stderr warnings as NativeCommandError even when exit=0; results below use actual process exit and assertions.

| Command / run | Actual outcome | Log |
| --- | --- | --- |
| `npm run typecheck` baseline and post-fix | PASS exit0, no errors | typecheck.log; typecheck-final.log; typecheck-release-check.log |
| `npm run lint` baseline and post-fix | PASS exit0, 81 warnings/0 errors | lint.log; lint-verified.log; lint-release-check.log |
| `npm run build` baseline and final | PASS exit0, optimized compile/types/static generation | build.log; build-final.log; build-release-check.log |
| `npm run test:server` baseline and post-fix | PASS exit0, 51 tests:46 pass,5 BLOCKED skips | test-server.log; test-server-final.log |
| `npm run audit:api` baseline | FAIL exit1 on unnormalized negotiation URL | audit-api.log |
| Same command intermediate repairs | FAIL unresolved nested encodeURIComponent/base identifier; then false crossed conditional method/path pairs; repaired resolver | Terminal diagnostics; audit-api-repair.log contains eventual successful repair output |
| `npm run audit:api` repaired/final | PASS exit0, 102 expanded caller operations,64 normalized source operations,63 active operations/55 method-paths, no missing active methods;1 unused operation | audit-api-final.log; migration-audit/API_INVENTORY.md |
| `npm run test:group2-routing` | PASS exit0,3 Playwright tests,23-route preflight/HEAD and anonymous rejection/validation | group2-routing.log |
| `npm run test:native-routing` baseline and final builds | PASS exit0,64 caller operations +63 trailing-slash operations;68×200,58×401,1×404 | native-routing.log; native-routing-final.log; native-routing-release-check.log |
| `node --test tests/client-backend.test.cjs tests/security-workflows.test.cjs tests/property-product.test.cjs tests/owner-verification.test.cjs tests/negotiations-reminders.test.cjs` | PASS exit0,43 tests | additional-node.log |
| `node --test tests/functional-audit.test.cjs` before fixes | FAIL exit1:2 reproduced property bugs,1 pass | regressions-before.log |
| Focused functional-audit + negotiations Node run | First FAIL on VM cross-realm array assertion; corrected test compares persisted length and serialized read; then PASS exit0,12 tests at that stage | regressions-after.log contains successful rerun |
| `npm run test:functional` first combined | FAIL exit1:93 pass,1 fail,5 skips; obsolete expected gallery retention assertion updated | all-node-final.log |
| Same after correcting expectation | PASS exit0:94 pass,5 BLOCKED skips | all-node-final-rerun.log |
| Same after enquiry validation | FAIL exit1:old email assertion expected invalid literal date/time; fixture assertion changed to actual valid date/time | all-node-complete.log |
| Same after fixture correction | PASS exit0:95 pass,5 BLOCKED skips | all-node-verified.log |
| Same after empty review/report regression | PASS exit0:101 tests,96 pass,0 fail,5 BLOCKED skips | node-final.log |
| Same after peer phone privacy regression | PASS exit0:102 tests,97 pass,0 fail,5 BLOCKED skips | node-release-check.log |
| `npx playwright test --config playwright.acceptance.config.ts` initial/final | PASS exit0,28 tests each:browser workflows and desktop/mobile functional usability | playwright-acceptance.log; playwright-acceptance-final.log |
| `npx playwright test --config playwright.audit.config.ts` baseline | FAIL exit1:3 fail,6 pass,1 BLOCKED skip. Real stale search failure; new test incorrectly assumed sell public and category combobox | playwright-audit-baseline.log |
| Same after fixes | PASS exit0:10 pass,1 BLOCKED skip at that stage | playwright-audit-after.log |
| Audit grep admin settings/visit picker | FAIL exit1:settings pass; new visit test incorrect day-cell selector | playwright-admin-visits.log |
| Audit grep settings/visit/owner verification/broker | FAIL exit1:3 pass; visit test ambiguous time selector; corrected explicit quick-time choice | playwright-extra-final.log |
| Expanded full audit config | PASS exit0:14 pass,1 BLOCKED legacy parity skip | playwright-audit-final.log |
| Audit grep empty review | PASS exit0:1 test (added after expanded full run) | playwright-empty-review.log |
| Acceptance grep owner assigns a platform tenant | PASS exit0:1 test after phone-result minimization | playwright-lookup-regression.log |
| `node scripts/audit-environment.cjs` initial attempt | FAIL missing compiled dotenv module; replaced with installed @next/env | Terminal diagnostic, no secret values printed |
| Same corrected | PASS exit0:presence/project checks; absent prerequisites recorded | environment.log; environment-status.json |
| `node scripts/audit-providers-readonly.cjs` | PASS exit0:Auth authenticated synthetic lookup,R2 signed HEAD404,Resend domain-list200; zero mutations/emails | provider-readonly.log; provider-readonly.json |
| `node scripts/audit-project.cjs` | PASS exit0:249 modules,34 pages,45 API files,27 input modules,18 forms | source-inventory.log |
| `git diff --check` | Initial FAIL newly moved search trailing whitespace; corrected; final PASS exit0 | Terminal; diff-check-final.log |

The 5 skipped Node assertions need original `tests/go-reference` source. Browser parity needs a running preserved Vite frontend and LEGACY_ORIGIN. Both are BLOCKED. No visual parity pass is claimed. Color warnings and occasional caret-style hydration diagnostics from the browser environment are retained; assertions were not suppressed.

Testing setup: `test:functional` runs every isolated Node suite. Original acceptance config runs28 workflow/usability tests. Audit config adds public/role/regression tests, route tests and optional parity. Browser harness uses Chrome/loopback18080 plus isolated API18081, intercepts Firebase identity transport and seeds synthetic IndexedDB sessions. Its database/R2/email adapters are test-only and not imported by production. Native routing uses built server18090 and real public reads; mutation requests deliberately omit identity. These are distinct evidence scopes.

No live R2 PutObject/DeleteObject or email verification harness was executed. Those existing scripts require opt-in and would mutate/send. Read-only probe transport completed without data/customer effects.

## All page routes

Status means browser rendering or expected guest redirect, not every form branch or live persistence. Protected routes also received representative role tests above. Dynamic IDs used isolated fixtures.

| Route | Entry file | Access / redirect | Status |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | Public | PASS render/guard |
| `/about` | `src/app/about/page.tsx` | Public | PASS render/guard |
| `/add-property` | `src/app/(protected)/add-property/page.tsx` | Firebase user | PASS render/guard |
| `/add-tenant/[propertyId]` | `src/app/(protected)/add-tenant/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/admin` | `src/app/admin/page.tsx` | Persisted admin role | PASS render/guard |
| `/archived-properties` | `src/app/(protected)/archived-properties/page.tsx` | Firebase user | PASS render/guard |
| `/attach-documents/[propertyId]` | `src/app/(protected)/attach-documents/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/auth` | `src/app/auth/page.tsx` | Public | PASS render/guard |
| `/blog` | `src/app/blog/page.tsx` | Public | PASS render/guard |
| `/buy` | `src/app/buy/page.tsx` | Public ? /properties?type=buy | PASS render/guard |
| `/contact` | `src/app/contact/page.tsx` | Public | PASS render/guard |
| `/edit-property/[propertyId]` | `src/app/(protected)/edit-property/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/faq` | `src/app/faq/page.tsx` | Public | PASS render/guard |
| `/inspection-report/[propertyId]` | `src/app/(protected)/inspection-report/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/legal-services/[propertyId]` | `src/app/(protected)/legal-services/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/manage-property` | `src/app/(protected)/manage-property/page.tsx` | Firebase user | PASS render/guard |
| `/manage-property/[propertyId]` | `src/app/(protected)/manage-property/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/other-services/[propertyId]` | `src/app/(protected)/other-services/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/privacy` | `src/app/privacy/page.tsx` | Public | PASS render/guard |
| `/properties` | `src/app/properties/page.tsx` | Public | PASS render/guard |
| `/property/[propertyId]` | `src/app/property/[propertyId]/page.tsx` | Public | PASS render/guard |
| `/renew-agreement/[propertyId]` | `src/app/(protected)/renew-agreement/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/rent` | `src/app/rent/page.tsx` | Public ? /properties?type=rent | PASS render/guard |
| `/request-services/[propertyId]` | `src/app/(protected)/request-services/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/review/[propertyId]` | `src/app/(protected)/review/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/search` | `src/app/search/page.tsx` | Public | PASS render/guard |
| `/select-property-type` | `src/app/(protected)/select-property-type/page.tsx` | Firebase user | PASS render/guard |
| `/sell` | `src/app/sell/page.tsx` | Redirect to protected intake ? /select-property-type | PASS render/guard |
| `/services` | `src/app/services/page.tsx` | Public | PASS render/guard |
| `/support` | `src/app/support/page.tsx` | Public | PASS render/guard |
| `/tenant-property` | `src/app/(protected)/tenant-property/page.tsx` | Firebase user | PASS render/guard |
| `/terminate-agreement/[propertyId]` | `src/app/(protected)/terminate-agreement/[propertyId]/page.tsx` | Firebase user | PASS render/guard |
| `/terms` | `src/app/terms/page.tsx` | Public | PASS render/guard |
| `/visit-planner` | `src/app/(protected)/visit-planner/page.tsx` | Firebase user | PASS render/guard |

## All API route files

Supported business methods below exclude OPTIONS/HEAD and explicit405 handlers. See the caller inventory for all source call sites and exported method/handler mappings. Route coverage alone is not proof of live mutation success. Services apply auth as described above. Unknown API paths return404. Nine old trailing-slash paths deliberately retain health-response compatibility, not successful business mutations.

| API path | File | Business methods | Service |
| --- | --- | --- | --- |
| `/api/admin/notifications` | `src/app/api/admin/notifications/route.ts` | GET, POST | notifications |
| `/api/admin/notifications/[id]/read` | `src/app/api/admin/notifications/[id]/read/route.ts` | PUT | notifications |
| `/api/admin/notifications/[id]/remarks` | `src/app/api/admin/notifications/[id]/remarks/route.ts` | PUT | notifications |
| `/api/admin/notifications/[id]` | `src/app/api/admin/notifications/[id]/route.ts` | DELETE | notifications |
| `/api/admin/site-settings` | `src/app/api/admin/site-settings/route.ts` | GET, PUT, PATCH | migration-remainder |
| `/api/agreements/renew` | `src/app/api/agreements/renew/route.ts` | POST | agreements |
| `/api/agreements/request-renewal` | `src/app/api/agreements/request-renewal/route.ts` | POST | agreements |
| `/api/agreements/request-termination` | `src/app/api/agreements/request-termination/route.ts` | POST | agreements |
| `/api/agreements/terminate` | `src/app/api/agreements/terminate/route.ts` | POST | agreements |
| `/api/auth/login` | `src/app/api/auth/login/route.ts` | POST | migration-remainder |
| `/api/auth/user` | `src/app/api/auth/user/route.ts` | POST | users |
| `/api/cron/reminders` | `src/app/api/cron/reminders/route.ts` | GET, POST | reminders |
| `/api/documents/property` | `src/app/api/documents/property/route.ts` | GET | documents |
| `/api/documents/property/[propertyId]` | `src/app/api/documents/property/[propertyId]/route.ts` | GET | documents |
| `/api/documents` | `src/app/api/documents/route.ts` | GET, POST | documents |
| `/api/documents/[id]` | `src/app/api/documents/[id]/route.ts` | GET, PATCH, DELETE | documents |
| `/api/files` | `src/app/api/files/route.ts` | DELETE | uploads |
| `/api/files/[...path]` | `src/app/api/files/[...path]/route.ts` | DELETE | uploads |
| `/api/inspection-reports/property/[propertyId]` | `src/app/api/inspection-reports/property/[propertyId]/route.ts` | GET | migration-remainder |
| `/api/inspection-reports` | `src/app/api/inspection-reports/route.ts` | POST | migration-remainder |
| `/api/inspection-reports/user/[userId]` | `src/app/api/inspection-reports/user/[userId]/route.ts` | GET | migration-remainder |
| `/api/negotiations` | `src/app/api/negotiations/route.ts` | GET, POST | negotiations |
| `/api/negotiations/[id]` | `src/app/api/negotiations/[id]/route.ts` | PATCH | negotiations |
| `/api/owner-verification` | `src/app/api/owner-verification/route.ts` | POST | owner-verification |
| `/api/properties` | `src/app/api/properties/route.ts` | GET, POST | properties |
| `/api/properties/search` | `src/app/api/properties/search/route.ts` | GET | properties |
| `/api/properties/tenant` | `src/app/api/properties/tenant/route.ts` | GET | properties |
| `/api/properties/[id]` | `src/app/api/properties/[id]/route.ts` | GET, PUT, PATCH | properties |
| `/api/property-hub` | `src/app/api/property-hub/route.ts` | GET, PATCH | property-hub |
| `/api/reviews` | `src/app/api/reviews/route.ts` | GET, POST | migration-remainder |
| `/api/service-requests` | `src/app/api/service-requests/route.ts` | GET, POST | migration-remainder |
| `/api/service-requests/[id]` | `src/app/api/service-requests/[id]/route.ts` | PUT | migration-remainder |
| `/api/services` | `src/app/api/services/route.ts` | GET | migration-remainder |
| `/api/tenants` | `src/app/api/tenants/route.ts` | GET, POST | tenants |
| `/api/tenants/[id]` | `src/app/api/tenants/[id]/route.ts` | GET, PUT, DELETE | tenants |
| `/api/upload/document` | `src/app/api/upload/document/route.ts` | POST | uploads |
| `/api/upload/image` | `src/app/api/upload/image/route.ts` | POST | uploads |
| `/api/upload/property-images` | `src/app/api/upload/property-images/route.ts` | POST | uploads |
| `/api/upload` | `src/app/api/upload/route.ts` | POST | uploads |
| `/api/upload/service-request-image` | `src/app/api/upload/service-request-image/route.ts` | POST | uploads |
| `/api/users` | `src/app/api/users/route.ts` | GET, POST | users |
| `/api/users/search` | `src/app/api/users/search/route.ts` | GET | users |
| `/api/users/[id]` | `src/app/api/users/[id]/route.ts` | GET, PUT, PATCH | users |
| `/api/visits` | `src/app/api/visits/route.ts` | GET, POST | visits |
| `/api/visits/[id]` | `src/app/api/visits/[id]/route.ts` | GET, PUT, DELETE | visits |
