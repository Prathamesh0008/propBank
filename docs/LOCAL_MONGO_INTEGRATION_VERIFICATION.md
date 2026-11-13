# Local Mongo mobile integration verification

Candidate: release/mongodb-mobile-production, based on approved production main
f75304d262bb351d0a963f4a83c6ccfd668a18b6. The original development worktree,
its uncommitted files and protected local configuration remain separate.

## Verification evidence

- Production build: previously PASS on Next 16.4.5; no dependency downgrade.
- Seven focused merge smoke checks: previously PASS using isolated in-memory
  dependencies. They cover password/Google onboarding, duplicate 409, phone edits,
  durable notification staging, partial failure/retry, login, property APIs,
  dashboard overview, inactive Mongo and metadata preservation.
- Eight real localhost integration checks: PASS on 13 November 2026 at
  10:41:48.517 UTC. They used actual Firebase client and Admin SDKs, actual Next
  endpoints and Atlas sandbox transactions, not just a mocked store.
- Final review regression: PASS for metadata-only saves preserving the current
  internal ownership operation marker instead of replaying stale profile state.
- TypeScript: PASS after that small review fix. No broad suite was rerun for
  this final code review/commit.

The live checks used Auth emulator 127.0.0.1:9099 with demo-propbank-local-auth,
Firestore emulator 127.0.0.1:8086 with distinct demo-propbank-local-data, and
propbank_sandbox_app scoped only to propbank_mobile_sandbox. Next ran on port 8080.
The client SDK explicitly used the Auth emulator; server token audience and
Admin SDK DATA writes were checked independently. The AUTH project's Firestore
namespace had zero profiles and the DATA project contained the three synthetic
profiles. Each had one owned Mongo claim and no pending reservation.

Manual registration returned 200; equivalent numbers returned the exact 409
message in preflight and authenticated final registration; a different number
succeeded for the same UID. Simulated Google provider onboarding returned 200
and rejected duplicates. A verified emulator-phone update returned 200 and
released only the prior owned claim. Login, profile/account endpoints, owner
property retrieval and dashboard page returned 200 with synthetic data.

Real Google popup/OAuth login and real SMS were NOT TESTED. Google credentials
were fabricated for the Auth emulator. Browser UI automation was not run.
Email delivery was intentionally unconfigured; no external mail was sent.
The results certify the stated local SDK/HTTP flows, not every unrelated UI flow.

## Isolation and retained local setup

Production credential variables were excluded from test processes. A network
preload blocked destinations other than loopback and the exact sandbox Atlas
hosts; a production Firestore host connection was rejected before registration.
The .env.local before/after digest matched. No production Firebase or Mongo
records were accessed or modified, and no customer inventory was imported.

Raw synthetic journals, emulator config/rules, runtime state and launch helpers
remain Git-ignored under .mobile-demo/local-integration in the original workspace.
They and the existing sandbox credentials are deliberately outside this commit.
No connection string, private key, environment file or recovery archive is part
of the reviewed file manifest.

The local services are independent from production. No push, merge into main,
Vercel deployment, production registration activation or firewall change is
included. See MONGODB_MOBILE_RELEASE_REVIEW.md for runtime gates and release scope.
