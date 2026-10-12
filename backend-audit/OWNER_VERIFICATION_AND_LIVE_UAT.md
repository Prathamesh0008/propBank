# Owner verification and live UAT readiness

Admin verification policy was explicitly selected by the user. The tenant intake rule is preserved: typed contacts never grant ownership.

## Implemented owner verification

Admin Portal → property details → Verify and link owner. Review a document already attached to this property, independently confirm ownership and select the intended existing Firebase UID. Supply the document ID, review note and confirmation. No emails are sent to unverified reported owner contacts.

`POST /api/owner-verification`: `{propertyId, ownerUID, evidenceDocumentId, reviewNote}`. Administrator authorization is server enforced. The destination must be an active Firebase account with verified email and an active platform profile. The UID cannot be an active tenant of the same property. Evidence must exist under that property. Only pending tenant-submitted properties with no owner can be linked; repeat attempts return 409.

One Firestore transaction sets trusted owner metadata, `ownershipVerification: verified`, private `ownershipVerificationAudit` (admin UID, owner UID, document ID, note, timestamp), and the owner UID of existing tenant collection records. It preserves embedded tenants, submitted contact evidence, rental terms, history and global user roles. No new collection, bulk update or migration is performed. Tenant-created properties remain private. This records an administrator's verification; it does not automatically authenticate the legal sufficiency of a document.

Files: `src/lib/server/services/owner-verification.ts`, `src/app/api/owner-verification/route.ts`, `src/features/admin/OwnerVerification.tsx`, `src/features/admin/AdminPropertyDetailsDialog.tsx`, `tests/owner-verification.test.cjs`.

Focused isolated backend tests: 26 passed, 0 failed. Includes three new verification tests. Typecheck and production build passed; lint has zero errors and 81 warnings. Live account verification and the new admin UI still require staging UAT; no new browser test result is claimed.

## Live testing blockers

Configuration inspection found `RESEND_API_KEY`, `FROM_EMAIL` and `CRON_SECRET` missing. The selected staging project and controlled recipient are not yet supplied. No production records or provider sends were performed.

Configure secrets locally, with a verified Resend sender and a cron secret of at least 32 characters. Supply only the staging project identity and controlled recipient in conversation, never secrets. Confirm that the running server actually targets staging before creating records. Do not call the existing cron against production: it scans eligible properties and visits, rather than a supplied test-record filter.

## Controlled UAT sequence

1. Use staging admin, owner and tenant accounts; record initial relationships.
2. Add a tenant-submitted property, upload test evidence, verify as admin, then confirm it appears in the new owner's Owned list and remains in the tenant's Tenant list. Check cross-user rejection and retained tenancy.
3. Trigger tenant assignment, renewal request, termination request and an existing service/negotiation notification on disposable staging records. Capture recipients, subjects and provider acceptance separately from inbox arrival.
4. Prepare due visit, current due-day rent and 90/60-day expiry cases. Call authenticated `POST /api/cron/reminders` twice. Record provider sends and persisted reminder delivery state; the second run must not send successful reminders again.
5. Check real Resend events, delivery/bounce status and controlled inbox. Provider acceptance alone does not prove delivery.
6. Verify R2 upload/open/delete and legacy URLs using controlled objects. Test simultaneous accounts and concurrent approval/version conflicts.

Expiry phases require separately controlled dates/records; do not rewrite customer agreements to trigger emails. Actual cron scheduling and deploy credentials require external setup. Failed or ambiguous reminder deliveries must follow existing retry/reconciliation rules.

No commit, push or prohibited git operation was performed. Branch: `feature/property-management-improvements`.
