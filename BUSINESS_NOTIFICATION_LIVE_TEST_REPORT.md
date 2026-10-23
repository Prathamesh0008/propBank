# PropBank Business Notification Live Test Report

Date: 23 October 2026  
Branch: `feature/property-management-improvements`

## Outcome

**PASS — the approved ten-message batch completed within its exact authorization.** Resend accepted all ten requests and subsequently reported all ten as delivered to the recipient mail servers. Gmail inbox receipt remains awaiting developer confirmation.

- Approved attempts: **10**
- Actual provider send attempts: **10**
- Accepted by Resend: **10**
- Provider-reported delivered: **10**
- Failed, rejected, or bounced: **0**
- Inbox receipt confirmed by developer: **0 of 10; awaiting confirmation**
- `rushikeshandhale1010@gmail.com`: **9 attempts**
- `upasanapatilofficial@gmail.com`: **1 attempt**
- `connectpropbank@gmail.com`: **0 attempts**
- All other addresses: **0 attempts**

## Message results

| No. | Event | Intended role | Recipient | Provider ID | Acceptance | Latest provider status | Inbox receipt |
|---:|---|---|---|---|---|---|---|
| 1 | Registration welcome | Registered user | `rushikeshandhale1010@gmail.com` | `01a16820-af85-7c28-ba06-d07bbd6af425` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 2 | Property submitted | Owner | `rushikeshandhale1010@gmail.com` | `01a16820-b0b8-7d33-9d95-7723a994ceb1` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 3 | Property submitted | Administrator | `upasanapatilofficial@gmail.com` | `01a16820-b1e6-7974-9814-af0b2ebcee87` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 4 | Property approved | Owner | `rushikeshandhale1010@gmail.com` | `01a16820-b3a4-74bd-aa5f-bdb923c94451` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 5 | Tenant assigned | Owner | `rushikeshandhale1010@gmail.com` | `01a16820-b4dc-7dbb-b046-0ed80c85939f` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 6 | Tenant assigned | Tenant | `rushikeshandhale1010@gmail.com` | `01a16820-b605-7d58-946e-18ccdb9e67a0` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 7 | Visit scheduled | Requester | `rushikeshandhale1010@gmail.com` | `01a16820-b727-7146-8284-614bfecf22d8` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 8 | Visit scheduled | Owner | `rushikeshandhale1010@gmail.com` | `01a16820-b8b0-7f3b-91b9-531f0a75b15c` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 9 | Agreement expiry — 30 days | Tenant | `rushikeshandhale1010@gmail.com` | `01a16820-b9ea-716e-abbb-475f1e4a32dd` | HTTP 200, accepted | Delivered | Awaiting confirmation |
| 10 | Agreement expiry — 30 days | Owner | `rushikeshandhale1010@gmail.com` | `01a16820-bb06-798d-bd17-db0fc9bac8fd` | HTTP 200, accepted | Delivered | Awaiting confirmation |

Every subject began with `[PROPBANK TEST — NO ACTION REQUIRED]`. No CC or BCC recipients, fallback sends, or retries were used. Each request had a stable message-and-role idempotency key.

## Template and data verification

The harness invoked the application's production `brandedEmail` renderer. Property submission and approval additionally used the production `propertyNotificationEvents` builder. Messages used only the approved fictional property, rent, visit, agreement, and role data.

The assignment and visit production events use shared body content for their two intended roles. The controlled test added the approved `Owner copy`, `Tenant copy`, and `Requester copy` subject suffixes so repeated deliveries to one test inbox remain distinguishable. The tenant assignment test body also displayed the approved fictional monthly rent. Production recipient rules and global templates were not changed.

## Safety controls and data impact

- Sender `connect@propbank.shop` was checked through the Resend domains API immediately before sending; `propbank.shop` was verified.
- The complete plan was validated before the first request: exact order, ten messages, 9/1 recipient distribution, subject prefix, HTML/plaintext presence, and unique idempotency keys.
- A gitignored local attempt journal was persisted before every provider request: `.notification-live-test-business-20261023.json`.
- The harness refuses to run while that journal exists, preventing accidental replay of this batch.
- No Firebase Authentication or Firestore records were read, created, updated, or deleted.
- No property, tenancy, agreement, visit, notification, or customer record was changed.
- The live reminder scheduler was not invoked. Nothing was deployed or pushed.

This result live-verifies transport for six selected template families only. It does not live-verify all 37 notification events or prove Gmail inbox placement until the developer confirms receipt.
