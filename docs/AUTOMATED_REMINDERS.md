# Automated reminders — local preparation only

No scheduler is activated by this change. Activation is authorized separately for this release; the reviewed root vercel.json is staged and becomes operational only on production promotion.

## Rules and data

Canonical active `tenants` drive rent/agreement reminders. Property activity, ownership binding and agreement validity are checked. Rent offsets are 7/1/0 days before/on due date, then 1/3/7 days overdue. Agreement offsets remain 30/15/7 days before expiry. Dates use the property IANA timezone, default Asia/Kolkata, and contractual due days clamp to month-end.

The latest eligible milestone within a **three-calendar-day catch-up window** is selected, avoiding a burst of obsolete milestones. Older unstaged events are not fabricated. Previous/current/next billing months are considered.

Owners remain eligible without a linked tenant account. Tenants require an active canonical relationship, linked UID, `linkConfirmationRequired !== true`, active profile, verified current Firebase email and enabled Auth account. Multiple independent tenancies retain separate schedules, amounts and recipients.

The authorized ledger API accepts optional `amountPaid` and `tenancyId` and status `due`, `partial` or `paid`. Rupee amounts have at most two decimal places; balance calculations use integer paise. Existing full-payment entries remain supported. Explicit expected-rent overrides remain supported. New independent entries use `rentLedgersByTenancy[tenancyId][month]`; the original property ledger is used only with exactly one canonical active tenancy. Ambiguous legacy shared entries suppress financial reminders and increment `ambiguous`; no allocation or migration is invented. Multi-tenancy writes must specify a valid active tenancy belonging to the property. The existing payment UI is unchanged; partial/scoped fields are optional API capabilities, not a redesigned payment form.

## Durability and security

Deterministic email outbox records and recipient-scoped in-app notices commit together after fresh canonical reads. No provider request occurs inside a transaction. Admin escalation email/in-app notification occurs at seven days overdue; participant-only reminders are excluded from the admin feed and unread count. Existing property notification APIs enforce participant visibility.

Before sending, revalidate canonical relationship, owner binding, verified recipient, payment status/balance, rent, agreement version and catch-up eligibility. Refresh wording and amount before the first provider attempt. Cancel paid, replaced, terminated, renewed, superseded or stale messages. Do not redirect a previously queued sensitive message to a changed address.

Existing leases, provider keys, retry limits and the 23-hour ambiguous-send safeguard remain. If an already attempted payload would change, require reconciliation rather than sending different content under the same provider key or inventing a duplicate-send key. `sent` means provider acceptance, not inbox delivery. Historical records/snapshots are not rewritten.

## Workers and continuation

- `/api/cron/rent-agreements`: start a daily sweep, 25 canonical tenancies per invocation.
- `/api/cron/rent-agreements?continuation=true`: resume only the current initialized India-calendar-day sweep. Completed or uninitialized days cost one state read, not another tenancy scan.
- `/api/cron/reminders`: compatibility alias for canonical rent/agreement processing; visits no longer run through it. Legacy pure reminder helpers remain for historical compatibility/tests, not the production scheduler route.
- `/api/cron/visits`: independent worker, at most 50 examined visit documents / 20 eligible visits per invocation; persists signed-cursor continuation. Existing seven-day lookahead remains compatible. Individual failures do not abort later candidates.
- `/api/cron/notification-recovery`: existing eight-record recovery batch, leases, backoff, provider idempotency and bounded one-pass legacy discovery.

Rent cursor/day/completion and bounded retry IDs live in `_rent_reminder_state` in the existing email_deliveries collection. Failed tenancies remain retryable while unrelated records proceed. At 25 persistent failures the scan pauses rather than discarding remaining work. Failed query/checkpoint writes expire their lease and reprocess idempotently. Visits use an independent `_visit_reminder_state`. Monitor documents have no delivery status/recoveryAt and are excluded from recovery queries.

An external orchestrator may follow `continuationRequired` in bounded bursts, then resume on its next tick. Vercel fixed schedules cannot follow response cursors; the persisted state supplies each next page. Each invocation processes up to four 25-tenancy pages, stopping between pages after 75 seconds. At the maximum batch throughput, 10,000 active tenancies require approximately 100 five-minute processing ticks plus a terminal page, not an execution-time guarantee. Daily processing starts at 09:00; this is not a promise of simultaneous 09:00 email delivery. Alert on incomplete daily sweeps, persistent failures and visit backlog near appointment times.

## Proposed production configuration — NOT active

The linked Vercel team is Pro. The linked team has been verified as Pro using authorized deployment-context metadata; the proposed frequencies are supported. Current Vercel cron limits are daily/hourly precision on Hobby and once-per-minute support on Pro/Enterprise (the linked team has now been verified as Pro): https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing .

| Endpoint | UTC schedule | Purpose |
|---|---|---|
| rent-agreements | `30 3 * * *` | 09:00 Asia/Kolkata daily start |
| rent-agreements?continuation=true | `*/5 * * * *` | Resume daily pages/retries (up to four pages per invocation) |
| visits | `*/5 * * * *` | Frequent independent visit processing |
| notification-recovery | `*/2 * * * *` | Bounded outbox recovery |

All calls require server-only `Authorization: Bearer <CRON_SECRET>` with at least 32 characters. Verify Production secret injection and HTTPS application origin. Never put credentials in browser variables or query strings. Confirm RESEND_API_KEY, FROM_EMAIL, ADMIN_EMAIL, APP_URL and verified sender domain. Preserve WAF and deployment protection. No automatic execution is claimed until jobs are approved, configured and observed. The separate `REMINDER_SCHEDULE.proposed.json` mirrors the reviewed root vercel.json.

## Index preparation — no deployment

Preserve existing tenancy `propertyId ASC, isActive ASC`, recovery `status ASC, recoveryAt ASC` and monitoring `kind ASC, status ASC` indexes. Canonical active-ID traversal and visitDate range/order rely on automatic single-field indexes unless exempted.

One additional local composite: admin_notifications / COLLECTION / `participantReminder ASC`, `readByUIDs CONTAINS`. It supports admin unread aggregation excluding personal reminders. Separately approve deployment and verify READY **before releasing the feed change**. No rules/IAM changes are required.

## Read model — not production billing

Assume one active tenancy/property, no reminder due, no transaction retries and a complete daily sweep:

| Properties | Daily sweep document reads |
|---|---:|
| 100 | 411, measured isolated fixture |
| 1,000 | 4,083, projected |
| 10,000 | 40,803, projected |

For these exact multiples of 25: `4N + 2(ceil(N/25)+1) + 1`: traversal, fresh tenancy/property, single matching membership, claim/checkpoint reads and terminal empty query. Multiple active memberships increase the bounded membership query cost. Transaction retries/index-entry reads may add cost.

A due event adds eligible-profile reads (normally two), two existing-record reads per recipient, and roughly ten reads per delivered email through recovery/fresh validation. Each recipient creates an email and in-app record; delivery adds state writes. Admin escalation and agreement events add recipients; retries add cost.

The optimized empty/completed polls add approximately **2,592 reads/day**: continuation 288, visits 864 and recovery 1,440, before emails, legacy discovery and UI reads. At 10,000 properties this can approach/exceed Spark daily read allowance before delivery. Review cadence, backlog and bounded external bursts; do not assume free-tier headroom or claim measured billing savings.

Indexed nextDueAt was evaluated: it can reduce scans at scale, but requires atomic maintenance by every tenancy, rent, renewal, termination and payment writer, plus separately approved initialization. An index alone would omit old tenancies and shifted dates. This implementation uses one bounded authoritative daily sweep rather than an incomplete secondary source of truth or production backfill.

## Acceptance before activation

Verify plan, index readiness, sender, credentials and job protection; approve activation; observe each worker/checkpoint and backlog; then separately approve controlled owner/confirmed-tenant/admin email and browser acceptance. Review ambiguous legacy multi-tenancy ledgers manually. Monitor failed/limited/ambiguous results, terminal recovery states and lastSuccessfulRunAt. No browser needs to remain open once jobs are operational.

## Local verification

Targeted regression run: 147 passed, zero failures/skips across eight files. After the final configuration-failure safeguard, affected canonical/recovery tests: 60 passed, zero failures/skips (overlapping coverage, not an additional full suite). TypeScript --noEmit --incremental false passed. Only synthetic fixtures/mocked delivery were used; no live scheduler or provider was invoked.

## Production release verification

Isolated release worktree: release/automated-reminders-20261120. Full regression suite: 1,173 total, 1,168 passed, zero failures, five existing missing-Go-reference skips. TypeScript and optimized production build passed; the build used verified Production bindings. Private-credential scan passed. Homepage work and original local/generated configuration changes are excluded. Cron configuration is staged for promotion after additive-index READY and deployment verification. Actual automatic execution and provider acceptance are verified separately from local tests; inbox delivery is not inferred.
