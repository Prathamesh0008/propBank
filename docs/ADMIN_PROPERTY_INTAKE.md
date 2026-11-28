# Admin unified property intake ? field inventory and implementation

Baseline: 47031291d0937e57a9c2152d4368df9d77dda2a7. Local fixtures only.

## Owner property form

- `...purposeFormSchema` (from `PropertyPurposeFields.tsx`): optional/nullable `preLeased` object containing `existingTenant` (`type`, `name`, `mobile`, `email`, `occupancyStartDate`), `tenantOccupied`, `monthlyRentalIncome`, `leaseTenureMonths`, `leaseStartDate`, `leaseEndDate`, `securityDeposit`, `paymentFrequency`, `lockInPeriod`, `escalation`, `leaseType`, `priceNegotiable` and `verificationStatus`. Active Pre-Leased Sale requirements use existing purpose/lease validation. Investment metadata does not automatically approve a tenant relationship.
- `...clientPropertySchema` (from `ClientPropertyFields.tsx`): optional strings `propertyCategory`, `structure`, `buildingName`, `expectedRent`, `areaUnit`, `carpetAreaUnit`, `constructedAreaUnit` and `plotAreaUnit`. Rendered structure choices depend on category; area inputs retain their existing unit selectors.
- `propertyTitle`: `z.string().min(1, "Property title is required")`
- `propertyType`: `z.string().min(1, "Property type is required")`
- `configuration`: `z.string().optional()`
- `listingType`: `z.string().min(1, "Listing type is required")`
- `agentOwnerEmail`: `z.string().email("Enter the registered legal owner's email").optional().or(z.literal(""))`
- `unitNumber`: `z.string().optional()`
- `floor`: `z.string().optional()`
- `location`: `z.string().min(1, "Location is required")`
- `structuredAddress`: `propertyAddressSchema.optional()`
- `carpetArea`: `z.string().optional()`
- `plotArea`: `z.string().optional()`
- `constructedArea`: `z.string().optional()`
- `tenantFirstName`: `z.string().optional()`
- `tenantLastName`: `z.string().optional()`
- `tenantEmail`: `z.string().email("Invalid email address").optional().or(z.literal(""))`
- `mobileNumber`: `z.string().optional()`
- `monthlyRent`: `z.string().optional()`
- `securityDeposit`: `z.string().optional()`
- `sellingPrice`: `z.string().optional()`
- `paymentDueDate`: `z.string().optional()`
- `agreementPeriod`: `z.string().optional()`
- `agreementStartDate`: `z.string().optional()`
- `agreementEndDate`: `z.string().optional()`
- `noticePeriod`: `z.string().optional()`
- `lockInPeriod`: `z.string().optional()`
- `unitCondition`: `z.string().optional()`
- `maintenanceToBePaidBy`: `z.string().optional()`
- `projectCondition`: `z.string().optional()`
- `rentalStatus`: `z.string().optional()`
- `possessionDate`: `z.string().optional()`
- `saleStatus`: `z.string().optional()`
- `buyerFirstName`: `z.string().optional()`
- `buyerLastName`: `z.string().optional()`
- `buyerPhone`: `z.string().optional()`
- `furnishedChecklist`: `z.array(z.object({ id: z.string(), name: z.string(), checked: z.boolean(), quantity: z.number().min(1).default(1), category: z.enum(['basic', 'kitchen', 'bedroom', 'living', 'appliances', 'semifurnished', 'office', 'infrastructure', 'safety', 'machinery', 'storage', 'utilities', 'other']) })).optional()`
- `images`: `z.array(z.string()).optional()`
- `internalImages`: `z.array(z.string()).optional()`
- `specificComments`: `z.string().optional()`

## Tenant property form

Source: `src/features/properties/TenantPropertyForm.tsx`. This is the existing regular-user tenant intake, separate from the unified Admin form. It supports Residential, Commercial and Industrial with one canonical state and six steps. Required flags below describe current controls and validation, not new schema guarantees.

### 1. Property Details

- Required `propertyTitle` and `structure`; category-specific type choices use `PROPERTY_STRUCTURES[category]`.
- Required `configuration` uses shared Residential BHK options only for non-plot Residential structures. Other categories/plots submit an empty configuration.
- Residential/Commercial use `StructuredAddressFields`: `unitNumber`, `buildingName`, `streetLocality`, `city`, `district`, `state`, `postalCode`, `country`, plus an editable legacy-text fallback when present. `resolvePropertyAddress` prepares the existing structured/formatted payload. Structured validation requires locality, city and country; Indian addresses additionally require state and a valid PIN. Unit and district are optional.
- Industrial uses required free-text `location` and optional `unitNumber`. Residential/Commercial hide these duplicate text controls.
- Non-plot structures show optional `floor`, `carpetArea` and `constructedArea`; plot structures show optional `plotArea` and hide those non-plot fields. Carpet/constructed labels and initial units are sq ft. Plot units: sq ft, sq m, sq yd, acre or hectare (initial sq m).
- Optional `unitCondition`: unfurnished, semi-furnished or furnished. Optional `maintenanceToBePaidBy`: owner or tenant in this form.
- `propertyType` and `propertyCategory` come from the category; `listingType` is initialized to rent and `rentalStatus` to rented. This tenant form does not offer the Owner form's sale/purpose selection.

### 2. Agreement Details

- Required `agreementPeriod`, `agreementStartDate`, `agreementEndDate` and `paymentDueDate` (1-31). Duration/start changes recalculate the end date through `calculateAgreementEndDate`; existing current-agreement validation checks date/duration compatibility.
- Optional `securityDeposit`, `escalationPercentage`, `escalationAmount`, `noticePeriod` and `lockInPeriod`, with existing numeric input constraints.
- Monthly rent is supplied by Step 3's schedule rather than a duplicate standalone agreement input.

### 3. Rent Schedule & Furnishing

- `RentScheduleEditor` manages `year`, `months`, `amount`, `fromDate` and `toDate` rows using its existing add/remove/undo controls. `validateUnifiedRentSchedule` checks applicable coverage/order and positive rent. The first row supplies `monthlyRent`; submission includes `rentScheduleVersion: 2`.
- `FurnishedChecklistModal` is available only when `supportsFurnishedChecklist(unitCondition, structure)` permits it. Only checked items are submitted. A condition/structure change that no longer supports furnishing clears the checklist and closes the modal.

### 4. Reported Owner

- `reportedOwner`: `companyName`, `personName`, `phone`, `alternatePhone`, `email` and `workingProfile`.
- At least company name or person name is required; `phone` must be a valid Indian mobile. Other contact fields are optional in this form. The backend validates a supplied email and returns `reportedOwner.email` field errors to this step.
- Tenant-supplied contacts do not establish ownership. Existing owner discovery/verification remains separate; this form neither selects an Admin account nor automatically approves an owner.

### 5. Images & Documents

- `images`: up to 10 PNG/JPEG/WebP files, each at most 5 MB, read locally before submission. No separate internal-image selector is rendered here.
- Optional supporting document types: rental agreement, rent receipt or other supporting document. Existing validation permits PDF/JPEG/PNG/WebP, up to 5 files, each 1 byte-5 MB and total at most 20 MB.
- Each selected document retains its type and generated idempotency key. Local selection is not an upload or verified evidence.
- Optional `specificComments`.

### 6. Review & Submit / save workflow

- Review displays existing field summaries, checked furnishings, image counts and selected/pending-retry documents. Back/Next are non-submit controls; existing validation and the synchronous submission lock remain in place.
- The authenticated form posts to `/api/properties` with `createdAs: 'tenant'`, category, property/address/financial values, `reportedOwner`, schedule, images and checked furnishing. Client tenant name/email come from the signed-in user; the backend retains its authenticated identity checks.
- After successful creation, `createdPropertyId` retains the saved ID. Supporting files then use `uploadSupportingDocument` (`/api/upload/document`, followed by `/api/documents`). Failed uploads return to Step 5 with explicit saved-property/pending-upload feedback. Retry reuses the saved property ID and document idempotency keys rather than creating another property.
- Success redirects to `/manage-property?tab=tenant`. Validation/submission errors retain form state. There is no durable refresh recovery or Save Draft implementation.
- This inventory documents source behavior. Actual registration, Firebase/R2 persistence, email delivery and browser interaction are not established by source inspection or isolated mocked tests.


## Reuse boundary

Admin mode reuses the Owner property controls, validators, category/purpose branches, structured address, schedules, furnishing, images and supporting evidence upload. Tenant intake personal/owner report fields remain unchanged. Admin owner contacts are separate from property location. Existing relationship_links, property_submissions, tenants, notifications and email_deliveries provide pending states, bounded discovery, idempotency and delivery recovery. No Firebase Auth account is created.
