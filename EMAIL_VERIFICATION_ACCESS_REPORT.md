# Email Verification Access Report

## Result

**PASS** — protected server operations now require a non-revoked Firebase identity with `email_verified: true`, an active persisted user profile, and the existing role or property relationship authorization.

## Root cause

Most protected APIs already used the shared `requireUser` authorization gate. The visible problem was partly client-side: `AuthContext` and the site header treated any signed-in Firebase identity as a fully authenticated user, so protected navigation remained visible while the verification screen was shown.

A limited server-side bypass also existed in shared user-service, authentication-activity, and media-session paths. Those paths validated the Firebase token directly but did not consistently apply email verification and active-profile checks. An unverified identity with a persisted admin role could reach user-management authorization, and an unverified user could receive a media session cookie. Private file downloads still reapplied `userFromToken` and were denied, so testing found no private file disclosure.

## Changes

- `src/lib/server/auth.ts`: the shared authenticated-user gate now requires `email_verified === true` and returns HTTP 403 with safe code `EMAIL_VERIFICATION_REQUIRED`.
- `src/lib/server/http.ts`: exposes the safe access-error code to clients.
- `src/lib/server/services/users.ts`: protected user and admin operations use the shared gate. The initial self-profile registration path remains available for onboarding but cannot gain admin authority or change an existing persisted role.
- `src/lib/server/services/auth-activity.ts`: session and account-link activity require the shared verified-user gate. The public password-reset-request audit remains available.
- `src/lib/server/services/media.ts`: media session cookies require a verified, active persisted user. Private downloads continue to reauthorize every request.
- `src/lib/server/services/migration-remainder.ts`: login requires an explicitly verified Firebase claim before session synchronization.
- `src/contexts/AuthContext.tsx`: listens for ID-token changes and exposes only verified users to protected route guards. Token refresh after verification updates the application state.
- `src/features/navbar/SiteHeader.tsx`: hides protected account navigation for unverified identities while public browsing remains available.
- `tests/auth-phase.test.cjs`: added regression coverage for persisted-admin denial, media-session denial, private-download denial before object access, public listing access, and verified Google profile synchronization.

## API access results

The isolated Firebase Auth and Firestore emulators ran as `demo-propbank` on `127.0.0.1:9099` and `127.0.0.1:8081`. A separate emulator-configured Next development server was used without contacting production services.

| Check | Result |
| --- | --- |
| Public `/api/properties` without authentication | **PASS** — 200 |
| Unverified email/password `/api/auth/login` | **PASS** — 403 `EMAIL_VERIFICATION_REQUIRED` |
| Unverified persisted admin `/api/users` | **PASS** — 403 `EMAIL_VERIFICATION_REQUIRED` |
| Unverified `/api/media/session` | **PASS** — 403 `EMAIL_VERIFICATION_REQUIRED`; no cookie minted |
| Unverified private download | **PASS** — 403 before R2/GCS object access in focused regression |
| Verified active individual `/api/auth/login` after token refresh | **PASS** — 200 |
| Verified individual `/api/users` admin access | **PASS** — 403 |
| Session authentication activity | **PASS** — one server-controlled record created |
| Disposable emulator fixture cleanup | **PASS** — both temporary Auth users, profiles, and activity records removed |

## Verification and session refresh

The client now uses `onIdTokenChanged`. After Firebase reports verification, the existing verification flow reloads the user and forces an ID-token refresh; the listener then exposes the verified identity and the server establishes the session. Unverified users remain able to use public browsing, verification, resend-verification, onboarding required to create their basic profile, password reset, and logout paths.

Firebase-verified Google identities continue through the same server gate. Existing persisted roles are retained during Google profile synchronization; a provider or email match cannot assign an admin role.

## Focused verification

- `npm run typecheck`: **PASS**.
- `node --test tests/auth-phase.test.cjs`: **PASS** — 10 passed, 0 failed, 0 skipped.
- Isolated emulator endpoint check: **PASS** — all seven access assertions above passed; no email or SMS was sent.

## Not verified

- Browser rendering and Google OAuth popup behavior were not automated because browser and Playwright testing were explicitly excluded. Google token semantics and persisted-role preservation were covered by focused server tests.
- Production Firebase accounts, customer data, storage, and deployment were not accessed.

## Dependency observation

Next.js 16.4.0 reported a known security advisory while starting the isolated development server. No dependency upgrade was performed because it is outside this issue's scope.
