# Mandatory registration mobile contact

New Individual and Real Estate Agent profiles require a valid Indian mobile contact. Existing registered accounts remain eligible to sign in even when their historical profile has no number or an older display format.

## Registration behavior

- The existing Create Your Account form displays Mobile Number immediately after Email Address and before Password, with a fixed `+91` prefix.
- The input uses `type="tel"`, `inputMode="numeric"`, `autocomplete="tel-national"`, required/pattern validation and a maximum length of ten digits. Controlled input removes non-digits and caps entry at ten digits.
- Accepted national numbers match `[6-9][0-9]{9}`. Missing or invalid input gets an inline error on blur, browser invalidation or submission, with accessible error association and invalid state.
- Both Individual and Agent selections use the same requirement. The frontend submits canonical `+91` plus the ten-digit contact.
- The backend independently validates new profiles using the existing Indian number normalizer. It accepts national or supported `+91` formatting and stores `phoneNumber` in Indian E.164 format. Invalid or absent input cannot persist a new Individual/Agent profile, registration audit or welcome event.
- New profile creation checks the UID document in a Firestore transaction before creating it, protecting an existing profile against a competing initial-registration write. Existing phone duplicate-contact checks remain; phone is not an identity credential.
- Administrative profile-creation/upsert routes also require a valid contact for new Individual/Agent profiles. Established administrator provisioning policy was not expanded or converted into public admin registration.

## Google and existing accounts

- New `GET /api/auth/user` returns only `{success, profileExists}` for the authenticated Firebase UID. It accepts no caller-selected account lookup, exposes no profile details and rejects anonymous/disabled-account access. Unverified identities may check only their own onboarding state, consistent with existing onboarding permissions.
- Google sign-in first checks that self-scoped profile state. A new user stays on the existing registration form to supply Full Name, Account Type and Mobile Number. The authenticated email is read-only; no password or second Firebase account is created.
- Profile persistence occurs only after valid contact submission. Google users then establish the normal session; password users retain the existing email-verification requirement.
- If Firebase account creation succeeds but saving the profile fails, retry reuses that Firebase UID through the same form rather than trying to create another account.
- Existing Google/password profiles sign in without a mobile requirement or registration POST. Existing roles, stored phone formatting, creation timestamps and property relationships remain intact. Registration synchronization cannot clear or replace an established contact or elevate a role.
- Existing My Account phone-change policy is unchanged. No forced mobile backfill, extra registration page, new OTP step or SMS configuration was introduced.

## Identity safeguards

The submitted mobile is **contact information only**. The change does not update Firebase Auth phone credentials, mark a mobile verified or use it to authorize owner/tenant links. Verified-email discovery, pending connections, documentary owner verification, tenant acceptance, owner authorization and generic invitation email workflows remain intact. Unverified password registrations cannot access protected property APIs. UID and role protections remain server enforced.

## Files modified for this task

- `src/features/auth/GoogleAuth.tsx`
- `src/features/auth/RegistrationMobileField.tsx` (new)
- `src/features/auth/AuthAccount.module.css`
- `src/lib/server/services/users.ts`
- `src/app/api/auth/user/route.ts`
- `tests/registration-mobile.test.cjs` (new)
- `tests/registration-mobile-ui.test.cjs` (new)
- `tests/auth-phase.test.cjs`
- `tests/agent-workflow.test.cjs`
- `tests/email-events-phase.test.cjs`
- `tests/verified-email-relationships.test.cjs`
- `tests/relationship-links.test.cjs`
- `REGISTRATION_MOBILE_REQUIREMENT_REPORT.md` (new)

Existing positive registration fixtures were updated with valid contact numbers. Prior uncommitted changes were preserved.

## Verification

- `npm run typecheck` — passed.
- Focused command — **92 passed, 0 failed**:

  ```text
  node --test tests/registration-mobile.test.cjs tests/registration-mobile-ui.test.cjs tests/auth-phase.test.cjs tests/account-management.test.cjs tests/agent-workflow.test.cjs tests/email-events-phase.test.cjs tests/verified-email-relationships.test.cjs tests/relationship-links.test.cjs
  ```

- Ten new backend cases cover valid numbers/all accepted leading digits, missing and malformed contacts, Individual/Agent normalization, Google completion, legacy login compatibility, immutable established contact/role, no mobile-derived privilege, self-only onboarding state, alternate creation routes and repeated/concurrent initial registration.
- Seven new UI cases execute the real component handlers against isolated Firebase/API boundaries: field order and attributes, digit restriction/inline errors, canonical contact and selected role, first Google completion, existing Google login, existing password login and retry without duplicate Firebase account creation.
- `git diff --check` — passed; line-ending conversion warnings only.

No live Firebase changes, actual account registrations, real email, Playwright, full suite, production build, deployment or push occurred. Tests used isolated fixtures and component handlers; live Google popup/browser behavior was not exercised. No new external configuration is required.
