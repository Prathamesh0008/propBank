# Verified-email owner–tenant connections

Pending Connections now supports verified-email discovery and confirmation without Firebase Phone OTP. This report supersedes the phone-verification prerequisite described in the earlier linking and invitation reports. Existing Google and email/password authentication, Resend templates, property records and management routes remain in place.

## Files modified in this task

- `src/contexts/AuthContext.tsx`
- `src/features/properties/PendingConnections.tsx`
- `src/lib/server/services/relationship-links.ts`
- `src/lib/server/services/owner-verification.ts`
- `src/lib/server/services/properties.ts`
- `src/lib/server/services/tenants.ts`
- `tests/pending-connections-ui.test.cjs`
- `tests/pending-connections.test.cjs`
- `tests/relationship-links.test.cjs`
- `tests/relationship-invitation-email.test.cjs`
- `tests/verified-email-relationships.test.cjs` (new)
- `VERIFIED_EMAIL_LINKING_REPORT.md` (new)

All pre-existing uncommitted work was preserved. No new management page or collection was introduced.

## Verified-email rules

- New owner and tenant claims store validated `recipientEmailNormalized` and `identityMethod: email` in the existing private `relationship_links` collection. Email normalization trims whitespace and lowercases the address without provider-specific alias rewriting.
- Discovery reads the authenticated UID's **current Firebase Admin UserRecord**, requiring a non-disabled account, `emailVerified: true`, and a valid email matching the claim. Editable Firestore profile email and token email never establish this match. Existing authentication additionally requires a verified Firebase ID token and active platform profile.
- Discovery requests accept no caller-supplied email, phone or UID. They query only the authenticated account's verified identity and bind an eligible claim to that UID in a transaction. A pre-existing candidate UID is never replaced by another account, including one that later acquires the same email address.
- New claims may bind an already registered, verified account at intake through Firebase Admin lookup. No account is created by this lookup and no account-existence response is exposed to the submitting user.
- Email-based claim IDs are deterministic for relationship, property, tenancy and normalized email. Changing a contact phone does not produce a new email claim or constitute identity proof.
- Existing registration/profile synchronization hooks and the authenticated token-change hook invoke the same discovery service. Property Hub refresh also discovers requests. Discovery does not create invitation email events.
- Pending email claims never fall back to a phone match when email is wrong or unverified. Existing genuine verified-phone support remains an optional compatibility path for older claims without an invitation email; no OTP configuration is required for new email invitations.
- Records without any reported recipient email cannot be discovered by email. An eligible reported address must be supplied through the existing authorized workflow; profile edits or guessed addresses cannot substitute for it.

## Existing invitation compatibility

For claims created before the normalized recipient email was persisted, discovery can consult existing private invitation outbox records addressed to the current verified account email. It verifies the relationship type, property association, current reported contact, expiry and existing candidate UID before adopting that email on the original claim. Existing pending-admin review state is retained. This creates no replacement property, tenancy or email delivery.

Discovery remains bounded and returns the existing `truncated` signal for large result sets. No bulk migration, historical invitation sending or live database operation was performed.

## Authorization and privacy

Email possession discovers a limited request; it never grants ownership or tenancy.

### Tenant submits first

1. Persist the existing tenant-created property, reported owner email and pending claim; reuse the generic Resend invitation.
2. A currently verified matching Firebase account discovers the claim, including after registering later.
3. The owner requests ownership verification. Property access remains unavailable.
4. An active administrator reviews the existing required evidence document and review note, with property verification version checks. The claimant's current Firebase identity is read again inside the transaction; changed or unverified email and a changed reported recipient block approval of that pending claim.
5. Approval links the original property to the owner. The tenant's rented relationship and property ID remain intact.

### Owner submits first

1. Persist the existing property/tenancy and owner-authorized pending invitation.
2. A verified matching tenant explicitly accepts. When the account was already known and authorized at intake, acceptance can complete the connection.
3. An account first discovered after intake still requires the existing additional authenticated owner approval after tenant acceptance.
4. Delayed approval rechecks the tenant's current Firebase email and verification, active profile, current property owner, active tenancy and UID conflicts inside the transaction.
5. Final linking updates the existing tenancy and embedded property relationship atomically. Rent, deposits, documents, agreements, histories and the owner's relationship are preserved.

Terminal states, expiry, optimistic versions, recent authentication for relationship actions, action rate limits and idempotent final-link replay are retained. Rejected or expired requests cannot link. Competing verified owners or established tenants cannot be overwritten.

Candidate responses remain limited to opaque reference, relationship, status, version and expiry; private property details, contacts, account identities and documents are not exposed through matching. Existing authorized owners retain their scoped property labels. Generic email links contain no private identifiers or authorization tokens. No public email lookup endpoint was added.

## API and UI

- Existing `GET /api/relationship-links` adds `emailVerified`, derived from current Firebase Admin state. Existing compatibility phone fields remain available.
- Existing `POST /api/relationship-links` retains its actions and request shape. Discovery and candidate authorization now support verified email; callers still cannot submit identity-matching fields.
- Existing administrator ownership-verification endpoint retains its evidence requirements and now rechecks email-based claimant identities during review.
- Pending Connections uses `emailVerified` for candidate actions, email-aware query keys, and a **Verify Email** link to the existing authentication flow instead of the unavailable Phone OTP control.
- Loading, empty, pending approval, rejected/expired and retry states remain in the existing Property Hub.

## Configuration

No Firebase Phone Auth or SMS setup is required for the email path. Keep the existing Google/email-password providers and email-verification flow enabled. Resend uses the existing `RESEND_API_KEY`, verified-domain `FROM_EMAIL`, trusted public HTTPS `APP_URL` and optional `SUPPORT_EMAIL` configuration.

Keep claims and invitation outbox records inaccessible to direct client reads/writes. If deployed Firestore index settings require a composite index for the new discovery query, provision `relationship_links(recipientEmailNormalized, status)` through the normal deployment process. No provider configuration, deployed rules or indexes were changed or attested during this task.

## Verification

- `npm run typecheck` — passed.
- Focused command:

  ```text
  node --test tests/verified-email-relationships.test.cjs tests/owner-verification.test.cjs tests/email-events-phase.test.cjs tests/relationship-invitation-email.test.cjs tests/relationship-links.test.cjs tests/pending-connections.test.cjs tests/pending-connections-ui.test.cjs tests/auth-phase.test.cjs tests/account-management.test.cjs tests/admin-property-operations.test.cjs tests/property-product.test.cjs
  ```

- **128 passed, 0 failed**, including 18 new email-specific tests: late owner/tenant registration, both creation directions, no-phone confirmation, current Admin identity versus stale token/profile values, unverified/wrong/changed email, delayed approval checks, recycled-email UID conflicts, rejected/expired claims, concurrent replay, preserved records, independent properties, legacy invitation adoption, enumeration protection and phone contact changes.
- `git diff --check` — passed; only existing Git line-ending conversion warnings.

All Firebase/Firestore and mail behavior was isolated in fixtures. No real emails, live database changes, Playwright, full suite, production build, deployment or Git push occurred.
