# Firestore production release reconciliation

Parents reviewed: production branch `337c0f7b0011ba364e9560d3b64d491fba27ff02` and approved feature `58c36d7dcfa44f3f33c8749f048642683edd7090`.

## Architecture and conflict resolution

The release uses the existing schema-2 Firestore mobile registry. No MongoDB runtime module, driver, migration tool or production environment gate is retained. The Mongo-only documents, import script, four runtime modules, memory fixture and smoke suite introduced by main's Mongo integration are removed from the release tree; their historical commits remain in Git. They are replaced by Firestore production compatibility coverage, not skipped or silently accepted Mongo tests.

`account.ts` and `users.ts` were compared against both parents. Their tested feature implementations retain verified identity/email reconciliation, role checks, verified/recent phone-change requirements, schema-2 claims, quarantine handling, optimistic concurrency, transactional profile/outbox writes and the new email contexts. Main's Mongo saga confirmation, metadata bypass and contact-repair hooks were not transplanted into that architecture.

Independent main improvements retained:

- Registration preflight before password-account creation, using the existing authenticated API client and submission lock.
- Country-prefix paste handling in the mobile input, normalized to the existing canonical format before submission. The active registry's shared normalization/policy definition remains unchanged.
- Firebase verified-phone reservations checked with the authoritative Auth SDK.
- Generic mock module injection and aggregation support in the isolated Firestore fixture.

The new preflight checks the schema-2 active control and a single hashed claim document. It performs no writes or user collection scans. It is advisory: every final registration still claims the number in the existing atomic transaction, including concurrent requests. No MongoDB environment variable is consulted, even with `NODE_ENV=production`.

## Full-regression findings reconciled

The initial full run had 1,117 passes, 12 failures and 5 existing skips. Failures were reviewed individually:

| Finding | Classification / correction |
|---|---|
| Admin occupancy wording | Updated test to the approved `Occupancy unknown` label; no vacancy invented |
| To Manage financial wording | Updated test to `Private management` |
| Submitting-agent edit returns 403 | Corrected notification staging for the exact authorized property-listing edit event; no tenancy/document access is granted |
| Repeated termination with omitted action | Test explicitly retries `terminate` for idempotence; a new default request on an ended agreement still returns 409 |
| Service notification recipient/event counts | Tests distinguish participant versus admin namespaces, self-notification suppression, resolution and archive events |
| Auth-phone reservation mock | Removed a duplicate mock method and retained authoritative phone lookup behavior |
| Legacy generic price projection | Preserve the generic field for authorized readers when contractual rent is unavailable; do not treat it as effective contractual rent |
| Submission email wording | Assert current structured status/address/customer/timestamp labels rather than legacy formatting |
| Legacy formatted stored rent | Compatible read-only parsing for valid rupee/grouped amounts; new API monetary input remains strict |
| Property-edit email count | Count pending-approval and rental-term events separately; no duplicated retry sends |
| Visit preference email formatting | Assert the date and time in their separate summary rows |
| Admin contractual-rent label | Assert the approved applicable-contractual-rent label |

Additional checks cover production-mode registration/account updates without Mongo variables, active-control requirements, malformed/blocked claims, Firebase phone reservations, concurrent ownership, rejected preflight preserving form input, prefix paste, legacy read/storage separation and submitting-agent privacy boundaries.

The five existing skips compare against unavailable original Go reference source. No application, authorization, registry or email assertions were disabled to make verification pass.

## Release boundaries

No Firebase documents/accounts, registry readiness, R2 credentials, environment settings or WAF rules are changed by this merge. Existing public Firebase web configuration and non-secret application metadata in the tracked `.env.production` file are unchanged. Test-generated migration-audit outputs are excluded after review, as are build-only generated source-path changes.

A successful production build, secret scan, full regression result and clean diff are required before the merge commit is pushed. Live acceptance uses read-only public requests and unauthenticated denial checks; it does not register accounts, mutate application data or send email. The previously routed Vercel deployment is the rollback reference; no rollback or configuration mutation is performed implicitly.

## Verification and blocked release state

The post-correction full regression invocation finished with 1,137 tests: 1,132 passed, 0 failed and 5 existing original-Go-reference skips. TypeScript completed successfully. A canonical-decimal preservation case added after test collection still requires its focused rerun during final release verification. The private-credential scan found no private keys/provider credentials; the unchanged public Firebase web configuration and app metadata in the tracked production env file were reviewed separately.

The production build was not started: baseline production availability failed before the merge was committed or pushed. The existing routed deployment `dpl_8kR7co2Y1prvu24mdgDnRA23hLpz`, release `8cc9d8c97c9c91323af6c95935203e0ff029facb`, has READY build metadata but responds HTTP 402 with `x-vercel-error: DEPLOYMENT_DISABLED` and `Payment required` for the homepage and checked API routes. The reason must be reviewed by the Vercel project owner (deployment status, usage and billing); no billing/configuration action was attempted. No runtime error clusters were reported for the queried hour, which does not establish health while requests are edge-blocked.

The merge remains local and uncommitted with conflicts resolved and Mongo removal staged. Remote main and the current production alias are unchanged. Resume only after the Vercel restriction is resolved, then rerun the pending focused/type/build/release checks, recheck remote refs, commit the reviewed merge and perform a non-force push/deployment verification. No new production records, Auth accounts, emails, credential/configuration changes or WAF changes were made.


## Resumed release verification

Production access was restored before resuming this release: the routed homepage returned HTTP 200, while unauthenticated auth-user and admin rented-directory requests returned HTTP 401. The previous HTTP 402 restriction is historical and no longer blocks this verification.

The complete resumed regression run finished with **1,138 tests: 1,133 passed, 0 failed and 5 existing original-Go-reference skips**. This includes the pending canonical-decimal precision case. TypeScript (`--noEmit --incremental false`) and the optimized Next.js production build both passed. The build used a child-process-only isolated output directory; generated source/configuration and audit files were restored to their pre-verification contents. The tracked-file/archive secret scan examined 1,821 files and found no private credentials. The unchanged tracked browser-safe Firebase configuration and non-secret application metadata were checked separately.

Registration/account tests confirm the Firestore registry operates without MongoDB settings and retains active schema-2 policy, authoritative Firebase phone reservations, malformed/blocked-claim rejection and atomic concurrent ownership enforcement. No MongoDB runtime source or package dependency remains. Remote main and the approved feature SHA were rechecked before committing. The existing routed deployment `dpl_8kR7co2Y1prvu24mdgDnRA23hLpz` is retained as the rollback reference.

Live release checks remain read-only except for an intentionally malformed registration-preflight request that is rejected before any database access. No live account creation, profile updates, email sends or registry mutations are part of release verification. Authenticated browser acceptance is a separate manual check.
