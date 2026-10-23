# PropBank Phase 2 — Transactional Email Events

## Status

**PASS (local focused verification)** — Major persisted account, property, tenancy, agreement, visit, negotiation, maintenance, owner-verification and rent-payment activities now record branded transactional deliveries through the existing `email_deliveries` service. No live email was sent and no production data was accessed.

## Existing functionality reused

- Existing Resend server integration, stable provider idempotency keys and sanitized provider errors.
- Existing `email_deliveries` records, retry leases, retry-count limits and admin-only history/retry APIs.
- Existing admin email-delivery history UI and its CSS Module; no new UI was needed.
- Existing Firestore transaction outbox for property submission and moderation decisions.
- Existing PropBank Basalt, Chalk and Clay responsive HTML/plaintext template wrapper.
- Existing notification records and all underlying business operations, authorization and relationship checks.

## Implemented and repaired

- Added reusable persisted user-event recording with recipient eligibility resolved from active server-side user records.
- Registration welcome delivery for newly persisted accounts.
- Verified mobile-number change protection: self-service only, Firebase-verified new phone claim, authentication no older than five minutes, user/admin email deliveries, and an administrator-visible security audit. When Firebase phone verification is absent or does not match, the change is blocked.
- Property submission now addresses the selected persisted owner when an administrator creates a property for that user; administrator notification remains included.
- Tenant assignment, replacement and removal events include the owner, current tenant, and affected former tenant only where applicable.
- Rental-term update events for owners and active linked tenants.
- Agreement renewal/termination activity events for the linked owner and active linked tenant.
- Visit schedule/update/cancellation events for the requester and property owner.
- Negotiation state events for only the persisted owner, customer and assigned broker participants.
- Maintenance request creation/update events for the requester, related owner and administrator as applicable.
- Owner-verification decision events for the submitting tenant, linked owner where applicable, and deciding administrator.
- First transition of a monthly ledger entry to `paid` emits a rent-payment event for the owner and active linked tenants.
- Stable event IDs and recipient-specific idempotency keys prevent duplicate delivery records for retries or repeated event submission. Retry APIs cannot change recipients or payloads.

## Files modified in Phase 2

- `src/lib/server/services/transactional-email.ts`
- `src/lib/server/services/users.ts`
- `src/lib/server/services/properties.ts`
- `src/lib/server/services/property-effects.ts`
- `src/lib/server/services/tenants.ts`
- `src/lib/server/services/agreements.ts`
- `src/lib/server/services/visits.ts`
- `src/lib/server/services/negotiations.ts`
- `src/lib/server/services/migration-remainder.ts`
- `src/lib/server/services/owner-verification.ts`
- `src/lib/server/services/property-hub.ts`
- `tests/email-events-phase.test.cjs`
- `EMAIL_EVENTS_PHASE_REPORT.md`

Other dirty files shown by Git belong to the completed Phase 1 work or pre-existing workspace changes and were preserved.

## Focused verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | **PASS** — exit code 0 |
| `node --test tests/email-events-phase.test.cjs` | **PASS** — 6 passed, 0 failed, 0 skipped |
| Stable-event deduplication | **PASS** |
| Current relationship recipient selection | **PASS** |
| Ineligible recipient suppression | **PASS** |
| Provider failure status and sanitized error | **PASS** |
| Persisted-admin delivery-history restriction | **PASS** |
| Retry payload/recipient immutability | **PASS** |
| Recent Firebase phone verification and security audit | **PASS** |
| `git diff --check` | **PASS** — no whitespace errors; Git emitted only line-ending conversion warnings |

Per instruction, Playwright, browser E2E, the full functional suite and a production build were not run.

## Environment and unverified items

- Required for live sending: `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL`, and `APP_URL` (or `NEXT_PUBLIC_APP_URL` for link construction). Values were not printed or changed.
- **BLOCKED for live verification:** Resend credentials, sender-domain validation, approved recipients, Firestore production rules/indexes and deployed retry behavior were not exercised. No real message was sent.
- **BLOCKED when Firebase phone authentication is not configured:** mobile-number changes correctly return an error instead of accepting an unverified number.
- Property submission/moderation uses an atomic Firestore outbox in the same transaction. Other activity hooks persist delivery records immediately after their successful business commit, so email-provider failure is recoverable, but a Firestore outage precisely between the business commit and delivery-record creation can still lose that notification. Closing that narrow durability gap requires moving each legacy business mutation to an in-transaction outbox write; this was not claimed as verified here.
- Browser rendering of templates and the existing admin delivery-history screen was not tested in this fast phase.
- Monthly rent and agreement reminder schedules were not changed; they remain Phase 3 scope.
