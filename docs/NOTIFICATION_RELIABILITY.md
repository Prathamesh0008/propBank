# Notification reliability — Phase 3

Local implementation only. No production data, mail, configuration, indexes or scheduler changed.

## Durable boundary

Business transactions stage deterministic `notification_intent` records in the existing
`email_deliveries` collection, alongside eligible recipient delivery records. No provider
calls happen inside a transaction. Recipient lookup failures or event-store failures
before commit fail the transaction; after commit, failures remain in the outbox.
Existing property-submission, moderation, relationship-invitation and reminder outboxes
remain supported. Admin lifecycle records are staged in their existing transactions.
Other admin activity is expanded idempotently from the durable intent after commit.

No historical events are backfilled. No second event database is introduced.
The trusted profile writer accepts an optional transaction staging callback; every
mobile-registry readiness, UID, claim and quarantine check is unchanged.

## Event and recipient matrix

| Event / producer | Trigger | Participant mail | Admin feed / configured email | Template / deterministic key |
|---|---|---|---|---|
| Registration / users | New committed profile | New account | Agent registration only | registration-welcome, agent-registration / UID + registration |
| Profile, mobile / users, account | Committed profile edit | Affected account | Minimal activity summary | account-security / UID + operation time |
| Security acknowledgement / account | Authenticated security-event acknowledgement | Account; previous address for verified email changes | No routine admin security mail | account-security / operation ID or verified address transition |
| Property submission, admin-assisted / properties | Committed property submission | Submitter | Yes | property-review / property + moderation revision + status |
| Listing decisions / properties | Committed moderation transition | Submitter | Yes | property-review, admin-property-lifecycle / moderation revision |
| Assignment, replacement / tenants, properties | Committed tenancy change | Owner + linked new/former tenant | Yes | tenant-assigned, tenant-replace / tenancy revision or immutable assignment IDs |
| Removal / tenants, properties | Active relationship ends | Owner + linked former tenant | Yes | tenant-removed / tenancy ID + committed change |
| Rental terms / tenants, properties | Actual rental-term changes | Owner + active linked tenants | Yes | rental-terms-updated / committed property timestamp |
| Relationship confirmation / relationship-links | Verified link committed | Owner + confirming tenant | Yes | tenant-linked / claim ID + linked |
| Rent due / reminders | Eligible due-date reminder | Owner + linked tenant | No routine reminder fan-out | existing rent-reminder / tenancy + due date + offset + recipient |
| Payment status / property-hub | Ledger status changes | Owner + active linked tenants | Yes | rent-payment-recorded / property + billing month + ledger version |
| Renewal, termination / agreements | Authorized lifecycle transition | Owner + linked tenant | Yes | agreement-activity, agreement-termination-admin / property + history version + action |
| Agreement expiry / reminders | Existing expiry reminder offsets | Owner + linked tenant | No extra routine reminder email | existing expiry reminder / agreement version + expiry date + offset |
| Service creation, status / migration-remainder | Committed request/status change | Requester + owner | Yes | maintenance-activity / request + history version + status |
| Visit create/update/delete / visits | Committed scheduled/rescheduled/cancelled/completed activity | Requester; eligible property owner | Yes | existing visit-activity requester/owner/admin templates / visit + management version + status + role |
| Negotiations / negotiations | Committed offer/decision | Owner + customer + assigned broker | Yes, minimal admin summary | negotiation-activity / negotiation + version + status |
| Owner verification / owner-verification | Committed decision | Submitting tenant + owner | Reviewing admin; persistent admin activity | owner-verification-decision / property + verification version + action |

Unlinked tenants are not matched by editable contact values. Existing trusted recipient
resolution and verified-Auth requirements remain. Configured admin delivery uses
`ADMIN_EMAIL`; no personal address is hardcoded. Missing configuration is visible as
unconfigured; absent provider/sender configuration leaves attempted deliveries retryable.
Private evidence is not copied into admin previews. Restricted agreement detail mail
retains its existing configured-admin recipient and branding.

## Recovery and monitoring

`GET` or `POST /api/cron/notification-recovery` requires the existing `CRON_SECRET`
(at least 32 characters), using constant-time bearer comparison. It is not a browser
endpoint. Each invocation reads at most 20 timed candidates, processes at most 8,
and scans at most 10 legacy records using a persisted document-ID checkpoint.
Intent expansion does not send child mail in a recovery invocation; child deliveries
are independently claimed by subsequent bounded runs. Normal post-response dispatch
may send the children immediately. Recipient expansion is capped at 60 per intent.

Two-minute atomic leases prevent concurrent workers from claiming the same row.
Lease-token fencing prevents stale workers from overwriting a newer claim's result.
Provider idempotency keys are retained. Five failed attempts become `exhausted`;
non-retryable request errors become `permanent_failure`. Backoff is 5/10/20/40/60
minutes for delivery attempts. The existing 23-hour provider-reconciliation safeguard
becomes explicit `reconciliation_required`, never an automatic resend.
Obsolete invitations and reminders remain cancelled. Poisoned intents are isolated.

Admin-only `GET /api/admin/email-deliveries/overview` returns aggregate pending,
processing, retryable, sent, exhausted, permanent/reconciliation counts, outstanding
intent count, legacy-discovery completion and last successful recovery time. The
existing delivery-management page displays the summary and sanitized errors.
An exhausted/permanent/reconciliation row needs an explicit operator decision;
the worker does not reset retry ceilings or invent a fresh provider key.

## Admin read state

`readByUIDs` on each existing notification tracks per-admin acknowledgement.
Legacy global `isRead` is not inherited by every admin. Historical notifications may
therefore appear unread on first use. No historical records are bulk rewritten.
Feed pages inspect at most 25 timestamp-ordered candidates and preserve continuation
even when the local read/unread filter yields a sparse page. Unread counts use indexed
aggregations. Mark-all-read uses 200-document ID pages and a stable cutoff; the client
passes the continuation cursor. Legacy directory responses are capped at 100; use the
feed for full pagination. Private previews remain admin-only.

## Required operational approval and verification

1. Review/deploy the additional indexes in `NOTIFICATION_RELIABILITY.indexes.json`.
   Merge with existing index definitions; do not replace unrelated indexes.
2. Verify existing admin recipient, Resend key and verified sender domain in the
   intended environment without exposing values. No config was changed locally.
3. Separately approve/configure an external scheduler with server-side bearer auth
   for the recovery endpoint. A one-minute cadence is a starting point, subject to
   quota and backlog review. Never place the secret in client variables or URLs.
4. After deployment approval, inspect recovery timestamps/backlog and use authorized
   controlled fixtures to verify actual provider acceptance and inbox delivery.
   Local mocked tests do not verify live mail, indexes or scheduling.

## Boundaries and limitations

- Firebase Authentication changes occur outside Firestore. A client-completed password
  change cannot be atomically observed by this server if the acknowledgement request
  never arrives. Once acknowledged, its audit and mail intent are atomic and replayable.
- The existing Auth display-name/photo synchronization and its compensation are not a
  distributed transaction. Profile notices describe a recorded profile update, not
  proof that the external Auth operation succeeded.
- Recovery cannot reconstruct notifications lost before this release. No historical
  business or notification records are scanned for backfill.
- Automatic recovery is **not operational** until the scheduler and required indexes
  are deployed and verified. `sent` means provider acceptance, not inbox delivery.
- Legacy discovery is resumable and one-pass; producers that predate this release must
  be retired before treating discovery completion as comprehensive.

## Exact Phase 3 file manifest

Created:
- `src/lib/server/services/notification-recovery.ts`
- `src/app/api/cron/notification-recovery/route.ts`
- `src/app/api/admin/email-deliveries/overview/route.ts`
- `tests/notification-reliability-phase3.test.cjs`
- `docs/NOTIFICATION_RELIABILITY.md`
- `docs/NOTIFICATION_RELIABILITY.indexes.json`

Modified (other pre-existing working-tree changes are retained):
- `src/lib/server/mobile-registry.ts` (optional trusted transaction callback only)
- `src/lib/server/services/transactional-email.ts`
- `src/lib/server/services/admin-lifecycle.ts`
- `src/lib/server/services/admin-directories.ts`
- `src/lib/server/services/notifications.ts`
- `src/lib/server/services/properties.ts`
- `src/lib/server/services/property-effects.ts`
- `src/lib/server/services/tenants.ts`
- `src/lib/server/services/agreements.ts`
- `src/lib/server/services/property-hub.ts`
- `src/lib/server/services/media.ts`
- `src/lib/server/services/migration-remainder.ts`
- `src/lib/server/services/visits.ts`
- `src/lib/server/services/negotiations.ts`
- `src/lib/server/services/owner-verification.ts`
- `src/lib/server/services/relationship-links.ts`
- `src/lib/server/services/users.ts`
- `src/lib/server/services/account.ts`
- `src/lib/server/services/enquiries.ts`
- `src/lib/server/services/group2-mail.ts`
- `src/features/admin/AdminNotificationFeed.tsx`
- `src/features/admin/AdminEmailDeliveries.tsx`
- `tests/fixtures/native-server.cjs`
- `tests/email-sender.test.cjs`
- `tests/negotiations-reminders.test.cjs`
- `tests/visit-planner-repair.test.cjs`
- `tests/property-enquiry-email.test.cjs`

Regression fixtures now wait for post-response delivery, expect atomic failure if the
intent store is unavailable, and distinguish permanent provider validation errors from
retryable transport failures. Invalid legacy pricing/profile fixtures were supplied
valid explicit values. The two pre-existing `email-events-phase` tests with missing
mobile-readiness setup were not modified or included in this targeted pass.
