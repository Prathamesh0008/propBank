# Verified sender domain update

Configured application email now uses **PropBank <connect@propbank.care>**. The local `FROM_EMAIL` already contained `connect@propbank.care`; it was preserved. `RESEND_API_KEY`, other credentials, `APP_URL`, optional support configuration and recipient addresses were not changed. This task did not independently attest domain verification or actual delivery.

## Implementation

- `resend.ts` is the single application transport and validates/normalizes the configured sender, rejects malformed/header-injected values, defaults to `connect@propbank.care`, and explicitly rejects the retired `@propbank.shop` domain.
- The legacy `property-effects.sendEmail` adapter delegates to that transport instead of maintaining its own sender fallback, provider request and differently capitalized display name.
- Owner/tenant invitation templates use the shared care fallback for their support contact when neither a support address nor a sender is configured. Existing configured support links and website origin remain intact.
- Standard property, account, agreement, owner-verification, visit and administrator events already use the transactional outbox/transport. Reminder events retain their configuration/recipient checks and use that same transport. Delivery leases, retries, existing idempotency keys, confirmation requirements and recipient eligibility were not weakened.
- Three opt-in notification test scripts now pin their sender/domain verification to `.care`. The opt-in generic live verification script uses the actual shared adapter rather than copying a function body into a separate VM. **None of these live scripts was executed**; syntax checks only.
- The isolated fixture now accepts an optional explicitly supplied transport, enabling adapter verification without real mail. Its default transport remains intercepted.

## Files changed for this task

- `.env.example`
- `src/lib/server/services/resend.ts`
- `src/lib/server/services/property-effects.ts`
- `src/lib/server/services/relationship-invitation-email.ts`
- `scripts/run-business-notification-live-test.cjs`
- `scripts/run-visit-notification-live-test.cjs`
- `scripts/run-final-notification-live-test.cjs`
- `scripts/verify-live-email.cjs`
- `tests/fixtures/native-server.cjs`
- `tests/native-group1.test.cjs` — updates the historical sender assertion to the current configured fixture sender/display name.
- `tests/email-sender.test.cjs` (new)
- `RESEND_SENDER_DOMAIN_UPDATE_REPORT.md` (new)

## Remaining old-domain references

- **Application:** `resend.ts` retains `@propbank.shop` only as an active rejection rule. There is no old-domain application sender fallback or alternate sending implementation.
- **Tests:** negative cases deliberately supply the retired domain and assert that neither adapter sends from it.
- **Opt-in scripts:** the business, visit and final notification scripts still contain `https://propbank.shop` as their historical **website-link fallback** when `APP_URL` is absent. These are not sender addresses. They were retained because the deployed website origin was not confirmed and the task explicitly forbids assuming a new origin. The scripts do not run as application notification handlers.
- **Historical documentation, audit output and existing delivery journals:** old sender/domain evidence is retained as historical material. It is not loaded as the application sender configuration, and no old event was resent or rewritten.
- The existing Gmail administration/contact address is a recipient/template legacy placeholder, not the envelope sender. Recipient configuration was deliberately preserved.

## Verification

- `npm run typecheck` — passed.
- Focused email/sender/invitation/repair tests — **47 passed, 0 failed**:

  ```text
  node --test tests/email-sender.test.cjs tests/email-events-phase.test.cjs tests/relationship-invitation-email.test.cjs tests/tenant-invitation-repair.test.cjs tests/property-runtime-repair.test.cjs
  ```

- Agreement, visit and reminder regressions — **28 passed, 0 failed**:

  ```text
  node --test tests/agreement-admin-notifications.test.cjs tests/visit-planner-repair.test.cjs tests/reminder-phase.test.cjs
  ```

- All four changed opt-in scripts passed `node --check` without execution.
- `git diff --check` — passed; line-ending conversion warnings only.

**75 focused tests passed in total.** Tests check both invitation directions, normal notifications, unchanged recipients and action origin, legacy-adapter consistency, care fallback/display name, retired-domain rejection, header injection, missing key handling and stable idempotency keys.

No real email, DNS change, provider-settings change, deployment or Git push occurred. Existing uncommitted work and historical data were preserved. Restart/reload any separately deployed process with `FROM_EMAIL=connect@propbank.care` through the normal release process; no deployment or historical resend is implied by this change.
