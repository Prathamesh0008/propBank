+# Visit Planner Notification Upgrade Report

Date: 2026-10-23  
Branch: `feature/property-management-improvements`

## Status

- **PASS — implementation and isolated verification**
- **PASS — controlled seven-message batch accepted and provider-reported delivered**
- **BLOCKED — unattended live reminders until an external scheduler is configured**

No production Firebase records, customer records, live visits, bucket settings, deployment resources, or scheduler endpoints were changed or invoked.

## Implemented

- Added an optional searchable selector backed by the existing public-property API. Options show property name, location and type without owner contact information.
- General visits remain valid when no property is selected.
- The server validates selected properties and accepts only active, approved/public, visit-eligible listings. It resolves the owner from the persisted property record.
- Removed the reminder dropdown. New visits are forced server-side to email reminders at 30 minutes; client values cannot override this.
- Added the required 30-minute helper text.
- Added role-specific immediate transactional outbox events:
  - General visit: requester + configured administrator.
  - Linked visit: requester + configured administrator + verified/active persisted owner.
  - Same-account/address overlap is deduplicated.
- Reschedule and cancellation events use the preserved requester, current property relationship and incremented management version.
- Visit reminders now use `email_deliveries` for requester and administrator, with frozen retry content, stable recipient-specific keys, leases and delivery history. Owners are excluded from reminder mail.
- Rescheduling changes the reminder generation, making the old reminder obsolete. Cancelled/completed/past visits remain ineligible.
- The due window opens 30 minutes before the appointment and lasts until the appointment. With the required five-minute scheduler cadence, the first run in that window sends the reminder without creating duplicates.
- Transactional retry processing now recognizes an already-sent duplicate as sent while preserving failed retry state.

## Files modified for this upgrade

- `src/features/visit-planner/VisitPlanner.tsx`
- `src/features/visit-planner/VisitPlanner.module.css`
- `src/lib/server/services/visits.ts`
- `src/lib/server/services/reminders.ts`
- `src/lib/server/services/transactional-email.ts`
- `tests/fixtures/native-server.cjs`
- `tests/visit-planner-repair.test.cjs`
- `tests/negotiations-reminders.test.cjs`
- `scripts/run-visit-notification-live-test.cjs`
- `VISIT_PLANNER_NOTIFICATION_UPGRADE_REPORT.md`

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| Visit/reminder/rent/agreement focused run | **PASS — 28 passed, 0 failed, 0 skipped** |
| Broader focused email/visit/reminder run | **PASS — 36 passed, 0 failed, 0 skipped** |
| `git diff --check` | **PASS** (line-ending notices only; no whitespace errors) |
| Playwright/browser E2E | **NOT RUN** per restriction |
| Production data/live scheduler | **NOT USED** |

The isolated checks cover general and linked scheduling, rejected property IDs, forced reminder configuration, requester/admin/owner selection, overlap deduplication, exact API contracts, version conflicts, requester preservation, role isolation, reminder timing and recipient selection, retry payload freezing, cancellation/completion suppression, rent/agreement reminder regression, and scheduler concurrency.

## Admin and website integration

The existing admin Visits view receives general and property-linked records. General visits carry no property association; linked visits retain the validated property reference. Requester identity remains unchanged during admin updates. Existing status filters and Active/Visited/Cancelled counts use the persisted status values.

## Live sender and scheduler

A read-only Resend domain lookup completed successfully:

- Sender: `connect@propbank.shop`
- Domain: `propbank.shop`
- Provider status: **verified**
- Configured sender match: **PASS**

No local deployment scheduler configuration exists. Deployment must call `/api/cron/reminders` every five minutes with `Authorization: Bearer <CRON_SECRET>`. Property-reminder continuation must follow `properties.nextCursor`; visit reminders are lease/idempotency protected.

## Controlled live test results

The developer explicitly approved exactly seven attempts. All data was synthetic; the transport enforced the two-address allowlist; no Firebase records were created or changed; no scheduler was invoked; and automatic retries/fallback recipients were disabled.

| Message | Purpose | Role | Destination | Provider ID | Provider result | Inbox receipt |
|---:|---|---|---|---|---|---|
| 1 | General visit confirmation | Requester | rushikeshandhale1010@gmail.com | `01a16878-c22d-7819-a466-c515f4b4c3ba` | Delivered | Pending confirmation |
| 2 | General visit confirmation | Administrator | upasanapatilofficial@gmail.com | `01a16878-c408-7769-9687-ae76032a528c` | Delivered | Pending confirmation |
| 3 | Linked visit confirmation | Requester | rushikeshandhale1010@gmail.com | `01a16878-c572-7840-a95a-5975f856f6f0` | Delivered | Pending confirmation |
| 4 | Linked visit confirmation | Administrator | upasanapatilofficial@gmail.com | `01a16878-c6f8-7e3c-a9d4-29b451d528e8` | Delivered | Pending confirmation |
| 5 | Linked visit confirmation | Synthetic owner | rushikeshandhale1010@gmail.com | `01a16878-c873-7758-b408-c547ed93413e` | Delivered | Pending confirmation |
| 6 | 30-minute reminder | Requester | rushikeshandhale1010@gmail.com | `01a16878-ca04-702e-9987-302db664714a` | Delivered | Pending confirmation |
| 7 | 30-minute reminder | Administrator | upasanapatilofficial@gmail.com | `01a16878-cb7c-739d-82f6-53fb52aef6cb` | Delivered | Pending confirmation |

Distribution: **4** messages to `rushikeshandhale1010@gmail.com`, **3** to `upasanapatilofficial@gmail.com`, and **7 provider attempts total**. Resend accepted all seven and subsequently reported all seven as delivered. All other addresses, including `connectpropbank@gmail.com`, CC and BCC were excluded.

Gmail inbox receipt remains pending and cannot be marked confirmed until the developer reports what arrived.

