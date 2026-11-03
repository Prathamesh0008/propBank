# Safe local Resend testing on dev/my-work

## Cause and workflow audit

The recovered system intentionally captured email in `services/resend.ts` and threw a configuration error after capture. The durable outbox therefore showed an undelivered failure; the launcher also removed Resend credentials. This was Firebase recovery isolation, not a sender/template regression.

Before changing delivery, the following paths were inspected:

| Workflow | Existing route to shared transport | Local testing |
| --- | --- | --- |
| Property submission/status, rental terms, agent registration and approvals | property-effects / transactional-email outbox | Capture or allowlisted resend-test |
| Tenant/owner invitations, confirmations and owner verification | relationship invitation events / transactional-email | Same policy; eligibility and authorization preserved |
| Agreements, renewal/termination and future-draft-related activity | agreements / group2-mail / outbox | Same policy; no draft/approval rules changed |
| Visits, visit updates and cancellations | visit notifications / next.after queues / outbox | Same policy; automatic reminder scans disabled |
| Enquiries, assignments, admin responses, service/maintenance requests, negotiations | notifications, enquiries, migration-remainder, negotiations / outbox | Same policy |
| Account welcome/security, mobile/email changes | users, account / outbox | Same policy; no verified-email/profile bypass |
| Rent/expiry/visit reminder scheduler and direct runner functions | reminders | Disabled in both local modes, before database scans |
| Admin retry of one eligible outbox delivery | transactional-email -> shared transport | Existing admin/eligibility checks plus current allowlist and budget |
| Four historical standalone live notification/email scripts | Direct fetch calls bypassing shared transport | Blocked in this development worktree; do not use for testing |
| Firebase verification/reset emails | Firebase Auth SDK, not Resend | Unchanged; use controlled test inboxes in propbanktest |

`src/lib/server/services/resend.ts` is the only application Resend HTTP send boundary. Legacy property-effects/group2 queues delegate to it; durable outbox delivery/retries also reach it. No Resend batch/broadcast client exists in src. Existing application templates and the `connect@propbank.care` sender default were retained. No frontend code, API route, property business authorization or R2 implementation was changed.

## Exact local configuration

Firebase stays in the unchanged `.env.firebase-dev.local`, targeting **propbanktest** for Auth and Firestore `(default)`. Email settings go only in the separate gitignored **`.env.email-dev.local`**. Never put provider keys in a NEXT_PUBLIC variable or use production dotenv as a fallback. The launcher ignores inherited shell email credentials and reads only this explicit email file.

The optional template is `.env.email-dev.example`. A local copy was created in **capture** mode, with no key, approved recipient list or verified-sender confirmation.

```powershell
Set-Location 'C:\Users\Nova Tech\Desktop\propBank-recovered-20261103-132554'
if (!(Test-Path -LiteralPath '.env.email-dev.local')) {
    Copy-Item -LiteralPath '.env.email-dev.example' -Destination '.env.email-dev.local'
}
notepad .env.email-dev.local
```

| Variable | capture | resend-test |
| --- | --- | --- |
| `PROPBANK_EMAIL_MODE` | `capture` (also the absent-file default) | Explicit `resend-test` |
| `RESEND_API_KEY` | Not needed; stripped from child process | Explicit development sending key |
| `FROM_EMAIL` | Existing sender default retained in templates | Existing verified sender, normally `connect@propbank.care` |
| `PROPBANK_EMAIL_SENDER_VERIFIED` | Empty | `1`, only after checking the sender/domain in Resend Dashboard |
| `PROPBANK_EMAIL_ALLOWLIST` | Empty; captures never deliver | 1-5 comma-separated exact developer-controlled addresses; no wildcards/display names |
| `ADMIN_EMAIL` | Uses existing fictional capture inbox | One of those allowlisted addresses for admin workflows; explicitly blank if no admin emails are desired |

Use a separate Resend **Sending access** key restricted to the verified sender domain where possible. Do not use another project's/customer credentials. This task neither obtains nor changes provider keys, DNS, verified domains or billing. Sender confirmation is an explicit operator attestation, not proof inferred from an API key; Resend still validates domain/key authorization on send. See [Resend API keys](https://resend.com/docs/dashboard/api-keys/introduction) and [Send Email](https://resend.com/docs/api-reference/emails/send-email).

Never add a real customer address to the allowlist. The application cannot infer who owns a mailbox: the operator must list only approved test inboxes. An address in message content does not authorize it as a recipient. Unapproved To, CC or BCC blocks the entire message rather than silently dropping or redirecting recipients. Exact normalized matching covers string/array envelopes and rejects comma injection, display-name headers and control characters. Only known envelope fields are serialized to Resend.

Stop the existing recovered server in its terminal, then restart after configuration changes:

```powershell
npm run dev:check
npm run dev -- --verify-connection
npm run dev
```

The connection flag checks development Firebase and exits; it sends no email. For actual controlled email testing, trigger one normal application event using test accounts and fictional development data. Do not run cron jobs or historical bulk-send scripts. A startup banner states capture or resend-test without printing keys/recipients.

## Delivery semantics and limits

- **capture:** save envelopes/content in gitignored `.cache/firebase-dev-email/outbox.jsonl`; no provider request. The transport throws a clear capture result, retaining existing failed/undelivered outbox semantics. This is not delivery success. Provider credentials and allowlist are inactive in the launched process.
- **resend-test:** require complete approved local configuration and propbanktest development mode. Validate all To/CC/BCC at actual delivery time, including queued work and admin retries. At most 3 total recipients/message. Batch arrays, the explicit batch helper and scheduled send envelopes are rejected. Existing application fan-out uses individually checked messages.
- A durable, locked reservation under `.cache/firebase-dev-email/send-budget.json` permits at most **5 provider attempts per rolling hour per worktree**. Failures/idempotent retries consume reservations too. Restart/hot reload does not reset it. Concurrent lock contention, unreadable/corrupt state or exhausted budget fails closed. Do not delete the budget to bypass it; if a crash leaves `send-budget.lock`, inspect it and confirm no sender process is active before owner-managed recovery. No stale-lock deletion is automatic.
- HTTP/provider errors, timeouts, unverified/restricted senders and a success response without an acknowledgement ID remain failures. The durable outbox records failed delivery; legacy best-effort queue failures are logged generically without keys/recipient details. A successful application mutation/queued response is not proof of email delivery.
- A provider acknowledgement is acceptance, not proof of inbox delivery. Use a controlled inbox and Resend delivery events to confirm delivery. No delivered claim is made for this implementation.
- No scheduler is started by dev. The cron authorization helper and direct visit/property reminder runners reject local Firebase/emulator mode before reads, even if a cron secret leaks into the process. R2 remains the existing local filesystem mock; enabling email cannot enable storage or change Firebase projects.
- The four historical direct-provider scripts now refuse worktrees containing `.env.firebase-dev.local` or explicit local email/Firebase mode, before loading credentials or sending. Arbitrary newly written network scripts remain outside this application transport guard; review new integrations rather than treating this as an OS network sandbox.

## Verification and live-send decision

Focused transport/policy tests use mocked fetch and fictional recipients only. They cover all envelope fields, queue delivery-time policy, capture, batch rejection, provider failures, acknowledgement checks, reminder blocking, legacy script guards and persistent filesystem budget behavior. Existing sender, enquiry/outbox/idempotency and production-like reminder fixtures confirm compatibility; no real reminder runner was invoked.

No real test email was sent: the recovered worktree had no configured Resend key or explicitly approved recipients, and no verified-sender confirmation was supplied. Historical hardcoded script addresses and production application admin settings were not treated as approval or copied into the new file.

The branch remains dev/my-work with recovery changes uncommitted. Original propBank was not read/modified/switched; this task operates only in the recovered worktree, with the existing external development credential file used solely through the Firebase connection check. No merge, rebase, reset, push, deployment, production Firebase access or provider billing/configuration change occurred.

## Consolidated implementation verification

- Typecheck passed.
- 57 focused development transport/Firebase/enquiry/reminder/secret-audit tests passed; another 5 selected existing sender/template/idempotency compatibility tests passed (62 total). All provider sends in tests were mocked.
- npm run dev -- --verify-connection passed against propbanktest Auth and Firestore (default); no writes.
- npm run dev restarted successfully in capture mode on localhost:8080, with R2 still using the local filesystem mock.
- git diff --check and current-snapshot secret-exposure audit passed; nothing staged, committed or pushed.
- No real email send was attempted because an explicit development Resend key, allowlisted recipient and sender-verification confirmation are missing.

Exact source/documentation/test paths changed by this email task (prior recovery edits remain in place):

- `.env.email-dev.example` (new safe template)
- `.env.email-dev.local` (new ignored local capture configuration; never commit)
- `scripts/start-firebase-dev.cjs`
- `scripts/start-emulator-dev.cjs`
- `src/lib/email-development.cjs` and `src/lib/email-development.d.cts` (new shared policy)
- `src/lib/server/development-email-budget.ts` (new durable attempt limit)
- `src/lib/server/services/resend.ts`
- `src/lib/server/services/property-effects.ts` (generic legacy queue failure logging only)
- `src/lib/server/services/reminders.ts` (local scheduler guards only)
- `scripts/run-business-notification-live-test.cjs`
- `scripts/run-visit-notification-live-test.cjs`
- `scripts/run-final-notification-live-test.cjs`
- `scripts/verify-live-email.cjs`
- `scripts/audit-repository-secrets.cjs` (include email-local secrets/ignore checks)
- `tests/development-email-safety.test.cjs` (new)
- `tests/firebase-environment.test.cjs` and `tests/fixtures/native-server.cjs` (isolated policy/capture/budget dependencies)
- `DEVELOPMENT_TESTING_GUIDE.md`, `TWO_DEVELOPER_SETUP.md`, `RECOVERY_FILES_TO_COMMIT.txt`, and this document
