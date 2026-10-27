# Owner and tenant invitation emails

Implemented generic transactional invitations on the existing relationship-linking system. Existing uncommitted changes were preserved. No new page, public lookup endpoint, email-based account matching, or authorization mechanism was introduced.

## Files changed for this task

- `src/lib/email-address.ts` — validated, trimmed, lowercase email normalization; rejects control characters and malformed addresses.
- `src/lib/server/services/relationship-invitation-email.ts` — reusable owner/tenant HTML and text templates; transactional invitation staging, stable keys and quotas.
- `src/lib/server/services/relationship-links.ts` — optional explicit invitation intents alongside newly persisted claims.
- `src/lib/server/services/properties.ts` — normalizes intake emails before submission fingerprinting; stages new-property invitation outbox records atomically and dispatches after commit.
- `src/lib/server/services/tenants.ts` — validates and normalizes Add Tenant email; atomically queues owner-authorized invitations.
- `src/lib/server/services/transactional-email.ts` — exposes stable delivery ID helper; cancels obsolete invitations before sending and blocks their retry. Existing recipient eligibility checks remain strict for normal account notifications.
- `src/components/RouteGuard.tsx` — preserves the fixed Pending Connections destination across sign-in when entering from the generic invitation CTA.
- `tests/relationship-invitation-email.test.cjs` — 19 isolated invitation tests.
- `tests/email-events-phase.test.cjs` — updates phone-security fixture to supply both current Firebase account phone identity and token phone proof.
- `RELATIONSHIP_INVITATION_EMAIL_REPORT.md` — this report.

## Templates

Both variants share a responsive, table-based layout with inline CSS, a forest-green header, ivory background, bronze accents, an accessible primary link, support footer and plain-text alternative. No submitted user values enter the template.

### Ownership

Subject: **Property Ownership Verification Request | PropBank**

Hello,

A tenant has submitted property information and identified you as the owner.

To review this request, please sign in or create your account and complete the required ownership verification.

No property ownership access has been granted.

CTA: **Review Ownership Request**

### Tenancy

Subject: **You've Been Invited to Confirm a Tenancy | PropBank**

Hello,

A property owner has submitted tenancy information and invited you to review a rental property connection.

Sign in or create your account to review the invitation and confirm whether the tenancy belongs to you.

You will not be linked to the property until the required identity verification and confirmation steps are completed.

CTA: **Review Tenancy Invitation**

Both variants explain that an unrecognized invitation can be ignored or reported to support, and that the invitation does not verify identity or authorize property access.

## Triggers and contracts

- Existing `POST /api/properties`: optional reported owner email on tenant intake, or tenant email on owner intake. Invalid supplied invitation email returns 400. Missing optional email preserves the pending relationship without sending mail.
- Existing `POST /api/tenants`: required valid tenant email. Only an actual authenticated property owner's invitation is eligible for reported-recipient mail; administrator/agent assignment without that authorization does not send it.
- Only a fresh persisted claim plus an explicit new-intake intent can create an invitation event. Login, discovery, reads, imports and historical contact synchronization do not trigger invitation mail.
- No new request fields or public endpoints. Existing Property Hub and relationship APIs retain their verified-identity permissions and limited projections.
- Existing administrator email-delivery listing and retry endpoints expose operational metadata and permit authorized retry, without recipient/content overrides.

## Persistence, delivery and abuse controls

- Property/tenancy, relationship claim, quota updates and invitation outbox records commit in one Firestore transaction. All transaction reads precede writes. A failed business/outbox write rolls back the operation and queues no email.
- After commit, existing Next.js `after` dispatch sends via the existing Resend adapter. Provider failure leaves the business records intact and records a sanitized delivery failure.
- Each claim/relationship event has one deterministic delivery document and immutable provider idempotency key. Repeated/concurrent requests and discovery cannot create additional invitation events.
- Existing delivery leases, bounded attempts (five), five-minute failed-delivery backoff and administrator retry are retained. There is no new background scheduler. Durable pending/failed records remain available to the existing operational tooling.
- Existing 23-hour reconciliation guard remains in place because provider deduplication is time-bounded; old ambiguous failures require reconciliation, not blind resend. See [Resend idempotency documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).
- New private `email_invitation_limits` counters enforce 10 invitations per sender/hour, 30 per sender/day and 3 per normalized recipient/day. Excess messages are recorded as `suppressed`; property/tenancy creation still succeeds. Suppressed records cannot be retried through the delivery endpoint.
- Missing/unsafe application URL suppresses invitation delivery and records a configuration reason. Correct configuration before accepting real intake; no automatic retrospective sending is added.
- Rejected, expired, linked, inactive, changed-contact or otherwise obsolete invitations are cancelled before provider delivery and cannot be retried. Sender profile must remain active. Checks reduce stale sends; a concurrent state change during the external provider call cannot retract a message already accepted by the provider, and its generic CTA still grants no access.

## Privacy and identity

- Email content and CTA URLs contain no names, phones, addresses, amounts, documents, property IDs, claim IDs, UIDs or access tokens.
- CTA is only `${APP_URL origin}/manage-property#pending-connections`; configured path/query/fragment are discarded. Support links target the existing `/support` route. Configuration-derived HTML values are escaped.
- Reported email is a delivery destination only. Existing and unregistered recipients get identical generic content; no account-existence lookup or disclosure is added.
- Clicking the link leads through authentication. Ownership still requires verified-mobile discovery and existing administrator documentary approval. Tenancy still requires the existing owner authorization and explicit tenant acceptance. A matching email cannot discover or link a relationship.
- No reply-to identity is taken from reported contact data. Private business notifications still require their existing trusted recipient checks.
- The existing phone verification UI reports verification unavailable; this task does not implement OTP or attest live Firebase Phone Auth configuration. Email-only recipients remain in the generic sign-in/verification-required experience until a compatible Firebase UID-bound phone verification integration is available.

## Live configuration dependencies

- `RESEND_API_KEY` for the existing Resend adapter.
- `FROM_EMAIL` on a verified sending domain.
- `APP_URL` (or `NEXT_PUBLIC_APP_URL`) with the trusted public origin; HTTPS is required in production.
- Optional `SUPPORT_EMAIL`; otherwise valid `FROM_EMAIL` is shown. The support page link is always provided.
- Keep `email_deliveries`, `relationship_links` and `email_invitation_limits` server-private in deployed Firestore rules. Counter `expiresAt` fields support optional operational TTL cleanup; no live rules or TTL configuration was changed.
- Existing Firebase verified-mobile integration remains an external dependency for secure discovery; email delivery does not remove that requirement.

## Verification

- `npm run typecheck` — passed.
- Focused run: `node --test tests/relationship-invitation-email.test.cjs tests/owner-verification.test.cjs tests/email-events-phase.test.cjs tests/relationship-links.test.cjs tests/pending-connections.test.cjs tests/pending-connections-ui.test.cjs tests/account-management.test.cjs tests/admin-property-operations.test.cjs tests/property-product.test.cjs` — **100 passed, 0 failed**.
- `git diff --check` — passed; Git reported line-ending conversion warnings only.

Tests use isolated Firestore/Firebase fixtures and intercepted Resend requests only. No real mail, production data writes, builds, Playwright, full suites, deployment or Git push were performed. No live sender-domain or Firebase provider configuration was verified.
