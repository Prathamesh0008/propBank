# MongoDB mobile uniqueness: reviewed local commit

Baseline: approved production main `f75304d262bb351d0a963f4a83c6ccfd668a18b6`.
Candidate branch: `release/mongodb-mobile-production`. This is a local code
handoff for controlled GitHub release preparation, not production activation.

## Scope and client-feature preservation

The Mongo registry controls canonical Indian mobile uniqueness for manual
registration, Google onboarding, verified phone changes and authorized correction
of legacy missing/invalid contacts. Firebase remains authoritative for identity
and existing Firestore application data. Request UID/email checks, verified
identity checks, recent authentication for phone changes and unresolved historical
conflict quarantine remain server-side.

The production Firebase client initializer, Google popup handler, Admin SDK
initializers and token verification module are unchanged. Property/admin/service
modules and the transactional-email implementation are unchanged from baseline.
The user/account adapters retain notification-intent staging in the same Firestore
profile transaction. The original local branch was NOT copied over newer production
features; this candidate starts with the complete approved production tree.

The registration UI adds a fail-closed preflight before password Auth creation and
handles pasted country prefixes consistently. The final server claim independently
enforces uniqueness. Ordinary login and non-phone metadata edits remain available
without Mongo. Metadata updates preserve raw historical contacts and cannot reset
the internal ownership operation marker. No existing number is silently rewritten.

## Runtime gates and fail-closed behavior

- Mongo access is server-only, lazy and pooled. There is no embedded URI, index
  provisioning on import, collection creation on request, or startup activation.
- Production ownership writes require `PROPBANK_MOBILE_BACKEND=mongodb` and
  explicit `MONGODB_MOBILE_DATABASE=propbank_mobile_registry`. Missing/wrong
  configuration fails with 503; production cannot fall back to legacy ownership.
- The control document must have the correct policy/version, active status,
  verifiedImport and writerIsolationVerified flags, plus an approved fingerprint.
  Required unique number, owned-UID, reserved-UID and idempotency indexes are
  verified. Missing control, inactive state, missing indexes or connection failures
  prevent ownership writes.
- A reservation precedes the Firestore profile compare-and-set. Confirmation
  follows only a resolved profile commit. Uncertain outcomes retain reservations
  and prior owned claims for same-UID recovery; no Auth deletion compensation or
  lease/TTL expiry may release them. Only the matching UID's prior owned claim
  can be removed during confirmation.
- Runtime code only reads the control document; no API activates it. The historical
  helper requires explicit approval, matching maintenance manifest and exact
  inventory, imports transactionally/idempotently and leaves activation false.
  A Boolean flag is operator approval evidence, not an automatic historical audit:
  the operator must verify full import coverage before setting release flags.
- The existing Vercel WAF freeze is an independent release boundary. This code
  commit changes no firewall or environment. Mongo mode replaces the obsolete
  Firestore ownership/control dependency without opening an unprotected path.

Therefore deploying this code alone does not open registration: it does not
provision/import claims, supply credentials or set active/verification flags,
and does not remove the existing mutation freeze. Cutover remains a separately
authorized operation with scoped runtime credentials, verified historical import,
writer drain and recovery evidence. Never use atlasAdmin for runtime access.

## Reviewed commit manifest — 19 files

- package.json
- package-lock.json
- src/features/auth/GoogleAuth.tsx
- src/features/auth/RegistrationMobileField.tsx
- src/lib/indian-phone.ts
- src/lib/server/mobile-registry.ts
- src/lib/server/mongodb.ts
- src/lib/server/mongo-mobile-policy.ts
- src/lib/server/mongo-mobile-store.ts
- src/lib/server/mongo-mobile-profile.ts
- src/lib/server/services/users.ts
- src/lib/server/services/account.ts
- src/app/api/auth/registration-check/route.ts
- scripts/mongo-mobile-history.cjs
- tests/fixtures/native-server.cjs
- tests/fixtures/memory-mongo.cjs
- tests/mongo-integration-smoke.test.cjs
- docs/LOCAL_MONGO_INTEGRATION_VERIFICATION.md
- docs/MONGODB_MOBILE_RELEASE_REVIEW.md

Unchanged shared policy/migration dependencies already exist on production main.
The lockfile adds the Mongo driver and its dependency graph while keeping Next
16.4.5 and existing application dependency versions. The test-fixture changes add
module injection and Firestore count aggregation for focused integration checks.

Generated local `next-env.d.ts` and `tsconfig.json` path changes are not release
implementation and remain unstaged. Original development work, environment files,
local launchers/data, recovery files and production administration/preflight
artifacts outside this candidate are preserved and excluded. No customer snapshot,
private key or synthetic runtime account journal is committed.

## Verification and readiness

Prior production build, seven merge smoke checks and eight real localhost SDK/HTTP
checks passed; the final review's single metadata-marker regression and TypeScript
check passed. Broad suites and Atlas integration were not rerun for this commit.
The preserved live Google sign-in implementation was reviewed; real Google OAuth
and SMS remain explicitly untested. See LOCAL_MONGO_INTEGRATION_VERIFICATION.md.

Ready for controlled GitHub release preparation after the local commit is verified.
Not authorized or certified here: push, main merge, production provisioning/import,
deployment, firewall release, work-drain clearance or registration activation.
