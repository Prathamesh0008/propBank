# PropBank Notification System Test Report

Date: 23 October 2026  
Branch: `feature/property-management-improvements`

## Result

The isolated notification repair is **PASS**. No real email was sent, no production Firebase record was accessed, and nothing was deployed.

The focused verification executed **107 tests: 106 passed, 0 failed, 1 skipped**. The skipped test requires the unavailable original Go reference source. A final post-cleanup subset executed **27 passed, 0 failed, 0 skipped**. `npm run typecheck` passed after the final code changes.

Live delivery remains **BLOCKED** pending controlled inbox approval. A mocked Resend acceptance is not treated as inbox delivery.

## Event inventory

Email events use the durable `email_deliveries` outbox unless explicitly described as a visit reminder. Website events use the protected `admin_notifications` collection or, for broker tracking, the assignment inbox.

| No. | Event | Exact recipients | Channel | Isolated status | Live status |
|---:|---|---|---|---|---|
| 1 | Account registration | Newly registered active user | Email | PASS | BLOCKED |
| 2 | Verified phone changed | Account user; configured administrator | Email + admin security notification | PASS | BLOCKED |
| 3 | Owner property submitted | Submitting owner; configured administrator | Email | PASS | BLOCKED |
| 4 | Admin-created property | Selected owner; configured administrator | Email | PASS | BLOCKED |
| 5 | Property approved | Property owner | Email | PASS | BLOCKED |
| 6 | Property rejected | Property owner | Email | PASS | BLOCKED |
| 7 | Property changes requested | Property owner | Email | PASS | BLOCKED |
| 8 | Tenant assigned | Property owner; newly assigned registered tenant | Email | PASS | BLOCKED |
| 9 | Tenant replaced | Property owner; replacement tenant; removed tenant | Email | PASS | BLOCKED |
| 10 | Tenant removed | Property owner; removed tenant | Email | PASS | BLOCKED |
| 11 | Rental terms changed | Property owner; active registered tenant | Email | PASS | BLOCKED |
| 12 | Rent marked paid | Property owner; active registered tenant | Email | PASS | BLOCKED |
| 13 | Rent due in 7 days | Property owner and active tenant separately | Email | PASS | BLOCKED |
| 14 | Rent due in 1 day | Property owner and active tenant separately | Email | PASS | BLOCKED |
| 15 | Rent due today | Property owner and active tenant separately | Email | PASS | BLOCKED |
| 16 | Agreement renewal requested | Property owner; active tenant | Email + admin/property website record | PASS | BLOCKED |
| 17 | Agreement renewal approved | Property owner; active tenant | Email + admin/property website record | PASS | BLOCKED |
| 18 | Agreement renewal rejected | Property owner; active tenant | Email + admin/property website record | PASS | BLOCKED |
| 19 | Agreement termination requested | Property owner; active tenant | Email + admin/property website record | PASS | BLOCKED |
| 20 | Agreement terminated/rejected/notice served | Property owner; affected active tenant | Email + admin/property website record | PASS | BLOCKED |
| 21 | Agreement expiry in 30 days | Property owner and active tenant separately | Email | PASS | BLOCKED |
| 22 | Agreement expiry in 15 days | Property owner and active tenant separately | Email | PASS | BLOCKED |
| 23 | Agreement expiry in 7 days | Property owner and active tenant separately | Email | PASS | BLOCKED |
| 24 | New enquiry | Configured administrator; enquiry remains in admin inbox | Email + Website | PASS | BLOCKED |
| 25 | Enquiry assigned/reassigned/unassigned | New agent; previous agent when removed/reassigned; acting/configured administrator | Email + private broker/admin inbox history | PASS | BLOCKED |
| 26 | Enquiry status updated | Assigned agent; configured administrator | Email + private broker/admin inbox history | PASS | BLOCKED |
| 27 | Visit scheduled | Requester; property owner | Email + admin visit notification | PASS | BLOCKED |
| 28 | Visit rescheduled/updated | Original requester; property owner | Email + admin visit notification | PASS | BLOCKED |
| 29 | Visit cancelled | Original requester; property owner | Email + admin visit notification | PASS | BLOCKED |
| 30 | Negotiation offer submitted | Property owner; customer; assigned broker when present | Email + admin negotiation notification | PASS | BLOCKED |
| 31 | Negotiation counteroffer/proposal | Property owner; customer; assigned broker | Email + admin negotiation notification | PASS | BLOCKED |
| 32 | Negotiation accepted/rejected/completed | Property owner; customer; assigned broker | Email + admin negotiation notification | PASS | BLOCKED |
| 33 | Maintenance request created | Requester; property owner; configured administrator | Email + admin service notification | PASS | BLOCKED |
| 34 | Maintenance updated/resolved | Requester; property owner; acting administrator | Email | PASS | BLOCKED |
| 35 | Owner verification approved/rejected/reconsidered | Submitting tenant; verified owner when linked; acting administrator | Email | PASS | BLOCKED |
| 36 | Visit reminder | Visit requester only | Leased, idempotent direct email | PASS | BLOCKED |
| 37 | Admin response to request | Original requester | Email | PASS | BLOCKED |

## Repairs completed

### Negotiation 404

The service was correctly enforcing moderation. The failing fixture represented a public listing but omitted `moderationStatus: approved`, so it correctly received 404. The fixture now represents an approved listing. Owner approval, customer final acceptance, broker permissions, stale-version rejection, and completion rules remain unchanged.

Negotiation tests now verify owner/customer/broker recipients, website records, unrelated-user exclusion, and offer/counter/rejection stages.

### Safe legacy HTML

`formatTemplate` escapes every ordinary interpolation value. Deliberate markup requires an explicit `trustedTemplateHtml` wrapper around application-constructed HTML whose dynamic values are escaped first. A regression test proves an injected `<img onerror>` string is encoded while intended `<strong>` formatting remains intact.

### Enquiry tracking notifications

Assignment, reassignment, unassignment, and status changes now create transactional events after the tracking transaction commits. Messages contain only the property label, tracking status, and assignment action. They exclude contacts, internal notes, owner secrets, attachments, and broker notes.

Assignment permissions remain server-enforced. Brokers cannot self-assign or update another broker's enquiry. Notification persistence failure does not roll back a committed assignment.

### Legacy delivery migration

- General enquiry email migrated to `email_deliveries`; the hard-coded administrator fallback was removed.
- Admin response email migrated with a stable event identity and verified requester UID.
- Property-effect tenant assignment messages migrated to UID-resolved transactional deliveries.
- Legacy rent-increase and due-day messages were removed because `tenancy.rental_terms_updated` already covers the same recipients and avoids duplicates.
- Visit reminders retain their established per-visit lease because their minute-based state is coupled to the scheduler.
- Unused compatibility exports in `group2-mail.ts` remain available; active general-enquiry delivery now uses the centralized system.

### Recipient correction

Admin-updated visits previously passed the administrator UID into recipient selection. They now retain the original requester and notify that requester plus the property owner.

## Reliability and security

- PASS — stable event keys prevent duplicate records.
- PASS — inactive or invalid recipients are suppressed.
- PASS — provider failures are sanitized and leave retryable state.
- PASS — retries cannot alter recipients or payloads.
- PASS — notification failures do not roll back committed rental or enquiry operations.
- PASS — listing submission outbox creation remains atomic with the property write.
- PASS — ordinary users cannot inject internal event types or arbitrary recipients.
- PASS — broker notes and private enquiry data are excluded from messages and unrelated users.
- PASS — admin delivery history requires a persisted admin and masks addresses.
- PASS — sender identity remains controlled by `FROM_EMAIL`.
- PASS — reminder suppression covers payment, inactive tenants, termination, renewal, stale terms, duplicates, and obsolete retries.
- PASS — pagination crosses 250 properties and resumes within a property after the 20-delivery limit.

## Commands and actual results

- `npm run typecheck`: **PASS**.
- Consolidated focused command across 11 test files: **106 passed, 0 failed, 1 skipped**.
- Final post-migration subset across 3 directly affected test files: **27 passed, 0 failed, 0 skipped**.
- No Playwright, browser E2E, full suite, production build, live cron invocation, deployment, or real email send was performed.

## Remaining items

- Live provider acceptance, provider delivery status, bounce behavior, and inbox receipt are **BLOCKED** until controlled test UIDs and inboxes are approved.
- The external scheduler is **NOT CONFIGURED** in this repository. It must call the protected endpoint about every five minutes and follow `nextCursor` until null.
- The skipped schema comparison requires the unavailable original Go reference source and does not affect notification assertions.
