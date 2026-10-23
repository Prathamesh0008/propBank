# PropBank Authentication and Controlled Testing Report

## Status

**PASS (focused local verification)** — Firebase email/password and Google authentication now share the existing Firebase identity, Firestore profile and persisted-role architecture. No deployment, live Firebase account, customer record, email, SMS or production data was used.

## Existing authentication reused

- Browser Firebase Auth configuration and Google popup provider.
- Separate Firebase Auth and Firestore Admin applications/projects.
- Fresh Firebase ID tokens attached by `apiFetch`; no custom password/token store was introduced.
- Server-side token revocation checks, persisted Firestore roles and active-profile enforcement.
- Twenty-minute HttpOnly, `SameSite=Strict` private-media session cookie with authorization rechecked on every private download.
- Existing Firestore user profiles, `admin`/`agent`/`individual` account roles, and owner/tenant relationships derived from properties.
- Existing admin user directory and role-change workflow.

## Added and repaired

- Email/password account creation and sign-in.
- Google sign-in retained in the same authentication panel.
- Firebase password-reset request UX with non-enumerating feedback.
- Firebase email verification, resend action and access blocking for unverified email identities.
- Password visibility control, loading states, accessible errors and mobile CSS Module styles.
- Safe `next` redirect handling that accepts only same-origin relative paths.
- Safe Google linking after the user proves access through the existing email/password account. Matching email alone never links an account.
- Removed the authentication UI's dependency on a redundant locally stored token; local APIs continue using refreshed Firebase ID tokens.
- Registration always starts with the persisted `individual` role. Owner, tenant and buyer capabilities remain relationship-based; `agent` and `admin` remain administrator-controlled persisted roles.
- Firebase-derived email-verification, account status, provider IDs, creation time and last successful sign-in are synchronized to the profile. Passwords, OAuth tokens and session secrets are never stored in Firestore.
- Server-controlled, bounded authentication activity for registration, session establishment, account linking, profile changes, authorized role changes and account-status changes.
- Password-reset requests are recorded as client-reported requests and are not represented as proof that the account owner performed them.
- Admin directory enrichment with verification/provider information, activation/deactivation, registration/login dates, owned/rented relationship counts and privacy-conscious activity history.
- Administrators cannot change their own role or active status through this workflow.

## Routes

- `/auth` — sign-in, registration, reset and verification interface.
- `POST /api/auth/user` — creates or synchronizes the authenticated Firebase user's Firestore profile.
- `POST /api/auth/login` — validates UID/token correspondence, verified email and active profile, then records session establishment.
- `POST /api/auth/activity` — records authenticated account linking or a non-authoritative password-reset request event.
- `GET/PATCH /api/users/[id]` — scoped profile access and admin-controlled role/status changes.
- `GET /api/users` — persisted-admin-only enriched user directory.

## Security behavior

- Firebase Auth owns passwords, verification links, reset links, OAuth credentials and provider linking.
- Email identities must be verified before protected application workflows.
- The server reads `admin` and `agent` from Firestore and never promotes by email address or OAuth provider.
- Existing roles survive repeat profile synchronization and duplicate Firebase callbacks.
- Role/status changes require a persisted administrator and update Firebase disabled state plus an audit event.
- Account linking requires a successful sign-in to the existing account before Firebase accepts the pending Google credential.
- Audit event fields are allowlisted, contain no tokens/IP addresses, and retain at most 100 records per target user.

## Controlled emulator testing

Install/start Firebase Auth and Firestore emulators outside this script, then set development-only values:

```text
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_TEST_PROJECT_ID=demo-propbank
PROPBANK_TEST_PREFIX=PBDEV_AUTH_V1
```

Commands:

- `npm run dev:auth:seed` — creates tagged admin, owner, tenant, buyer and broker emulator identities plus an isolated property, active tenancy/agreement and enquiry.
- `npm run test:auth` — runs only focused authentication/authorization tests with no email or SMS.
- `npm run dev:auth:cleanup` — removes only the known tagged Firestore fixtures and their known emulator Auth accounts.

The seed script refuses to run without both emulator hosts and a `demo-` or `test` project ID. `PROPBANK_TEST_PASSWORD` can override the documented development-only default. These accounts have no access outside the emulator project.

## Files changed

- `.env.example`
- `package.json`
- `scripts/auth-emulator-fixtures.cjs`
- `src/firebase.ts`
- `src/app/api/auth/activity/route.ts`
- `src/features/auth/Auth.tsx`
- `src/features/auth/GoogleAuth.tsx`
- `src/features/auth/AuthAccount.module.css`
- `src/lib/server/auth.ts`
- `src/lib/server/services/auth-activity.ts`
- `src/lib/server/services/users.ts`
- `src/lib/server/services/migration-remainder.ts`
- `src/features/admin/AdminAgentsTab.tsx`
- `src/features/admin/AdminTypes.ts`
- `src/features/admin/AdminUserDetailsDialog.tsx`
- `src/features/admin/AdminUserDetailsDialog.module.css`
- `tests/fixtures/native-server.cjs`
- `tests/auth-phase.test.cjs`
- `AUTH_TESTING_PHASE_REPORT.md`

No homepage hero or unrelated page styling was modified.

## Verification

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | **PASS** — exit code 0 |
| `node --test tests/auth-phase.test.cjs` | **PASS** — 6 passed, 0 failed, 0 skipped |
| `package.json` parse | **PASS** |
| Emulator script syntax | **PASS** |
| Focused diff whitespace check | **PASS** — only Git line-ending notices |

Focused tests cover unverified-email rejection, non-privileged registration, provider/login metadata, role and account-status authorization/auditing, admin relationship/activity visibility, ordinary-user privacy and authenticated account-link recording. Playwright, browser E2E, full functional tests and production builds were not run.

## Firebase Console/manual requirements

- Enable Email/Password and Google providers in the existing Firebase Auth project.
- Configure the Google OAuth consent screen and approved support email.
- Add only approved development/staging/production domains to Firebase authorized domains.
- Configure password-reset and email-verification action URLs for each environment.
- Confirm the browser Firebase project matches `FIREBASE_AUTH_PROJECT_ID`; keep `FIREBASE_DATA_PROJECT_ID` separate as already enforced.
- Configure Firebase Phone Authentication before any mobile-number ownership workflow can be enabled; current mobile changes remain securely blocked without verified phone claims.
- Define/deploy reviewed Firestore rules and indexes separately; none are stored locally in this repository.

## Not verified

- Live Email/Password and Google provider configuration, OAuth redirect domains and action-link delivery.
- Real password reset or verification email delivery.
- Live account linking and disabled-user token revocation timing.
- Emulator seed execution; the safety guards and script syntax were checked, but no emulator was started.
- Browser presentation and redirect behavior.
- Full regression of Phases 1–3 and other workflows, excluded by the requested fast-testing scope.
