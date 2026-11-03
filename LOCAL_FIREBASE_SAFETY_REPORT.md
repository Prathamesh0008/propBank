# Dedicated Firebase development isolation ? 2026-11-03

## Implemented architecture

- Default `npm run dev`: `start-firebase-dev.cjs` reads only `.env.firebase-dev.local`, selects explicit `firebase` mode, and launches Next on localhost:8080. Missing configuration fails closed. `.env.local` is preserved. Environment values for app-owned Firebase/provider settings are masked before Next dotenv loading, including ADC and legacy aliases. Production credentials from the parent shell are discarded.
- Browser Auth and both Admin apps must target the configured `FIREBASE_DEV_PROJECT_ID`; both known production IDs are rejected. Both Admin services use the same explicit development service-account identity. Project ID, service-account email ownership, JSON shape and private-key parsing are checked before launch. Firestore is explicitly `(default)`. No ADC fallback is permitted for real development. Browser expected project/mode and existing initialized app configuration are checked too.
- Optional `dev:emulator` preserves the existing demo-project, loopback-address, credential stripping and port checks. No emulator implementation or fixture guard was removed. `dev:check` normally checks real-development configuration; setting shell `PROPBANK_FIREBASE_MODE=emulator` selects emulator preflight. `dev:live -- --allow-live-firebase` remains separate. Direct live local configuration requires both explicit live mode and the existing allow flag.
- Production defaults remain Auth `propbank-7601b`, data `propbank-944fc`; existing production credential fallback and SDK behavior are preserved. No production environment file, provider configuration, deployed resources or billing was changed.
- Resend delivery is replaced only in real-development mode with a local capture under `.cache/firebase-dev-email/`. It throws a clear configuration result after capture so the existing durable outbox records an undelivered failure rather than fabricated delivery success. Existing notification/outbox business logic and retry limits are unchanged. Firebase's own verification/password-reset emails remain functional in the development project and require developer-controlled inboxes.
- Managed file operations use `.cache/firebase-dev-files/` with project-partitioned hashed filenames, a dedicated mock bucket and buffered Put/Get/Delete support. The existing authenticated media routes and authorization checks still mediate access. Cached live R2 clients are never reused in this mode. Unsupported operations/non-mock buckets fail explicitly; no R2 request occurs. Legacy Firebase Storage is blocked. This does not claim to validate real provider integration.
- Existing verified-email, mandatory Indian mobile/profile completion, role/admin, ownership/tenancy, agreement and document authorization, session cookies, account-switch/logout cache isolation and read-budget logic were preserved.

## Files changed by this task

`.env.firebase-dev.example`, `.env.example`, `.gitignore`, `package.json`, `scripts/start-firebase-dev.cjs`, `src/lib/firebase-environment.cjs`, `src/lib/firebase-environment.d.cts`, `src/firebase.ts`, `src/lib/server/firebase-admin.ts`, `src/lib/server/r2.ts`, `src/lib/server/local-development-storage.ts`, `src/lib/server/services/media.ts`, `src/lib/server/services/resend.ts`, `tests/firebase-environment.test.cjs`, `DEVELOPMENT_TESTING_GUIDE.md`, `README.md`, and this report. All pre-existing uncommitted work was preserved. Existing `next.config.ts` already calls the shared policy and therefore receives the strengthened validation without another config edit.

## Configuration and manual setup

See `.env.firebase-dev.example` and the detailed Firebase Console/PowerShell instructions in `DEVELOPMENT_TESTING_GUIDE.md`. Required variables: `PROPBANK_FIREBASE_MODE=firebase`, `FIREBASE_DEV_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `FIREBASE_AUTH_PROJECT_ID`, `FIREBASE_DATA_PROJECT_ID`, `FIREBASE_PROJECT_ID`, both explicit `FIREBASE_AUTH_CREDENTIALS` / `FIREBASE_DATA_CREDENTIALS` (same development JSON file), `FIRESTORE_DATABASE_ID=(default)` and local `APP_URL`. Browser mode and expected project are derived by the launcher; sender ID is optional.

No development project ID or credentials were supplied. The project must still be created; enable Email/Password and Google, authorize localhost, create the default database, generate a development-only service account, configure the file, and create new fictional users/properties through existing app contracts. No customer identities/data should be copied. Optional connection verification is `npm run dev:check -- --verify-connection`: isolated development Auth listing of at most one user and one Firestore settings-document read, no writes. It has NOT been run. Browser registration/Google verification must also be checked after configuration. No real-project fixture writer was added; emulator fixture tools still reject real projects.

## Verification

- `npm run typecheck`: passed.
- `node --test tests/firebase-environment.test.cjs tests/auth-phase.test.cjs tests/profile-completion-authorization.test.cjs tests/account-completion-shell.test.cjs tests/private-file-session.test.cjs`: 64 passed, 0 failed. Includes production rejection, missing/mismatched configuration and identity, browser/Admin selection, default database, emulator and production compatibility, fixture refusal, dotenv rehydration prevention, local mail/storage isolation, verified email, profile/role checks and account-switch/logout session isolation.
- `tests/storage-security.test.cjs`: 24 passed, 2 existing failures: property base64 failure expects 502 but receives validation 400; missing-profile media session expects `ACCOUNT_PROFILE_REQUIRED` but receives `ACCOUNT_DISABLED` (still denied). Both reproduce when this task's media/R2/Resend modifications are removed from source in memory via a temporary preload; workspace files were not reverted and authorization was not weakened to satisfy old expectations.
- `npm run dev:check`: expected fail-closed result, `Configure a dedicated non-production FIREBASE_DEV_PROJECT_ID.` No server or live Firebase connection was started.
- `git diff --check`: passed (existing CRLF normalization notices only).
- No Playwright, browser E2E, full test suite, deployment, push, live Firebase access, fixtures, email delivery, R2 operation or billing change was performed. Actual emulator startup was not attempted; isolated configuration/socket/SDK tests pass.

## Limits

Offline configuration validation cannot prove that a web API key belongs to the intended project or that a key has sufficient IAM permissions. Use the development project's actual web app config and perform the documented connection/sign-in checks. Local guards cannot revoke credentials from old running processes or prevent independently written SDK tools from bypassing them. Stop old dev servers and reload tabs. Real provider integration needs separate explicit authorization and isolated test resources. No production quota improvement is asserted without monitoring.

---

# Historical emulator safety audit (superseded default workflow)

The following records the earlier emulator-only implementation; use the current architecture above and the updated development guide for ordinary startup.

# Local Firebase isolation — 2026-11-02

Routine `npm run dev` now requires the Auth and Firestore emulators. No environment credentials were replaced, no database migration/fixture writes were run, and no production Firebase login/read/write was attempted. Existing quota-audit changes and the pre-existing `next-env.d.ts` modification were preserved.

## Why local development consumed production reads

Previously `npm run dev` directly executed `next dev`. Next loaded `.env.local`, which selects data project `propbank-944fc` and contains provider credentials but no Firestore/Auth emulator host overrides. The Admin Firestore getter therefore used the real `(default)` database. Normal navigation, public listings, login/profile checks, admin screens and polls could all consume production reads. Browser Auth configuration alone never redirected server Firestore.

The existing `dev:emulator` launcher was optional, required `.env.test-accounts.local`, validated addresses but did not check service availability, did not isolate R2 credentials, and did not prevent direct `next dev` from using production. Removing shell credentials alone was insufficient because Next could load them from `.env.local` afterward. The optional local accounts file also contains delivery-related keys; only whitelisted emulator/browser settings are now consumed by the app launcher. Secret values were not printed.

## Safe startup and configuration

| Entry point | Result |
|---|---|
| `npm run dev` / `npm run dev:emulator` | Same safe launcher; defaults to `demo-propbank`, Auth `127.0.0.1:9099`, Firestore `127.0.0.1:8081`, `(default)` database; checks both ports before starting Next. |
| `npm run dev:check` | Prints only safe target/status information, checks TCP reachability, starts no app and performs no database operation. This describes the selected child environment, not an older running server. |
| Direct `next dev` | Next config and Admin runtime block live Firebase in development unless explicitly opted in. Partial emulator configuration fails validation instead of using production defaults. |
| `npm run dev:live -- --allow-live-firebase` | Explicit authorized live diagnostic path; separate fresh shell; real reads/writes and configured providers remain possible. Without the flag it exits before environment/provider loading. |
| Production build/start | Existing production defaults/credential handling retained, with separate Auth and Data projects. Emulator settings are rejected in production. No new production env variables are required. |

The side-effect-free shared environment policy checks loopback host/port syntax, required hosts, browser Auth URL consistency, and matching browser/Auth Admin/Data Admin `demo-` project IDs. A legacy data-project alias, if present, must match too. Only synthetic `demo-` projects are accepted for this workflow, following [Firebase emulator guidance](https://firebase.google.com/docs/emulator-suite/connect_firestore). Server authorization still verifies the Firebase identity and current persisted complete profile and role. Production cannot accidentally enable emulator token acceptance through an emulator host setting.

The launcher sets credential values to empty in its child process, preventing Next dotenv rehydration; it does not edit `.env.local`, `.env.production` or `.env.test-accounts.local`. Emulator initialization passes only the demo project settings, without explicitly requesting ADC or loading configured service-account files. The SDK may construct its default credential object internally; emulator host routing still keeps operations local. Resend, R2 (including any cached R2 client) and legacy Cloud Storage calls are rejected in emulator mode. The launcher disables Twilio and cron credentials, uses an invalid-domain admin address and local app URL, and uses `.next-emulator` for build cache isolation. Provider-specific manual tests remain available through isolated mocks rather than live providers.

The check is a TCP availability test, not proof that a port is owned by a Firebase emulator. All accepted endpoints remain loopback and all projects synthetic; a wrong local service produces local failures. If an emulator later stops, SDK operations fail against its configured local address; they do not switch to production. Startup/network failure behavior was verified using isolated transport stubs, not by starting emulators or generating database traffic.

## Exact PowerShell commands

Terminal 1:

```powershell
Set-Location 'C:\Users\Nova Tech\Desktop\propBank'
npx firebase-tools emulators:start --only auth,firestore --project demo-propbank --config firebase.emulators.json
```

Terminal 2, same directory, after stopping any older Next process through its original terminal:

```powershell
npm run dev:check
npm run dev
```

Open `http://localhost:8080`; inspect local records at `http://127.0.0.1:4001`. Startup must show emulator mode and the demo project/local endpoints. The startup summary is safe to share; do not print environment files.

To create local fixtures, use a third terminal in the project directory while the emulators are running:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081'
$env:FIREBASE_TEST_PROJECT_ID = 'demo-propbank'
$env:PROPBANK_TEST_PREFIX = 'PBDEV_AUTH_LOCAL_001'
$env:PROPBANK_TEST_PASSWORD = Read-Host 'Temporary emulator password'
npm run dev:auth:seed
```

No fixture creation was executed during this task. The seed creates tagged emulator-only owner/tenant/buyer/broker/admin scenarios; account/profile completion remains mandatory where fixture mobile fields are empty. Use the normal completion flow with local-test values, never a server authorization bypass. Optional reusable fixtures continue to use the gitignored local accounts file and explicit `dev:accounts:seed` command. `.env.emulator.example` is a reference; do not overwrite an existing local accounts file.

Stop Next and the emulators with `Ctrl+C`, close emulator/fixture shells, and reload the browser before switching projects. No credential restoration is necessary. Ordinary local work still uses the safe launcher. Authorized deployments use their own environment with `npm run build` / `npm start`, keeping Auth `propbank-7601b`, Data `propbank-944fc`, existing credentials/buckets, and the same server permissions. Authorized live diagnostics use a new shell and the explicit `dev:live` flag; never leave that process running for ordinary development.

See [DEVELOPMENT_TESTING_GUIDE.md](DEVELOPMENT_TESTING_GUIDE.md) for fixture cleanup, optional emulator persistence, custom configuration and the complete script authorization table.

## Files changed for this task

- Entrypoints/configuration: `package.json`, `next.config.ts`, `.env.example`, new `.env.emulator.example`.
- Shared selection policy: new `src/lib/firebase-environment.cjs` and its TypeScript declaration `src/lib/firebase-environment.d.cts`.
- SDK/provider boundaries: `src/lib/server/firebase-admin.ts`, `src/firebase.ts`, `src/lib/server/r2.ts`, `src/lib/server/services/resend.ts`. `src/lib/server/firestore.ts` already delegates to the guarded Admin initializer and needed no change.
- Safe launch/diagnostics: `scripts/start-emulator-dev.cjs`, new `scripts/start-live-dev.cjs`, `scripts/check-migration-readonly.cjs`, `scripts/audit-providers-readonly.cjs`, `scripts/test-native-routing.cjs`, `scripts/auth-emulator-fixtures.cjs`.
- Tests: new `tests/firebase-environment.test.cjs`; one shared-policy dependency mapping in `tests/server-foundation.test.cjs`.
- Documentation: `README.md`, `DEVELOPMENT_TESTING_GUIDE.md`, this report.

The earlier read-budget modifications remain separate, intact working-tree changes; they are not claimed as new work in this task.

## Verification

- `npm run typecheck`: passed.
- Configuration/emulator tests: 16 passed, entirely isolated. Covers missing/remote/mismatched configuration, production separation, credential non-loading, browser behavior, Next config guard, port availability failure, loss of emulator config after initialization, provider blocking despite leaked credentials, diagnostic authorization gates, dotenv rehydration prevention, and property owner/tenant/unrelated access contracts.
- Auth phase, profile completion authorization and account completion shell tests: 20 passed. Server authentication/permissions were not disabled or replaced.
- Two selected Admin initialization/credential foundation tests passed. Two additional older auth foundation tests failed on their pre-existing missing `@/lib/indian-phone` harness dependency; both failures reproduced against the original HEAD source in the existing audit baseline directory. They were not resolved by weakening authentication or changing unrelated test fixtures.
- `git diff --check`: passed.
- No Playwright, full suite, deployment, Git push, emulator seed/write or live production operation was performed. Actual end-to-end emulator startup was not attempted; routing/startup checks use static inspection and isolated SDK/socket tests.

## Remaining live access paths

Explicit `dev:live`, directly setting `PROPBANK_ALLOW_LIVE_FIREBASE=1`, authorized production builds/servers, and already-running old processes can still access live Firebase. `check-migration-readonly.cjs` and public native-routing diagnostics now require `--allow-live-firebase`; provider audit requires `--live-providers`. Existing storage inventory requires `--live-readonly`, and email/R2 live verifiers retain their explicit send/one-file flags. Emulator fixtures now require `demo-` rather than permitting potentially provisioned `test-` project IDs.

These checks are application safeguards, not an OS/network sandbox. A new standalone Admin SDK script can bypass them; review future live-capable tooling and keep production credentials out of routine test environments. External schedulers/deployments and other project credentials remain outside local launcher control. Production daily savings still require actual Firestore monitoring after rollout; no permanent quota-resolution claim is made.
