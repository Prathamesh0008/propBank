# Staging and retirement guide

## Preserve existing data

No existing collection is renamed or deleted. No backfill or live write was run during development. Keep Auth and DATA projects separate. Retain existing R2/GCS bucket configuration and historical public URLs.

Two additive collections are created only by successful authenticated requests:

- `negotiations`: propertyId, ownerUID, customerUID, explicitly assigned brokerUID; original asking price, each offered/proposed/counter/approved/final amount; status, version, timestamped history. Existing buyers remain unchanged. Negotiations do not automatically overwrite property rent or produce a legal agreement. The owner enters the accepted terms in the existing agreement/property workflow.
- `file_uploads`: SHA-256 object-key document ID, key, URL, uploaderUID, contentType, createdAt. New upload keys include a UUID. Old object paths are retained. Old files without metadata use existing owner/admin deletion authorization.

Visit documents gain `reminderDelivery` (generation hash, frozen email payload, status, lease, leaseUntil, firstAttemptAt); existing `notifiedAt` is respected. No reminder collection is introduced. Rescheduling resets delivery tracking only when the schedule changes.

Ensure deployed Firestore rules restrict server-owned collections. Admin SDK authorization bypasses client rules, so server permissions remain mandatory. Existing deployed rules are not included in this repository; review broad wildcard grants before adding narrower rules, because Firestore grants are additive. Do not overwrite existing rules with a generic new ruleset.

## Acceptance environment

`npm run test:acceptance` exercises real Next.js screens against native handler code with test-only Firebase sessions and isolated in-memory Firestore, R2 and Resend. The adapter is under tests and cannot be enabled in production source. It does not establish live Google OAuth, Firestore index, storage or mail deliverability readiness.

For live UAT, configure a separate staging Auth/DATA project and storage environment; use four disposable test profiles (admin, owner/individual, tenant/individual, customer/individual), plus an agent for delegated negotiation. Use actual Firebase bearer tokens. Test self UID query access, cross-UID rejection, owner also tenant, property create/edit/publish/archive/restore, tenant assignment, document upload/read/delete, inspections/reviews, agreement renewal/termination, inquiries, visits, owner acceptance/counter/rejection, customer acceptance and admin completion. Check email delivery to controlled staging inboxes. Confirm logout/account switching clears cached private data.

Keep credentials in ignored local files or the deployment secret store. `.env.production` currently contains no configured server secret values; `.env.local` must remain untracked. Never commit staging token files, Admin accounts or private environment values.

## Native visit scheduler

Endpoint: `GET` or `POST /api/cron/reminders`, with `Authorization: Bearer <CRON_SECRET>`. The server requires a secret of at least 32 characters, RESEND_API_KEY and FROM_EMAIL. No UID, admin role or query parameter substitutes for the secret.

Invoke every minute from the chosen hosting scheduler. The route awaits delivery and persistence; it does not depend on a long-lived Next process or a browser tab. It queries visits in the next seven days, finds the due email window, processes up to 20 candidates with four workers, uses Firestore transactional two-minute leases and the same Resend idempotency key for retries, and persists `notifiedAt` only after provider success. Each invocation reports counts and `limited`; monitor this and increase capacity/query pagination for higher volume. Expired visits are skipped rather than emailed after the appointment.

Example Vercel production configuration, **enable only at the controlled cutover**:

```json
{"crons":[{"path":"/api/cron/reminders","schedule":"* * * * *"}]}
```

Verify that the chosen hosting plan supports minute frequency and the route's 300-second execution allowance. An external scheduler can call the same HTTPS endpoint with a secret header. Do not put the secret in the URL, repository, public variables or browser requests. [Vercel scheduler security](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Provider acceptance is not proof of inbox delivery. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) lasts 24 hours; the implementation stops automatic ambiguous retries after 23 hours and counts `needsReconciliation`. Inspect provider delivery logs before resetting such records. Sender configuration must remain stable during retries. Frozen pending payloads contain customer information and must remain server-only.

## Cutover gate

1. Obtain the original Go scheduler/controllers and its deployed schedule/configuration. Compare exact visit, rent, tenant, agreement, property reminder and notification rules. Visit reminder support here is not a claim that all Go jobs have been ported.
2. Restore the Go source path used by the test oracle and install its supported Go toolchain; run the full server suite with all comparison tests.
3. Run live staging UAT, including Firestore index availability, new R2 upload/delete/replace behavior and controlled mail delivery. Verify deployment secrets and the cron endpoint on the intended hosting platform.
4. Review existing public document/media exposure. Authorization now restricts API metadata, but historical public object URLs remain publicly retrievable. Private document storage requires a compatible private bucket/serving strategy and an explicit data/URL migration; none was provisioned during this audit.
5. During a maintenance cutover, stop the old scheduler, then enable the new scheduler. Do not run both mail schedulers in parallel: Go does not participate in the new leases/provider idempotency scheme. Record the rollback point and monitor provider/cron failures.
6. Retire Go/Railway only when every old job and authenticated workflow has been verified, not merely because Next builds.

Current status: **NOT READY** for Go/Railway retirement. The application has no active HTTP dependency on either, but scheduler parity and live external acceptance remain unresolved.
