# Structured addresses - Phase 5: Newly generated output

Local work on feature/homepage-redesign. Phases 1-4, homepage design and all other uncommitted work are preserved. No production application records, files, credentials, schedules or provider settings were accessed or changed.

## Exact files changed

- src/lib/email-design.ts
- src/lib/server/services/agreements.ts
- src/lib/server/services/admin-lifecycle.ts
- src/lib/server/services/group2-mail.ts
- src/lib/server/services/notifications.ts
- src/lib/server/services/property-activity.ts
- src/lib/server/services/property-effects.ts
- src/lib/server/services/relationship-links.ts
- src/lib/server/services/tenants.ts
- src/lib/server/services/canonical-reminders.ts
- src/lib/server/services/transactional-email.ts (format-version type only)
- scripts/preview-transactional-emails.cjs (pure Zod loader compatibility)
- tests/server-foundation.test.cjs (pure helper loader compatibility)
- tests/property-address-outputs.test.cjs
- docs/STRUCTURED_ADDRESS_PHASE5.md

## Address usage inventory

| Output/workflow | Existing address requirement | Phase 5 change |
|---|---|---|
| AgreementWorkflow renewal/termination screen | Property title, terms, dates, schedule and inventory; no physical address currently rendered | No address or legal content introduced |
| Agreement renewal and termination participant notices | Property address in body and shared email summary | formatPropertyAddress in existing body/context; lifecycle, signatures, terms and IDs unchanged |
| Detailed administrative agreement notices | Property address in existing summary | Same canonical formatter; recipient/action rules unchanged |
| Agreement PDFs / document generation | No current PDF generation library/implementation found in src; signed agreements are uploaded files | No new generator, fabricated PDF or file rewrite |
| Inspection possession/handover template downloads | Existing Download Template buttons have no download handler | Existing gap reported only; no unrelated implementation |
| Document/report metadata and downloads | Existing bound file/name/type/date metadata; no generated property-address field | No address fields added; upload/download/security behavior unchanged |
| Document, inspection, TDS, legal/other service activity notices | Existing property address in activity body/admin summary/email | Shared canonical formatter at the existing producer boundary |
| Service request and status notices | Existing property activity/email context | Shared canonical formatter; no extra lookups, personal address or recipient changes |
| Property create/update / admin lifecycle notices | Existing propertyAddress snapshot and body/context | Canonical formatting for newly created snapshots and messages |
| Property enquiries | Existing trusted propertyAddress snapshot supplied by server | Derive snapshot from authoritative property fields; never fall back to requester personal address |
| General Quick Inquiry / account and security emails | No physical property address requirement | No address added |
| Tenant assignment | Existing shared property email context | Use the already-read authoritative transaction snapshot, retaining all canonical components instead of a legacy model projection |
| Confirmed relationship notice | Existing property address in confirmation message | Shared canonical formatter; confirmation/eligibility unchanged |
| Tenant invitation | Existing identity/connection instructions | No new address added to invitation templates |
| Current rent/expiry reminder emails and in-app notices | Existing shared property address summary | New reminders use canonical formatting; timing, period/balance calculation, roles and keys unchanged |
| Older property reminder path | Existing shared email summary | Newly generated summary uses canonical formatter; no timing/worker changes |
| Visit scheduled/rescheduled/cancelled emails | Existing property email context when property-bound | Correct formatting through shared email context |
| Personal/general visit or legacy confirmation/reminder without a property-address field | No address currently required | No address or new property lookup introduced |
| Admin delivery/notification history | Already-rendered content / historical strings | No rewrite of historical or already-staged content |
| Other exports | No current address-bearing CSV/print/PDF generator found in src/scripts audit | None invented |

## Shared formatting and privacy

propertyEmailContext now calls formatPropertyAddress for new output. It passes only the already-authorized property snapshot to the formatter. All eight canonical components are retained where recorded, with exact-component deduplication. Opaque legacy full lines do not get an extra city/state/PIN appended. Partial, international, missing and invalid-placeholder values follow the Phase 4 read policy; no component is guessed.

Explicit producer strings and legacy positional helper inputs use the same formatter. Positional slots, headings, body/legal statements, dates, currencies, signatures, IDs and links remain otherwise unchanged. Legacy helper functions with no current callers are not activated or given new events.

Property addresses stay separate from previousAddress/currentAddress and their structured personal variants. These are not inspected by the formatter, used as fallbacks, added to email rows or copied into document metadata. Existing recipient eligibility, role scoping, private-file bindings, public visibility and authorization checks are unchanged. HTML continues through the existing escaping/branding renderer.

The enquiry producer uses the authoritative property address rather than an arbitrary client-supplied address when a property is resolved. No client role or error label controls formatting or authorization.

## Historical content and queued-reminder compatibility

No file or stored record is migrated. Previously rendered delivery HTML/text and uploaded document metadata are left intact. Existing delivery IDs and notification idempotency keys are unchanged, so duplicate staging does not overwrite prior records or resend delivered mail.

Canonical reminders already revalidate business eligibility/content immediately before delivery. Changing their shared address renderer globally without compatibility handling could alter queued HTML and trigger first-attempt reconciliation safeguards. For that reason:

- New canonical deliveries carry propertyAddressFormatVersion: 1.
- Existing deliveries without that marker retain their original address presentation during the existing refresh operation.
- propertyEmailContext has an internal legacy-format option used only for this output compatibility path.
- Recipient, rent amount/balance, dates, timezone, catch-up, cancellation, leasing, retry/backoff, provider idempotency, pagination and scheduling algorithms are unchanged.
- No existing delivery or notification is marked, patched or reformatted in bulk. Existing lifecycle revalidation remains active; it is not bypassed to freeze financial wording.

Older queued reminders may consequently retain their earlier duplicated geography until consumed. That is deliberate compatibility, not a claim that historical output was normalized.

## Isolated verification

New tests cover complete/partial/legacy/international/missing addresses, all eight fields, duplicate suppression, HTML escaping, personal-address isolation, actual authorized agreement notice/renewal APIs, unchanged active renewal terms, service/document activity, canonical rent/expiry reminders, canonical/legacy queued formatting, duplicate prevention, visit confirmations and positional templates. Historical document metadata and rendered sent email content remain byte-for-byte unchanged in their synthetic records. Document metadata does not gain an invented property/personal-address field.

The initial consolidated targeted run executed 248 tests: 246 passed and two new fixture assertions failed. The fixtures were corrected to respect HTTP 201 creation responses and the existing available-property visit requirement. No application validation or assertions were weakened. Two additional output tests cover renewal notices and authoritative tenant-assignment context.

Final affected-file follow-up: 43 passed, zero failed/skipped (15 new output tests plus relationship/tenant-invitation regressions). The final output-only check also passed 15/15 after strengthening document metadata assertions. Across the consolidated run and focused follow-ups, 258 distinct targeted scenarios are verified with no unresolved failures; this is not a newly executed full-project regression suite.

Relevant existing coverage includes the full transactional template catalog, recipient/privacy rules, canonical reminder milestones and date calculations, outbox retry/recovery/idempotency, visit lifecycle, agreement notices, property enquiry delivery, Property 360 activity, account/server foundations and personal-address authorization.

TypeScript --noEmit --incremental false and git diff --check pass. Tests use isolated native Firebase/Auth/Firestore/R2 fixtures and mocked email transport; no real jobs or emails were triggered.

## Remaining gaps / review

- There is no implemented agreement PDF generator to verify or reformat; uploaded agreements retain their original contents/signatures.
- Inspection template download buttons remain existing placeholders. Implementing downloads requires separate scope.
- Historical files, sent email bodies, queued payloads and ambiguous legacy address prose are intentionally not rewritten or semantically parsed.
- Actual browser previews, PDF authoring and real inbox/mobile email-client rendering were not verified. No live-delivery claim is made.
- No scheduler activation, production reads/writes, migration, infrastructure change, commit, push or deployment occurred.
