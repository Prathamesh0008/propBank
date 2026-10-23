# PropBank Phase 3 — Rent and Agreement Reminders

## Status

**PASS (focused local verification)** — calendar-based rent and agreement reminders now use the existing `email_deliveries` system, and the scheduler continuation no longer skips eligible deliveries when its per-run budget is reached. No production endpoint, customer record, scheduler, or live mailbox was used.

## Existing functionality reused

- Protected `/api/cron/reminders` GET/POST route and constant-time `CRON_SECRET` authorization.
- Existing minute-based visit reminder scan, leases, frozen retry payload and Resend idempotency key behavior.
- Phase 2 `email_deliveries`, recipient eligibility, delivery leases, retry status, sanitized failures and admin-only retry endpoint.
- Existing PropBank Basalt/Chalk/Clay responsive HTML and plaintext template wrapper.
- Current property tenant relationships, rent ledger, agreement dates, tenancy/agreement revisions and manual rent-payment workflow.

## Changes implemented

- Rent reminders at 7 days, 1 day and the due date, separately for the active linked tenant and current owner.
- Agreement expiry reminders at 30, 15 and 7 days, separately for the active linked tenant and current owner.
- Property timezone support through `Intl.DateTimeFormat`; invalid or absent zones fall back to `Asia/Kolkata`.
- Due days 29–31 are clamped to the final calendar day of shorter months. For example, day 31 becomes February 28 in non-leap-year February.
- Paid current-period rent, inactive tenants, inactive properties and terminated/expired/cancelled agreements suppress reminders.
- Current rent amount, due date, agreement end date, tenancy relationship, recipient relationship, agreement version and scheduled reminder date are revalidated before retry.
- Reminder records include event type, property/record ID, tenancy ID, rental period or agreement version, offset, due date, scheduled date, recipient UID/role, frozen content, status, retries and a stable recipient-specific idempotency key.
- Emails include the property, amount/period/due date or agreement expiry guidance and an authenticated application link. No documents are attached or exposed.

## Pagination repair

The previous implementation scanned a large property page, stopped attempting delivery after 20 messages, and continued iterating. Its cursor could therefore advance beyond unprocessed events.

The repaired scanner:

- Reads at most 250 properties per page and attempts at most 20 deliveries.
- Returns a signed continuation containing the last fully completed property, current property and next event index.
- Resumes within a property when its recipients span executions.
- Returns a page continuation at an exact 250-property boundary, then terminates with `nextCursor: null` when the following page is empty.
- Rejects malformed, tampered and stale continuations.
- Uses transactional delivery leases and stable idempotency keys, so concurrent or repeated runs do not duplicate messages.
- Never uses the continuation to authorize a request; every call must still pass `Authorization: Bearer <CRON_SECRET>`.

## Files modified

- `src/lib/server/services/reminders.ts`
- `src/lib/server/services/transactional-email.ts`
- `tests/reminder-phase.test.cjs`
- `REMINDER_PHASE_REPORT.md`

## Focused verification

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | **PASS** — exit code 0 |
| `node --test tests/reminder-phase.test.cjs` | **PASS** — 8 passed, 0 failed, 0 skipped |
| Rent offsets 7, 1 and 0 | **PASS** |
| Agreement offsets 30, 15 and 7 | **PASS** |
| Owner and active-tenant recipients | **PASS** |
| Paid rent and inactive tenancy suppression | **PASS** |
| Terminated/replaced-date suppression | **PASS** |
| February day-31 clamping | **PASS** |
| Concurrent/repeated execution | **PASS** |
| Failed delivery retry with frozen recipient | **PASS** |
| Changed terms make retry obsolete | **PASS** |
| More than 20 eligible deliveries | **PASS** — 20 then 2 through continuation |
| More than 250 properties and exact boundary | **PASS** — 251-property continuation and empty terminal page |

Playwright, browser E2E, the full functional suite and a production build were not run, as requested.

## Deployment configuration

Required environment variables:

- `CRON_SECRET` — at least 32 characters; also signs continuation tokens.
- `RESEND_API_KEY` — server-side Resend credential.
- `FROM_EMAIL` — verified sender address.
- `APP_URL` (or existing `NEXT_PUBLIC_APP_URL` fallback) — base URL for authenticated links.

No scheduler configuration file exists in this repository. The deployment scheduler must call `/api/cron/reminders` every five minutes with the bearer secret to preserve visit-reminder timing. When the response contains `properties.nextCursor`, it must immediately call the same endpoint again with `propertyCursor=<URL-encoded token>` and repeat until `properties.nextCursor` is `null`. It must retain the same secret for an entire continuation chain; rotating `CRON_SECRET` invalidates outstanding tokens safely. Only one normal schedule trigger is needed; overlapping invocations are safe but wasteful.

The property query uses `isActive == true` ordered by document name. No new composite index was identified by the focused fixture tests; the existing visit query still requires Firestore to support its `visitDate` range/order query. Deployed Firestore may return an index creation link if its current index configuration differs.

## Unverified live integrations

- **BLOCKED:** live Resend sender verification and delivery to real inboxes were not tested.
- **BLOCKED:** deployed Firestore indexes, rules, dataset size and runtime limits were not exercised.
- **BLOCKED:** no deployment scheduler is declared in this repository, so automatic execution requires external platform configuration.
- **BLOCKED:** live continuation behavior through the deployed proxy/platform was not invoked.
