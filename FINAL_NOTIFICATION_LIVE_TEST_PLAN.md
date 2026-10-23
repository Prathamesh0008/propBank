# PropBank Final Notification Live Test Plan

Date: 23 October 2026  
Branch: `feature/property-management-improvements`

## Approval status

**AWAITING EXPLICIT APPROVAL — NO NEW EMAIL SENT.** Previous authorizations for the two-message pilot and ten-message business batch are exhausted.

## Reconciliation

All 37 events passed isolated tests. Six event families already have real provider delivery evidence and will not be repeated: account registration, owner property submission, property approval, tenant assignment, visit scheduled, and agreement expiry at 30 days.

The older 75-message plan contained a totals error. Adding its row-level destinations produces 66 normal-inbox messages and 9 administrator-inbox messages, not 63 and 12. Removing the 9 normal and 1 administrator messages already sent for the six business families leaves the exact final batch below:

- Remaining event families: **31**
- `rushikeshandhale1010@gmail.com`: **57 attempts**
- `upasanapatilofficial@gmail.com`: **8 attempts**
- Total: **65 attempts**
- All other recipients, including `connectpropbank@gmail.com`: **0**

## Exact remaining batch

`N` means `rushikeshandhale1010@gmail.com`; `A` means `upasanapatilofficial@gmail.com`.

| Event No. | Remaining event | Intended role → controlled inbox | N | A | Total |
|---:|---|---|---:|---:|---:|
| 2 | Verified phone changed | Account user → N; administrator → A | 1 | 1 | 2 |
| 4 | Admin-created property | Selected owner → N; administrator → A | 1 | 1 | 2 |
| 6 | Property rejected | Property owner → N | 1 | 0 | 1 |
| 7 | Property changes requested | Property owner → N | 1 | 0 | 1 |
| 9 | Tenant replaced | Property owner, replacement tenant, removed tenant → N | 3 | 0 | 3 |
| 10 | Tenant removed | Property owner, removed tenant → N | 2 | 0 | 2 |
| 11 | Rental terms changed | Property owner, active tenant → N | 2 | 0 | 2 |
| 12 | Rent marked paid | Property owner, active tenant → N | 2 | 0 | 2 |
| 13 | Rent due in 7 days | Property owner, active tenant → N | 2 | 0 | 2 |
| 14 | Rent due in 1 day | Property owner, active tenant → N | 2 | 0 | 2 |
| 15 | Rent due today | Property owner, active tenant → N | 2 | 0 | 2 |
| 16 | Agreement renewal requested | Property owner, active tenant → N | 2 | 0 | 2 |
| 17 | Agreement renewal approved | Property owner, active tenant → N | 2 | 0 | 2 |
| 18 | Agreement renewal rejected | Property owner, active tenant → N | 2 | 0 | 2 |
| 19 | Agreement termination requested | Property owner, active tenant → N | 2 | 0 | 2 |
| 20 | Agreement terminated/rejected/notice served | Property owner, affected active tenant → N | 2 | 0 | 2 |
| 22 | Agreement expiry in 15 days | Property owner, active tenant → N | 2 | 0 | 2 |
| 23 | Agreement expiry in 7 days | Property owner, active tenant → N | 2 | 0 | 2 |
| 24 | New enquiry | Administrator → A | 0 | 1 | 1 |
| 25 | Enquiry assigned/reassigned/unassigned | New agent, previous agent → N; administrator → A | 2 | 1 | 3 |
| 26 | Enquiry status updated | Assigned agent → N; administrator → A | 1 | 1 | 2 |
| 28 | Visit rescheduled/updated | Requester, property owner → N | 2 | 0 | 2 |
| 29 | Visit cancelled | Requester, property owner → N | 2 | 0 | 2 |
| 30 | Negotiation offer submitted | Property owner, customer, assigned broker → N | 3 | 0 | 3 |
| 31 | Negotiation counteroffer/proposal | Property owner, customer, assigned broker → N | 3 | 0 | 3 |
| 32 | Negotiation accepted/rejected/completed | Property owner, customer, assigned broker → N | 3 | 0 | 3 |
| 33 | Maintenance request created | Requester, property owner → N; administrator → A | 2 | 1 | 3 |
| 34 | Maintenance updated/resolved | Requester, property owner → N; acting administrator → A | 2 | 1 | 3 |
| 35 | Owner verification approved/rejected/reconsidered | Submitting tenant, verified owner → N; acting administrator → A | 2 | 1 | 3 |
| 36 | Visit reminder | Visit requester → N | 1 | 0 | 1 |
| 37 | Admin response to request | Original requester → N | 1 | 0 | 1 |
|  | **Totals** |  | **57** | **8** | **65** |

## Channels and safe representation

Every remaining row has an email channel. These events also create or update website-visible operational records:

- Verified phone changes: admin security notification.
- Agreement requests and decisions: admin/property agreement records.
- Enquiries and agent tracking: admin inbox and private broker assignment history.
- Visits: admin visit notification.
- Negotiations: admin negotiation notification.
- Maintenance creation: admin service notification.

Website read/unread state is tested through isolated fixtures and does not require a live email or production record. All email families can be rendered safely from synthetic data. Multiple simulated non-admin roles must share N, so real delivery proves template transport; isolated tests remain authoritative for distinct role selection and access control.

## Preflight completed

- `RESEND_API_KEY`: configured; value not displayed.
- Sender: `connect@propbank.shop`.
- Read-only Resend domain check: `propbank.shop` is **verified**.
- Required subject prefix: `[PROPBANK TEST — NO ACTION REQUIRED]`.
- Data source: fictional in-memory users, properties, tenancies, agreements, visits, enquiries, negotiations, maintenance requests, and verification requests.
- Firebase/Firestore production mutations: none planned.
- Production reminder scheduler: will not be invoked.

## Execution controls after approval

The one-shot harness will validate the full 65-message plan before sending, enforce the exact 57/8 limits, reject CC/BCC or any other address, use the production branded renderer, assign stable per-event-role idempotency keys, and persist a new gitignored journal before every request. Sends will be sequential with no retries or fallback. A failure or ambiguous response stops the batch immediately and consumes that attempt.

After the batch, only read-only Resend status checks will run. Inbox receipt will remain pending until the developer confirms it. No event already live-tested will be resent.
