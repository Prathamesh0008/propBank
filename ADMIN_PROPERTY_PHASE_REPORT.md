# Admin Property Phase Report

## Scope and result

Phase 1 implements admin-assisted property creation and tenant relationship management only. No Phase 2 email/outbox, phone-change, notification-management, or Phase 3 reminder work was started. No production data, Firebase accounts, stored files, emails, or deployments were changed.

Status: **PASS — implemented and verified with isolated data.** Live Firebase behavior remains **BLOCKED** until an approved staging environment and test accounts are available.

## What already existed

- Properties already used `ownerUID` as the authoritative owner relationship and appeared in the owner's Manage Property account.
- Tenant relationships already existed in the property `tenants` array and mirrored `tenants` collection; no duplicate tenant model was added.
- Owners could use the existing Add Tenant form, and linked active tenants could see rented properties through the tenant property API.
- Property and tenant APIs already enforced persisted owner/admin/member permissions.
- Owner-created sale/rent listings already entered `pending_review`; tenant-submitted records already used the private owner-verification workflow.
- Property creation and tenant assignment already invoked their established post-persistence notification effects.

## Implemented

- Added persisted-admin-only user search by name, email, or phone, limited to 20 results and reporting combined profile/Auth active state.
- Added an Admin Portal account-assistance panel that confirms the selected user and active status.
- Added **Add Property for User**, retaining property-type selection and the existing property form while assigning the selected active user as the actual owner.
- Admin-created public listings retain the existing `pending_review` moderation path and are visible to the selected owner.
- Added admin-assisted property metadata and relationship history with actor UID, user UID, property ID, relationship, action, revision, and server timestamp.
- Added atomic admin tenant assignment, replacement, and removal through the existing tenancy model.
- Added `tenancyRevision` optimistic concurrency checks so stale admin actions return conflict instead of overwriting a newer relationship.
- Replacement/removal preserves prior tenant records as inactive and preserves property ownership.
- Duplicate active assignment, inactive/unregistered accounts, private unverified properties, invalid rental terms, and unauthorized callers are rejected server-side.
- The existing tenant form is reused and prefilled from the selected registered account. It retains rental terms, rent schedule, security deposit, due day, agreement dates, and other existing fields.
- Admin property details now link directly to tenant relationship management.
- Owner and tenant visibility continues through the existing property APIs; profile rental pointers are updated or cleared after the tenancy transaction commits.
- Existing property-created and tenant-assignment notification effects remain post-commit. No new email architecture was introduced in this phase.

## Files created

- `src/app/api/admin/users/search/route.ts`
- `src/app/api/admin/properties/[id]/tenancy/route.ts`
- `src/features/admin/AdminPropertyOperations.tsx`
- `src/features/admin/AdminPropertyOperations.module.css`
- `tests/admin-property-operations.test.cjs`
- `ADMIN_PROPERTY_PHASE_REPORT.md`

## Files modified

- `src/lib/server/services/users.ts`
- `src/lib/server/services/properties.ts`
- `src/lib/server/services/tenants.ts`
- `src/lib/server/services/contracts.ts`
- `src/features/admin/AdminPortal.tsx`
- `src/features/admin/AdminPropertyDetailsDialog.tsx`
- `src/features/properties/AddPropertyForm.tsx`
- `src/features/properties/SelectPropertyType.tsx`
- `src/features/services/AddTenant.tsx`
- `scripts/audit-active-api.cjs`

## Verification

- `npm run typecheck` — **PASS**, exit 0.
- Focused Phase 1 and property regression run — **PASS**, 34 passed, 0 failed, 0 skipped.
- New Phase 1 tests alone — **PASS**, 6 passed, 0 failed, 0 skipped.
- Initial `npm run test` — **FAIL**, 159 passed, 1 failed, 5 skipped. The API inventory scanner did not normalize the new `q` query parameter.
- API inventory regression after the scanner fix — **PASS**, 8 passed, 0 failed.
- Final `npm run test` — **PASS**, 160 passed, 0 failed, 5 skipped. The five existing skips require unavailable original Go reference sources.
- `npm run build` — **PASS**, Next.js 16.4.0 production build compiled, typechecked, and generated all 32 static pages. Both new admin API routes were included as dynamic routes.
- Targeted Playwright property workflows — **PASS**, 3 passed: owner/tenant add-property paths, tenant-intake privacy/admin visibility, and assigned-tenant account visibility.
- `git diff --check` — **PASS**; only existing line-ending warnings were reported for two unrelated files.

All tests used isolated fixtures. They did not send real emails or modify live accounts or records.

## Preserved behavior

- Ownership, archive/restore, listing moderation, tenant intake/owner verification, private storage, visits, negotiations, agreements, service requests, Firebase project separation, and existing notification/reminder behavior remain intact.
- The homepage hero and its dependencies were not modified.
- No API contract used by an existing workflow was removed or replaced.

## Remaining integration requirements

- Live end-to-end verification is **BLOCKED** because the configured environment is not an approved isolated staging environment with dedicated admin, owner, and tenant accounts.
- Production execution requires approval to create disposable staging users/properties/tenancies and verify cleanup.
- Phase 2 must design the centralized transactional email/outbox system. The current post-commit legacy notification effects were reused, but live email delivery was not tested or claimed.
- No Firestore migration is required for legacy properties: missing `tenancyRevision` safely reads as revision `0`, and relationship history begins with the first new admin action.

## Actions requiring approval

- Creating or modifying real Firebase users, properties, or tenancy records.
- Sending live emails.
- Deploying these routes/UI changes.
- Running any production migration or backfill.

