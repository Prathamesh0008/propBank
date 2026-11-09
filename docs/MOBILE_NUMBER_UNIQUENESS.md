# Global registered-mobile uniqueness: implementation and rollout report

> Superseded activation policy: schema-2 legacy-conflict reservations now allow activation with blocked duplicate numbers and explicit unresolved account states, without changing historical profiles. Version-1 canonicalization/reconciliation prerequisites below are historical. See [current implementation and runbook](MOBILE_LEGACY_RESERVATIONS.md).


Date: 2026-11-06. Safety branch: `fix/mobile-number-uniqueness`. Starting commit: `fa98b7e0e53d29053365be4c1a1b8230a313f686` (`main`). Existing untracked project-knowledge documents were preserved. No production connection, migration, provider operation, setting change, push or deployment was performed.

**Implemented locally and tested; NOT production activated.** Deploying the code without initialization intentionally blocks registrations/profile writes involving registered mobiles with HTTP 503. Normal existing login/profile-status reads do not consult the registry and remain unchanged.

## 1. Confirmed root cause

`users.ts` queried phone equality before a separate profile write. The UID-only creation transaction could not serialize two different UIDs claiming one phone. `updateUser` also had an independent missing-profile creation path. `account.ts` used another non-atomic duplicate query. Whole-profile `saveUser` calls from tenancy/property effects could replay stale mobile data. Raw string equality treated equivalent legacy formats inconsistently.

## 2. Architecture chosen

A single server-only `writeUserWithMobile` transaction owns registered mobile writes. All account roles (`admin`, `agent`, `individual`) must supply valid Indian contact numbers; no administrator exemption from the mandatory number requirement remains. UIDs, property/tenant relations, roles and Firebase provider-linking design are unchanged.

Canonicalization reuses `indianMobile`: 10 national digits starting 6-9, optional +91 and accepted punctuation, stored `+91XXXXXXXXXX`. The registry document key is lowercase SHA-256 of `propbank:mobile:v1:` plus the canonical number. The pure shared policy is also loaded by the maintenance script, preventing normalization/key drift. SHA-256 here avoids plain phone document IDs, **does not anonymize enumerable phone numbers**, and requires private registry rules/IAM. No new HMAC secret or startup-generated key exists.

The write transaction reads readiness control, target user, requested phone claim and old claim if changing. It checks the verified profile-phone snapshot to reject concurrent changes. It rejects another UID's claim, reserves/retains the number, updates the profile and releases the old owned claim together. All reads precede writes. Existing valid profile phones whose claims are missing/corrupt fail closed. Create-only prevents an onboarding race from overwriting an existing UID profile. Failure rolls back profile and registry together.

No runtime user collection scan, fallback phone query, per-keystroke request, availability endpoint, login registry read, polling or N+1 query was added. The uniqueness transaction uses three direct document reads for a new/same-number write, four for a change. Existing surrounding authorization/provider/notification reads remain. Readiness is read, not written, on normal mutations.

## 3. Files changed

- `src/lib/server/mobile-registry-policy.ts` (new): pure canonical key policy/constants shared by runtime and migration.
- `src/lib/server/mobile-registry.ts` (new): canonical validation and atomic trusted mobile/profile writer.
- `src/lib/server/services/users.ts`: onboarding, POST upsert, PUT/PATCH update and missing-profile creation use the transaction; metadata saves omit phoneNumber. Admin missing-profile creation verifies the target Firebase Auth email rather than accepting arbitrary identity data; the previously unreachable PUT path is now handled safely. Existing admin edits cannot change another account's registered mobile, preserving the prior self/recent-auth/verified-phone restriction.
- `src/lib/server/services/account.ts`: canonical validation and atomic mobile/profile saves; retains recent auth and current Firebase/token phone proof.
- `src/lib/server/http.ts`: optional ApiError application code exposed by existing sanitized error wrapper.
- `scripts/mobile-registry-migration.cjs` (new): default read-only inventory, guarded begin/backfill/activate modes, paginated users and durable resume checkpoint.
- `tests/fixtures/mobile-registry.cjs` (new): explicit activated-registry fixture for isolated tests.
- `tests/mobile-number-registry.test.cjs` (new): transaction/route/migration cases.
- `tests/registration-mobile.test.cjs`: explicit registry initialization in test setup (not a permissive runtime fallback).
- `tests/registration-mobile-ui.test.cjs`: password/Google conflict display and retained-input retry tests.
- This report and dated superseding notes in relevant project-knowledge documents. The original project-knowledge ZIP remains the historical audit snapshot and was not repackaged.

No page/route UI, Firebase configuration, live rules, role union, dependency, environment file, authentication provider or unrelated property/enquiry contact policy changed. All user-supplied UIDs still pass existing identity/role checks. Trusted Admin SDK tools outside the application can bypass application invariants and must be controlled operationally.

## 4. Database additions

`mobile_number_registry/{sha256}`:

- ownerUID: Firebase UID string;
- createdAt, updatedAt: timestamps.

`mobile_number_registry_state/main`:

- version: 1;
- status: maintenance -> backfilled -> active;
- cursor: last processed users document ID;
- fingerprint: SHA-256 of ordered UID/canonical-phone inventory;
- users: verified inventory count;
- updatedAt, activatedAt (when activated): timestamps.

Absent/unsupported/nonactive control yields 503 `MOBILE_REGISTRY_NOT_READY`. The gate prevents legacy numbers being stolen while the registry is absent/unbackfilled. Do not manually create an active flag: activation must verify the complete inventory and every claim. Correctness assumes all phone writers use the new code and direct clients cannot mutate profiles/registry/control. New collection count is 24 including the original 22; there are no new HTTP endpoints.

## 5. Manual registration behavior

Email/password Auth creation remains first. A valid unused phone and Firestore profile commit together. Conflict returns 409 `{success:false,code:"MOBILE_ALREADY_REGISTERED",message:"This mobile number is already registered. Please use a different mobile number."}` with no owner/account details. Invalid mobile fails 400; inactive initialization fails 503. Existing Firebase identity is not deleted if profile reservation/persistence fails. The form retains name/email/mobile and retries using the same UID. Existing onboarding profiles retain their assigned contact under the prior policy; onboarding is not an unverified mobile-change route.

## 6. Google onboarding behavior

Uses the identical `/api/auth/user` writer. Google identity may exist before profile completion. Duplicate completion fails with the same 409 message, retains input and allows another phone under that UID. No phone-based merging or change to Google/password credential linking. Existing complete Google login does not query/write registry or ask to register again.

## 7. Profile/admin update behavior

`/api/account`, POST `/api/users`, and PUT/PATCH `/api/users/[id]` share the invariant. Same canonical number can be retained. Self number changes still require recent authentication (existing five-minute rule), verified token phone and current Firebase Auth phone agreement. No OTP enrollment or arbitrary/unverified change UI was invented. Admin role/status edits that save a profile also validate its registry ownership; admin creation cannot bypass uniqueness via either creation path. Admin changing another UID's existing number remains forbidden.

The shared metadata saver removes phoneNumber before a merge, so stale tenancy/property updates cannot restore an old number. Firebase Auth and Firestore remain separate systems: profile display-name/photo/status synchronization and business notification effects are not cross-service ACID transactions. Existing compensation/partial-failure behavior remains; mobile ownership and profile.phoneNumber themselves always commit together.

## 8. Legacy migration and activation sequence (instructions only; not executed)

Every mode requires explicit `--project=<DATA_PROJECT_ID>` equal to `FIREBASE_DATA_PROJECT_ID`. The script never loads `.env` itself, never uses the Auth project, and uses explicit DATA credentials or application-default credentials. Run from repository root with installed dependencies. Set credentials privately; never place credential JSON in shell arguments, logs or committed files. Read-only inventory still reads live data, so it also requires an appropriately authorized operator/session.

1. **Obtain separate production migration approval.** Verify a recoverable backup/operational rollback plan and deployed DATA project/rules/IAM. Do not infer authorization from this implementation task.
2. Run `node scripts/mobile-registry-migration.cjs --dry-run --project=<DATA_PROJECT_ID>`. It reads users in pages of 250, including inactive/admin accounts. It reports missing/invalid counts, canonical duplicate groups and hashed account references. It emits no raw phones/emails/UIDs/credentials. Detail arrays cap at 100 with detailsLimited flag; all records still contribute to counts. The offline map keeps one entry per canonical phone and at most two account references per number; memory is O(distinct phones), not a streaming external-memory index.
3. Resolve every duplicate/missing/invalid profile through a separately approved identity-verification/support process. Do not merge/delete users, invent contacts, select a winner, or attach phone ownership from editable tenant/property contacts. The script refuses backfill/activation while any conflict remains. It does not provide an unverified remediation bypass; approved legacy corrections while writes are paused require trusted administrative tooling.
4. Pause **all** writers: every old deployment/server, privileged scripts, client profile writes, triggers and imports. Drain in-flight writes. Install the new writer on all instances before resuming any traffic. The script's `--writers-paused` is an operator acknowledgment, not a technical lock on old software or unrestricted Admin SDK clients.
5. With approval and paused writers, run `node scripts/mobile-registry-migration.cjs --begin --project=<DATA_PROJECT_ID> --approve-registry-writes --writers-paused`. It initializes maintenance state only when absent, or no-ops existing maintenance. It refuses active/other existing states; a later maintenance cycle needs separate review.
6. Repeat the read-only audit while frozen. Run `node scripts/mobile-registry-migration.cjs --backfill --project=<DATA_PROJECT_ID> --approve-registry-writes --writers-paused`. A complete clean preflight precedes claim writes. Each transaction reads maintenance state/user/claim, refuses conflicting ownership, reserves the number, canonicalizes only users.phoneNumber if needed, and advances the checkpoint atomically. No UID/role/relation edits. A restart re-audits the complete inventory and resumes the checkpoint. Fingerprint ignores harmless canonical representation changes, but a changed UID/number inventory stops resume. Repeating completed backfill with unchanged inventory is a no-op. Never reset/delete the control or conflicting claims to force progress.
7. Verify client-denial rules and deployed version. Then separately run `node scripts/mobile-registry-migration.cjs --activate --project=<DATA_PROJECT_ID> --approve-registry-writes --writers-paused --rules-verified`. It re-audits all users, demands canonical storage and matching claims for every UID, compares inventory fingerprint/count and only then marks active. Repeated activation against unchanged verified inventory is idempotent. Resume writers only after success. Any stale/missing/conflicting state stops activation.
8. Monitor 409/503 application codes and registry integrity using authorized operations. No registry read is added to login. Rollback must never re-enable the old unguarded writer while accepting new phone changes; pause mutations instead.

No production readiness is claimed until this sequence, reconciliation and real Firebase/rules verification are complete. It is impossible to guarantee global ownership in a partially populated registry while simultaneously accepting all new numbers without inspecting legacy data; the explicit fail-closed gate is the chosen safety boundary.

## 9. Focused validation results

TypeScript: `npm run typecheck` passed.

Selected tests: `node --test tests/mobile-number-registry.test.cjs tests/registration-mobile.test.cjs tests/registration-mobile-ui.test.cjs`.

Final result across the three selected files: **37 passing tests** (18 registry/route/migration, 10 registration, 9 component-harness). The initial run encountered a syntax error in a new test callback and then a failure-injection mistake in a migration test; both test-only issues were corrected, and only the affected registry file was rerun. The other 19 tests and the TypeScript check had already passed. No broad suite or browser/server build was run.

Covered: new/duplicate password onboarding, new/duplicate Google onboarding, existing Google and password login, same UID retention, canonical equivalence, profile conflict, verified change/release, simultaneous different-UID claims, unbackfilled legacy fail-closed behavior, duplicate/invalid/missing legacy reports, admin create/update conflicts, unauthorized endpoint UID/role attempts, no registry route, stale metadata overwrite prevention, failed transaction rollback/retry, stale phone snapshot, corrupt claim refusal, paginated 260-user migration, interrupted checkpoint/resume, idempotence, incomplete activation refusal and retained form values/server message under both providers.

The test fixture serializes transactions, rolls back failures and enforces reads-before-writes. It verifies algorithm/route behavior under modeled ACID semantics, **not real Firestore contention/retry/index behavior**. UI checks use a React component/event harness, not browser E2E or real Google/password providers.

## 10. Deployment prerequisites and client security

No new environment secret, provider, index or npm dependency is required. Runtime collection access needs DATA project server IAM. Deny client reads/writes to both registry/control collections and client creation/update/deletion of registered profile mobile data (prefer server-only users writes for this architecture). There is no HTTP route exposing registry ownership.

No deployed rule files are available. A conceptual deny-only match is `match /mobile_number_registry/{id} { allow read, write: if false; }`, and the same denial is required for mobile_number_registry_state. **This fragment alone is insufficient if an overlapping wildcard grants access**: Firestore allow rules are additive. Review/remove overlapping grants and test actual rules, including users.phoneNumber writes, before passing --rules-verified. No rule file was guessed/deployed in this task.

Vercel/hosting requires manual verification of DATA credentials/project bindings and that all active deployments use this writer before activation. No production settings were accessed. Client Firebase config and Auth/data separation stay unchanged. Existing direct-Admin fixture/reset/import tools must not write live phone profiles outside the invariant; emulator fixtures need a consistent backfill/activation before exercising the new app mutation paths.

## 11. Known risks and unverified scenarios

- Direct browser Firestore rules enforcement could not be tested: deployed rules are unavailable. Absence of an HTTP registry route is not proof of direct SDK denial. Unauthorized API attempts were tested.
- Real Firestore transaction retries/contention and real provider-account lifecycle were not exercised. No emulator, live production data, Google popup or browser E2E was used.
- Legacy data has not been inventoried or reconciled; no migration executed. Readiness is absent until approved initialization. Never label this production-activated global uniqueness.
- SHA-256 phone keys are enumerable and must remain private; control/registry writes require tightly scoped operational access.
- Historical duplicate/missing/invalid contacts require human verification; no automatic winner, merge, deletion, OTP workflow or guessed replacement is provided.
- Pausing all old/privileged writers and verifying additive Firestore rules are mandatory operational prerequisites. Operator flags cannot prove these facts themselves.
- The existing separate Firebase Auth/display-profile synchronization and best-effort notification behavior can still partially fail outside the mobile/profile transaction. Such failure must not trigger arbitrary claim release or Firebase identity deletion.

No push, deployment, credential/environment changes, production migrations or destructive operations were performed.

## Local dry-run diagnostics (2026-11-06 follow-up)

Plain Node does not auto-load .env.local. The migration intentionally reads FIREBASE_DATA_CREDENTIALS (inline JSON or path), otherwise ADC; unlike the application DATA helper, it does not fall back to the legacy FIREBASE_CREDENTIALS alias. FIREBASE_DATA_PROJECT_ID must explicitly match --project. No other application/email/R2/Auth variable is required for inventory. GOOGLE_APPLICATION_CREDENTIALS can supply ADC when explicit DATA credentials are absent.

`node --env-file=.env.local scripts/mobile-registry-migration.cjs --dry-run --check-config --project=propbank-944fc` performs local credential parsing/project checks and Firebase/Firestore client construction only, then exits before token resolution or any inventory/query. A successful local initialization is not evidence of key validity at the provider, effective IAM permission, database existence or production authorization. An ADC initialization success does not establish that ADC is available; its resolution remains lazy.

In this diagnostic session the inherited process lacked DATA credentials/ADC configuration, while .env.local contained a parseable project-matching DATA credential. Explicitly loading that file succeeded with network connection functions blocked. No live query, token acquisition or write operation ran. The original generic error alone cannot establish the original shell's exact SDK failure or an IAM denial.

CLI errors now emit allowlisted stage/code JSON instead of SDK messages/stack traces/paths. Codes distinguish PROJECT_SELECTION_MISMATCH, DATA_CREDENTIAL_FILE_UNREADABLE, DATA_CREDENTIAL_JSON_INVALID, DATA_CREDENTIAL_PROJECT_MISMATCH, DATA_CREDENTIAL_INVALID, ADC_UNAVAILABLE, FIRESTORE_UNAUTHENTICATED and FIRESTORE_PERMISSION_DENIED (plus database/transport errors). A permission-denied code requires investigation of effective read access/API/database configuration, not automatic write-role grants. Four focused tests validate redaction, configuration failures and network-free configuration checking.

Only after explicit production read authorization and effective read-permission verification should an operator omit --check-config to execute --dry-run. No migration write mode or production setting was changed by this follow-up.
