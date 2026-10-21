# Live email verification — 12 October 2026

Recipient: `rushikeshandhale1010@gmail.com`, explicitly supplied by the user. Secrets were not printed. Resend API key, verified-domain sender and cron secret were configured.

## Scope

Real `sendEmail` source and real Resend HTTPS transport. Reminder tests executed the existing `POST /api/cron/reminders` route handler with its actual bearer-secret check and reminder services against isolated in-memory Firestore/auth fixtures. This is not verification of a deployed HTTP server, real Firestore persistence, external cron scheduling or a full tenant-assignment/renewal transaction. No production customer records were read or modified by the tests. No real Firebase accounts were created.

## Results

| Trigger | Subject | Resend HTTP | Provider event |
|---|---|---|---|
| Direct existing sendEmail helper | PropBank controlled transactional email verification | 200, accepted | delivered |
| Scheduled visit, 15 minutes away, 30-minute reminder | Visit reminder: PropBank controlled test visit | 200, accepted | delivered |
| Current IST due day, supplied test rent 15000 | Monthly rent due | 200, accepted | delivered |
| Controlled agreement end date 90 days away | Agreement expiry reminder | 200, accepted | delivered |
| Controlled agreement end date changed to 60 days away | Agreement expiry reminder | 200, accepted | delivered |

Six sendEmail/provider calls produced five distinct accepted email IDs. The sixth call was an intentional identical-payload/key replay of the visit reminder; Resend returned the original ID.

Provider IDs: direct `01a12f87-bd1f-789d-9850-d453f2ca6d39`; visit `01a12f87-c1f7-7e39-9058-7ef795202674`; rent `01a12f87-c9cc-74ab-b5d9-5d99be84b11b`; expiry 90 `01a12f87-c5e2-7d88-9c91-31351e278318`; expiry 60 `01a12f87-cdbe-70c1-a1ab-58240f976c32`.

## Cron and duplicate prevention

- Missing authorization: HTTP 401, zero provider calls.
- First authorized POST: HTTP 200; one visit and two property reminders sent; zero failures.
- Identical second POST: HTTP 200; zero sent, zero provider calls; previously successful property deliveries skipped and visit delivery excluded.
- 60-day phase POST: HTTP 200; only the new expiry phase sent.
- Repeated 60-day phase POST: HTTP 200; zero sent, zero provider calls.
- Explicit provider replay: HTTP 200 with the same original visit email ID, not a new email ID.

Application deduplication used the fixture's retained transactional reminder state between runs; real deployed Firestore transactions still require staging verification.

## Delivery and limitations

Resend retrieval returned HTTP 200 and `last_event: delivered` for all five distinct IDs. This verifies the provider's reported delivery to the recipient server. Inbox/spam folder placement and the user's actual receipt were not observable; the recipient should check both folders.

No application business-logic bug was found. Earlier sender-domain rejection was resolved by the user's environment correction. A manual, opt-in harness was added at `scripts/verify-live-email.cjs`; it requires a controlled recipient and `--send-live`, confines real transport to Resend and that recipient, and throttles calls. Its isolated dependency loader exists only in tests/scripts and is not imported by production routes. Sanitized results are in `backend-audit/live-email-verification.log`.

Do not rerun the whole harness merely to poll delivery: each new execution creates a fresh test run and intentionally sends new emails. No commit or push was performed; branch remains `feature/property-management-improvements`.
