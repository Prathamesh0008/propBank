# KNOWN ISSUES

> Current mobile policy: schema-2 legacy reservations supersede earlier all-conflicts-must-be-fixed activation requirements. Unique contacts are reserved; duplicate numbers are ownerless blocked claims; missing/invalid profiles are locked in mobile_number_registry_accounts. Historical users stay unchanged. Three private registry collections make 25 total source collections; no new API. [Current design, tests and controlled runbook](../MOBILE_LEGACY_RESERVATIONS.md).


> Implementation update (2026-11-06): K05 has a tested transaction-backed mobile registry implementation on `fix/mobile-number-uniqueness`, but production reconciliation/backfill/activation is pending. The historical statements below describe the audited starting commit. Current behavior, two new server-only collections (24 total), fail-closed rollout requirements and test limits supersede those mobile-specific statements: [Mobile uniqueness implementation and rollout](../MOBILE_NUMBER_UNIQUENESS.md).


> Source audit: 2026-11-06 (Asia/Calcutta). Branch `main`, commit `fa98b7e0e53d29053365be4c1a1b8230a313f686`. Static inspection only; no production database access, external service health checks, browser tests, migrations, push or deployment. ?Implemented? means a source-complete path with identifiable validation and authorization; it does not certify successful runtime operation. Historical reports are secondary evidence only.

## Evidence standard

Confirmed means an explicit source mismatch, missing invariant or operation ordering can be demonstrated statically. It does not mean a live incident occurred. Conditional risks/unknowns are separated below. Severity estimates prioritize confidentiality/account access, correctness and operating cost; they are not formal exploit assessments. Suggested solutions are proposals only; no fixes were implemented.

## Confirmed source findings

### K01. Verified email synchronization blocked by profile gate

- **Severity:** High
- **Description/evidence:** After Firebase completes a verified email change, the stored profile email differs. requireUser rejects completedProfile before readMyAccount can execute its intended verified-email synchronization. The onboarding POST may offer a recovery path, but the normal account GET synchronization cannot run in that state.
- **Source:** `src/lib/server/auth.ts:71`, `src/lib/server/services/account.ts:39`, `src/features/account/MyAccount.tsx:3`
- **Affected functionality:** Email change and protected account access
- **Suggested solution:** Use a narrowly scoped identity-only verified-email synchronization step before complete-profile enforcement; preserve previous-address notification and forbid arbitrary browser email writes.
- **Verification status:** Confirmed by static source inspection; not reproduced against a live service.

### K02. Owner verification label uses wrong terminal state

- **Severity:** Medium
- **Description/evidence:** AdminPropertiesTab checks ownershipVerification != approved; server writes verified. Tenant-origin properties remain presented as reported-owner records even after successful verification.
- **Source:** `src/features/admin/AdminPropertiesTab.tsx:34`, `src/lib/server/services/owner-verification.ts:51`
- **Affected functionality:** Admin property directory owner presentation
- **Suggested solution:** Use the canonical verified ownership state separately from approved listing moderation.
- **Verification status:** Confirmed by static source inspection; not reproduced against a live service.

### K03. Agent selector query disabled in enquiry tab

- **Severity:** Medium
- **Description/evidence:** AdminPortal enables useAllUsers only when activeTab is agents, but passes its result to EnquiryInbox in the enquiries tab. First access to enquiries without visiting agents can have no assignment candidates.
- **Source:** `src/features/admin/AdminPortal.tsx:41`, `src/features/admin/AdminPortal.tsx:433`
- **Affected functionality:** Admin enquiry broker assignment
- **Suggested solution:** Load a scoped active-agent query for both relevant tabs or fetch it directly in the assignment UI.
- **Verification status:** Confirmed by static source inspection; not reproduced against a live service.

### K04. Email delivery UI not wired to active portal

- **Severity:** Medium
- **Description/evidence:** AdminEmailDeliveries is defined but no active import/render elsewhere in src was found; enquiry error text directs admins to Email deliveries nevertheless.
- **Source:** `src/features/admin/AdminEmailDeliveries.tsx:9`, `src/features/enquiries/EnquiryInbox.tsx:22`
- **Affected functionality:** Delivery monitoring and manual retry discoverability
- **Suggested solution:** Wire the admin component to a protected tab/route; retain admin-only API.
- **Verification status:** Confirmed by static source inspection; not reproduced against a live service.

### K05. Mobile duplicate prevention is not atomic

- **Severity:** High
- **Description/evidence:** checkPhone queries phoneNumber before a create transaction that only reads users/{uid}. Different UID registrations can pass precheck together. updateUser missing-profile branch also saves without duplicate check.
- **Source:** `src/lib/server/services/users.ts:75`, `src/lib/server/services/users.ts:187`, `src/lib/server/services/users.ts:206`
- **Affected functionality:** Registration and duplicate-contact policy
- **Suggested solution:** Use canonical phone normalization and transactional unique-contact reservation if business requires uniqueness; distinguish unverified contact from verified identity.
- **Verification status:** Confirmed missing atomic invariant by static inspection; concurrency outcome not exercised.

### K06. Agent submissions dropped by owned-property hook

- **Severity:** Medium
- **Description/evidence:** Server ownerUID query merges submitted agent listings with userRole agent; useUserProperties only retains ownerUID=self in owned and userRole tenant in tenant. Separate-owner agent submissions can be dropped from that hook result.
- **Source:** `src/hooks/useProperties.ts:24`, `src/lib/server/services/properties.ts:91`
- **Affected functionality:** Consumers of useUserProperties
- **Suggested solution:** Return a submitted agent segment or preserve agent rows in permitted client directory, with appropriate actions.
- **Verification status:** Confirmed filtering behavior; impact on every screen requires UI verification because some screens fetch separately.

### K07. Email retry/outbox recovery depends on explicit invocation

- **Severity:** Medium
- **Description/evidence:** Outbox can remain pending if after registration/execution fails; no general scheduled outbox drain route was found. Retry API exists, but UI is not wired and some effects are caught after the business mutation.
- **Source:** `src/lib/server/services/transactional-email.ts:96`, `src/lib/server/services/property-effects.ts:24`
- **Affected functionality:** Business notification reliability
- **Suggested solution:** Add bounded authenticated drain/reconciliation and monitor pending/failed age; stage important intents atomically.
- **Verification status:** Confirmed recovery architecture gap; actual stranded deliveries unverified.

### K08. Supporting file count/size quota checked outside save transaction

- **Severity:** Medium
- **Description/evidence:** createDocument reads all property documents and computes 5-file/20-MiB budget, then separately calls saveMediaRecord. Concurrent requests can both pass.
- **Source:** `src/lib/server/services/documents.ts:55`, `src/lib/server/services/documents.ts:58`
- **Affected functionality:** Supporting document quotas
- **Suggested solution:** Maintain a transactionally reserved counter/aggregate or read/check the relevant quota set in the final transaction.
- **Verification status:** Confirmed missing atomic quota invariant; race not exercised.

### K09. Full scans and per-item reads remain

- **Severity:** Medium
- **Description/evidence:** Tenant discovery and hub scan properties; user search/dossiers scan users/properties; admin inbox fetches tracking per notification. Client caching reduces repeated requests but does not bound document reads.
- **Source:** `src/lib/server/services/properties.ts:62`, `src/lib/server/services/property-hub.ts:27`, `src/lib/server/services/enquiries.ts:37`, `src/lib/server/services/users.ts:101`
- **Affected functionality:** Firestore costs, latency, admin scale
- **Suggested solution:** Introduce scoped relationship indexes/queries, cursor pagination and batch retrieval; preserve legacy visibility with an explicit migration plan.
- **Verification status:** Confirmed by static source inspection; not reproduced against a live service.

### K10. Auth activity logging scans matching history for every event

- **Severity:** Low
- **Description/evidence:** recordAuthActivity queries all targetUID events then deletes entries beyond 100. Read cost occurs before retention trim.
- **Source:** `src/lib/server/services/auth-activity.ts:18`
- **Affected functionality:** Login/security activity storage
- **Suggested solution:** Use indexed ordering/limits and a bounded retention worker rather than full snapshots on every event.
- **Verification status:** Confirmed by static source inspection; not reproduced against a live service.

### K11. Public reset-activity endpoint can amplify operations

- **Severity:** Medium
- **Description/evidence:** password_reset_requested accepts unauthenticated email, looks up Firebase account and writes/trims history without application rate limiting. Generic response limits disclosure but not request cost/audit noise.
- **Source:** `src/lib/server/services/auth-activity.ts:35`
- **Affected functionality:** Auth API abuse and activity accuracy
- **Suggested solution:** Apply distributed limits and record trusted provider events distinctly from client assertions.
- **Verification status:** Confirmed absent local limiter; external edge/Firebase protections unknown.

### K12. Security event records are client assertions

- **Severity:** Low
- **Description/evidence:** Recent-authenticated self caller can POST password_changed/email_change_requested without server proof the Firebase operation occurred. UI invokes it after the operation, but direct clients can forge their own audit narrative.
- **Source:** `src/lib/server/services/account.ts:91`
- **Affected functionality:** Security history evidentiary quality
- **Suggested solution:** Label events client-reported or correlate with authoritative Auth metadata/provider events.
- **Verification status:** Confirmed trust boundary; does not grant another user access.

### K13. Legacy JSON parser accepts trailing content

- **Severity:** Low
- **Description/evidence:** readObject stops at first complete JSON value, explicitly preserving Go behavior; modern strict endpoints built on it may surprise clients/security tooling.
- **Source:** `src/lib/server/services/domain-contracts.ts:25`
- **Affected functionality:** API validation consistency
- **Suggested solution:** Define supported compatibility contract and adopt strict full-body JSON parsing for newly versioned APIs.
- **Verification status:** Confirmed by static source inspection; not reproduced against a live service.

### K14. Admin Auth/data state updates can partially commit

- **Severity:** Medium
- **Description/evidence:** updateUser changes Firebase disabled state before persisting Firestore profile; a later failure can leave state out of sync. Account profile rollback after Firebase display-name/photo failure restores only name/photo/time; other Firestore updates remain.
- **Source:** `src/lib/server/services/users.ts:232`, `src/lib/server/services/account.ts:77`
- **Affected functionality:** Account management consistency
- **Suggested solution:** Use durable change intent and reconciliation/compensation with explicit partial-success reporting.
- **Verification status:** Confirmed operation ordering; failure scenario not induced.

### K15. Optional concurrency tokens permit last-write-wins callers

- **Severity:** Low
- **Description/evidence:** Visit expectedVersion and relationship expectedVersion are optional. Some legacy updates have optional timestamp guards. Transactions prevent torn writes but do not require callers to acknowledge intervening changes.
- **Source:** `src/lib/server/services/visits.ts:129`, `src/lib/server/services/relationship-links.ts:308`
- **Affected functionality:** Concurrent operations
- **Suggested solution:** Require version tokens consistently for state-changing user decisions; preserve deliberate idempotent retries.
- **Verification status:** Confirmed optional checks; harmful concurrent outcome needs verification.

### K19. Cron continuation and narrow reminder windows require scheduler design

- **Severity:** Medium
- **Description/evidence:** Property worker returns nextCursor at 20 event attempts or 250 properties; visit worker caps 1000 upcoming and 20 due visits. No checked-in scheduler follows cursors. Late execution after visit time skips visit reminder.
- **Source:** `src/lib/server/services/reminders.ts:160`, `src/lib/server/services/reminders.ts:42`, `src/lib/server/services/reminders.ts:25`
- **Affected functionality:** Reminder completeness
- **Suggested solution:** Deploy frequent authenticated scheduler that exhausts property cursors, observes limited/reconciliation flags and budgets execution.
- **Verification status:** Confirmed bounded behavior; actual schedule/backlog unknown.

### K22. Self administrator mutation guard differs by endpoint

- **Severity:** Medium
- **Description/evidence:** createUser blocks an administrator changing their own role/status, but updateUser used by PUT/PATCH users/[id] has no equivalent check. Direct clients can self-demote or self-disable an admin despite the guarded POST path. This is a policy inconsistency and lockout risk, not a nonadmin privilege escalation.
- **Source:** `src/lib/server/services/users.ts:173` (POST guard); `src/lib/server/services/users.ts:199` (updateUser); `src/lib/server/services/users.ts:231` (role/status mutation).
- **Affected functionality:** Administrator account lifecycle.
- **Suggested solution:** Apply consistent self-role/status policy to every mutation path; protect last-admin invariant if required.
- **Verification status:** Confirmed source guard discrepancy; no account was changed.

### K23. Combined sale/rent listings cannot receive offers

- **Severity:** Medium
- **Description/evidence:** publicListing accepts sell_rent and public listing views normalize it for browsing, but createNegotiation explicitly requires stored listingType rent or sell. A combined listing can be public while offer creation returns Available property not found.
- **Source:** `src/lib/listing-policy.ts:8`; `src/lib/server/services/negotiations.ts:95`.
- **Affected functionality:** Offers on combined sale/rent listings.
- **Suggested solution:** Define explicit intended offer type and asking-price selection for combined listings, then accept the supported intent consistently in server/UI.
- **Verification status:** Confirmed incompatible static eligibility predicates; no live offer submitted.

## Conditional risks and external unknowns

### K16. Historical public URLs cannot be revoked by projection

- **Severity:** Medium
- **Description/evidence:** Private legacy references are wrapped in authenticated proxy URLs, but anyone retaining original public URL may still use provider access. Legacy deletion creates approval_required cleanup intent rather than removing the external object.
- **Source:** `src/lib/server/file-projection.ts:36`, `src/lib/server/services/documents.ts:96`
- **Affected functionality:** Legacy document confidentiality
- **Suggested solution:** Audit provider ACLs/URLs and execute separately authorized migration/revocation; do not delete guessed keys.
- **Verification status:** Conditional risk; original object ACL/public access unverified.

### K17. Deployed database rules/IAM/indexes absent from repository

- **Severity:** Medium
- **Description/evidence:** No Firestore/Storage rules, index manifest or deployment integration workflow found. Admin SDK bypasses rules. Repository alone cannot establish that direct client data access is blocked.
- **Source:** `src/lib/server/firebase-admin.ts:45`
- **Affected functionality:** External security boundaries and deploy reproducibility
- **Suggested solution:** Obtain deployed rules/IAM/index evidence and version controlled intended policy; test through emulators in authorized follow-up.
- **Verification status:** Unknown external configuration, not a proven exposed database.

### K18. Hosting request/runtime constraints may reject supported app uploads

- **Severity:** Medium
- **Description/evidence:** App allows 20-MiB files/21-MiB multipart and buffers data on upload/download; actual Vercel/other platform limits and memory/runtime settings were not available. Cron requests may do sequential provider calls.
- **Source:** `src/lib/server/services/uploads.ts:46`, `src/lib/server/services/media.ts:19`, `src/app/api/cron/reminders/route.ts:4`
- **Affected functionality:** Uploads, media delivery, reminder execution
- **Suggested solution:** Verify deployed body/memory/time limits; use authorized direct/private signed upload design or streaming if needed.
- **Verification status:** Conditional deployment risk; no current platform limits were asserted or tested.

### K20. Dependency and type-maintenance risks

- **Severity:** Low
- **Description/evidence:** npm legacy-peer-deps is enabled; React 19 and legacy UI library ranges need compatibility review. Generated Go contracts can drift from native additions; several domain components/services retain any/dynamic records. No current vulnerability audit was performed.
- **Source:** `.npmrc:1`, `src/lib/server/services/go-contracts.ts:1`, `src/hooks/useProperties.ts:19`
- **Affected functionality:** Dependency updates and schema maintenance
- **Suggested solution:** Pin/review lockfile changes, validate peer compatibility, maintain explicit native schema tests and obtain a separately scoped dependency audit.
- **Verification status:** Potential maintenance risk; no CVE or incompatible package claimed.

### K21. Tracked production environment file requires controlled review

- **Severity:** Medium
- **Description/evidence:** git ls-files confirms .env.production is tracked while .gitignore mainly covers local variants. Its values were not copied or treated as safe. Presence alone does not establish credential exposure.
- **Source:** `.gitignore:22`
- **Affected functionality:** Secret handling and build-time configuration
- **Suggested solution:** Review names/value sensitivity and git history privately; remove sensitive tracked config and rotate only if exposure is confirmed.
- **Verification status:** Tracked-file presence confirmed; secret exposure not asserted.

## Additional limitations and non-findings

No browser tests, extensive suites, production data queries, live email/R2 calls, dependency vulnerability checks or exploit attempts were performed. Test files frequently transpile source with mocked dependencies or assert source contracts; their presence is not runtime acceptance evidence. Existing audit reports may refer to older commits. No blanket claim is made that all legacy UI components are dead: AdminEmailDeliveries is the specific unwired component identified. No owner/tenant/broker account roles should be added based on UI labels. No payment gateway, SMS sender, e-signature or dynamic CMS was found.
