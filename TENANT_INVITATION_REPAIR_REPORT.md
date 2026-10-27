# Tenant invitation and property visibility repair

## Diagnosis and evidence limits

The reported invitation's exact non-delivery reason **cannot be established from the available local evidence**. No production claim, email outbox, server execution log or Resend delivery record was read. No real email was sent. Local `.env.local` contains nonempty `APP_URL`, `FROM_EMAIL` and `RESEND_API_KEY` entries; this does not attest deployed values, validity, provider authorization or inbox delivery. Their values were not logged or changed.

The source trace establishes:

1. Ordinary Add Tenant submits `POST /api/tenants`. The server validates the email, creates the existing detailed and embedded tenancy and a fresh relationship claim, and stages an invitation in the same transaction when the actor is the actual property owner.
2. Administrator mode submits `POST /api/admin/properties/:id/tenancy`. It preserves a pending claim and deliberately does not send a reported-recipient email without owner consent. An administrator using the ordinary endpoint also does not qualify as the owner merely because they can manage the property.
3. Fresh owner-authorized events use a stable per-claim outbox document and Resend idempotency key. Regression tests show exactly one invitation; no incorrect key reuse was reproduced.
4. Missing/unsafe application URL produces a `suppressed` outbox record; sender or recipient limits also suppress mail. Invalid submitted email fails intake. Pending, linked, rejected or expired tenancy state must not be confused with mail status.
5. The outbox is committed before Next.js `after()` dispatch. No outbox event implies no invitation was queued. `pending` without an attempt means provider submission has not been recorded. `sending` indicates a delivery lease. `failed` records a sanitized delivery failure. `cancelled` means the relationship/contact no longer qualifies. `sent` means provider acceptance, not confirmed mailbox delivery.
6. A missing API key was previously collapsed into the generic provider failure message. It is now identified explicitly as a configuration failure, without logging secrets or recipient data. The established fallback sender remains `connect@propbank.shop` if `FROM_EMAIL` is absent; that sender domain still needs provider authorization. Invalid supplied sender format now fails clearly.

**Confirmed source gap repaired:** an admin-created tenancy had no visible owner action to authorize and queue its invitation afterward. The owner now has that action inside the existing Property Hub. This is a staging/authorization recovery gap; it does not prove that an administrative actor caused this particular reported email failure. Actual suppression, dispatch or provider rejection remains unknown until the corresponding operational record is inspected.

## Why the tenant saw zero properties

`isActive` describes the tenancy record. It does not establish tenant-account authorization. The reported **Awaiting Tenant Acceptance** state is a pending relationship with no trusted tenant UID link yet. Owned: 0 and Tenant: 0 are therefore expected before the required confirmations finish; matching email alone must not reveal the property.

The existing final-link transaction was verified to update both detailed and embedded tenant records with the authenticated UID, retain the original property ID and owner's relationship, and mark the relationship `linked`. No underlying final-link transaction failure was reproduced.

The existing UI additionally gated its acceptance button on verified-email response state and review. Without the actual API response/runtime bundle, the reported missing button cannot be attributed more precisely. It now always presents **Accept Tenancy** for the applicable tenant pending state, disabled until review and verified-email eligibility; it no longer disappears solely because eligibility is absent. The verification requirement remains visible when needed.

## Changes

- **Tenant interface:** “Tenant connection request,” “Awaiting your confirmation,” “Review Invitation,” a review-gated acceptance button and a concise explanation that property visibility follows confirmation and any required owner approval. The opaque reference is secondary review/support information.
- **Outcome messages:** acceptance returns a precise `linked` or `pending_owner_authorization` status, allowing success feedback or “Your acceptance has been recorded. Waiting for the property owner’s approval.”
- **Owner recovery:** new `authorize_tenancy_invitation` action on existing `POST /api/relationship-links`. Only the authenticated current owner with recent authentication can use it. It transactionally verifies current claim/property/tenancy/email, records `invitationAuthorizedByUID` and timestamp while preserving the original `createdByUID`, and stages the generic email with the existing quotas and stable key. It grants no tenant access. Repeated authorization cannot queue another invitation.
- **Owner approval:** the existing explicit final approval remains available when tenant acceptance is waiting for it. Administrator privilege cannot impersonate owner consent. Rejected/expired requests cannot be authorized.
- **Visibility refresh:** creation and confirmation invalidate relationship, owned/rented, property-detail and Property Hub queries. Pending connections refresh on focus and poll while requests remain pending; observing a completed connection invalidates property queries. This lets another session's approval appear without waiting for the previous five-minute properties cache. Polling does not send invitations.
- **Tenant Details:** differentiates active tenancy with a pending account connection from an already connected tenant account.
- **Operations:** configuration failures have safe, specific messages and a failure category. The administrator delivery UI exposes pending, sending, sent, failed, suppressed and cancelled filters, refresh and eligible pending/failed retry. It explains that provider acceptance does not establish inbox delivery. Existing delivery leases, immutable recipient/content retry, attempt limits and reconciliation safeguards remain.

No second property, tenancy or management page was introduced. Verified-email discovery, documentary owner verification, explicit tenant acceptance, owner authorization, private listing visibility, expiry/version checks and existing document/rental permissions remain in force.

## Exact files changed for this task

- `src/features/services/AddTenant.tsx`
- `src/features/properties/PendingConnections.tsx`
- `src/features/admin/AdminEmailDeliveries.tsx`
- `src/hooks/useProperties.ts`
- `src/lib/server/services/relationship-links.ts`
- `src/lib/server/services/relationship-invitation-email.ts`
- `src/lib/server/services/transactional-email.ts`
- `src/lib/server/services/resend.ts`
- `tests/pending-connections-ui.test.cjs`
- `tests/tenant-invitation-repair.test.cjs` (new)
- `TENANT_INVITATION_REPAIR_REPORT.md` (new)

Existing uncommitted work was preserved. Other listed tenant/property service files were inspected without unnecessary changes.

## Verification

- `npm run typecheck` — passed.
- `git diff --check` — passed; line-ending conversion warnings only.
- Focused regression command — **139 passed, 0 failed**:

  ```text
  node --test tests/tenant-invitation-repair.test.cjs tests/verified-email-relationships.test.cjs tests/owner-verification.test.cjs tests/email-events-phase.test.cjs tests/relationship-invitation-email.test.cjs tests/relationship-links.test.cjs tests/pending-connections.test.cjs tests/pending-connections-ui.test.cjs tests/auth-phase.test.cjs tests/account-management.test.cjs tests/admin-property-operations.test.cjs tests/property-product.test.cjs
  ```

- After the final presentation copy changes, all **12 Pending Connections UI tests** passed again, along with typecheck and whitespace checks.
- Added eight focused backend cases cover fresh owner invitation and original-property visibility, administrative consent isolation, acceptance awaiting approval, transactional rollback, missing provider key, sender/provider failures, suppression/invalid input/failed writes and terminal-state rejection. Three additional UI cases cover review-to-accept availability, waiting-for-owner wording and owner authorization controls.

Tests use isolated Firebase/Firestore fixtures and intercepted provider requests. No Playwright, full suite, production build, live Firebase writes, real email, deployment or push occurred.

## Separate controlled verification

To determine the original event's delivery failure, an authorized operator must inspect its existing claim and masked administrator outbox metadata, then correlate an existing provider message ID with Resend if one exists. Do not resend merely to diagnose it.

Actual outbound delivery requires a separately authorized test using a controlled mailbox and the deployed sender configuration, followed by checking the persisted attempt/status, provider result and recipient inbox/spam. Nothing in this task attests real email delivery. Any retry or new invitation in a live environment is a separate controlled action; it was not performed here.
