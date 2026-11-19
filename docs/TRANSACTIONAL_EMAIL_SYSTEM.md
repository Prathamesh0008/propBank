# PropBank transactional email system

## Architecture and safety

Business transactions stage `UserEvent` notification intents and/or frozen `TransactionalEmailEvent` deliveries in `email_deliveries`. Existing recipient resolution, transaction boundaries, event identifiers, delivery hashes, leases, retry ceilings, backoff and provider idempotency are retained. `recoverNotification` and notification recovery continue to revalidate eligible recipients before sending. Existing queued HTML/text is not rewritten, and delivered/provider-accepted records are not resent.

New content uses `src/lib/email-design.ts`: table layout, inline forest/ivory branding, the approved `/images/pb1_logo.png` asset, text fallback when images are blocked, preheader, escaped headings/greetings, optional summary rows, human status labels, date/time helpers, Indian currency and a single validated action. `propertyEmailContext` consumes an already-authorized snapshot; it performs no database queries. Dates, money and addresses remain unchanged in storage. The primary action and support link use configured `APP_URL` / `NEXT_PUBLIC_APP_URL`; production requires HTTPS and rejects localhost. An isolated `http://local` or `.test` origin is accepted only outside production for existing fixtures. Missing/unsafe origins omit actions and remote logo URLs rather than inventing a destination.

`emailContext` and recipient names are additive intent metadata. Absent metadata on historical intents is supported. Role-restricted rows default to hidden when no recipient audience is known. HTML body fragments are server-owned; customer values must be escaped at their producer. Internal identifiers remain in durable traceability metadata and authorized route parameters, not summary fields. Email action links never point directly at private files.

## Complete application email inventory and recipient matrix

Recipients below are eligibility candidates, not unconditional sends. Existing verified identity, active-account, relationship/invitation and configured-admin checks still apply. Owner/tenant notices are scoped to the relevant property/tenancy; removal/termination can deliberately address a relevant former tenant. Actor self-notification suppression follows existing producer policy.

| Template ID | Existing events / trigger | Recipients | Producer |
|---|---|---|---|
| registration-welcome | user.registration_welcome; successful new account/profile creation | Registered user | users.ts / createUser |
| account-security | user.profile_changed, user.mobile_number_changed, user.password_changed, user.email_change_requested, user.email_changed | Account holder; previous address only for trusted email-change notices; configured admin for profile/mobile activity | account.ts, users.ts, verified-email.ts |
| agent-registration | agent.registration | Registered agent, admin | users.ts |
| property-review | property.submitted, property.approved, property.rejected, property.changes_requested | Existing authorized submitter/owner recipient; admin on submission | property-effects.ts / propertyNotificationEvents |
| admin-property-lifecycle | property submitted/pending, tenant assigned/removed/replaced/confirmed, rental terms changed, agreement renewal submitted/renewed/rejected, termination lifecycle | Admin according to existing lifecycle email policy | admin-lifecycle.ts / stageAdminLifecycle |
| property-activity | property.updated; maintenance lifecycle; inspection.submitted; review.submitted; document.uploaded/reviewed/removed/removal_requested | Eligible owner and applicable confirmed tenants, respecting private-document scope and actor suppression | property-activity.ts / stagePropertyActivity |
| property-activity-admin | Same existing property activity | Configured admin | property-activity.ts |
| tenant-assigned | tenancy.tenant_assigned during tenant/property intake | Owner, eligible confirmed tenant | tenants.ts, property-effects.ts |
| tenant-assign | tenancy.tenant_assign | Owner, eligible tenant | tenants.ts / tenancy lifecycle |
| tenant-replace | tenancy.tenant_replace | Owner, eligible replacement and relevant former tenant | tenants.ts |
| tenant-remove | tenancy.tenant_remove | Owner, relevant former tenant | tenants.ts |
| tenant-removed | tenancy.tenant_removed during property relationship edits | Owner, relevant former tenant | property-effects.ts |
| tenant-linked | relationship.tenant_linked after confirmation | Owner, confirmed tenant | relationship-links.ts |
| rental-terms-updated | tenancy.rental_terms_updated, including meaningful schedule/deposit/due-day/date edits | Owner, confirmed applicable tenants | property-effects.ts |
| agreement-activity | agreement.renewal_request/approve/complete/reject; agreement.termination_request/terminate/reject as supported by existing action validation | Owner, applicable confirmed tenant participants | agreements.ts |
| agreement-termination-admin | agreement.termination_admin_requested/notice_served/terminated/rejected | Admin | agreements.ts |
| agreement-expiry-reminder | agreement.expiry_reminder at existing configured offsets | Eligible owner and tenant | reminders.ts |
| rent-reminder | rent.reminder at existing seven-day, one-day and due-date offsets | Eligible owner and tenant | reminders.ts |
| rent-payment-recorded | rent.payment_recorded, rent.payment_status_changed | Owner, active confirmed applicable tenant; administrative awareness follows existing admin-activity policy | property-hub.ts |
| maintenance-activity | maintenance.created/updated when no property-bound activity snapshot exists | Requester, admin | migration-remainder.ts |
| property-enquiry | enquiry.property_created | Admin | notifications.ts |
| general-enquiry | enquiry.general_created | Admin | group2-mail.ts / inquiryMailEvent |
| enquiry-tracking | enquiry.assigned/reassigned/unassigned/status_updated | Authorized current/previous agent and admin as selected by existing producer | enquiries.ts |
| negotiation-activity | negotiation status transitions supported by negotiations.ts | Relevant owner, customer, broker; admin awareness through existing policy | negotiations.ts |
| visit-activity-requester | visit.scheduled/completed/cancelled; rescheduling is recorded under the normalized scheduled type | Requester | visits.ts |
| visit-activity-owner | Same visit lifecycle, when property/owner relationship exists | Eligible owner | visits.ts |
| visit-activity-admin | Same visit lifecycle | Configured admin | visits.ts |
| visit-reminder-requester | visit.reminder, 30 minutes before visit | Eligible requester | reminders.ts |
| visit-reminder-admin | Same reminder, duplicate-address suppression retained | Admin | reminders.ts |
| owner-verification-decision | owner_verification.approve/reject/reconsider | Related reporting tenant, relevant owner, admin actor | owner-verification.ts |
| admin-response | request.admin_response | Original authorized requester | notifications.ts |
| admin-activity | Existing administrative copies for payment/service/negotiation/profile/agent events | Configured admin | transactional-email.ts / recoverNotification |
| relationship-owner-invitation | relationship.owner_invitation, new explicitly authorized intake only | Reported owner address, rate-limited and revalidated against authoritative claim | relationship-invitation-email.ts |
| relationship-tenant-invitation | relationship.tenant_invitation, new explicitly authorized intake only | Invited tenant address, same safeguards | relationship-invitation-email.ts |

The catalogue lists template families; it does not add new lifecycle actions. Runtime action allowlists in each service remain authoritative. Authentication activity records such as login, role changes and password_reset_requested are not themselves a promise of an additional application email. No login/page-view email was introduced.

### Existing shared coverage and boundaries

- Deposit changes are covered by rental-terms-updated; there is no separate deposit event.
- TDS and inspection report variants use inspection.submitted / property-activity. Legal and related services use the existing maintenance service category. Service Resolved and Completed retain distinct business states and human labels.
- Property reviews, document uploads/reviews/removals and shared-document requests use existing property activity, with private Pre-Leased evidence excluded from tenant recipients. Emails do not attach documents, photographs, KYC, private evidence or private download links.
- Agreement creation information accompanies tenancy/relationship workflows. Reading/generating a draft PDF is not a new mutation/email event. Renewal proposals remain distinct from activation/approval; notices do not claim a completed renewal merely because a request was submitted.
- Inventory snapshots are part of the agreement workflow; no independent inventory email event was invented.
- Legacy tenant/visit/notice/termination/renewal helper exports have no current external call sites found in `src`. Their positional template interfaces remain supported and redesigned for compatibility; they were not activated as a second delivery system.

## Content improvements

Property review messages identify property/unit, corrected address, applicable price label, submitter context for admin, feedback and actual submission/review timestamps. Property activity separates requester/role, property, update, recorded time and status. Agreements separate proposed/recorded dates and next steps. Visits include scheduled time and status; internal visit references are omitted. Rent notices use the existing due-date-resolved amount and explicit billing period. Payment notices describe recorded payment status, not proof of a bank transfer; multi-tenancy amounts are owner/admin-only rather than exposing unrelated contracts. Unconfirmed tenant links are excluded from payment email selection. General enquiries include actual submitted customer preferences/contact/message in both HTML and text. Admin account updates use a minimal audit-safe summary, not full changed personal values.

Missing optional rows are omitted. Zero deposits render as zero. Absent amounts are not coerced to zero. Raw enums are humanized. Subject/body/summary strings remain escaped and approved route links are validated. Support and private-file authorization are unchanged.

## Delivery status and operational dependencies

- pending / queued: durable delivery exists, not sent.
- sending / processing: active atomic lease.
- sent / provider_accepted: Resend accepted the request; this does **not** prove inbox delivery.
- failed / retryable_failure: recoverable according to existing backoff/attempt ceilings.
- permanent_failure / exhausted / reconciliation_required: existing operator intervention states.
- No verified delivery/bounce webhook pipeline was added. Delivered/bounced cannot be claimed without trusted provider evidence. Existing admin delivery history already explains provider acceptance separately from delivery.

`RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL` and approved HTTPS application origin remain operator prerequisites. Sender-domain verification, actual inbox delivery, bounce tracking and real recovery/reminder scheduler execution are unverified locally. This task does not configure or invoke schedulers/providers. The existing protected recovery endpoint, bounded pagination and leases remain unchanged. Missing admin configuration remains visible through existing durable recovery/unconfigured states.

## Local previews

Run `node scripts/preview-transactional-emails.cjs`. No `.env`, SDK, account records or providers are loaded. Default output: `%LOCALAPPDATA%/PropBank/email-previews/index.html`, with individual HTML/text files and a copied approved logo. There are 34 current template IDs, their applicable role variants, and 11 legacy positional templates (68 previews in total). The gallery provides 640px desktop and 375px mobile frames. Data is synthetic and action URLs use `preview.propbank.invalid`; no public preview route is added. These are shared-renderer examples, not proof that every customer record contains every optional field or that Outlook/Gmail/mobile clients have been verified.

## Firebase authentication branding: manual operator work only

The current application still uses Firebase client verification/password-reset delivery. No action-link generation, live send or authentication transport replacement was introduced.

1. Select the correct Auth project in Firebase Console. In Project settings > General, inspect the **public-facing name** and support email. Set the public-facing name to PropBank after separate configuration approval; a missing/generic app name is a possible source of project-number branding, not a locally verified Console diagnosis.
2. Open Authentication > Templates (or the Console's current Security > Authentication > Templates navigation). Review Email address verification and Password reset separately.
3. Set sender display name to PropBank. Use subjects such as `Verify your email for PropBank` and `Reset your PropBank password`. Preserve Firebase's required placeholders/action links. Customize reply-to only with the approved monitored support address. Inspect the template preview; verification email body customization is limited compared with password reset.
4. Preserve existing verified action-handler/continue destinations. Do not paste unapproved redirect domains or replace a working handler while changing branding. If a custom sending/link domain is required, follow Firebase's domain verification process under separate DNS/configuration approval.
5. After approval, verify real verification/reset messages on test accounts under an explicitly authorized live acceptance procedure. No such sends were performed here.

### Separate future design requiring approval: Resend authentication messages

If Console customization is insufficient, Firebase Admin can generate verification/reset action links for a custom sender. This is a separate security-sensitive implementation, **not activated here**:

- Verification requests require a current revoked-token-checked Firebase identity; resolve UID and current email from Firebase Admin, never a submitted `emailVerified` flag. Permit unverified identities only on this narrow endpoint, not through relaxed protected-route gates.
- Resolve password-reset targets server-side with generic anti-enumeration responses; require abuse controls (App Check where appropriate), bounded per-account/IP limits, cooldowns and idempotent request keys. Do not require completed-login access from a user who has forgotten the password.
- Use approved `ActionCodeSettings` continue URLs and authorized domains, and preserve existing Firebase action-code validation/one-time use/expiry. Never log codes, links or secrets.
- Encrypt/restrict sensitive delivery payloads and operator visibility; do not copy action links into ordinary audit/outbox previews. A retry must preserve the same immutable message/provider idempotency identity rather than generate a different action link on each attempt.
- Revalidate current recipient identity before delivery; test stale email/UID, token revocation, expired/reused codes, cancellation, retries, enumeration resistance and all mobile registry/profile gates in emulators before cutover approval.

Official references: [Firebase email template customization](https://support.google.com/firebase/answer/7000714), [Admin-generated email action links](https://firebase.google.com/docs/auth/admin/email-action-links), [Custom email action handlers](https://firebase.google.com/docs/auth/custom-email-handler), [Custom email domains](https://firebase.google.com/docs/auth/email-custom-domain).

## Files changed in this task

New shared/local files:
- src/lib/email-design.ts
- src/lib/email-legacy.ts
- src/lib/email-preview-catalog.ts
- scripts/preview-transactional-emails.cjs
- tests/transactional-email-design.test.cjs
- docs/TRANSACTIONAL_EMAIL_SYSTEM.md

Existing email/event producers and adapters updated (prior unrelated local changes retained):
- src/lib/server/services/account.ts
- src/lib/server/services/admin-lifecycle.ts
- src/lib/server/services/agreements.ts
- src/lib/server/services/enquiries.ts
- src/lib/server/services/group2-email-templates.ts
- src/lib/server/services/group2-mail.ts
- src/lib/server/services/migration-remainder.ts
- src/lib/server/services/negotiations.ts
- src/lib/server/services/notifications.ts
- src/lib/server/services/owner-verification.ts
- src/lib/server/services/property-activity.ts
- src/lib/server/services/property-effects.ts
- src/lib/server/services/property-email-templates.ts
- src/lib/server/services/property-hub.ts
- src/lib/server/services/relationship-invitation-email.ts
- src/lib/server/services/relationship-links.ts
- src/lib/server/services/reminders.ts
- src/lib/server/services/resend.ts
- src/lib/server/services/tenants.ts
- src/lib/server/services/transactional-email.ts
- src/lib/server/services/users.ts
- src/lib/server/services/visits.ts

Existing test compatibility expectations updated:
- tests/server-foundation.test.cjs: load the real pure rendering dependencies and assert the new plain-text alternative while retaining sender/header/body/idempotency assertions.
- tests/agreement-admin-notifications.test.cjs: reject technical ID summary fields instead of requiring them; retain property/unit, participant, admin recipient, timeline and unread-state assertions.
- tests/relationship-invitation-email.test.cjs: compare the same forest color case-insensitively; all private-data/link/recipient security checks remain.

## Local verification record

The consolidated targeted run exercised authentication, payment/agreement consistency, Property 360, email events, sender, enquiries, invitations, reminder generation, durable staging, retry/recovery, and the new renderer. Three existing expectations above required compatibility updates. No tests were deleted or skipped.

Final affected/new-file verification: 97 passed, 0 failed, 0 skipped (57 new rendering/integration cases plus 40 existing sender, invitation, agreement/admin and server-foundation checks). TypeScript `--noEmit --incremental false` passed. Full production/browser/mailbox acceptance was not performed. The broader regression suite was not rerun wholesale after the narrowly affected follow-ups.

New branded messages preserve actual customer values even if an address matches a historical footer address. The legacy-only footer compatibility replacement remains for old HTML. New/explicit text alternatives and existing immutable delivery snapshots remain separate from provider delivery confirmation.
