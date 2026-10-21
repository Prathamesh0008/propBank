# PropBank Email Events — Phase 2 Report

Date: 2026-10-21

## Status

- **PASS — Central delivery records:** Transactional events use deterministic idempotency keys and persist recipient role/UID, related property/record IDs, template/version, status, retry count, timestamps, and sanitized failures in the server-only `email_deliveries` collection.
- **PASS — Recipient controls:** Registered-user mail resolves the current active persisted profile. Administrative mail accepts only the configured `ADMIN_EMAIL`. Failed-delivery retry cannot alter recipient or content.
- **PASS — Provider behavior:** Resend receives an idempotency header and HTML/plaintext content. Missing provider configuration and provider errors produce a failed delivery instead of a false sent status.
- **PASS — Main activity hooks:** Registration, verified mobile-number changes, property creation/admin creation, listing moderation, tenant assignment/replacement/removal, rental-term changes, agreement requests/termination, visit activity, negotiation updates, service-request updates, and owner-verification decisions now create explicit events after their business write.
- **PASS — Mobile-number security:** A changed number requires a Firebase token with recent authentication and a matching verified `phone_number` claim. The API returns a blocked error when verified phone ownership is unavailable.
- **PASS — Admin management:** Persisted admins can inspect privacy-masked delivery history, filter it, and retry eligible failures. Non-admin access is denied at the service/API layer. The UI uses its own CSS Module.
- **PASS — Brand templates:** Central HTML/plaintext output uses the current PropBank wordmark and Basalt, Chalk, Limestone, and Clay palette with authenticated application links when an app URL is configured.
- **BLOCKED — Live delivery:** No real email was sent. Resend domain/sender acceptance, production Firestore rules, and deployed delivery behavior remain unverified.
- **NOT STARTED — Recurring reminders:** Rent and agreement reminder scheduling remains Phase 3 and was intentionally untouched.

## Files changed for Phase 2

- `src/lib/server/firestore.ts`
- `src/lib/server/services/resend.ts`
- `src/lib/server/services/transactional-email.ts`
- `src/lib/server/services/property-effects.ts`
- `src/lib/server/services/users.ts`
- `src/lib/server/services/properties.ts`
- `src/lib/server/services/group2-mail.ts`
- `src/lib/server/services/tenants.ts`
- `src/lib/server/services/agreements.ts`
- `src/lib/server/services/visits.ts`
- `src/lib/server/services/negotiations.ts`
- `src/lib/server/services/migration-remainder.ts`
- `src/lib/server/services/owner-verification.ts`
- `src/app/api/admin/email-deliveries/route.ts`
- `src/app/api/admin/email-deliveries/[id]/retry/route.ts`
- `src/features/admin/AdminEmailDeliveries.tsx`
- `src/features/admin/AdminEmailDeliveries.module.css`
- `src/features/admin/AdminPortal.tsx`
- `tests/fixtures/native-server.cjs`
- `tests/email-events-phase.test.cjs`

## Verification

- **PASS — `npm run typecheck`:** exit 0.
- **PASS — focused Node checks:** `node --test tests/email-events-phase.test.cjs tests/admin-property-operations.test.cjs` — 10 passed, 0 failed, 0 skipped.
- Tests cover stable-event deduplication, delivery status persistence, inactive-recipient rejection, provider failure sanitization, persisted-admin access, non-admin denial, immutable retry payloads, successful retry, and regression of admin property/tenant operations.
- Per instruction, Playwright, browser/E2E suites, the complete functional suite, production build, live email delivery, and production data operations were not run.

## Remaining integration requirements

- Confirm `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL`, and `APP_URL`/`NEXT_PUBLIC_APP_URL` in the intended non-production environment without exposing their values.
- Deploy Firestore rules that deny browser access to `email_deliveries`; the application accesses it only through admin-authorized server routes.
- Exercise each event with isolated staging accounts and a Resend test recipient before production approval. Live delivery must not be claimed from mocked provider tests.
- Production deployment, scheduler changes, real-recipient sends, and production-record changes require separate approval.
