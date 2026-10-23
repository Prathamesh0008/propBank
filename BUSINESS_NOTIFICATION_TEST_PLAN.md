# PropBank Business Notification Email Test Plan

Date: 23 October 2026  
Branch: `feature/property-management-improvements`

## Approval status

**PLANNING COMPLETE — NO EMAIL SENT.** This plan requires separate explicit approval. It does not reuse authorization from the two-message pilot or the earlier 75-message proposal.

## Verified sender and allowlist

- Sender: `connect@propbank.shop`
- Resend domain: `propbank.shop`
- Latest read-only provider status: **verified**
- Approved test inboxes from the completed pilot:
  - `rushikeshandhale1010@gmail.com`
  - `upasanapatilofficial@gmail.com`
- Explicitly excluded: `connectpropbank@gmail.com` and every other address
- Required subject prefix: `[PROPBANK TEST — NO ACTION REQUIRED]`

The execution harness must compare its complete destination set with these two addresses before the first send. It must have no retry loop, fallback recipient, CC, or BCC. Every provider request counts as an attempt.

## Fictional test data

All six event families will be rendered from in-memory fictional data:

- Property: `Aster Court Test Residence`
- Property reference: `PB-TEST-BUSINESS-20261023`
- Location: `Fictional Test District`
- Monthly rent: `₹32,500`
- Visit: `15 November 2026 at 11:00 AM IST`
- Agreement expiry: `30 November 2026`
- Test user labels: `Test Account`, `Test Owner`, `Test Tenant`, `Test Visitor`, `Test Administrator`

These values do not identify a customer or real property. No Firebase, Firestore, scheduler, property, tenancy, visit, agreement, or notification record will be created or changed.

## Recipient conditions verified from source

1. **Registration welcome:** generated only after a new authenticated profile is persisted; recipient is that registered active user.
2. **Property submission:** a pending-review submission generates one owner delivery and one configured-admin delivery. Approval is not implied.
3. **Property approval:** an administrator moderation decision generates one delivery to the property owner using the resulting approved status.
4. **Tenant assignment:** after a valid assignment persists, the property owner and newly assigned registered tenant receive separate deliveries.
5. **Visit scheduled:** after a visit persists against an authorized property, the requester and property owner receive separate deliveries.
6. **Agreement expiry:** for an active tenancy and current agreement date, the selected reminder offset generates separate owner and tenant deliveries. The plan uses the 30-day variant and does not invoke the cron endpoint.

The production recipient rules will be represented in the content and idempotency metadata, while a final transport allowlist redirects only the synthetic role deliveries described below.

## Proposed messages

| Message | Event | Intended role | Actual test inbox | Proposed subject | Purpose |
|---:|---|---|---|---|---|
| 1 | Registration welcome | Registered user | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Welcome to PropBank` | Verify the real branded welcome template and authenticated-account link presentation. |
| 2 | Owner property submission | Property owner | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Property submitted - Pending Review` | Verify the owner sees fictional property reference and pending-review status. |
| 3 | Owner property submission | Administrator | `upasanapatilofficial@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] PropBank – New Property Submitted for Review` | Verify administrator review content without routing to configured `ADMIN_EMAIL`. |
| 4 | Property approval | Property owner | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Property approved` | Verify the approved-status moderation template for the fictional listing. |
| 5 | Tenant assignment | Property owner | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Tenant assignment confirmed — Owner copy` | Verify the owner-role version of the existing assignment content. |
| 6 | Tenant assignment | Assigned tenant | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Tenant assignment confirmed — Tenant copy` | Verify the tenant-role delivery using a distinct idempotency key. |
| 7 | Site visit scheduled | Visit requester | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Property visit updated — Requester copy` | Verify scheduled date/property content for the requester role. |
| 8 | Site visit scheduled | Property owner | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Property visit updated — Owner copy` | Verify the owner role receives the same persisted visit event independently. |
| 9 | Agreement expiry in 30 days | Active tenant | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Rental agreement expires in 30 days — Tenant copy` | Verify the real expiry reminder template and next-step link. |
| 10 | Agreement expiry in 30 days | Property owner | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Rental agreement expires in 30 days — Owner copy` | Verify the owner-role reminder with a distinct idempotency key. |

## Exact proposed volume

- Total outbound attempts authorized by this proposed run: **10**
- To `rushikeshandhale1010@gmail.com`: **9**
- To `upasanapatilofficial@gmail.com`: **1**
- To `connectpropbank@gmail.com`: **0**
- To all other addresses: **0**

## Representation limitation

The two approved inboxes can safely verify all six template families, including separate role-labeled owner/tenant/requester copies. They cannot prove delivery to six distinct real identities because owner, tenant, requester, and registered-user roles share the normal-user inbox. Role selection and isolation are already covered by focused isolated tests; this controlled run verifies the actual rendered business templates and Resend transport.

No selected event is blocked from safe template testing. The administrator submission copy must be explicitly redirected to the approved administrator inbox rather than the configured `ADMIN_EMAIL` value.

## Execution controls after approval

1. Recheck sender verification and exact allowlist before sending.
2. Build the existing application templates from the fictional data only.
3. Assert every subject starts with the required prefix.
4. Assign a unique fixed idempotency key to each event-role pair.
5. Send sequentially. If an attempt fails or is ambiguous, stop immediately; do not retry.
6. Cap the process at ten provider POST requests.
7. Perform only read-only provider status lookups afterward.
8. Report provider acceptance, message ID, delivery/bounce/pending state, and inbox confirmation separately.

## Approval checkpoint

Explicit approval must authorize exactly these **10 messages** to the two listed inboxes. No part of the 75-message plan is included or authorized by approving this plan.
