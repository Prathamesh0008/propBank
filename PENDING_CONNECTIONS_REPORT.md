# Pending Connections and secure owner-tenant linking

## Result and placement

The existing bidirectional relationship implementation is reused and hardened. Pending Connections now lives inside `PropertyHub.tsx`, both in its portfolio dashboard (including accounts with no linked properties) and its existing property detail view. No route, separate linking page or duplicate property model was created. My Account provides a shortcut to the existing Property Hub anchor instead of rendering a second connection-management interface.

Pending Connections remains available when the portfolio activity request fails. It uses its own authenticated, database-backed connection query, with loading, empty, retry, blocked mobile verification, awaiting owner/tenant/admin, and rejected/expired history states. Compact rows use the existing typography and forest/ivory/bronze tokens, Lucide icons, responsive spacing, keyboard focus indicators, accessible review disclosures, and reduced-motion support.

Review is required in the UI before Accept Tenancy or Approve Tenant Connection is enabled. Linked records are filtered out of the pending list. Successful mutations invalidate the existing Owned/Rented and property-hub queries. Refresh also reloads those queries to pick up an administrator's approval performed elsewhere.

## Exact files changed in this pass

1. `src/lib/relationship-link-state.ts` (new)
2. `src/lib/server/services/relationship-links.ts`
3. `src/lib/server/services/owner-verification.ts`
4. `src/features/properties/PendingConnections.tsx` (new)
5. `src/features/properties/PropertyHub.tsx`
6. `src/features/properties/PropertyHub.module.css`
7. `src/features/properties/ManageProperty.tsx`
8. `src/features/account/RelationshipLinks.tsx`
9. `src/features/account/RelationshipLinks.module.css`
10. `src/features/admin/OwnerVerification.tsx`
11. `tests/relationship-links.test.cjs`
12. `tests/pending-connections.test.cjs` (new)
13. `tests/pending-connections-ui.test.cjs` (new)
14. `PENDING_CONNECTIONS_REPORT.md` (this report)

The existing tenant/owner intake forms, tenancy assignment, registration/login/account integration, normalized Indian phone helper, permissions, media authorization, property-hub service, and notification infrastructure were inspected and retained from the preceding linking implementation. No unrelated public-site edits or audit artifacts were removed.

## Persistent state and API changes

The existing `relationship_links` collection remains the single compact discovery/invitation collection. Ownership still comes exclusively from the existing property's verified `ownerUID`, and tenancy access from the confirmed tenant UID; claims are not an alternate access model.

New records carry `version: 0`, a server-generated 30-day `expiresAt`, creator/authorizer references, original property/tenant references and validated canonical contact. Sensitive property, rent, agreement, document or identity data is not copied into claims.

Canonical states are:

- `verification_required`
- `pending_owner_authorization`
- `pending_tenant_acceptance`
- `pending_admin_verification`
- `linked`
- `rejected`
- `expired`

Older `awaiting_*` states remain readable and normalize during authorized use. Older pending records with a valid creation timestamp receive the same 30-day lifetime logically; malformed or missing expiry evidence fails closed. Expiry is enforced on reads, discovery and mutations, not only through the UI. Authorized normalization/expiry writes are transactional and increment the revision. Already linked UID relationships are never revoked by claim expiry. Rejected and expired claims cannot be revived through matching or claim actions.

No new endpoint was needed. Existing endpoints changed:

- `GET /api/relationship-links` adds unified `connections`. Each row has an opaque ID/reference, relationship, canonical state, version, optional expiry and viewer role. Before linking, candidate rows omit property ID, title/address, phone, tenant/document/rental data, name, email and UID. Current owners may receive their already-authorized property ID/label, but never the pending candidate's UID/email/contact. Legacy `links`, `approvals` and `sentInvitations` response arrays remain available with the same privacy restrictions.
- `GET /api/relationship-links?propertyId=...` remains administrator-only and supplies trusted UID references needed by the existing verification form. It also normalizes old states and expiry for authorized admin review.
- `POST /api/relationship-links` accepts `{action, claimId?, expectedVersion?}`. Existing action names are retained: `discover`, `request_owner_verification`, `confirm_tenancy`, `approve_tenancy`, `reject`. New UI submissions supply the observed version. Stale pending mutations return 409; repeated final acceptance/approval remains idempotent. Existing clients without the optional revision still face transactional state, identity and membership checks. Owners can now reject their own pending tenant invitations without pretending to be a phone-verified candidate.
- `POST /api/owner-verification` retains its original admin role, independent evidence-document, review-note, active identity and expected property-version requirements. It recognizes canonical pending states and updates claim revisions. An expired/rejected discovery claim stays terminal even if an administrator later independently verifies ownership through the existing documentary process; that independent evidence workflow is not authorization through the expired claim.

## Both linking directions

Tenant-first: tenant intake preserves the authenticated tenant UID/Firebase email and records the reported owner's original phone plus validated +91 canonical contact. Discovery can bind an eligible verified owner account without disclosing private property details. Request Ownership Verification moves the claim into pending admin verification. Only the existing administrator evidence approval writes the original property's owner UID. The original tenant's Rented access and property ID remain intact.

Owner-first: owner intake and tenancy assignment create pending invitations while retaining all rent/lease/deposit records. The invited Firebase account must explicitly accept. If the owner originally authorized that exact already verified candidate, acceptance can finish linking. An initially unbound invitation (later registration) or admin-created invitation additionally requires the current owner's approval of the confirmed account. This prevents a recycled unbound phone from automatically acquiring access. Linking updates the existing detailed/embedded tenant records in one transaction, never creates a property copy, and cannot replace an established UID.

Registrations, verified sign-ins, phone-bearing Firebase token changes and account updates continue using existing discovery integration points. Repeated matching does not generate new claims or notifications.

## Phone verification integration status and external requirements

The repository has email/password and Google authentication, but no established phone-provider/reCAPTCHA verification UI or attested SMS configuration. No cloud authentication configuration was queried or changed. In-app Verify Mobile Number is therefore honestly disabled with a clear support/setup explanation. There is no OTP simulation, fake verified flag, profile-phone trust or email-as-phone-proof fallback.

The server can consume an already verified phone identity only when a revocation-checked Firebase ID token's `phone_number` matches the current active Firebase Admin UserRecord's phone, with an active platform profile and verified email. Manually edited profile phones never participate in matching. UID bindings remain stable when contacts change. Arbitrary owner/tenant UID parameters cannot grant access, duplicate/ambiguous phone matches fail closed, and confirmed relationships are protected against competing claims.

To enable in-app verified mobile matching end to end, an operator must configure Firebase Phone Auth, authorized domains, supported SMS region settings and reCAPTCHA, then integrate phone credential verification/linking onto the existing UID and refresh the ID token. Account collisions must use recovery rather than automatic account merging. This work and real-device verification remain an external integration dependency; this report does not claim that deployed phone verification is enabled.

Existing Firestore deployment rules must deny direct client access to `relationship_links` and `relationship_link_limits`, including broad catch-all grants. Review indexes for the equality queries before rollout. Optional rate-limit TTL housekeeping may use `expiresAt`; do not TTL-delete relationship history. No live rules, indexes or TTL settings were changed. Legacy records without a discovery claim still require an independently reviewed migration; no live backfill was performed.

Official Firebase setup reference: https://firebase.google.com/docs/auth/web/phone-auth

## Security and notifications

Every final mutation rechecks active profile, claim binding, current property ownership, tenant activity/UID, phone identity, current state, expiry and optional revision inside its Firestore transaction. Discovery and expiry transitions likewise recheck authorized scope when writing. Per-UID rate limits, opaque IDs, strict request fields, immutable claimed UID handling, state guards and deterministic event IDs are retained.

Only confirmed link actions use the existing notification infrastructure. No private details are sent to reported/unverified contacts, and no notification is generated on ordinary discovery, refresh or state normalization. Relationship notification recipients use active, verified Firebase identities. Existing public listing visibility and administrator ownership-evidence rules remain unchanged.

## Verification

All database/auth tests use the existing isolated fixture. UI tests server-render the actual component with isolated query results; they do not open a browser or access Firebase/network services. Final commands and counts are recorded below after the final run.

Final validation results:

- `npm run typecheck` — passed.
- `node --test tests/relationship-links.test.cjs tests/pending-connections.test.cjs tests/pending-connections-ui.test.cjs tests/owner-verification.test.cjs tests/account-management.test.cjs tests/auth-phase.test.cjs tests/admin-property-operations.test.cjs tests/property-product.test.cjs` — 82 passed, 0 failed.
- `node --test --test-name-pattern="tenant" tests/native-group2.test.cjs` — 4 passed, 0 failed.
- `git diff --check` — passed; only existing LF/CRLF advisories.

Total: 86 focused tests passed. These cover both registration orders, blocked unverified/wrong identities, independent owner evidence approval, owner-authorized tenant acceptance, unchanged Owned/Rented property IDs, preserved records, idempotence, races, private projections, expiry, old-state compatibility, and all requested Pending Connections display states.

No Playwright, full test suite, extensive browser testing, build, deployment, Git push or live data operation was performed.
