# PropBank Development Testing Guide

This workflow uses local Firebase Auth and Firestore emulators only. It must never use a real Firebase project or customer data.

## Prerequisites

- Node.js and the repository dependencies.
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

The seed/cleanup script refuses non-local emulator hosts, refuses project IDs that do not begin with `demo-` or `test-`, and refuses to run without `PROPBANK_TEST_PASSWORD`. It communicates directly with the configured emulator endpoints, so it cannot silently fall back to Firebase production APIs.

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

## Disable external delivery

Before starting the application for local tests, remove delivery credentials from that terminal:

```powershell
Remove-Item Env:RESEND_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:FROM_EMAIL -ErrorAction SilentlyContinue
Remove-Item Env:TWILIO_ACCOUNT_SID -ErrorAction SilentlyContinue
Remove-Item Env:TWILIO_AUTH_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:TWILIO_PHONE_NUMBER -ErrorAction SilentlyContinue
```

Do not load `.env.local` or `.env.production` into an emulator test shell if either contains live delivery credentials. Focused Node tests use isolated transports or missing-provider behavior; they must never call Resend, SMS providers, or production cron endpoints.

## Run focused checks

Run only the checks relevant to the feature under development. Authentication checks are:

```powershell
npm run typecheck
npm run test:auth
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
2. Add `testDataTag: $env:PROPBANK_TEST_PREFIX` to every generated Firestore record.
3. Use only accounts derived from that prefix and `@example.invalid` addresses.
4. Use a password supplied at runtime, never a committed default.
5. Keep emulator hosts on loopback and the project ID under `demo-` or `test-`.
6. Stub or disable email, SMS, storage, payment, and other external delivery systems.
7. Add a focused Node test command rather than expanding a single all-feature run.
8. Clean up only records and accounts matching the exact prefix; never perform collection-wide deletion.
9. Verify cleanup with an unrelated sentinel record when the cleanup implementation changes.

Google OAuth consent and real verification-email delivery are not fully represented by this workflow. Test them only with an explicitly isolated Firebase environment and controlled test identities; do not claim emulator coverage for those provider-managed flows.

## Reusable user and administrator accounts

The two stable development accounts use `.env.test-accounts.local`, which is covered by `.gitignore`. Set local emulator hosts, a `demo-`/`test-` project, a unique fixture tag, and both account email/password pairs in that file. Never commit or copy its password values into reports.

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
