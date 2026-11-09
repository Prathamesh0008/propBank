# Property purposes

Canonical purposes are `rent`, `sell`, `pre_leased` and `manage`. Historical `sell_rent` records remain supported; no document migration is needed.

## Pre-leased sale

The residential/commercial/industrial add and edit forms share purpose fields. `preLeased` stores the occupancy assertion, monthly income, lease dates, optional deposit/lock-in/escalation, payment frequency, lease type and negotiability. Annual income and indicative gross yield are calculated from monthly income and selling price, never trusted from submitted calculated values. Income is owner-reported, not guaranteed.

Server validation requires positive finite prices, confirmed occupancy and a real calendar-date lease that has already started and has not ended, using the Indian calendar date. An expired lease is excluded dynamically from public discovery and flagged for owner/admin review. No scheduled writer or migration is introduced.

Existing listing moderation remains mandatory, including re-review after lease/content edits. Lease assertions begin pending; client-supplied verification is ignored. Documents have the existing independent submitted/verified/rejected admin-review lifecycle: document verification alone does not establish tenant identity or guarantee income.

Optional lease/proof files upload through the existing protected supporting-document pipeline after the property is saved. Failure preserves the saved property and redirects to its private Documents workspace for retry. Existing tenant type (individual/company), name, Indian mobile, optional email and occupancy start date are stored under `preLeased.existingTenant`, visible and editable only to the legal owner/admin. They are stripped from public, tenant-role and agent-role projections. No internal tenant, Auth account or relationship record is created or linked from this data, including when its phone matches an existing user. New pre-leased submissions require these details; historical records can still receive unrelated metadata edits without a destructive migration. Cover photographs may become public only after listing approval. Evidence, tenant contacts, deposits and lease details beyond the public summary stay private.

Approved active pre-leased properties appear in sale results and the Pre-Leased investments filter. Public summaries contain monthly/annual income, indicative gross yield, lease end/remaining term and pending verification/review state.

## Private management

Management properties are restricted to their owner and administrators, including property/document/file access and associated service requests. Tenant and submitting-agent visibility cannot expose a management property. Management photos are private even if a listing moderation flag is approved accidentally. Public listing/search/SEO policy and enquiry creation exclude management properties.

Registration collects property details only, without service selections or issue descriptions. Obsolete service/note draft fields are ignored on writes; historical stored metadata remains intact. Registering creates no service request. Owners can later use Manage Property's existing request and history workflows, private issue-photo upload, status tracking and permitted cancellation. Cleaning, general repairs and appliance maintenance extend the existing catalog; existing plumbing/electrical/painting/other categories and lifecycle are reused. No provider/payment records are invented.

Hidden investment/management fields are normalized server-side on purpose changes. Existing relationship records are preserved; listing evidence does not replace operational tenancy.

## Files

- Policy/types: `src/lib/property-purpose.ts`, `listing-policy.ts`, `property-product.ts`, `src/services/propertyService.ts`.
- Forms/display: `PropertyPurposeFields.tsx`, `PropertyPurposeSummary.tsx`, Add/Edit/Manage Property, ClientPropertyFields, PropertyDetails/PropertyDetailsDialog, admin property dossier, landing PropertiesSection and SearchResults.
- Server: properties, contracts, property-hub, domain-contracts, media, documents, notifications, negotiations and maintenance catalog in migration-remainder.
- Existing workflows: ServiceRequestWorkflow and supporting-documents client helper.
- Tests: `tests/property-purpose.test.cjs`, existing pricing/moderation/admin-integrity/product regression tests. Old regression fixtures were corrected to meet already-existing layout/structure/contact validation.

## Configuration and verification boundaries

No new Firebase rules, collection, compound query/index or infrastructure deployment is required. The public investment filter reuses existing approved/active queries and filters results in application code; existing query indexes remain prerequisites. Existing private upload storage configuration is required.

Targeted tests use an isolated in-memory Firebase/media fixture. Real storage uploads, browser layout/mobile responsiveness, live indexes and deployed rules are not exercised. No production access, deployment, Auth change, mobile-registry change or migration was performed.
