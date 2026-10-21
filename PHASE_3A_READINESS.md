# Phase 3A — Live integration readiness

**Result: BLOCKED for live acceptance testing.** Read-only inspection on 2026-10-21; only this report was created. No users, application records, files, rules, indexes, schedules or deployments were changed. No emails/jobs/migrations were triggered.

## Environment and checks

| Check | Status | Evidence / implication |
| --- | --- | --- |
| Environment classification | **BLOCKED — isolated staging not established** | Auth/browser: `propbank-7601b` (display name PropBank); Firestore: `propbank-944fc` (Propbank). Both ACTIVE, without staging labels. Existing accounts/data are present. Treat this shared live configuration as production; business classification still needs owner confirmation. |
| Local configuration alignment | **PASS** | Auth credentials match the browser/Auth project; Data credentials match Firestore. Development loads `.env.local`; production-mode loading uses `.env.local` and `.env.production`, selecting the same projects/buckets. No Auth/Firestore emulators configured. |
| Staging accounts | **BLOCKED** | Complete bounded read: 13 Auth accounts, 9 Data profiles; no explicit E2E/staging account candidates found by test naming/claim markers. No safe six-account mapping or controlled login credentials supplied. Existing accounts must not be repurposed. |
| R2 names/access | **PASS — read only** | Public `CLOUDFLARE_R2_BUCKET_NAME=propbank`; private `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME=propbank-private`; names differ. Signed HEAD bucket requests both returned 200. R2 account/access credentials and public prefix are configured. No upload/delete performed. |
| Deployed bucket configuration/privacy | **BLOCKED** | No linked deployment configuration or Cloudflare management token available. Local source selects the private bucket for new managed uploads and gates public covers by publication policy, but deployed variables, custom domains and current public-access settings were not independently verified. Previous disposable-object evidence is not a new permission test. |
| Deployed Firestore rules | **PASS — inspected** | Live release retrieved, updated 2026-03-19: one global recursive rule with `allow read, write: if false`. Browser clients are denied, including `enquiry_assignments`, `storage_objects`, `enquiry_controls` and `legacy_storage_cleanup`. Admin SDK bypasses these rules; API authorization remains essential. No browser Firestore/storage SDK imports found in application source. Staging/deployment rule parity remains unverified. |
| Deployed indexes | **FAIL** | Composite-index listing succeeded: none configured. Synthetic, read-only queries returned code 9 / index required for the three queries below. No customer documents were returned. Broker assignment's single-field `brokerUID` indexes are READY. |
| Control-record TTL | **FAIL — housekeeping prerequisite** | Direct field metadata shows no TTL policy on `enquiry_controls.ttlAt`. Rate/replay expiration is enforced by code, but physical record expiry is not configured. |
| Authentication/API review | **PASS — source inspection only** | Bearer tokens and media cookies use revocation checks; active persisted roles and current property relationships enforce access. Media cookie: 20 minutes, HttpOnly, SameSite=Strict, Secure in production/HTTPS; client renewal every 10 minutes and cache clearing on identity change. Phase 2A approval, 2B assignment and 2C verification/admin-visits guards and transaction/version checks are present. Real multi-user sessions/revocation remain untested here. |
| Google sign-in domains | **PASS / BLOCKED** | Auth REST configuration has five authorized domains including localhost; none explicitly named staging/E2E. Staging HTTPS origin/provider setup and actual controlled sign-in remain unverified. |
| Resend sender | **PASS — metadata only** | Key and `FROM_EMAIL` configured; sender domain `propbank.shop` reports VERIFIED. No email sent and no new delivery claim made. |
| Recipient isolation | **FAIL** | `ADMIN_EMAIL` is absent: general enquiries fall back to the hardcoded business Gmail inbox. No recipient override/allowlist configured. Other workflows send to actual profile/relationship emails; even visits with reminder type `none` can send confirmation/update emails. |
| Reminder scheduling | **BLOCKED — external schedule unknown** | `CRON_SECRET` meets the 32-character minimum. Both GET and POST `/api/cron/reminders` can write records and send visit/rent/expiry mail; neither was invoked. No scheduler/deployment configuration found locally; README identifies an external scheduler. Its target, timing and environment isolation are unverified. |
| Local typecheck | **PASS** | `npm run typecheck`, exit 0. No mutation-capable functional/browser/provider scripts were run in this phase. |

Required composite indexes, collection scope, subject to staging validation/approval:

- `visits`: `userId ASC`, `visitDate ASC`.
- `inspection_reports`: `propertyId ASC`, `createdAt DESC`.
- `inspection_reports`: `userId ASC`, `createdAt DESC`.

An initial index/field-list metadata request returned HTTP 400; corrected index listings and direct field lookups succeeded. The missing-index findings above come from actual query failures, not just static inference. Hosted environment variables could not be inspected; local production-mode configuration is not proof of remote deployment settings.

## Required isolated accounts and configuration

Use six distinct, verified, operator-controlled Google/Firebase identities. The following are **proposed identifiers, not existing accounts**; actual addresses must use an approved controlled domain and be recorded with their Auth UIDs before execution.

| Proposed account label / email local part | Persisted role | Relationship |
| --- | --- | --- |
| `pb-e2e-20261021-customer` | individual | Customer only |
| `pb-e2e-20261021-owner` | individual | Owner of synthetic property |
| `pb-e2e-20261021-tenant` | individual | Submitting/linked tenant |
| `pb-e2e-20261021-broker-a` | agent | Assigned broker |
| `pb-e2e-20261021-broker-b` | agent | Initially unassigned broker; reassignment target |
| `pb-e2e-20261021-admin` | admin | Test administrator |

Missing prerequisites: approved staging Auth/Data project IDs and least-privilege credentials; controlled accounts; staging HTTPS host and authorized domain; isolated R2 buckets/credentials; explicit mail recipients and scheduler ownership. Customer/owner/tenant are relationship scopes, not new global roles.

Configure staging equivalents of `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_AUTH_PROJECT_ID`, `FIREBASE_AUTH_CREDENTIALS`, `FIREBASE_DATA_PROJECT_ID`, `FIREBASE_DATA_CREDENTIALS`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET_NAME`, `CLOUDFLARE_R2_PUBLIC_URL`, and `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME`. Use approved staging legacy-GCS configuration only if testing that path. Never copy production credential values into the report.

## Staging acceptance plan — not executed

1. Approve exact staging projects, host and distinct buckets (proposed names: `propbank-staging-public` / `propbank-staging-private`; availability unverified). Confirm the running server and built browser bundle point only to staging. Keep staging credentials unable to mutate live projects/buckets.
2. Provision the six controlled identities and matching staging `users/{uid}` profiles. Record verified email, active state, persisted role and UIDs in a restricted test manifest. Retain deny-all browser Firestore rules; verify direct authenticated/anonymous SDK access is denied. Create approved indexes and wait for READY.
3. Disable external staging scheduling and leave `RESEND_API_KEY` unset for the first workflow pass. Do not rely on `reminderType=none` to suppress transactional mail. Inspect every automatic recipient path before enabling delivery; explicitly configure `ADMIN_EMAIL` to a controlled inbox.
4. Use a unique `E2E3A-20261021-<run-id>-` prefix in property titles, filenames, enquiry messages and review notes. Use synthetic data only. Keep server-generated property IDs/UUIDs and `managed/<uuid>` object keys unchanged; capture every exact record/object ID in the manifest. Never assume a prefix grants cleanup permission.
5. Test real Google login, role redirects, logout/login, refresh, token/cookie expiry and controlled-account revocation over HTTPS. Test pending listing privacy, approval/rejection/resubmission and archive/restore; tenant intake must remain private.
6. With approved disposable staging files, test private upload/download, anonymous/unrelated/wrong-property denial, direct origin/custom-domain denial, and approved public cover visibility. Exercise upload/deletion failures only inside staging and record resulting cleanup intents.
7. Test enquiry assignment/reassignment/unassignment with both brokers, private-note isolation and stale writes. Test owner rejection/reconsideration/separate evidence-based approval. Test admin visit filters, status/cancellation, requester visibility and conflicts; broker progress must not create visits.
8. After separate mail approval, enable a staging Resend key with only controlled identities/recipients. Send explicitly approved transactional messages. Invoke reminder jobs only against the isolated staging database, with the scheduler disabled and all due records synthetic; verify deduplication and delivery. Never call the shared live cron endpoint.
9. After cleanup approval, remove only manifest-listed test files/records through supported APIs or reviewed staging-only cleanup. Check aliases/bindings first, reconcile only exact approved managed IDs, remove dependent records/control entries, and delete disposable accounts last. Confirm unrelated/public assets remain accessible; retain sanitized test evidence. Do not run bulk-prefix or bucket-wide deletion.

## Historical URL prerequisites

`phase-1-security/STORAGE_MIGRATION_PLAN.md` is prepared, not executed. Its prior snapshot contains 29 confidential references / 27 distinct confidential values; these are historical counts, not a fresh inventory. Before any migration: refresh a bounded read-only inventory, approve exact sources/aliases, back up metadata, verify private destination permissions, verify real sessions and checksums, switch references transactionally, then obtain separate source-revocation/cache-purge approval. Replacing URLs alone does not revoke historical public copies. Preserve published photography and GCS token/ACL behavior until an exact migration is approved.

## Exact actions requiring approval

- Provision/change staging projects, hosting, credentials, OAuth domains, buckets, bucket policies or deployed environment variables; deploy any code/rules.
- Create the six accounts, assign roles, seed/update/delete test records, revoke sessions, or perform disposable staging uploads/deletions and cleanup.
- Create the three indexes or enable TTL, identifying the exact target project. No production index/rule changes are implied by this report.
- Enable Resend, approve sender/recipient lists and messages, trigger any reminder endpoint, or create/change scheduler jobs.
- Execute historical copying, reference updates, source deletion/token revocation, ACL/policy changes or cache purges: separate manifest-specific production approval required.

No such approval was assumed or action executed. Stop before live acceptance until isolation and the listed prerequisites are resolved.
