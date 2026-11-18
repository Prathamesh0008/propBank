# PropBank production cutover checklist

Prepared locally; no production changes authorized or executed. Every cloud write,
credential change, release deployment, scheduler activation, cache purge and WAF
change below requires separate operator approval. Stop on any failed gate.

## Local release gate

- Review the complete diff on `fix/mobile-number-uniqueness`; preserve existing work.
- Require typecheck, build and isolated regression results. Do not equate them with
  browser or live-provider verification. Review original-Go parity skips separately.
- Approve an exact release commit before any push or deployment; this task creates none.

## 1. Freeze and isolate writers

- Keep the existing project-wide mutation freeze across production, preview and old
  deployment URLs. Preserve other security rules. Read back rule priority/conditions.
- Inventory local servers, old deployments, scripts, Workers, Functions, scheduled jobs,
  CI and other holders of Firebase/R2 credentials. Operator pause alone is temporary.
- Retire/protect unguarded old deployment URLs before relaxing the freeze. Shared R2
  credentials still permit legacy uploads; bucket cleanup did not revoke those keys.
- New Firebase credentials must remain scoped to approved writers. Do not modify old
  Firebase projects. Do not infer isolation from a 401 deployment-protection response.

## 2. Configure the intended Vercel production build

Project: `prop-bank`. Reconfirm team/project linkage and the approved release commit.
Production previously still targeted the old projects; fresh local setup does not
update Vercel. Inspect effective values, never dump secrets.

| Variables | Required production mapping |
| --- | --- |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | propbank-production-new1 |
| NEXT_PUBLIC_FIREBASE_API_KEY / AUTH_DOMAIN / STORAGE_BUCKET / MESSAGING_SENDER_ID / APP_ID | Exact new web-app configuration; six variables share NEXT_PUBLIC_FIREBASE_ prefix |
| FIREBASE_AUTH_PROJECT_ID / FIREBASE_DATA_PROJECT_ID | propbank-production-new1 for both named Admin apps |
| FIREBASE_AUTH_CREDENTIALS / FIREBASE_DATA_CREDENTIALS | Approved new-project service-account JSON in server-only sensitive variables; local Windows file paths cannot work on Vercel |
| FIREBASE_PROJECT_ID / FIREBASE_CREDENTIALS and storage aliases | Inspect any inherited fallback; none may silently select historical DATA. Legacy Firebase Storage is not required for managed R2 files |
| CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY | Existing approved R2 account/key; server-only |
| CLOUDFLARE_R2_BUCKET_NAME | propbank |
| CLOUDFLARE_R2_PRIVATE_BUCKET_NAME | propbank-private |
| CLOUDFLARE_R2_PUBLIC_URL | Existing intended legacy/public base; no private-bucket public access |
| RESEND_API_KEY / FROM_EMAIL | Approved existing provider key and verified-domain sender |
| ADMIN_EMAIL | Explicit authorized admin recipient; confirm effective build/runtime value. Tracked .env.production currently provides a recipient even though Vercel metadata previously lacked the variable |
| APP_URL (or NEXT_PUBLIC_APP_URL fallback) | Approved production origin, currently https://prop-bank.vercel.app; verify email links |
| CRON_SECRET | Server-only high-entropy secret, at least 32 characters, shared only with approved scheduler |

Do not commit secrets. Do not deploy the local credential path. Do not add new emulator
or backend-proxy overrides. Review tracked `.env.production` old public defaults and
prove production environment overrides them. Public Firebase variables are baked into
the browser bundle, so a new build is mandatory after configuration approval.

## 3. Firebase / storage gates

- Metadata: `(default)`, Native, `asia-south1`, ten required indexes READY in
  `propbank-production-new1`; strict direct-client deny rules deployed.
- Read-only verification: registry control active, version 2, policy
  `legacy-conflict-reservations-v1`; do not rerun empty-database initialization after
  users exist. Verify designated admin and existing accounts through authorized checks.
- Auth providers enabled, authorized production/staged origins reviewed. Never weaken
  profile completion, email verification, duplicate-mobile claims or private bindings.
- R2 buckets remain intact and private; application-managed objects use private
  `managed/{uuid}` keys and authoritative new Firestore bindings. Do not import old keys.
- Historical object deletion does not invalidate cached public URLs. Inventory the
  exact historical public/custom CDN origins from the retained backup without exposing
  object names. Operator must purge the relevant zones/URLs or disable retired public
  endpoints and confirm expiration/inaccessibility at every legacy origin. r2.dev and
  custom-domain caches are separate. No purge or DNS/public-access change is performed
  by this plan; do not claim deletion proves cache cleanup.

## 4. Stage and verify without live promotion

After separate release approval, the staged production command is:

```powershell
vercel deploy --prod --skip-domain
vercel inspect <staged-deployment-id-or-url>
```

Verify production-environment credentials, browser project ID, approved commit, health,
admin authorization, private-file denials and WAF enforcement. Do not route the live
alias before these checks. WAF may block media-session and registration mutations;
that is an operational restriction, not proof of broken application authorization.
Do not bypass the WAF with alternate endpoints/methods.

## 5. Promotion, controlled acceptance and unfreeze

- Obtain approval to promote the exact verified staged deployment:
  `vercel promote <verified-deployment-id-or-url>`.
- Confirm production aliases resolve to it, and old unguarded writers are inaccessible.
- Obtain separate approval for the minimum WAF change permitting intended application
  writes. Retain other security restrictions; ensure temporary narrower rules do not
  continue blocking account/profile APIs. Verify published configuration by fresh read.
- Run only approved controlled browser records/recipients; no uncontrolled live signup
  or email tests. Do not mark an operation PASS merely because its API returned 200.
- If a gate fails, retain/reapply the freeze and use a known guarded new-project build.
  Never roll back to old-project configuration or an unguarded mobile writer. Once new
  registrations/payments exist, rollback code only; do not restore stale database or
  registry snapshots, delete claims or overwrite payment/agreement history.

## 6. Schedulers and email (separate activation approval)

Implemented endpoints, not evidence of configured automatic execution:

- `GET /api/cron/notification-recovery`
- `GET /api/cron/reminders?propertyCursor=<url-encoded-continuation>`

Both require `Authorization: Bearer <CRON_SECRET>` and can write/send; do not probe
these during read-only checks. Configure an approved authenticated external scheduler
or compatible platform scheduler without exposing secrets to browsers. Choose cadence
against plan limits, expected volume and the bounded processing budgets; no paid
provisioning or plan assumption. Reminder worker must continue `properties.nextCursor`
until exhausted, with bounded invocation orchestration; do not discard continuation.
Recovery uses bounded candidate batches, atomic leases, backoff and provider idempotency.
Review monitoring for pending, failed, exhausted and reconciliation-required rows, plus
last successful run. Verify actual execution and one approved real delivery before
claiming operational recovery/reminders. Provider acceptance is not inbox delivery.
Keep scheduler calls disabled until the intended release and recipient configuration
are verified. Existing WAF exceptions must be explicitly reviewed, never bypassed.

## Manual browser acceptance (not executed by this task)

Use an isolated environment or separately approved controlled live fixtures:

1. Email/password and Google: signup, verification/onboarding, login, logout, safe next,
   homepage fallback, no flicker; reject duplicate mobile including concurrent claims.
2. Owner/admin: residential/commercial Rent, Sale, Pre-Leased, To Manage create/edit;
   valid monetary/date fields, schedule add/edit/remove and persistence.
3. Image/document upload, refresh, authorized download; deny cross-property/tenant
   Pre-Leased evidence access. No misleading background media permission toast.
4. Approve/reject/request changes; approved public visibility, private To Manage and
   tenant/internal moderation redaction. Verify desktop/tablet/mobile layouts.
5. Assign/confirm/remove tenant, preserve property and agreement inventory; proposed
   inventory remains unconfirmed until acknowledgement. Test draft/finalized boundaries.
6. Scheduled rent and ledger defaults at a rent increase, manual payment override,
   historical payments and renewal snapshots; unapproved renewal leaves active terms.
7. Inspections/services, enquiry assignment/progress/pagination, negotiations and visit
   scheduling/reschedule/cancel with authorized users and expected lifecycle events.
8. Owner/tenant/admin notifications and independent admin read states; delivery/recovery
   visibility and duplicate prevention. Real Resend delivery only with separate approval.
9. Confirm old deployment mutation denial, new-project bindings, live alias and writer
   isolation before declaring production ready. Record any unexecuted flow UNVERIFIED.

## Enquiry API/performance compatibility

`GET /api/enquiries` now accepts `limit` (default 25, max 50) and `cursor` (last record
ID), returning existing `enquiries` plus `hasMore`, `nextCursor`, `order: record_id`.
The built-in admin/agent inbox follows continuation explicitly and deduplicates IDs.
No auto-download of all pages. All other consumers must honor continuation.
Document-ID order includes legacy records without timestamps; it is not a global
newest-first timeline. Concurrent inserts before the cursor appear after Refresh.
Related assignments/notifications and deterministic intake-email IDs are fetched in
batches of at most 30. No additional composite index is required: equality filters
use single-field indexes with document-ID ordering; name-IN lookups use the key index.
If deployed field exemptions disable these existing indexes, stop and seek separate
index approval. No index manifest or infrastructure is changed here.
