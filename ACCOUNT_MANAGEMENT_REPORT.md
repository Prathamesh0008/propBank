# PropBank Account Management Report

Date: 24 October 2026  
Scope: Account profile, security, activity and preferences only

## Implemented

- Added the protected `/my-account` page for Individual, Real Estate Agent and Administrator accounts.
- Added **My account** to the desktop avatar menu and mobile workspace navigation.
- Displays the persisted profile plus authoritative Firebase email verification, provider, account creation and last-sign-in metadata.
- Added self-service editing for full name, verified phone field, HTTPS profile-photo URL, optional biography and agent agency details.
- Added compact notification preferences for optional product updates and activity summaries. Mandatory security notifications cannot be disabled.
- Added password change for password-provider accounts using Firebase recent reauthentication, plus the existing Firebase password-reset flow.
- Added verified email-change initiation using Firebase `verifyBeforeUpdateEmail`. The persisted email changes only after Firebase reports the new address verified.
- Google-only accounts receive provider-appropriate guidance and are not offered an unsupported password-change form.
- Added private account activity history, capped by the existing 100-event retention behavior.
- Added durable, idempotent transactional email records for name, verified phone, password, email-request/completion and important agent-profile changes.
- Email completion writes the updated Firestore email and the new/previous-address outbox deliveries in one transaction.

## Security protections

- Every account API request requires a valid, verified Firebase identity and active persisted profile.
- The account APIs derive the UID from the verified token; they accept no target UID from the browser.
- Role, active status and email are rejected in general profile-edit payloads. Users cannot promote themselves or change their account type.
- Phone changes require authentication within five minutes and a matching Firebase-verified `phone_number` claim. Without a configured phone-verification provider, the change returns a clear blocked response.
- Password and email security-event recording requires recent authentication and a unique operation reference.
- Email-change completion trusts verified Firebase Auth state, not browser input, and alerts both the new and previous verified addresses where available.
- Passwords, tokens and internal UIDs are not returned by the account view or stored in Firestore.
- Existing Admin user details continue to expose privacy-conscious activity only to persisted administrators.

## Files changed

- `src/app/(protected)/my-account/page.tsx`
- `src/app/api/account/route.ts`
- `src/app/api/account/security-event/route.ts`
- `src/features/account/MyAccount.tsx`
- `src/features/account/MyAccount.module.css`
- `src/features/navbar/UserMenu.tsx`
- `src/features/navbar/UserMenu.module.css`
- `src/features/navbar/MobileNav.tsx`
- `src/lib/server/services/account.ts`
- `src/lib/server/services/auth-activity.ts`
- `src/lib/server/services/transactional-email.ts`
- `tests/account-management.test.cjs`

## Verification results

- `npm run typecheck`: **PASS** — 0 TypeScript errors.
- `node --test tests/account-management.test.cjs tests/auth-phase.test.cjs tests/email-events-phase.test.cjs`: **PASS** — 26 passed, 0 failed, 0 skipped.
- New account tests: **PASS** — 7 passed, covering own-profile visibility, metadata/activity privacy, profile updates, role protection, cross-account denial, verified-phone enforcement, security-event idempotency, verified email synchronization and Google-only provider handling.
- Existing authentication and transactional-email regression tests: **PASS** — 19 passed.
- `git diff --check`: **PASS** — no whitespace errors (Git emitted existing line-ending conversion warnings only).

## Remaining live verification

- No production Firebase account or Firestore profile was read or modified.
- No real email was sent. Resend delivery and inbox placement for account-security templates remain unverified.
- Firebase email-change action links, recent-login behavior and final browser token refresh require a controlled manual test with approved test accounts.
- Password-reset completion is not reliably observable from the current Firebase client/server integration, so PropBank records the reset request but does not claim or email that the reset completed.
- Phone-number changes remain unavailable until Firebase phone verification is configured and the signed-in token contains the verified new number.
- Profile-photo support is URL-based because the current user profile model has no dedicated profile-photo upload workflow.
- Browser rendering and interaction were not exercised because Playwright/E2E testing was explicitly excluded.

The homepage hero, authentication registration/login flow, backend business workflows and global styling were not changed.
