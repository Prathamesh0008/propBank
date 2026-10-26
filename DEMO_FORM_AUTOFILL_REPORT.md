# PropBank Demo Form Autofill Report

## Status

PASS — A development-only **Fill Demo Data** control is attached to every rendered HTML form on localhost. Values are applied only after the user clicks the control; submission remains manual and existing validation and authorization remain active.

## Form inventory

| Area | Component | Form purpose | Demo fill |
|---|---|---|---|
| Authentication | `src/features/auth/GoogleAuth.tsx` | Registration, login and password reset | Eligible profile/email fields only; passwords remain manual |
| Public contact | `src/features/landing-page/GeneralInquiryForm.tsx` | General property enquiry and visit interest | Implemented |
| Residential search | `src/features/search/PropertySearchForm.tsx` | Residential search filters | Implemented |
| Commercial search | `src/features/search/CommercialPropertySearchForm.tsx` | Commercial search filters | Implemented |
| Search results | `src/features/search/SearchResults.tsx` | Result-page search/filter refinement | Implemented |
| Property creation | `src/features/properties/AddPropertyForm.tsx` | Owner/agent listing creation | Implemented across rendered steps |
| Property editing | `src/features/properties/EditProperty.tsx` | Existing listing edits | Implemented across rendered steps; existing values require confirmation before replacement |
| Tenant intake | `src/features/properties/TenantPropertyForm.tsx` | Private tenant property and reported-owner details | Implemented; relationship IDs remain manual |
| Property workspace | `src/features/properties/PropertyHub.tsx` | Rent ledger and internal admin notes | Implemented; receipt/property relationships remain manual |
| Visits | `src/features/visit-planner/VisitPlanner.tsx` | Schedule and reschedule visits | Implemented with a valid future date/time; property selection remains optional/manual |
| Admin visits | `src/features/admin/AdminVisits.tsx` | Visit filters | Implemented |
| Owner verification | `src/features/admin/OwnerVerification.tsx` | Approval, rejection and reconsideration | Notes/reasons implemented; real owner UID and evidence document remain manual |
| Negotiations | `src/features/negotiations/NegotiationPanel.tsx` | Customer offers and negotiation actions | Implemented |
| Agreements | `src/features/services/AgreementWorkflow.tsx` | Agreement renewal/termination requests | Implemented |
| Documents | `src/features/services/AttachDocuments.tsx` | Document metadata and upload | Text metadata implemented; files remain manual |
| Inspection | `src/features/services/InspectionReport.tsx` | Inspection report submission | Implemented; file inputs remain manual |
| Reviews | `src/features/services/Review.tsx` | Owner/tenant reviews | Implemented |
| Service requests | `src/features/services/ServiceRequestWorkflow.tsx` | Maintenance/service creation and admin updates | Implemented; image upload remains manual |

Conditional forms receive the same control when they appear, including multi-step property screens and per-record admin/property forms.

## Safety and behavior

- Controls render only when `NODE_ENV` is not production and the hostname is `localhost`, `127.0.0.1`, or `::1`.
- Existing non-empty editable values are replaced only after browser confirmation.
- Passwords, OTPs, tokens, secrets, payment credentials, file inputs and hidden fields are never populated.
- Property, owner, tenant, agent, broker and user identity IDs are never invented.
- Relationship selects are left unchanged for manual selection from authorized records.
- Selects use only options already rendered by the application. A delayed second pass supports dependent controls without bypassing validation.
- Dates are generated at click time. Visits and due dates use future dates; agreement expiry/end fields use a later future date.
- Demo content is visibly labelled with `Demo —` where free text supports it.
- No form is submitted and no API, Firebase, email, payment or notification action is triggered by autofill.

## Image handling

File upload controls remain manual because browser security prevents valid synthetic `File` selection and existing signed-upload workflows must be preserved. Forms that already expose an editable URL field receive `https://images.unsplash.com/photo-1600585154340-be6161a56a0c`. A read-only check returned HTTP 200 with `image/jpeg`. The URL is never inserted into file controls.

## Files changed

- `src/app/layout.tsx`
- `src/components/DemoFormAutofill.tsx`
- `src/components/DemoFormAutofill.module.css`
- `src/lib/demo-form-data.ts`
- `tests/demo-form-autofill.test.cjs`
- `DEMO_FORM_AUTOFILL_REPORT.md`

## Verification

- Focused Node tests: PASS — 4 passed, 0 failed, 0 skipped.
- `npm run typecheck`: PASS.
- `git diff --check`: PASS (line-ending notices only).
- Production visibility: PASS in focused environment tests; the root layout mounts the control only in development and the client also enforces an approved loopback hostname.
- Browser E2E: NOT RUN, per instruction.

