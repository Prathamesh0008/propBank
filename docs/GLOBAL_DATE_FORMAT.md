# Global date presentation

Local feature branch: feature/global-date-format. Production is unchanged.

## Contract

Full human-readable dates use DD/MM/YYYY. Date-times append the applicable time. The shared DatePicker supports text entry, calendar selection, required/min/max/disabled constraints and canonical hidden form values. The Input adapter applies this to all existing date fields without duplicating form controls.

Use formatDisplayDate / formatDisplayDateTime / formatDisplayTime from src/lib/date-format.ts for display only. Civil YYYY-MM-DD strings are validated and rendered without UTC parsing. Instants use the explicit IANA timezone or Asia/Kolkata. Firestore Timestamp, serialized timestamp, Date and epoch-millisecond values are supported. Missing, invalid and legacy year-0001 values use a safe fallback. Do not sort or persist formatted display strings.

Firestore/API timestamps, civil dates, billing month keys, event IDs, scheduling calculations, rent amounts and reminder metadata keep their original representations. The property-detail termination form now submits canonical dates rather than locale-formatted labels, using the existing calculation with civil-date parsing.

## Coverage

- Shared picker and Input adapter: residential/commercial property forms, tenant intake, lease/occupancy dates, renewal/termination, rent schedule editor, receipt dates, filters and visits.
- Public property details, landing preview, owner/tenant management and Property Hub.
- Admin property/rented directories, detail dialogs, moderation, user history, visits, service requests, notifications, archives and email-delivery history.
- Inspection/document upload dates and service/agreement history.
- New visit, tenant, termination, property submission, rental-term, rent payment and reminder email presentation. Recipient, event, idempotency and delivery behavior are unchanged.

## Intentional exceptions

- Billing-month selectors/labels use MM/YYYY (canonical YYYY-MM). Rent due day remains a day-of-month, not a fabricated full date.
- Calendar month/year navigation, weekday headings and time-only slots retain their useful granularity.
- Machine-readable time attributes, form state, query/filter cursors, ISO fields and backend calculations remain canonical.
- Uploaded PDFs and immutable previously generated documents/emails/free-text history are not rewritten. No active PDF renderer exists in this source tree; the existing printable inventory HTML annexure has no date field, so no artificial date was added.
- Dates embedded by users in arbitrary descriptions, file names or document content are not rewritten.

## Verification

- 23 isolated date-format checks; 10 calendar checks; 145 related rent/agreement/inventory/email/admin regressions: 178 distinct checks passing, no skips.
- Initial combined run passed 167 checks with one calendar test-file parse failure (unescaped slash regex in updated expectations). The affected calendar file then passed all 10 checks; the date-format file passed all 23 after adding the canonical termination-payload regression. No full suite was rerun.
- TypeScript --noEmit --incremental false and git diff --check.
- Actual browser interaction, mobile layout, PDF rendering by external software and live provider delivery are not verified. No live API calls, database writes, sends, server restarts or deployments were performed.

## Exact changed files

- docs/GLOBAL_DATE_FORMAT.md
- src/features/account/MyAccount.tsx
- src/features/admin/AdminArchiveTab.tsx
- src/features/admin/AdminEmailDeliveries.tsx
- src/features/admin/AdminNotificationFeed.tsx
- src/features/admin/AdminPropertiesTab.tsx
- src/features/admin/AdminPropertyDetailsDialog.tsx
- src/features/admin/AdminRentedProperties.tsx
- src/features/admin/AdminServiceRequestsTab.tsx
- src/features/admin/AdminUserDetailsDialog.tsx
- src/features/admin/AdminVisits.tsx
- src/features/admin/OwnerVerification.tsx
- src/features/enquiries/EnquiryInbox.tsx
- src/features/landing-page/GeneralInquiryForm.tsx
- src/features/landing-page/PortfolioSections.tsx
- src/features/negotiations/NegotiationPanel.tsx
- src/features/properties/EditProperty.tsx
- src/features/properties/ListingModeration.tsx
- src/features/properties/ManageProperty.tsx
- src/features/properties/PendingConnections.tsx
- src/features/properties/PropertyDetails.tsx
- src/features/properties/PropertyDetailsDialog.tsx
- src/features/properties/PropertyHub.tsx
- src/features/properties/PropertyPurposeSummary.tsx
- src/features/services/AddTenant.tsx
- src/features/services/AgreementWorkflow.tsx
- src/features/services/AttachDocuments.tsx
- src/features/services/InspectionReportList.tsx
- src/features/services/ReviewHistory.tsx
- src/features/services/ServiceRequestWorkflow.tsx
- src/features/visit-planner/VisitPlanner.tsx
- src/lib/calendar-date.ts
- src/lib/date-format.ts
- src/lib/server/services/agreements.ts
- src/lib/server/services/group2-mail.ts
- src/lib/server/services/property-effects.ts
- src/lib/server/services/property-hub.ts
- src/lib/server/services/reminders.ts
- src/ui/date-picker.tsx
- tests/agreement-admin-notifications.test.cjs
- tests/calendar-system.test.cjs
- tests/global-date-format.test.cjs
- tests/phase5a-integration.test.cjs

The existing unstaged firebase-debug.log deletion is preserved and is unrelated to this feature.
