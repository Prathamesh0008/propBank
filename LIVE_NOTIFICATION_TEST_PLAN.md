# PropBank Controlled Live Notification Test Plan

Date: 23 October 2026  
Branch: `feature/property-management-improvements`

## Approval status

**STOPPED BEFORE SEND.** No email was sent and no Firebase or Firestore record was modified.

The proposed inboxes below are **not yet approved**. The developer must confirm ownership/control and explicitly approve the exact 75-message plan before execution.

## Read-only account verification

| Purpose | UID | Firebase Auth | Firestore profile | Role | Active | Email verified | Proposed inbox | Inbox approved? |
|---|---|---|---|---|---|---|---|---|
| Normal test user | `9W0oKZe70fWJkkqjyi8VVNdYKoA3` | Found | Found | `individual` | Yes | Yes | `rushikeshandhale1010@gmail.com` | **UNCONFIRMED** |
| Administrator | `ZhwS4DVHBZPW947R7r1LzG1kGOI3` | Found | Found | `admin` | Yes | Yes | `upasanapatilofficial@gmail.com` | **UNCONFIRMED** |

The Auth and profile email values match for both identities. The normal identity uses Google; the administrator uses password authentication. Neither Auth account is disabled. No account field was changed.

## Environment verification

- Firebase Authentication project: **`propbank-7601b`** — matches the requested project.
- Firestore project: **`propbank-944fc`** — matches the requested project.
- `RESEND_API_KEY`: **configured**; value not displayed.
- `FROM_EMAIL`: **configured** as `connect@propbank.shop`.
- `ADMIN_EMAIL`: **configured** as `connectpropbank@gmail.com`.
- `APP_URL`: **configured**; value not displayed.
- Resend sender/domain authorization: **NOT VERIFIED**. Verifying it would require a provider API request or console access, which was not performed during this read-only local configuration check.
- `connectpropbank@gmail.com` is an application recipient but is **not approved** by the information supplied in this task. The harness must not send to it unless it is separately approved.

## Safe test method

The live phase will use a non-destructive harness around the existing PropBank templates and Resend transport:

1. Construct synthetic notification payloads in memory with unmistakable fixture IDs. Do not create properties, tenancies, negotiations, visits, enquiries, or delivery records in production Firestore.
2. Exercise the production template-building and Resend transport code, but apply a strict destination allowlist immediately before transport.
3. Map all simulated non-admin roles to the approved normal-user inbox and the administrator role to the approved administrator inbox. This tests rendered content and delivery while isolated tests remain authoritative for real UID/relationship selection.
4. Reject the run if any resolved destination is outside the approved allowlist.
5. Prefix every subject exactly with `[PROPBANK TEST — NO ACTION REQUIRED]`.
6. Use a unique test-run ID and per-event/role idempotency key so a retry cannot create an unintended duplicate.
7. Do not invoke `/api/cron/reminders`; generate reminder payloads with a controlled clock in the harness.
8. Record separately: test message created, Resend accepted, provider delivered/bounced, and recipient-confirmed inbox receipt.

Two accounts cannot reproduce distinct persisted owner, tenant, customer, and broker relationships at the same time without production mutations. The harness therefore multiplexes those simulated roles to the normal approved inbox. This live phase verifies real transport and rendered content. The focused isolated tests remain the evidence for role selection, authorization, and unrelated-user exclusion.

## Proposed messages

Destinations use these abbreviations:

- **N:** `rushikeshandhale1010@gmail.com` for simulated user, owner, tenant, customer, broker, former-tenant, and requester roles.
- **A:** `upasanapatilofficial@gmail.com` for the simulated administrator role.

| No. | Notification event | Intended role deliveries | Proposed destination | Count | Method |
|---:|---|---|---|---:|---|
| 1 | Account registration | User | N | 1 | Synthetic registration event through branded template/outbox transport |
| 2 | Verified phone changed | User, admin | N, A | 2 | Synthetic security event; no phone change |
| 3 | Owner property submitted | Owner, admin | N, A | 2 | Synthetic pending-review property |
| 4 | Admin-created property | Selected owner, admin | N, A | 2 | Synthetic admin-created listing |
| 5 | Property approved | Owner | N | 1 | Synthetic moderation decision |
| 6 | Property rejected | Owner | N | 1 | Synthetic rejection with test reason |
| 7 | Property changes requested | Owner | N | 1 | Synthetic change request with test reason |
| 8 | Tenant assigned | Owner, tenant | N twice | 2 | Synthetic relationship event, distinct role keys |
| 9 | Tenant replaced | Owner, new tenant, removed tenant | N three times | 3 | Synthetic replacement event, distinct role keys |
| 10 | Tenant removed | Owner, removed tenant | N twice | 2 | Synthetic removal event |
| 11 | Rental terms changed | Owner, active tenant | N twice | 2 | Synthetic terms event |
| 12 | Rent marked paid | Owner, active tenant | N twice | 2 | Synthetic paid-period event |
| 13 | Rent due in 7 days | Owner, active tenant | N twice | 2 | Controlled-clock reminder payload |
| 14 | Rent due in 1 day | Owner, active tenant | N twice | 2 | Controlled-clock reminder payload |
| 15 | Rent due today | Owner, active tenant | N twice | 2 | Controlled-clock reminder payload |
| 16 | Agreement renewal requested | Owner, tenant | N twice | 2 | Synthetic agreement activity |
| 17 | Agreement renewal approved | Owner, tenant | N twice | 2 | Synthetic agreement activity |
| 18 | Agreement renewal rejected | Owner, tenant | N twice | 2 | Synthetic agreement activity |
| 19 | Agreement termination requested | Owner, tenant | N twice | 2 | Synthetic agreement activity |
| 20 | Agreement terminated/rejected/notice served | Owner, affected tenant | N twice | 2 | Synthetic termination activity |
| 21 | Agreement expiry in 30 days | Owner, active tenant | N twice | 2 | Controlled-clock reminder payload |
| 22 | Agreement expiry in 15 days | Owner, active tenant | N twice | 2 | Controlled-clock reminder payload |
| 23 | Agreement expiry in 7 days | Owner, active tenant | N twice | 2 | Controlled-clock reminder payload |
| 24 | New enquiry | Admin | A | 1 | Synthetic general enquiry; no customer record |
| 25 | Enquiry reassigned | New agent, previous agent, admin | N twice, A | 3 | Synthetic private tracking summary without contacts/notes |
| 26 | Enquiry status updated | Assigned agent, admin | N, A | 2 | Synthetic tracking summary |
| 27 | Visit scheduled | Requester, owner | N twice | 2 | Synthetic visit event |
| 28 | Visit rescheduled | Requester, owner | N twice | 2 | Synthetic visit event |
| 29 | Visit cancelled | Requester, owner | N twice | 2 | Synthetic visit event |
| 30 | Negotiation offer submitted | Owner, customer, broker | N three times | 3 | Synthetic negotiation event |
| 31 | Negotiation counteroffer | Owner, customer, broker | N three times | 3 | Synthetic negotiation event |
| 32 | Negotiation accepted/rejected | Owner, customer, broker | N three times | 3 | Synthetic negotiation event |
| 33 | Maintenance request created | Requester, owner, admin | N twice, A | 3 | Synthetic maintenance event |
| 34 | Maintenance request resolved | Requester, owner, admin | N twice, A | 3 | Synthetic maintenance event |
| 35 | Owner verification completed | Submitting tenant, verified owner, admin | N twice, A | 3 | Synthetic verification event |
| 36 | Visit reminder | Requester | N | 1 | Controlled-clock visit reminder payload; cron not invoked |
| 37 | Admin response to request | Original requester | N | 1 | Synthetic response event |

**Total proposed messages: 75**  
**Messages to N: 63**  
**Messages to A: 12**

Repeated sends to the same inbox represent distinct intended roles and will include the simulated role and event number in the test-only subject suffix/body so the recipient can distinguish them.

## Data and customer safeguards

- No existing customer property, tenancy, enquiry, visit, negotiation, agreement, rent ledger, owner-verification, or notification record will be used or changed.
- No Firebase account will be created, disabled, verified, or assigned a role.
- No Firestore fixture will be written for the transport test.
- No production scheduler or reminder endpoint will be invoked.
- No email will be addressed to `ADMIN_EMAIL` or any profile-derived address unless that exact address appears in the final approved allowlist.
- The harness will stop before the first send if sender configuration, subject prefix, run ID, or allowlist validation fails.

## Missing requirements and approval checkpoint

Before execution, the developer must provide all of the following:

1. Confirm that `rushikeshandhale1010@gmail.com` is controlled and approved for **63** test messages.
2. Confirm that `upasanapatilofficial@gmail.com` is controlled and approved for **12** test messages.
3. Explicitly approve the total **75-message** send covering events 1–37 above.
4. Confirm whether `connectpropbank@gmail.com` should remain excluded. It is excluded by this plan.
5. Approve use of `connect@propbank.shop` as the sender after confirming that domain/sender is verified in Resend, or authorize a read-only Resend provider check first.

Until all five items are answered, controlled live notification testing remains **BLOCKED**.
