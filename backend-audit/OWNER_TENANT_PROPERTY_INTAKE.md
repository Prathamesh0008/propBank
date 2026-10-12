# Owner and tenant property intake

Add Property now offers **As an Owner** and **As a Tenant**, followed by the existing category selection. Existing `/add-property?type=...` URLs still open the owner form. Tenant URLs use `/add-property?as=tenant&type=...`.

The tenant form captures property/category/type/structure, unit/floor, carpet/built-up/plot areas and units, building/location, supplied owner company/person/contacts/email/working profile, finalized rent, optional year-wise rent amounts and periods, deposit, due day, escalation fields, agreement period/dates, notice/lock-in, furnishing checklist, maintenance payer, tenant working profile, multiple images and comments.

## Persistence and identity

Both paths use `POST /api/properties`. Tenant requests include `createdAs: 'tenant'` and a `reportedOwner` object containing only `companyName`, `personName`, `phone`, `alternatePhone`, `email`, and `workingProfile` strings.

The server takes tenant UID/email from the verified Firebase token, regardless of supplied ownerUID/tenantEmail. New records use existing `properties` and `tenants` collections in the existing transaction. Additive private metadata is `createdAs`, `submittedByUID`, `ownershipVerification: 'pending'`, and `reportedOwner`. Actual ownerUID remains empty until a separate trusted verification/linking workflow exists. Owner contact input never grants ownership, tenant access to an existing property, or another account relationship.

Tenant submissions are rented/private records, excluded from public browsing even if listing state changes. They appear immediately in the submitter's Tenant list. Existing owned properties remain in Owned. Admin's all-properties list and full-detail dialog show the supplied details with a verification warning. No global user role is changed, no existing property is overwritten and no existing data is migrated.

An administrative owner-verification/linking workflow is not implemented by this intake feature. Renewal approval cannot be performed by an unlinked reported owner. This avoids treating a tenant's typed contact information as verified ownership. No email is sent to unverified reported owner addresses; the existing admin property-added notification records intake.

## Validation

Focused tests cover authenticated identity, spoofed owner/tenant fields, invalid intake mode, missing rental terms, atomic embedded/collection state, public/unrelated-user rejection, owner-operation rejection and admin metadata visibility. Browser tests cover both selection paths and one account owning an existing property while adding a different rented property. The new form is included in 1440/768/390px layout checks.

Final validation: npm run typecheck PASS; npm run lint PASS (0 errors, 80 warnings); npm run build PASS; full backend suite 86 tests / 81 passed / 0 failed / 5 skipped original-Go checks; Playwright 26 passed / 0 failed, including 1440/768/390px checks; git diff --check PASS. Branch remains feature/property-management-improvements; no commit or push.
