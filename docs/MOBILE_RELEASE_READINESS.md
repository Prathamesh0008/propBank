# Mobile uniqueness schema-2 local production release

Status: **BLOCKED for production deployment/activation pending operator prerequisites.** Local release preparation is complete. This document accompanies the single local feature-branch release commit; identify it with `git log -1 --format=%H`. Branch: `fix/mobile-number-uniqueness`; base: `fa98b7e0e53d29053365be4c1a1b8230a313f686`. No implementation rewrite is included in release preparation.

## Included artifacts and validation

The commit includes the server mobile policy/writer, both user/account service integrations, API error-code support, guarded migration/diagnostics script, explicit registry fixture, four focused test files, both mobile implementation reports, this release checklist and all nine linked project-knowledge Markdown files. The pre-existing project-knowledge ZIP is a historical audit snapshot, is not a deployment artifact and is intentionally left untracked.

Final local validation on 2026-11-06: `npm run typecheck` passed; all **54** selected tests passed:

```powershell
node --test tests/mobile-number-registry.test.cjs tests/registration-mobile.test.cjs tests/registration-mobile-ui.test.cjs tests/mobile-registry-diagnostics.test.cjs
```

These are isolated unit/route/component-harness tests, not real Firestore contention/rules, real-provider or hosted production-build verification. No broad suite, browser E2E, production data access, migration, rule change, deployment or push was performed during release preparation. Only explicitly selected source/test/docs paths are staged. Environment files, credentials, local provider configuration and the old ZIP are excluded.

Authoritative migration semantics: [MOBILE_LEGACY_RESERVATIONS.md](MOBILE_LEGACY_RESERVATIONS.md). Earlier schema-1 migration instructions remain historical and must not be used for this release.

## Unresolved production gates

All are unverified by this local preparation and must be signed off before production actions:

- Exact Vercel team/project, production environment bindings, approved CLI version, deployment protection and target resolution. No local .vercel linkage or deployment URL has been established by this task.
- Successful production build of this exact release and approved hosted checks. Local typechecking is not a production build.
- Verified DATA project/identity/read and migration permissions, explicit production read approval, separate migration/activation approvals. Keep credentials private; prefer a read-only identity for inventory and a separately approved migration identity for writes.
- Recoverable consistent backup of users plus mobile_number_registry, mobile_number_registry_accounts and mobile_number_registry_state; secured backup destination, restore permissions and a rehearsed consistent restore procedure. Preserve rules/IAM configuration. No backup/restore command is provided because destination, policy and restore target have not been verified.
- Verified client get/list/create/update/delete denial on all three private registry collections, including browser admin-role clients. Prevent direct user creation/deletion/phone writes bypassing the server. Check overlapping allow rules; a deny-only fragment is not enough. No live rules have been read or changed here.
- Enforced freeze of phone/profile creation/deletion and retirement/blocking of every old writer, including old deployment/preview URLs, triggers, import/reset tools and privileged Admin SDK clients. Flags are operator acknowledgments, not infrastructure locks. Review login metadata-only writes separately if logins must remain available.
- Existing registry control/version state and full current legacy coverage. If schema-1 control or active state already exists, --begin refuses it; obtain a separately reviewed transition rather than resetting it blindly.
- Complete reservation verification and explicit schema-2 activation. Historical Auth-provenance cases remain separate reconciliation work; no deletion/merge is required to quarantine their mobile contacts.

## Exact ordered commands: approved future procedure only

**Do not paste/run the whole sequence. Stop at every unmet gate. None of the following production steps was executed by this release task.** Use a clean checkout of the release commit, not a folder containing extra untracked artifacts. Configure an approved existing Vercel project context manually under separate authorization; never allow automatic project creation/linking to choose a target.

1. **Local verification; no production access**:

```powershell
git status --short
git log -1 --format=%H
```

Confirm the clean checkout and exact approved release commit. Set credentials in an approved ignored local environment file; the example below uses `.env.local`, never a committed credential file. Confirm its contents select the intended DATA project and do not contain an emulator override. Inherited shell variables override env-file assignments and must also be verified privately.

2. **Local configuration only; no token acquisition or Firestore query**:

```powershell
$env:FIREBASE_DATA_PROJECT_ID = 'propbank-944fc'
node --env-file=.env.local -e "if(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) process.exit(1)"
if ($LASTEXITCODE -ne 0) { throw 'Unexpected emulator override; stop.' }
$migrate = @('--env-file=.env.local', 'scripts/mobile-registry-migration.cjs', '--project=propbank-944fc')
& node @migrate --dry-run --check-config
if ($LASTEXITCODE -ne 0) { throw 'Local initialization check failed; stop.' }
```

3. **Remote metadata read only**, after Vercel access authorization and verified existing linkage:

```powershell
vercel project inspect --non-interactive
```

Stop on unresolved linkage, authentication failure or any team/project mismatch. Confirm production Firebase Auth/data bindings, secrets and canonical origins privately. Do not run a deployment until the target and settings are approved. Vercel commands below require this already verified directory/project context.

4. **Production DATA read only**, with explicit inventory approval:

```powershell
& node @migrate --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Inventory failed; stop.' }
```

Keep even hashed inventory details private; report aggregate counts only. This is not a registry-coverage verification command; --activate performs that check later. Historical missing/invalid/duplicate counts need not be zero for schema 2, but all such records must be covered by its reservation plan.

5. **Vercel production deployment creation; provider write, no production-domain assignment yet**:

```powershell
vercel deploy --prod --skip-domain
```

Record the returned production deployment URL privately; verify the exact commit/build and approved hosted checks before promotion. Keep deployment protection enabled. Deployment URLs can execute code even without the production domain, so treat staged deployment as a consequential production action requiring approval.

6. **Operational production freeze and backup gate**: enforce the reviewed mutation freeze, drain old writers, prevent bypass access to old deployments, verify database backups/restore, and sign off live rules/IAM. These controls are platform-specific; no guessed firewall, database-export or security-rule commands are supplied. Keep only reviewed login metadata/activity writes available if required.

7. **Production traffic promotion; provider/routing write**, while mobile mutations remain frozen:

```powershell
$stagedDeployment = '<approved staged production deployment URL>'
vercel promote $stagedDeployment
```

Verify all public aliases now use guarded schema-2 code and older deployment endpoints cannot bypass the freeze. Existing login does not read registry readiness; signup/mobile-writing updates remain intentionally unavailable before activation.

8. **Authoritative production DATA read only, after freeze**:

```powershell
& node @migrate --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Frozen inventory failed; stop.' }
```

9. **Production Firestore writes: initialize maintenance and reserve legacy numbers/account states**. Separate migration approval is mandatory; only pass --writers-paused after the operational gate is actually enforced:

```powershell
& node @migrate --begin --reserve-legacy-conflicts --approve-registry-writes --writers-paused
if ($LASTEXITCODE -ne 0) { throw 'Maintenance initialization refused; stop.' }
& node @migrate --backfill --reserve-legacy-conflicts --approve-registry-writes --writers-paused
if ($LASTEXITCODE -ne 0) { throw 'Reservation incomplete; preserve checkpoint and stop.' }
```

The reservation mode does not modify historical users, Auth identities or relationships. Valid unique contacts become owned claims; duplicate groups become ownerless blocked claims; missing/invalid accounts receive locked states. Resume only against unchanged inventory and matching version/policy. Never delete a checkpoint/claim or overwrite an owner to force progress.

10. **Production Firestore write: activation**, only after separate approval and independently verified rules:

```powershell
& node @migrate --activate --reserve-legacy-conflicts --approve-registry-writes --writers-paused --rules-verified
if ($LASTEXITCODE -ne 0) { throw 'Activation refused; keep the mutation freeze.' }
```

This validates every account state and every owned/blocked number against the frozen inventory before changing control to active. Do not use a manual active flag as a substitute.

11. **Approved operational unfreeze**: confirm successful activation and reviewed hosted behavior; resume mutations only through guarded schema-2 instances. Monitor registration conflicts, unresolved-account responses and readiness/integrity errors. Do not label legacy duplicate contacts or missing Auth identities as repaired.

## Rollback without an unguarded writer

1. Re-enforce the operational phone/profile mutation freeze; preserve ordinary reads/logins only where reviewed safe. Capture the failure state, checkpoint and newly accepted writes without exporting customer data.
2. Leave users, owned/blocked claims, account states and control intact while investigating. Never release blocked claims, delete unresolved states, force an active flag or blindly reset a fingerprint.
3. If a previously verified schema-2-compatible production build exists, promote that specific build under approval:

```powershell
$compatibleDeployment = '<approved guarded schema-2 production deployment URL>'
vercel promote $compatibleDeployment
```

Do **not** run bare `vercel rollback`: the previous deployment may contain an unguarded writer. No compatible fallback deployment has been established here; if none exists, keep mutations frozen until a guarded repair release is approved.

4. A database restore requires separate approval and consistent restoration of users/claims/account/control, including accounting for all registrations/phone changes accepted after the backup. Do not restore only one collection or discard post-cutover identities. Backfill never changed historical profiles, but new registrations after activation still require coordinated recovery planning.
5. Revalidate coverage, compatible runtime, rules/IAM and bypass-writer controls before unfreezing. --begin cannot reopen active state; it is not a rollback switch.
