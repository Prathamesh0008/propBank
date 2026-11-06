# PropBank legacy-conflict reservations: implementation and activation plan

Current policy: schema version **2**, `legacy-conflict-reservations-v1`. Branch: `fix/mobile-number-uniqueness`. This report supersedes the version-1 requirement that every historical phone problem be corrected before registry activation. No production reads/writes, Auth changes, migration execution, activation, deployment or push occurred during this implementation.

## 1. Safety conclusion

The strategy is safe for **new registrations and permitted future mobile changes**, subject to complete legacy coverage, frozen migration inputs, server-only access and retirement of all bypass writers. It does not make the historical dataset duplicate-free or establish ownership of a phone. Existing duplicate contacts remain explicitly quarantined rather than assigned to a winner. Technical claim ownership is an allocation to a UID, not verified phone ownership or authority over a property.

Every valid historical canonical number must be either uniquely reserved or blocked. Every historical UID must have a matching account-state record, including missing/invalid contacts. Normal application requests cannot resolve a quarantine, drop an unresolved account state, or release a blocked claim. There is no resolution bypass flag or public registry API.

## 2. Exact changes in this pass

- `src/lib/server/mobile-registry-policy.ts`: schema version 2, new private account-state collection and explicit reservation-policy marker. **The existing phone-key algorithm/namespace is unchanged**, so old entries cannot be missed by moving to a new key space.
- `src/lib/server/mobile-registry.ts`: checks per-UID state; rejects blocked target numbers; rejects unresolved claim attempts; allows authorized non-phone edits on conflicted profiles without modifying their raw contact, claim or account state; releases old claims only when version-2 owned-state and UID checks succeed. Normal successful claims atomically write profile, owned claim and per-UID state.
- `scripts/mobile-registry-migration.cjs`: full paginated grouping, conflict blocking, missing/invalid account-state creation, unchanged historical profiles, durable checkpoint/resume, repeat-safe completion and complete activation verification. Write modes now additionally require `--reserve-legacy-conflicts`. Existing project/approval/rules guards and safe diagnostics remain.
- `tests/fixtures/mobile-registry.cjs`: explicit schema-2 fixture state.
- `tests/mobile-number-registry.test.cjs`: expanded legacy quarantine, login/update, reservation/activation, rollback and sticky-block tests.
- This report and superseding documentation links. No authentication, role/permission, UI, property-management, environment or dependency code changed in this pass.

## 3. Registry schema and privacy

All three collections are server-only:

| Collection | Fields / purpose |
| --- | --- |
| mobile_number_registry/{existing deterministic key} | Unique: version=2,status=owned,ownerUID,createdAt,updatedAt. Duplicate: version=2,status=blocked,memberCount,membersFingerprint,createdAt,updatedAt; **ownerUID is absent**. |
| mobile_number_registry_accounts/{UID} | version=2,state=owned/conflicted/missing/invalid; phoneKey only for valid contacts; createdAt,updatedAt. No phone, email, name, role or group-member list. |
| mobile_number_registry_state/main | version=2,reservationPolicy=legacy-conflict-reservations-v1,status=maintenance/backfilled/active,cursor,fingerprint,users,timestamps. |

Blocked member fingerprints hash sorted UID membership; no member UID array is persisted. Phone document keys remain SHA-256 of the existing canonical-key input. Hashing does not anonymize an enumerable phone space, so registry reads must remain private. Raw historical phones/UID membership are used transiently in migration memory, not printed/exported. Dry-run remains read-only and paginated (250 user documents/page); memory is O(users). Report detail arrays are capped, while aggregate counters cover all records.

Counter meanings: `uniqueValidNumbers` counts valid canonical numbers occurring once (uniquely reservable); `validMobileNumbers` counts all distinct valid canonical numbers, including duplicate groups; `duplicateAccounts` counts every profile in duplicate groups.

If the previously reported 42-profile inventory is unchanged, the expected result is **25 owned number claims, 2 blocked number claims, and 42 account-state records: 25 owned, 4 conflicted, 12 missing, 1 invalid**. This is arithmetic from the supplied inventory, not a new production inspection.

## 4. New-user behavior

Email/password registration and Google onboarding retain the same Firebase UID validation and shared profile endpoint. A valid unused canonical mobile commits profile/owned claim/account state together. Equivalent formats share one key. Two different UIDs racing for a free number serialize through the same claim transaction; one succeeds and the other receives 409 MOBILE_ALREADY_REGISTERED. A uniquely reserved or blocked historical number returns that same generic conflict without disclosing another account or group membership.

Failed transactions leave neither partial profile nor partial claims/account state. Firebase identities are not deleted on failure. Existing form error display and retained-input retry remain unchanged. No new phone-availability requests, login checks, polling or normal user-collection scans were added. Normal mobile writes use four deterministic reads, five on number change, in addition to existing service authorization reads.

## 5. Historical-user behavior

| Historical state | Login / profile access | Ordinary updates |
| --- | --- | --- |
| Owned valid contact | Existing Auth/email/role/profile gates unchanged. | Authorized non-phone updates and verified self mobile changes work; a successful change atomically moves the owned claim and account-state phoneKey. |
| Conflicted valid contact | Existing verified complete users can still log in. No registry query is added to login. | Authorized non-phone edits work and preserve the exact raw historical phone. A different number returns MOBILE_RESOLUTION_REQUIRED even if normal phone-verification checks pass. Blocked claim and conflicted state remain untouched. |
| Missing/invalid contact | Existing incomplete-profile/login restrictions remain; no identity is disabled or recreated. | Normal onboarding cannot create a claim, even for a free/verified number. Existing strict profile validators may reject invalid input earlier. Separate approved resolution is required; no placeholder contact is invented. |
| Missing Auth identity | Remains unable to authenticate under existing identity checks. | Registry reservation preserves data/relationships; it does not recreate or attach an identity. Identity provenance/recovery remains separate work. |

Admin requests do not bypass quarantine. Existing admin role/status/non-phone updates for conflicted valid profiles retain the same authorization checks. The per-UID unresolved state survives a missing profile document, so ordinary recreation with the same UID cannot erase quarantine. Corrupt or missing state/claim records fail closed. Unrelated tenant/property/enquiry/emergency contacts remain outside registered-mobile uniqueness.

## 6. Controlled reservation and activation requirements

These are instructions for a separately approved production operation; none were executed here.

1. Review/commit a reproducible schema-2 release and stage-test deployed IAM/rules. Obtain separate production DATA inspection, migration and activation approvals. No other Auth project access is needed for reservation.
2. Take a recoverable consistent backup of users and all registry/control/account-state collections, preserve rules/IAM configuration and establish an operational mutation-freeze/rollback plan.
3. Verify both new and old deployments, preview URLs, scripts, importers, triggers and direct clients cannot write user phones outside the new writer. Freeze registered-phone mutations and user creation/deletion; drain old writers. Keep only reviewed login metadata/activity writes available if login continuity is required. `--writers-paused` is an operator assertion, not an infrastructure lock.
4. Using explicitly approved DATA credentials/project, run `node scripts/mobile-registry-migration.cjs --dry-run --project=<DATA_PROJECT_ID>`. The script does not auto-load .env files; credentials must be selected privately. A clean identity/phone inventory is no longer a prerequisite: all conflicts must instead be represented by the reservation plan.
5. Run `--begin` with `--reserve-legacy-conflicts --approve-registry-writes --writers-paused --project=<DATA_PROJECT_ID>`. This initializes schema-2 maintenance only when absent, or resumes matching schema-2 maintenance. It **refuses existing version-1 control or active state**; those require a separately reviewed maintenance transition, not an automatic reset.
6. Run `--backfill` with the same flags. This mode now reserves legacy contacts and records account states; it **never writes users or related records**. Full canonical grouping precedes claim writes. Each transaction rechecks maintenance, profile snapshot, account state and claim before writing. Unique numbers reserve their UID; duplicate groups receive ownerless blocked claims; missing/invalid accounts receive explicit unresolved states. Checkpoint advances atomically. Changed inventory stops resume. Repeating an unchanged completed pass is a no-op.
7. Existing partial version-1 claims can be upgraded only when their owner is in the exact historical group. A matching duplicate becomes blocked, never assigned to one member. Unrelated owners, conflicting schema-2 state, or a blocked number whose membership no longer matches cause refusal. The tool never downgrades a block to owned just because a duplicate profile disappeared.
8. Run `--activate` with the same flags plus `--rules-verified`, only under separate approval. It rebuilds the inventory, verifies every historical UID's state and every valid number's owned/blocked reservation, validates blocked membership/count and absence of ownerUID, rechecks the fingerprint and control state, then activates. A missing claim/state, changed group, unexpected owner or inventory drift prevents activation. Missing/invalid profiles are allowed only with matching locked states.
9. Resume mobile mutations only on schema-2 instances after verification. Monitor 409/503 outcomes without exporting personal data. Keep blocked numbers reserved until an explicitly designed, separately authorized resolution procedure verifies all affected identities and atomically reconciles state; no such release/transfer endpoint is introduced here.

Schema-1 runtime and schema-2 runtime reject each other's control versions. This fail-closed boundary avoids silently applying quarantine with old code. Do not blindly rewrite an existing control flag to active or reset fingerprints/checkpoints.

## 7. Security and rollback prerequisites

Verify client get/list/create/update/delete denial on **all three** private collections, including administrator browser clients. Prevent direct clients from creating/deleting user profiles or changing users.phoneNumber outside trusted server operations. Remove overlapping wildcard allows: adding a deny match alone does not override another allow. No deployed rules were available or changed; actual denial needs separate verification.

Restrict Admin SDK credentials and privileged scripts, because Admin SDK bypasses Firestore rules. Preserve Firebase Auth/data project separation and recent-auth/current-Auth-phone proof for normal number changes. Editable profile contact fields never establish identity/property authority.

Rollback must freeze affected mutations and preserve a consistent users/claim/account/control snapshot. Never roll back to an unguarded application while accepting registrations. Do not clear quarantine, delete account states, release blocked keys or force activation to restore availability. Existing --begin intentionally cannot reopen active state; prepare an explicit approved operational freeze before cutover.

## 8. Focused validation and remaining limits

**54 tests passed**, plus `npm run typecheck`. Executed only:

`node --test tests/mobile-number-registry.test.cjs tests/registration-mobile.test.cjs tests/registration-mobile-ui.test.cjs tests/mobile-registry-diagnostics.test.cjs`

Coverage includes unique legacy reservation; duplicate ownerless blocks; password/Google rejection against unique/blocked numbers; free-number success; missing/invalid quarantine; unchanged historical records; conflicted login and non-phone edits; verified-change refusal; ordinary verified owned-number changes; simultaneous new claims; snapshot conflicts; atomic rollback; 260-user paginated checkpoint/resume; repeat-safe completion; complete activation coverage; blocked-owner corruption; vanished duplicate members; version mismatch; unrelated existing claim refusal; controlled v1 partial-claim quarantine; privacy-safe diagnostics; existing form/provider behavior.

Tests use an isolated, serialized transaction fixture with rollback and read-before-write enforcement, plus a component/event harness. They are not live Firestore retry/contention/rules, browser E2E, real-provider or production migration tests. No broad suite, Playwright, live inventory, migration CLI write mode, live activation, deployment or push was run.

**Activation can technically proceed without deleting or modifying historical accounts once approved schema-2 reservation coverage and deployment/security prerequisites are verified. It has not been performed here.** Historical duplicate data and missing Auth identities remain unresolved and must not be mislabeled as repaired or abandoned.

## Release preparation

See [local release readiness, ordered operator commands and rollback gates](MOBILE_RELEASE_READINESS.md). Production remains blocked pending those external approvals and verifications.
