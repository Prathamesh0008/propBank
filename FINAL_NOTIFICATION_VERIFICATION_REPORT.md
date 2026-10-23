# PropBank Final Notification Verification Report

Date: 23 October 2026  
Branch: `feature/property-management-improvements`

## Final result

All **37 notification event families** pass isolated functional checks and now have controlled Resend transport evidence. This verifies event logic in isolated fixtures and delivery of synthetic, branded test messages to the recipient mail servers. Event-specific Gmail inbox receipt remains pending developer confirmation.

| Measure | Result |
|---|---:|
| Notification event families inventoried | 37 |
| Event families passing isolated tests | 37 |
| Event families covered by controlled live email | 37 |
| Event-specific provider send attempts | 75 |
| Event-specific provider accepted | 75 |
| Event-specific provider reported delivered | 75 |
| Generic pilot attempts / delivered | 2 / 2 |
| Total provider attempts / accepted / delivered | 77 / 77 / 77 |
| Provider failures, bounces, or ambiguous attempts | 0 |
| Inbox-confirmed messages | 2 generic pilot messages |
| Event-specific inbox confirmations | 0; awaiting developer confirmation |
| Focused website-notification checks | 15 passed, 0 failed |

## Controlled final batch

The approved final batch covered the 31 event families that were not included in the earlier ten-message business batch.

- Authorized attempts: **65**
- Actual attempts: **65**
- `rushikeshandhale1010@gmail.com`: **57**
- `upasanapatilofficial@gmail.com`: **8**
- All other recipients: **0**
- Resend accepted: **65**
- Resend reported delivered: **65**
- Rejected, bounced, failed, or ambiguous: **0**
- Automatic retries or fallback sends: **0**

Every subject used `[PROPBANK TEST — NO ACTION REQUIRED]`. Each request used a stable event-and-role idempotency key. A gitignored journal was written before every provider request and prevents this batch from being replayed. The sender domain `propbank.shop` was verified through a read-only Resend provider check immediately before execution.

The controlled harness used the production PropBank branded HTML/plaintext renderer with synthetic event-specific content. It redirected simulated roles only at the final test transport boundary. It did not invoke production business operations. Isolated tests remain the evidence for persisted relationship-based recipient selection, authorization, duplicate prevention, suppression, and website records.

## Website notifications

Focused isolated checks covered:

- Admin notification inbox visibility and access restrictions.
- Property review reasons, stale-decision protection, approval, and change-request records.
- General and property enquiries.
- Agent assignment, reassignment, unassignment, private history, and status updates.
- Visit creation, updates, cancellation, administrator visibility, and stale updates.
- Negotiation notifications and unrelated-user exclusion.
- Agreement renewal, rejection, termination, and retained history.
- Maintenance/service request creation and resolution history.
- Notification archive/unarchive and read/unread state.

Result: **15 passed, 0 failed**. One legacy test initially failed because its isolated environment omitted `ADMIN_EMAIL` after the hard-coded fallback had been intentionally removed. The fixture was corrected to use `admin@test.invalid`; the focused rerun passed. No application behavior was weakened.

## Safety and production impact

- No Firebase Authentication account was changed.
- No production Firestore property, tenancy, agreement, visit, enquiry, negotiation, maintenance, or customer record was created, updated, or deleted.
- No customer or configured production administrator address received a test email.
- `connectpropbank@gmail.com` remained excluded.
- No production scheduler endpoint was invoked.
- No deployment or Git push was performed.

## Remaining work

1. The developer must confirm receipt of the 75 event-specific messages in the two approved Gmail inboxes. Provider delivery alone does not prove inbox placement.
2. The external reminder scheduler is **NOT CONFIGURED by this repository work**. Configure the deployment scheduler to call the protected reminder endpoint approximately every five minutes for visit reminders and continue following `nextCursor` until it is null. Property reminders remain calendar-date based and idempotent.
3. Before production release, verify deployment environment variables, deployed Firestore indexes/rules, Resend webhook or provider monitoring, and scheduler authorization in the intended hosting environment.
4. Controlled synthetic delivery does not replace a staged workflow acceptance test with isolated real test accounts. No production customer workflow was mutated for this verification.

No notification event is currently marked missing in the 37-event inventory. Automated scheduling remains a deployment requirement rather than a completed live integration.
