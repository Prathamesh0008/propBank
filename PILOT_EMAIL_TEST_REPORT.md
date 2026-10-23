# PropBank Pilot Email Test Report

Date: 23 October 2026  
Branch: `feature/property-management-improvements`

## Scope

The developer authorized exactly two email attempts: one to each approved inbox. No retries, fallback recipients, CC, BCC, Firebase changes, scheduler calls, deployment, or additional sends were permitted or performed.

## Preflight

- `RESEND_API_KEY`: present.
- Sender: `connect@propbank.shop`.
- Resend domain `propbank.shop`: verified.
- Exact allowlist: `rushikeshandhale1010@gmail.com`, `upasanapatilofficial@gmail.com`.
- Outbound message count: 2.
- Required subject prefix: present on both messages.
- Other recipients configured for this test: none.
- `connectpropbank@gmail.com`: excluded.

## Attempts

| Attempt | Recipient | Subject | Provider ID | Provider acceptance | Latest provider status | Inbox receipt |
|---:|---|---|---|---|---|---|
| 1 | `rushikeshandhale1010@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] User notification pilot` | `01a16818-6e7a-7ec3-9874-851d32c168f6` | Accepted, HTTP 200 | **delivered** | Awaiting user confirmation |
| 2 | `upasanapatilofficial@gmail.com` | `[PROPBANK TEST — NO ACTION REQUIRED] Administrator notification pilot` | `01a16818-7027-7b5d-8c45-71067109355f` | Accepted, HTTP 200 | **delivered** | Awaiting user confirmation |

## Totals

- Authorized maximum attempts: 2.
- Actual send attempts: **2**.
- Provider accepted: **2**.
- Provider rejected: **0**.
- Provider currently reports delivered: **2**.
- Bounced: **0 reported**.
- Inbox receipt confirmed by recipient: **0 pending confirmation**.

The messages contained only a harmless controlled-test notice and no customer information. This pilot does not authorize or initiate the 75-message notification plan.
