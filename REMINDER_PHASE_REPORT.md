# PropBank Reminder Phase Report

Date: 2026-10-21

## Implemented functionality

- **PASS — Rent reminders:** Active tenants and property owners receive separate events 7 calendar days before, 1 day before, and on the current monthly rent due date.
- **PASS — Agreement reminders:** Active tenants and owners receive separate events 30, 15, and 7 calendar days before the current effective agreement end date. No workflow automatically renews or terminates an agreement.
- **PASS — Calendar handling:** Each property may supply an IANA timezone. Invalid or absent zones use `Asia/Kolkata`. Calculations use calendar dates rather than elapsed-hour rounding.
- **PASS — Month-end rule:** Due days 29–31 clamp to the final calendar day in shorter months. A rent due on the 31st therefore falls on February 28, or February 29 in a leap year.
- **PASS — Current-state safeguards:** Explicit `rentLedger[YYYY-MM].status === "paid"`, inactive/former tenants, inactive rentals, and terminated/expired/cancelled agreements suppress reminders. The property is re-read immediately before enqueueing.
- **PASS — Obsolete retry protection:** A failed rent reminder cannot be retried after its amount, due date, tenancy, paid state, or rental state changes. Agreement retries require the same active tenancy, end date, and agreement/tenancy version.
- **PASS — Idempotency and concurrency:** Keys include property, tenancy, rent period or agreement version/end date, reminder offset, recipient role, and recipient UID. `email_deliveries` transactions claim one delivery with a recoverable lease; Resend receives the stable provider idempotency key.
- **PASS — Bounded work:** A run reads at most 250 active properties and attempts at most 20 property-recipient deliveries. The response supplies `nextCursor`; subsequent invocations pass it as `propertyCursor`.
- **PASS — Email content:** Existing PropBank HTML/plaintext branding is reused. Rent messages include amount, period and due date. Agreement messages include the end date and days remaining. Links point to the authenticated property rent/agreement sections.

## Existing functionality reused

- Protected `GET`/`POST /api/cron/reminders` endpoint and minimum-length `CRON_SECRET` bearer check.
- Existing visit-reminder query, lease, frozen payload and retry behavior.
- Current property `rentLedger`, tenant relationships, rental/agreement statuses and due-date fields.
- Phase 2 `email_deliveries`, recipient resolution, Resend transport, branded HTML/plaintext templates, admin history and constrained retry.
- Existing admin reminder notifications remain deterministic and contain no recipient identity.

## Files changed

- `.env.example`
- `src/lib/server/services/reminders.ts`
- `src/lib/server/services/transactional-email.ts`
- `tests/reminder-phase.test.cjs`
- `REMINDER_PHASE_REPORT.md`

## Focused verification

- **PASS — `npm run typecheck`:** exit 0.
- **PASS — `node --test tests/reminder-phase.test.cjs tests/email-events-phase.test.cjs`:** 10 passed, 0 failed, 0 skipped after the final reminder test addition.
- Covered all rent offsets, all agreement offsets, both recipient roles, February month-end clamping, paid suppression, inactive tenancy, termination, renewed dates, concurrent duplicate runs, provider failure/retry, immutable recipients, and obsolete-term retry rejection.
- Per instruction, Playwright, browser E2E, the complete functional suite, production build, live scheduler invocation, production data access, and real email delivery were not run.

## Configuration and indexes

Required server environment variables:

- `CRON_SECRET` — at least 32 characters; never expose it to browser code or query strings.
- `RESEND_API_KEY` — Resend server credential.
- `FROM_EMAIL` — verified sender address/domain.
- `APP_URL` — absolute application origin for authenticated email links. `NEXT_PUBLIC_APP_URL` remains a supported fallback.
- Existing Firebase Admin data-project credentials remain required for Firestore access.

No new composite Firestore index is required by the new property-reminder code. It queries `properties` by `isActive == true`, orders by document ID, and paginates by document ID. The preserved visit query requires its existing `visits.visitDate` index. No deployed index files were present locally, so deployed index availability is **BLOCKED** until verified against the intended Firebase project.

## Scheduler requirements and blockers

- **BLOCKED — Automatic execution:** No scheduler configuration is present in this repository. Configure the deployment scheduler or an external scheduler to call `/api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`. It must follow `properties.nextCursor` using `?propertyCursor=...` while `properties.limited` is true.
- The existing combined endpoint includes time-sensitive visit reminders, so the deployment interval must continue to satisfy visit timing. Property reminders are calendar-date idempotent and tolerate repeated runs.
- **BLOCKED — Live delivery:** Resend sender verification, deployed Firebase permissions/indexes, scheduler authentication, and real delivery have not been tested. Use isolated staging accounts and controlled recipients before production approval.
- No production records, real recipients, scheduler settings, or deployed infrastructure were modified.
