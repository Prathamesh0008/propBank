# Owner–tenant property connections

## Implemented behavior

A reported contact is a discovery signal, not an access grant. New property and tenancy records reuse the original property ID. No database migration, backfill, live service changes or production writes were performed during implementation.

- Tenant intake preserves the authenticated tenant UID and Firebase email. The reported owner's original `phone` remains available to authorized users; validated `reportedOwner.phoneE164` is additive. An atomic `relationship_links` owner candidate is created even if no owner account exists.
- New owner-entered tenancy records retain rent, deposits, dates and documents, but have no trusted `userUID` until confirmed. They carry `linkConfirmationRequired: true` and validated `phoneE164`. New invitations do not inherit legacy email-only access.
- Known Firebase-verified phone accounts can be recorded as candidates. An invitation created by the authenticated owner for that exact verified candidate requires the tenant's confirmation. An initially unbound invitation (including registration later), or an admin-created invitation, additionally requires the current owner's approval of the confirmed account. This prevents a stale unbound phone invitation from automatically authorizing a recycled number.
- Owner requests use the existing admin owner-verification endpoint, evidence document, independent review note, version guard and review history. A phone claim cannot set `ownerUID`. Admin approval updates the existing property and tenant owner references atomically.
- Discovery runs after verified registration/profile synchronization, authenticated login, account updates and phone-bearing Firebase ID-token changes. My Account and Manage Properties also allow explicit refresh. Stable claim IDs and transaction checks prevent repeated logins from creating more requests.
- Established UID relationships and unchanged legacy tenancy relationships are preserved. Historical tenant documents remain available to authorized owner/admin workflows. Removed embedded tenant records are retained as inactive history.

## Identity and configuration dependency

**SMS verification is not implemented or advertised as available in this app.** The repository has Firebase email/password and Google authentication, but no existing phone-provider/reCAPTCHA verification workflow whose configuration could be established safely. A manually entered profile number never becomes trusted.

The server accepts an Indian E.164 phone only when a revocation-checked Firebase ID token's `phone_number` matches the current Firebase Admin UserRecord's `phoneNumber`, with active profile, active Firebase account and verified email. Candidate lookup uses Firebase Auth `getUserByPhoneNumber`, never a profile-phone search. Claim actions require sign-in within five minutes. Established links remain UID-based if phone contacts later change.

For users without this trusted identity, the UI shows **Verification Required**, disables Verify Mobile Number, and preserves pending relationships. It does not silently set a verified flag or substitute email verification.

To enable an in-app verification step later, an operator must first establish supported Firebase Phone Auth configuration (provider, authorized domains, SMS region policy and reCAPTCHA) and integrate phone credential linking to the **existing UID**, not an independent phone sign-in that creates another account. Refresh the Firebase ID token after verification. Handle credential collisions with explicit account recovery; do not merge accounts by phone. This integration and real-device verification remain outstanding.

Official references:
- https://firebase.google.com/docs/auth/web/phone-auth
- https://firebase.google.com/docs/reference/js/auth#linkwithphonenumber

No cloud settings were read or changed, so this implementation does not claim the deployed Firebase project has SMS verification enabled.

## Data and authorization

`relationship_links` is a compact private claim/invitation collection, not an ownership model. Fields include property ID, tenant ID when applicable, relationship, canonical contact, candidate UID, state, immutable creator, authorizing owner/candidate, confirmation/request/approval timestamps and reviewer metadata. Owner access remains exclusively the existing property `ownerUID`; tenant access remains the confirmed embedded/detailed tenant `userUID`.

Claimant responses contain only opaque claim reference, relationship and status before linking. Property ID becomes available after linking. An existing owner may see references for their own outgoing invitations, but account identity is disclosed to that owner only after the tenant confirms. Admin candidate review is admin-only.

Firebase phone identity is unique. Duplicate profile numbers are ignored, ambiguous authentication results fail closed, bound candidates are never automatically replaced with recycled-number accounts, and stale phone/account evidence is checked again before linking. Confirming one record cannot overwrite another established tenant or owner. Claim writes and property/tenant writes use Firestore transactions; failed writes leave no partial relationship.

Keep direct client Firestore reads/writes denied for `relationship_links` and `relationship_link_limits`; all access must pass through these authenticated server endpoints. Review deployed Firestore rules before rollout, including broad catch-all grants: a narrow deny cannot override an existing permissive matching rule. Rules were not deployed or modified by this task.

`relationship_link_limits` supplies distributed per-UID minute quotas: reads/lookups 30, discovery 20, mutations 10. Its `expiresAt` can be configured for Firestore TTL housekeeping; quota expiry itself does not depend on TTL. No TTL or index configuration was changed remotely. Queries use equality matching fields. Review any required Firestore index configuration before rollout; existing index exemptions must permit these queries. Discovery is bounded to 100 candidates per batch, moves matched candidates out of its initial state, and may continue on subsequent refreshes. Terminal history is queried separately so it does not hide new invitations.

Legacy records without the new canonical fields/claims are not silently migrated. Existing verified owner/tenant relationships keep working. Older unlinked records require an administrator-reviewed migration or the existing evidence workflow; no bulk scan of private records or live backfill runs at startup.

## API contracts

- `GET /api/relationship-links`: authenticated self-scoped `{phoneVerified, phoneVerificationAvailable:false, links, approvals, sentInvitations, truncated}`. No arbitrary phone or UID lookup. `links` uses opaque `id`, `relationship`, `status`, and post-link `propertyId`. Owner approvals may include the tenant's confirmed Firebase UID/email and an already owned property ID. Outgoing invitation references never reveal whether an account exists.
- `GET /api/relationship-links?propertyId=...`: administrator-only candidate UID/state review for the existing owner-verification UI.
- `POST /api/relationship-links`: `{action, claimId?}`. Actions: `discover`, `request_owner_verification`, `confirm_tenancy`, `approve_tenancy`, `reject`. The server rejects arbitrary phone/UID/approval fields, oversized or malformed bodies, stale identities and competing relationships. Repeated successful confirmation is idempotent. Errors use 400/401/403/404/409/429, with Retry-After on 429.
- Existing `POST /api/properties`: tenant intake additionally records an owner candidate; owner-created rented properties record pending tenancy invitations. Invalid contact numbers are rejected.
- Existing `POST /api/tenants` and admin tenancy assignment: save pending invitations instead of email/UID auto-linking. Supplied tenant UIDs cannot bypass confirmation.
- Existing `PUT /api/tenants/:id` and property edits: preserve established UIDs and server-controlled verification flags. Editing a pending contact cannot authorize it.
- Existing `/api/users/search?phone=...`: non-admin callers always receive the same neutral verification-required response with no user object. Forms no longer perform phone-driven account/profile auto-fill. Admin search remains authenticated and scoped to administrators.
- Existing `POST /api/owner-verification`: unchanged evidence/decision payload. It additionally updates claim status inside the existing transaction and rechecks a requesting candidate's current Firebase phone identity.
- Existing `GET /api/account`: additive `phoneVerified`, derived from Firebase, not from editable profile values.

Internal states map to Verification Required (including an invitation awaiting tenant confirmation), Awaiting Owner Approval, Awaiting Admin Verification, Linked and Rejected.

Relationship, ownership-verification and tenancy notifications resolve active, email-verified recipients through Firebase Auth, not reported contacts or editable profile email. No discovery notification is sent to an unverified reported number. Post-link notices use deterministic event IDs in the existing notification infrastructure.

## Files changed for this feature

- `src/lib/indian-phone.ts`
- `src/lib/server/services/relationship-links.ts`
- `src/app/api/relationship-links/route.ts`
- `src/lib/server/services/{properties,tenants,users,account,owner-verification,property-hub,domain-contracts,contracts,migration-remainder,media,transactional-email}.ts`
- `src/lib/server/permissions.ts`
- `src/features/account/RelationshipLinks.tsx` and `RelationshipLinks.module.css`
- `src/features/account/MyAccount.tsx`
- `src/features/properties/{TenantPropertyForm,AddPropertyForm,ManageProperty}.tsx`
- `src/features/services/AddTenant.tsx`
- `src/features/admin/OwnerVerification.tsx`
- `src/contexts/AuthContext.tsx`
- `tests/relationship-links.test.cjs`
- `tests/{account-management,admin-property-operations,native-group2,property-product}.test.cjs`
- `tests/fixtures/native-server.cjs`

`GoogleAuth.tsx` was reviewed; profile creation and verified sign-in already call the server integration points, so its authentication flow did not need changes. Existing public-site edits and cleanup audit documents were preserved.

## Validation

All automated tests use the isolated in-memory server/Firebase fixture. No live Firebase, R2 or mail service is contacted. Validation passed:

- `npm run typecheck`.
- `node --test tests/relationship-links.test.cjs tests/owner-verification.test.cjs tests/account-management.test.cjs tests/auth-phase.test.cjs tests/admin-property-operations.test.cjs tests/property-product.test.cjs` ? 60 passing tests.
- `node --test --test-name-pattern="tenant" tests/native-group2.test.cjs` ? 4 passing targeted tenant tests.
- `git diff --check` ? passed (existing LF/CRLF advisories only).

The 64 passing tests include normalization, late registration, delayed admin approval, retained tenant access, owner-authorized tenancy confirmation, later owner approval, unverified/edited contacts, wrong numbers, multiple properties, duplicates, competing claims, private responses, alias-injection rejection, rate limiting, phone changes, ambiguous matches, isolated transaction failure, and preservation of rent/documents/history. No Playwright, full suite, build, deploy or push was run.

A stale property-product visit assertion was updated to match the pre-existing Visit Planner contract (also covered by visit-planner-repair tests): unavailable/private properties return 404 and do not create visits. No visits service code or scheduling permissions were changed by this feature.
