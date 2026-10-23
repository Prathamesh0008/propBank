# Authentication Emulator Verification Report

Date: 2026-10-23  
Repository: `C:\Users\Nova Tech\Desktop\propBank`  
Branch: `feature/property-management-improvements`

## Results

| Check | Status | Result |
|---|---|---|
| Isolated emulator safety | PASS | Firebase Auth and Firestore ran under `demo-propbank`; both emulator host variables were set and the fixture script refused non-`demo-`/`test-` project IDs. No live Firebase project was used. |
| Emulator availability | PASS | Firebase CLI 15.34.1 was available through `npx`; Auth ran on 9099 and Firestore on 8081. A portable Java 21 runtime was used because Java was not installed on PATH. |
| Fixture creation | PASS | Five Auth users and five Firestore profiles were actually created for administrator, owner, tenant, buyer and agent scenarios. Profiles were active, email-verified fixtures with persisted roles `admin`, `individual` (owner/tenant/buyer relationships), and `agent`. |
| Email/password session | PASS | The owner signed in through the Auth Emulator and established a server session through `POST /api/auth/login`. |
| Owner relationship | PASS | The authenticated owner query returned the tagged owned property through the application API. |
| Tenant relationship | PASS | The authenticated tenant query returned the same property through the tenant property service. |
| Admin authorization | PASS | A buyer request to the admin user directory was rejected with HTTP 403. |
| Private-record isolation | PASS | A buyer request for the private pending property hub was rejected with HTTP 403. |
| Admin directory and audit | PASS | The admin directory returned all five active, verified fixture profiles. The owner detail included the owned-property relationship and the authoritative session activity record. |
| Tagged cleanup | PASS | Cleanup removed the tagged fixture property and Auth account. A deliberately unrelated sentinel record remained intact, proving cleanup was scoped; the sentinel was then removed explicitly. Fixtures were reseeded after the check. |
| Google OAuth | BLOCKED | The local emulator run did not exercise the real Google OAuth redirect/consent flow. This requires a controlled manual test with an authorized development domain and isolated test account. |
| Verification-email delivery | BLOCKED | Accounts were marked verified through the Auth Emulator to test protected workflows. Verification-link email delivery and action-code handling require a controlled manual test; no email was sent. |

## Test accounts

The seed creates deterministic development-only addresses using `PBDEV_AUTH_VERIFY` for the roles `admin`, `owner`, `tenant`, `buyer`, and `broker`. The password comes from `PROPBANK_TEST_PASSWORD`; if omitted, the documented fixture default is used. These accounts exist only while the isolated emulator data exists and can be recreated at any time.

## Commands to repeat

Use a Java 21+ runtime, then start only the isolated emulators:

```powershell
$env:JAVA_HOME = '<path-to-java-runtime>'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npx --yes firebase-tools@15.34.1 emulators:start --only auth,firestore --project demo-propbank --config '<isolated-firebase-config.json>'
```

In another terminal:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8081'
$env:FIREBASE_TEST_PROJECT_ID = 'demo-propbank'
$env:PROPBANK_TEST_PREFIX = 'PBDEV_AUTH_VERIFY'
$env:PROPBANK_TEST_PASSWORD = '<development-only-password>'
npm run dev:auth:seed
npm run typecheck
npm run test:auth
npm run dev:auth:cleanup
```

Application-service verification also requires running the app with its Firebase Auth and data project IDs set to `demo-propbank`, both emulator host variables set, and all email/SMS delivery disabled.

## Focused verification output

- `npm run typecheck`: PASS (exit 0).
- `npm run test:auth`: PASS — 6 passed, 0 failed, 0 skipped.
- No Playwright, browser E2E, full functional suite, production build, real email, SMS, deployment, or production Firebase access was performed.

## Notes

The existing development server on port 8080 was left untouched. A temporary copy outside the repository was used for HTTP integration checks because Next.js prevents a second development instance from using the same project directory. Firebase Emulator UI was available only for this local verification. The Firebase CLI reported a Next.js security advisory during startup; dependency remediation was outside this verification task and remains a release-readiness item.
