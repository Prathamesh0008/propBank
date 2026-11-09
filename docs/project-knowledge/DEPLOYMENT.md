# DEPLOYMENT

> Source audit: 2026-11-06 (Asia/Calcutta). Branch `main`, commit `fa98b7e0e53d29053365be4c1a1b8230a313f686`. Static inspection only; no production database access, external service health checks, browser tests, migrations, push or deployment. ?Implemented? means a source-complete path with identifiable validation and authorization; it does not certify successful runtime operation. Historical reports are secondary evidence only.

## Local setup (instructions only, not executed during audit)

Use the lockfile with npm and a compatible Node runtime: installed Next package declares Node >=20.9.0. Repository package.json does not pin an engines field or a production runtime version. `.npmrc` sets legacy-peer-deps=true, so installations intentionally bypass peer-dependency enforcement.

1. Install dependencies with `npm ci` in the repository.
2. Populate an ignored local environment from `.env.example`, using approved development/emulator accounts. Do not copy production credentials into shared context.
3. For normal development, `npm run dev` listens on port 8080. It can use whatever backend environment is configured; it is not automatically production-isolated.
4. For isolation, start Firebase Auth/Firestore emulators with an installed Firebase CLI and a demo-/test- project, e.g. `firebase emulators:start --config firebase.emulators.json --project demo-propbank`. CLI/Java prerequisites are not bundled by package.json. Configure the ignored `.env.test-accounts.local` with matching NEXT_PUBLIC_FIREBASE_PROJECT_ID, FIREBASE_AUTH_PROJECT_ID, FIREBASE_DATA_PROJECT_ID and FIREBASE_TEST_PROJECT_ID; local emulator hosts must be loopback host:port. Then `npm run dev:emulator` uses the guarded launcher. Obtain fixture values privately; none are documented here.
5. `npm run build` -> next build; `npm start` -> next start --port 8080. No build/start was run for this audit. Build-time NEXT_PUBLIC variables are compiled into browser assets and must be set in each intended environment before building.

`firebase.emulators.json`: Auth 127.0.0.1:9099, Firestore 127.0.0.1:8081, UI 127.0.0.1:4001, singleProjectMode=true. `scripts/start-emulator-dev.cjs` requires local emulator hosts and matching test project, strips live Firebase credential envs, ADC path, Resend and obsolete Twilio envs before launching Next. It does not replace every external service configuration, so R2 behavior still requires conscious isolation. Fixture seed/cleanup scripts are mutating and were not run.

## Environment variable names

No values, account IDs, bucket names, keys, user identities or tokens are included. Requiredness is conditional on the subsystem being used; optional aliases and externally consumed SDK variables are distinguished in each row.

| Subsystem | Names | Meaning/requiredness |
| --- | --- | --- |
| Browser Firebase (build-time public configuration) | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser Auth initialization. These are public project configuration identifiers; never put Admin credentials in NEXT_PUBLIC variables. |
| Server Firebase Auth | `FIREBASE_AUTH_PROJECT_ID`, `FIREBASE_AUTH_CREDENTIALS` | Auth Admin project and service-account JSON or path. If credentials absent, uses application default credentials (ADC). Must match browser project. |
| Server Firestore/data and legacy storage | `FIREBASE_DATA_PROJECT_ID`, `FIREBASE_DATA_CREDENTIALS`, `FIREBASE_CREDENTIALS`, `FIREBASE_PROJECT_ID`, `FIREBASE_DATA_STORAGE_BUCKET`, `STORAGE_BUCKET`, `FIREBASE_STORAGE_BUCKET` | Explicit DATA variables preferred. Legacy aliases preserved. Data credentials never borrowed by Auth. Bucket required only for legacy Firebase Storage operations. |
| Cloudflare R2 | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_URL`, `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME` | Account/access/secret/legacy bucket required by R2 helper. Public URL optional fallback. Private bucket is additionally required for managed uploads and must differ from legacy bucket. |
| Email and links | `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `SUPPORT_EMAIL` | Resend HTTP API key, verified sender and configured admin recipient. APP_URL preferred over NEXT_PUBLIC_APP_URL for absolute action links; invitation templates validate public origin. SUPPORT_EMAIL falls back to sender. FROM_EMAIL has a source default but reminders explicitly require it configured. |
| Scheduler, ingress and diagnostics | `CRON_SECRET`, `ENQUIRY_TRUSTED_IP_HEADER`, `PROPBANK_READ_METRICS` | Cron secret minimum 32 characters; ingress header optional and only safe behind trusted header stripping; read metric flag 1 enables estimates. |
| Local/test/runtime controls | `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_TEST_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `PROPBANK_TEST_DIST_DIR`, `PROPBANK_DEV_PORT`, `PROPBANK_DEV_WEBPACK`, `NODE_ENV` | Emulator SDK/launcher controls and ADC/runtime settings. Runtime-provided NODE_ENV is not an application secret. Launcher uses isolated test project and strips live credentials/email settings. |

Additional test/live verification scripts consume private fixture selectors and account credentials. They are tooling inputs, not application runtime requirements; discover names directly from the selected script before an explicitly authorized test. The launcher explicitly removes PROPBANK_TEST_USER_EMAIL/PROPBANK_TEST_USER_PASSWORD/PROPBANK_TEST_ADMIN_EMAIL/PROPBANK_TEST_ADMIN_PASSWORD from its child environment. No fixture values belong in shared docs.

## Firebase provisioning boundaries

`src/lib/server/firebase-admin.ts` initializes named propbank-auth and propbank-data apps lazily. Auth project prefers FIREBASE_AUTH_PROJECT_ID then browser project then a source fallback. Data project prefers FIREBASE_DATA_PROJECT_ID then FIREBASE_PROJECT_ID then a different source fallback. Configure explicitly to avoid unintended fallback selection. Credential parser accepts inline JSON or readable file path and rejects a service-account project mismatch. For credential-free ADC, the host needs properly scoped identity for each operation/project. Production IAM, enabled providers, domains, quotas, rules and indexes are unknown from repository inspection.

No Firestore/Storage rule or index manifest is checked in. Do not deploy permissive guessed rules or run data backfills based on this documentation. Obtain authorized deployed configuration and reconcile code query shapes in DATABASE_SCHEMA before changing policies.

## Storage and email provisioning

Managed files require a separate private R2 bucket, server credentials permitting exact-object put/get/delete, and authenticated media routing. Legacy bucket/public URL settings remain to resolve historical references. Do not make the private bucket publicly accessible. Actual R2 bucket ACLs, custom domain behavior, CORS and key scopes were not inspected. Server buffers media; host request/memory/time limits must be verified separately.

Resend uses server fetch to its emails API, 30-second abort timeout, optional Idempotency-Key and branded HTML/text. Configure approved FROM_EMAIL sender/domain DNS and ADMIN_EMAIL. APP_URL should be the canonical application HTTPS origin so invitations and notifications link to the correct environment. No DNS/provider dashboard delivery health was checked. Firebase verification/password reset messages are separate from the Resend business email infrastructure. Twilio variables stripped by the test launcher do not establish an implemented SMS integration.

## Hosting, branch and CI/CD

The repository can run as a Node.js Next deployment. Vercel is a plausible hosting target, but no vercel.json, checked-in .vercel project linkage or .github workflow was found in the active repository inventory. Actual host/project, GitHub App integration, linked repository, production domain, production branch, deployment IDs and preview/prod environment values are **unknown**. An installed connector is not evidence of a specific deployment. No external dashboards were accessed.

The audited local branch is `main`, commit `fa98b7e0e53d29053365be4c1a1b8230a313f686`. Do not infer that main is the configured production branch. Current commit subject was ?Restore PropBank stable version 04-11-2026?; that is historical commit metadata, not runtime health evidence.

`next.config.ts` sets LAN allowedDevOrigins, Turbopack root, optional PROPBANK_TEST_DIST_DIR and skipTrailingSlashRedirect=true for compatibility. There are no active external backend rewrites in this file. Read native wrapper behavior before changing slash redirects; some compatibility endpoints would otherwise loop or change contract.

## Scheduled work and recovery

An external scheduler must invoke GET or POST `/api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`. Calls write reminder state/send email; do not invoke during a read-only audit. Visit reminders query now to seven days ahead (cap 1000), select at most 20 due visits, use four concurrent workers and requester/admin delivery events with leases. A visit reminder is due only before the visit; late scheduling can miss it.

Property reminders scan active properties in 250-document ID pages and attempt at most 20 events per call, returning properties.nextCursor. The scheduler must continue with query propertyCursor until exhausted and observe limited/failed/needsReconciliation. Rent offsets are 7/1/0 calendar days; agreement expiry offsets 30/15/7; already-paid months and inactive/ended rentals are excluded. Timezone fallback is Asia/Kolkata. No documented cron frequency/deployed schedule exists in repo. Design frequency around visit windows and daily calendar reminders, host duration budgets and continuation retries.

There is no general automatic email outbox sweeper route. Pending/failed records can be retried through admin API, with still-current context checks and attempt/time safeguards. Storage reconciliation GET is a dry run; POST deletes only specifically selected eligible managed objects, uses a 24-hour grace rule unless cleanup state bypass applies, and must be separately authorized operational work. TTL fields on control docs require external Firestore TTL policies; actual policies are unknown.

## Scripts and tests inventory

Scripts are not all read-only despite audit/test naming. Read source and assert emulator isolation before execution. In particular firebase-fresh-start, fixtures, wiring scripts and live notification/storage verification can mutate files, identities, records, objects or send email. They were inspected/inventoried, not executed.

- `scripts/audit-active-api.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/audit-backend-current.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/audit-environment.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/audit-firestore-reads.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/audit-project.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/audit-providers-readonly.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/auth-emulator-fixtures.cjs` ? Seed/cleanup fixtures; mutates Auth/Firestore.
- `scripts/check-migration-readonly.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/firebase-fresh-start.cjs` ? Reset/setup utility; operational/destructive scope requires separate review.
- `scripts/run-business-notification-live-test.cjs` ? Business notification live exercise; mutating and sends mail.
- `scripts/run-final-notification-live-test.cjs` ? Live notification exercise; mutating and sends mail.
- `scripts/run-visit-notification-live-test.cjs` ? Live visit/notification exercise; mutating and sends mail.
- `scripts/start-emulator-dev.cjs` ? Guarded local-emulator Next launcher.
- `scripts/storage-migration-inventory.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/test-group2-routing.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/test-native-routing.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/verify-live-email.cjs` ? Live provider verification; may send email.
- `scripts/verify-live-r2.cjs` ? Live object verification; may write/delete objects.
- `scripts/verify-property-runtime.cjs` ? Audit/routing/runtime/migration investigation helper; inspect its flags, target environment and writes before use.
- `scripts/wire-migration-remainder.cjs` ? Legacy route wiring generator; modifies source.
- `scripts/wire-native-group2.cjs` ? Legacy route wiring generator; modifies source.

Test commands in package.json: `npm run lint`, `npm run typecheck`, `npm run test:server`, `npm run test:functional` (also npm test), `npm run test:auth`, `npm run test:storage`; routing audit scripts have separate commands. Numerous .test.cjs files use TypeScript transpilation/mocks/source assertions; .spec.ts suites use Playwright. Existing tests are not a certificate of complete integration coverage. **No tests, browser E2E or extensive suites were run during this documentation task.** Only static documentation consistency checks were run.

Test source inventory:

- `tests/acceptance.spec.ts`
- `tests/account-completion-shell.test.cjs`
- `tests/account-management.test.cjs`
- `tests/add-property-navigation.test.cjs`
- `tests/add-property-pricing.test.cjs`
- `tests/admin-property-directory.test.cjs`
- `tests/admin-property-operations.test.cjs`
- `tests/admin-property-order.test.cjs`
- `tests/agent-workflow.test.cjs`
- `tests/agreement-admin-notifications.test.cjs`
- `tests/amount-to-words.test.cjs`
- `tests/auth-phase.test.cjs`
- `tests/auth-profile-retry.test.cjs`
- `tests/automatic-data-refresh.test.cjs`
- `tests/brand-lock.spec.ts`
- `tests/brand-navigation.spec.ts`
- `tests/client-backend.test.cjs`
- `tests/client-workflows.spec.ts`
- `tests/demo-form-autofill.test.cjs`
- `tests/email-events-phase.test.cjs`
- `tests/email-sender.test.cjs`
- `tests/enquiry-assignment.test.cjs`
- `tests/firestore-read-budget.test.cjs`
- `tests/fixtures/acceptance-server.cjs`
- `tests/fixtures/browser-session.ts`
- `tests/fixtures/native-server.cjs`
- `tests/form-audit-phase-a.test.cjs`
- `tests/form-audit-phase-b.test.cjs`
- `tests/form-phase-c.test.cjs`
- `tests/functional-audit.spec.ts`
- `tests/functional-audit.test.cjs`
- `tests/group2-routing.spec.ts`
- `tests/homepage-hero-restore.test.cjs`
- `tests/listing-approval.test.cjs`
- `tests/migration-remainder.test.cjs`
- `tests/native-group1.test.cjs`
- `tests/native-group2.test.cjs`
- `tests/negotiations-reminders.test.cjs`
- `tests/next-agreement-draft.test.cjs`
- `tests/owner-verification.test.cjs`
- `tests/parity.spec.ts`
- `tests/pending-connections-ui.test.cjs`
- `tests/pending-connections.test.cjs`
- `tests/phase-2c.test.cjs`
- `tests/private-file-auth-lifecycle.test.cjs`
- `tests/private-file-session-api.test.cjs`
- `tests/private-file-session.test.cjs`
- `tests/profile-completion-authorization.test.cjs`
- `tests/property-admin-integrity.test.cjs`
- `tests/property-category-ui.test.cjs`
- `tests/property-category.test.cjs`
- `tests/property-enquiry-email.test.cjs`
- `tests/property-furnishing.test.cjs`
- `tests/property-product.test.cjs`
- `tests/property-runtime-repair.test.cjs`
- `tests/registration-mobile-ui.test.cjs`
- `tests/registration-mobile.test.cjs`
- `tests/relationship-invitation-email.test.cjs`
- `tests/relationship-links.test.cjs`
- `tests/reminder-phase.test.cjs`
- `tests/rent-schedule.test.cjs`
- `tests/residential-layout.test.cjs`
- `tests/routes.spec.ts`
- `tests/security-workflows.test.cjs`
- `tests/server-foundation.test.cjs`
- `tests/storage-security.spec.ts`
- `tests/storage-security.test.cjs`
- `tests/tenant-invitation-repair.test.cjs`
- `tests/tenant-supporting-documents.test.cjs`
- `tests/verified-email-relationships.test.cjs`
- `tests/visit-planner-repair.test.cjs`

## Release unknowns/risks to verify externally

Production branch/host/Node version; actual build result; environment bindings; provider availability and quotas; Auth provider/domain/one-account-per-email policy; deployed Firestore rules/indexes/TTL/IAM; R2 private ACLs and legacy object visibility; Resend DNS/sender acceptance/webhook policy; reminder cadence/cursor handling; request body and execution limits; monitoring/backups/retention; exact GitHub integration. No production readiness claim is made. Do not push/deploy these docs or change runtime settings without a separate user request.
