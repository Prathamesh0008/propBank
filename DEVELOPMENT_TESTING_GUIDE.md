# PropBank Development Testing Guide

Routine development uses the shared real Firebase development project **propbanktest**. For a second Windows laptop, follow [TWO_DEVELOPER_SETUP.md](TWO_DEVELOPER_SETUP.md); do not create a second project or copy production secrets. Optional emulator instructions follow below. Never use customer data.

## Dedicated Firebase development setup (Windows PowerShell)

1. Open https://console.firebase.google.com/ and select the existing **propbanktest** project on both laptops. Auth and Firestore share this development project. Do not create another project for developer two. The following Console steps describe how to verify the existing setup; project provisioning is already complete.
2. In **Project settings ? General ? Your apps**, register a **Web** app. Copy its `apiKey`, `authDomain`, `projectId`, `appId` and optional `messagingSenderId` into the dedicated local file below. Use the development project's own `<project-id>.firebaseapp.com` auth domain. Do not reuse the production web API key.
3. In **Build ? Authentication ? Get started ? Sign-in method**, enable **Email/Password** (password sign-in) and **Google**. For Google choose a project support email and save. Configure any OAuth consent/testing requirements shown by Google; add only developer test identities when the consent screen is in testing.
4. In **Authentication ? Settings ? Authorized domains ? Add domain**, add `localhost` (no scheme or port). New projects may omit it by default. Retain the development project's Firebase auth domain. Do not add localhost to production.
5. In **Authentication ? Templates**, review verification/reset templates. Use only test inboxes you control. Firebase Auth verification/reset email is sent by the development Auth project; it is separate from the captured Resend adapter. Never register a real customer's address. Verify email normally; no local bypass is added.
6. In **Build ? Firestore Database ? Create database**, choose Standard/native Firestore, database **`(default)`**, an appropriate region and **Production mode** rules. Leave direct client access denied; this app uses authorized server routes. The Admin SDK uses IAM and bypasses rules, so keep server authorization intact. Do not import production data or deploy rules to an existing project.
7. In the development project's **Project settings ? Service accounts ? Firebase Admin SDK ? Generate new private key**, generate a development-only JSON key. Store it outside the repository in a folder readable only by your Windows account. Verify `project_id` and the `client_email` suffix identify the development project. Never use a service account with production access; review its IAM permissions and remove cross-project grants. Use the minimum Auth administration and Firestore access needed by the app; don't grant Owner. Both SDKs use this one key. See [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).
8. Stop old Next processes from their original terminals. Keep `.env.local` unchanged; do not copy development values over production credentials. Create the separate file only if it does not exist:

```powershell
Set-Location 'C:\Users\Nova Tech\Desktop\propBank'
if (!(Test-Path -LiteralPath '.env.firebase-dev.local')) {
    Copy-Item -LiteralPath '.env.firebase-dev.example' -Destination '.env.firebase-dev.local'
}
notepad .env.firebase-dev.local
```

Keep every project ID as `propbanktest`, fill in its existing Web app values, and set both credential paths to the same development-only JSON key on your own laptop (forward slashes work on Windows). The file is gitignored. It uses literal dotenv values, not `$VARIABLE` interpolation. Required settings are `PROPBANK_FIREBASE_MODE=firebase`, `FIREBASE_DEV_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `FIREBASE_AUTH_PROJECT_ID`, `FIREBASE_DATA_PROJECT_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_AUTH_CREDENTIALS`, `FIREBASE_DATA_CREDENTIALS`, `FIRESTORE_DATABASE_ID=(default)`, and `APP_URL=http://localhost:8080`. Browser mode and expected development ID are derived by the launcher.

```powershell
Remove-Item Env:PROPBANK_FIREBASE_MODE -ErrorAction SilentlyContinue
npm run dev:check
npm run dev
```

Open http://localhost:8080. One terminal is enough. `npm run dev` always selects dedicated Firebase mode, even if the shell previously selected emulators. Missing configuration stops startup. The launcher ignores inherited Firebase/provider credentials, masks app variables from Next dotenv files, reads only the dedicated file, and rejects extra nonempty settings. It never loads production secrets into the child process. Do not add Resend, R2, ADC or legacy credentials to this file.

The banner must show `firebase`, your development project ID, `(default)`, development Firebase Auth, captured email, local filesystem storage mock, and localhost:8080. It contains no keys. Development builds use `.next-firebase-dev`; emulator builds use `.next-emulator`. An occupied port causes startup failure. Stop old servers and fully reload browser tabs after any environment change; this cannot revoke credentials already held by an old process. Existing Firebase app project mismatches require a restart/reload.

`dev:check` validates local configuration and parses the private key without contacting Firebase. To explicitly confirm the **development** Auth and database connection after setup:

```powershell
npm run dev:check -- --verify-connection
```

This command first validates the same isolated configuration, lists at most one Auth user, reads only `siteSettings/main_settings` in the development database, writes nothing and prints no identity data. It consumes a development read. The first laptop has already verified the `propbanktest` Auth/Firestore connection. Run this check independently on the second laptop. Complete a browser registration/sign-in to confirm the web API key/provider configuration too.

## Test accounts, fictional data and integrations

Create new accounts through the application using developer-controlled email addresses and new test passwords. Verify email, then complete the mandatory name, Indian mobile contact number and Individual/Agent role form. Google users also complete this form. The mobile field is a contact number, not a reason to copy customer identity data; use a team-controlled test number. Incomplete users remain locked to completion. Server role, verified-email, ownership and relationship checks stay enabled. An existing production login/session is invalid in the new Auth project.

For the first development administrator, first create and complete a test account, then explicitly update only that user's `users/{uid}.role` to `admin` in the **development** Firestore Console. Sign out and back in. Never grant admin via registration payloads or copy production identities. Subsequent changes use the existing admin workflow.

Use the existing app forms/contracts to create fictional residential, commercial and industrial properties, using owner and tenant accounts. Exercise editing, archive/restore, invitations, Pending Connections, owner verification, agreements and future drafts, rent schedules, document metadata/uploads, Visit Planner, services, reviews, approvals, enquiries and notifications. No parallel development data model or permission bypass is introduced. No real-project fixture writer is added; the existing seed/cleanup scripts continue to accept loopback `demo-` emulators only and reject real development and production projects.

Application email is captured in gitignored `.cache/firebase-dev-email/outbox.jsonl`. Inspect it locally; it can contain test addresses and links. The adapter never calls Resend and intentionally reports a configuration failure after capture, so durable `email_deliveries` records remain failed/retryable rather than falsely marked delivered. Existing retry limits apply. Reminder jobs that require a provider configuration report unavailable. Firebase Auth's own test verification/reset emails still go to your developer-controlled inbox.

Managed file Put/Get/Delete operations use a local filesystem mock under gitignored `.cache/firebase-dev-files/`, partitioned by development project. Existing authenticated media routes, relationship checks, document bindings and session cookies authorize access. No R2 credentials/client or network requests are used; non-mock buckets and unsupported operations fail explicitly. Legacy Firebase/GCS storage remains unavailable in this mode. Local files aren't shared between machines. Don't place real private documents in fixtures. This mock does not validate R2 networking, CORS or provider behavior.

Live Resend/R2 tests require the existing separate explicit authorization flags and independently reviewed isolated test resources/configuration. Ordinary development has no provider opt-in; do not enable them by inserting production credentials. Production deployment environment variables and live SDK behavior remain unchanged.

Sign out and switch between different test users to verify that profile/query caches and private-file session state reset. Do not reuse a stale browser tab from an old server. Confirm Auth users and fictional Firestore records appear in the new project's Console, and verify no production usage is attributable to this local process. Isolation does not stop other old processes, deployments or schedulers from using production quota.

Firebase references: [Google provider setup](https://firebase.google.com/docs/auth/web/google-signin), [localhost authorization](https://firebase.google.com/docs/auth/faq-and-troubleshooting), [Firestore setup](https://firebase.google.com/docs/firestore/quickstart-server).

## Optional emulator mode (Windows PowerShell)

`npm run dev:emulator` runs the existing emulator-only launcher. Neither edits `.env.local`. No local accounts file is required for the defaults. Stop old Next.js processes through their original terminals before restarting; already-running processes do not inherit new settings.

Terminal 1:

```powershell
Set-Location 'C:\Users\Nova Tech\Desktop\propBank'
npx firebase-tools emulators:start --only auth,firestore --project demo-propbank --config firebase.emulators.json
```

Terminal 2, from the project directory:

```powershell
$env:PROPBANK_FIREBASE_MODE = 'emulator'
npm run dev:check
npm run dev:emulator
```

Open `http://localhost:8080`. The startup summary must say `mode: emulator`, project `demo-propbank`, Firestore `127.0.0.1:8081`, Auth `127.0.0.1:9099`, database `(default)`, and external email/R2/legacy storage disabled. `dev:check` checks configuration and TCP availability, not database contents or the environment of an old server. It cannot identify the service behind an occupied port. If either service is unavailable, startup exits instead of launching Next.js or falling back to production. Later emulator shutdown causes local SDK failures, not production fallback.

Browser, Auth Admin and Data Admin must use the same `demo-` project in emulator mode. Missing, remote or inconsistent settings are rejected by the launcher and server. Direct `next dev` without a complete explicit development environment is blocked unless live access is explicitly enabled. The browser rejects missing/nonlocal emulator URLs; production builds reject emulator Auth settings. Emulator builds use `.next-emulator` to separate their cache from normal builds.

An optional gitignored `.env.test-accounts.local` can override emulator defaults. Use `.env.emulator.example` as a reference; do not overwrite an existing file. Only emulator/browser settings are read from that file by the app launcher. Shell settings take precedence; production project IDs or remote endpoints in that shell cause refusal. Use a fresh PowerShell terminal if necessary. Custom projects must match all project settings and the CLI `--project`; ports must match `firebase.emulators.json`. Never copy production data into fixtures.

## Prerequisites

- Node.js 22 or newer and the repository dependencies.
- Java 21 or newer available through `JAVA_HOME`/`PATH` for the Firestore emulator.
- Firebase CLI, invoked with `npx firebase-tools` if it is not installed globally.
- A development-only password supplied in the current terminal. Do not save it in source files, committed environment files, shell profiles, or command history shared with others.

The checked-in [`firebase.emulators.json`](firebase.emulators.json) binds Auth to `127.0.0.1:9099`, Firestore to `127.0.0.1:8081`, and the Emulator UI to `127.0.0.1:4001`. Change that local config and the corresponding host variables together if a port is unavailable.

## Start the isolated emulators

From the repository root, start only Auth and Firestore with a synthetic project ID:

```powershell
npx firebase-tools emulators:start --only auth,firestore --project demo-propbank --config firebase.emulators.json
```

Keep that terminal open. In a second PowerShell terminal, set the isolation variables:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081'
$env:FIREBASE_TEST_PROJECT_ID = 'demo-propbank'
$env:NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = 'http://127.0.0.1:9099'
$env:NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'demo-propbank'
$env:FIREBASE_AUTH_PROJECT_ID = 'demo-propbank'
$env:FIREBASE_DATA_PROJECT_ID = 'demo-propbank'
$env:PROPBANK_TEST_PASSWORD = Read-Host 'Temporary emulator password'
```

The seed/cleanup script requires local emulator hosts, a synthetic `demo-` project and `PROPBANK_TEST_PASSWORD`. It cannot silently fall back to production. Firebase recommends demo projects without live resources: see [Firestore emulator guidance](https://firebase.google.com/docs/emulator-suite/connect_firestore).

## Seed the five roles

Choose a unique uppercase prefix for the work being tested, then seed:

```powershell
$env:PROPBANK_TEST_PREFIX = 'PBDEV_AUTH_LOCAL_001'
npm run dev:auth:seed
```

The script creates emulator-only accounts named from the prefix for these scenarios:

- Administrator (`admin` persisted role)
- Owner (`individual` role with an owned-property relationship)
- Tenant (`individual` role with an active rental relationship)
- Buyer (`individual` role)
- Broker (`agent` persisted role)

It also creates a tagged property, tenancy, and enquiry fixture. Re-running the same prefix is idempotent for the fixture identities.

Account-completion requirements are unchanged: fixtures with empty/missing mobile numbers must complete the usual profile form with an emulator-only test mobile before accessing protected workflows. Fixture tags never grant authorization. Auth verification/reset links are printed locally by the emulator instead of delivered as real email.

## Disable external delivery

The launcher explicitly sets empty credentials in the Next.js child environment so `.env.local` cannot reintroduce live Resend, Twilio, R2, Google credentials or storage buckets. Simply removing shell variables is insufficient because Next.js reads env files afterward. Cron credentials are disabled and the launcher supplies a local app URL and invalid-domain administrator address. Server Resend, R2 and legacy Cloud Storage boundaries reject emulator operations even if credentials are accidentally present.

Email/storage operations therefore show configured-unavailable behavior in the manually running emulator app. Use isolated mocks to test uploads, downloads and provider delivery/failure behavior. No real mail or R2 writes are part of this workflow. Firebase verification/reset links remain emulator-local. Production providers retain their existing behavior.

## Run focused checks

Run only the checks relevant to the feature under development. Authentication checks are:

```powershell
npm run typecheck
node --test tests/firebase-environment.test.cjs tests/auth-phase.test.cjs tests/profile-completion-authorization.test.cjs tests/account-completion-shell.test.cjs
```

Other focused scripts already present in `package.json` may be run individually when their feature changes. Do not substitute `npm test`, because it invokes the complete functional suite. Browser and Playwright suites are outside this local workflow.

To exercise the application manually, start it from the same emulator-configured terminal with `npm run dev`. Sign in using the generated address pattern `<lowercase-prefix>-<role>@example.invalid` and the temporary password held in `PROPBANK_TEST_PASSWORD`.

For the reusable accounts stored in `.env.test-accounts.local`, start the application with `npm run dev:emulator`. This loads the emulator-only client and server project settings before Next.js reads the normal local environment. Stop any existing process on port 8080 first; environment changes do not affect a Next.js process that is already running.

## Inspect activity and relationships

Open the local Emulator UI at `http://127.0.0.1:4001` to inspect emulator records. Authentication/session events are stored in the emulator `auth_activity` collection. The authenticated Admin Portal user directory and user-detail view show the privacy-conscious activity history and owned/rented relationships through the real application services.

Never treat client-only sign-in events as an authoritative audit. The verification flow exercises the server session endpoint, which records the authoritative session activity.

## Clean up fixtures

Use the same prefix and password that created the fixtures:

```powershell
$env:PROPBANK_TEST_PREFIX = 'PBDEV_AUTH_LOCAL_001'
npm run dev:auth:cleanup
```

Cleanup removes only known fixture accounts and documents carrying that prefix/tag. It does not clear collections or delete untagged records. Stop the emulators with `Ctrl+C` after cleanup.

## Convention for future feature tests

Every feature test must:

1. Use a unique prefix such as `PBDEV_<FEATURE>_<DEVELOPER>_<RUN>`.
2. Add `testDataTag:$env:PROPBANK_TEST_PREFIX` to every generated Firestore record.
3. Use only accounts derived from that prefix and `@example.invalid` addresses.
4. Use a password supplied at runtime, never a committed default.
5. Keep emulator hosts on loopback and the project ID under `demo-`.
6. Stub or disable email, SMS, storage, payment, and other external delivery systems.
7. Add a focused Node test command rather than expanding a single all-feature run.
8. Clean up only records and accounts matching the exact prefix; never perform collection-wide deletion.
9. Verify cleanup with an unrelated sentinel record when the cleanup implementation changes.

Google OAuth consent and real verification-email delivery are not fully represented by this workflow. Test them only with an explicitly isolated Firebase environment and controlled test identities; do not claim emulator coverage for those provider-managed flows.

## Reusable user and administrator accounts

The two stable development accounts use `.env.test-accounts.local`, which is covered by `.gitignore`. Set local emulator hosts, a `demo-` project, a unique fixture tag, and both account email/password pairs in that file. Never commit or copy its passwords into reports. Keep project/ports consistent with the emulator CLI and complete missing mobile/profile fields through the normal flow.

```powershell
npm run dev:accounts:seed
npm run dev:accounts:cleanup
```

Seeding preserves existing emulator UIDs and unrelated fixture fields when the accounts already exist. It merges the trusted persisted roles and creates the tagged test property only when absent. Cleanup targets the exact fixture tag, both configured Auth identities, and their authentication activity records.

To retain emulator state across restarts, keep the export directory local and gitignored:

```powershell
npx firebase-tools emulators:start --only auth,firestore --project demo-propbank --config firebase.emulators.json --import .firebase-emulator-data --export-on-exit .firebase-emulator-data
```

On the first run, omit `--import .firebase-emulator-data` if the directory does not exist. Without import/export, Firebase emulator accounts are memory-local and must be reseeded after restart.

## Return to the normal environment safely

Stop Next.js and the emulators with `Ctrl+C` in their respective terminals. Close the fixture/emulator shells so their session-only environment variables and passwords are discarded. Open a fresh shell and reload the browser before switching projects; old Firebase sessions and already-running Node processes do not change environment automatically. `.env.local` was never rewritten, so no credential restoration is necessary.

Ordinary development remains `npm run dev` (emulators required). Production deployment continues to use its separate authorized environment with `npm run build` and `npm start`. Do not set emulator host or mode variables in deployment environments. Production still uses Auth `propbank-7601b` and Data `propbank-944fc`, with their separate existing credentials.

Only for explicitly authorized live diagnostics, in a separate fresh shell:

```powershell
npm run dev:live -- --allow-live-firebase
```

This enables real Firebase reads/writes and configured live email/storage providers. Stop it when diagnostics finish; do not use it as a routine development command. The flag is an intentional operational opt-in, not a substitute for permission to inspect or mutate production records. Setting `PROPBANK_FIREBASE_MODE=live` together with `PROPBANK_ALLOW_LIVE_FIREBASE=1` also bypasses the development block and must be treated as the same explicit authorization.

## Scripts outside routine emulator development

| Script | Required authorization / behavior |
|---|---|
| `check-migration-readonly.cjs` | `--allow-live-firebase`; reads configured Firestore settings and consumes reads even though read-only. |
| `storage-migration-inventory.cjs` | Existing `--live-readonly`; scans live configured Firestore in bounded pages. Without flag, instructions only. |
| `audit-providers-readonly.cjs` | `--live-providers`; contacts configured live Firebase Auth, R2 and Resend. |
| `test-native-routing.cjs` | `--allow-live-firebase` for public-read checks; `--compatibility-only` avoids those reads. Starts a built server, not the safe development launcher. |
| `verify-property-runtime.cjs` | Separate loopback demo/emulator server and blocked outbound email required; no production target allowed. |
| `auth-emulator-fixtures.cjs` | Loopback emulator hosts, `demo-` project, explicit seed/cleanup action and fixture credentials required. Never uses `.env.local`. |
| `verify-live-email.cjs`, notification live-test scripts | Existing explicit `--send-live` / `--approved-7` gates; real email operations, not routine emulator tests. |
| `verify-live-r2.cjs` | Existing `--live-one-file`; real R2 operations with isolated auth/database fixtures. |
| Static API/read inventories and focused `.test.cjs` files | Source parsing or isolated transports; no live database calls. |

These guards are not an operating-system network sandbox. A new direct Admin SDK script, a deliberately authorized live command, an old running server or externally deployed scheduler can still access production. No production quota reduction is claimed without actual monitoring.

## Controlled Resend opt-in on the recovered branch

Capture remains the default. See [LOCAL_EMAIL_TESTING.md](LOCAL_EMAIL_TESTING.md) and `.env.email-dev.example` for an optional separate `.env.email-dev.local` with exact-recipient resend-test authorization. Firebase stays on propbanktest, R2 stays local, and reminder runners remain disabled locally. Earlier capture-only descriptions above describe the default, not this explicit test opt-in.
