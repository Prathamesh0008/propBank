# Property form data-integrity map

This report covers Owner Add Property, Tenant Add Property, Add Tenant, Edit Property, the property API/Firestore adapters, and the administrator property dossier. It documents code- and isolated-test verification; browser file-picking, real R2 transfer, and production Firebase behavior still require controlled staging verification.

## Property identity and classification

| Visible field | Request / stored field | Authorized API and admin display | Verification |
| --- | --- | --- | --- |
| Property Name | `propertyTitle` request → canonical Firestore `title`; new records mirror to legacy `buildingName` only when absent | `title`, falling back to legacy `buildingName`, then property ID | Owner, tenant, edit, legacy fallback and no-duplicate display covered |
| Category | Route category → `propertyType` and additive `propertyCategory` | Property Category | Residential, Commercial and Industrial combinations covered |
| Property Type / Structure | `structure` | Property Type / Structure | Category allow-list enforced server-side; legacy values preserved on edit |
| Residential Layout | `configuration` | Residential Layout | Required only for applicable non-plot residential intake |
| Unit / Flat / Shop / Plot number | `unitNumber` | Unit Number | Preserved independently from property name |
| Floor | `floor` | Floor | Hidden for plot intake; legacy edit value is not deleted |
| Address / Location | request `location`; stored projection also supplies address | Admin header and authorized details | Required on creation |

## Areas, condition and listing

| Visible field | Stored field | Admin behavior |
| --- | --- | --- |
| Carpet area + unit | `carpetArea`, `carpetAreaUnit` | Combined value and unit |
| Built-up / constructed area + unit | `constructedArea`, `constructedAreaUnit` | Combined value and unit |
| Plot area + unit | `plotArea`, `plotAreaUnit` | Shown only when supplied |
| Unit condition | `unitCondition` | Unit Status |
| Furnishing checklist | `furnishedChecklist` | Furnished Checklist |
| Property purpose | `listingType`: `rent`, `sell`, `sell_rent`, `manage` | Listing Purpose plus moderation/status badges |
| Rental / sale status | `rentalStatus`, `isRented`, `isSold` | Separate availability badges |
| Project condition / possession date | `projectCondition`, `possessionDate` | Core Details |
| Maintenance payer | `maintenanceToBePaidBy` | Agreement & Security |
| Maintenance charges | No current Owner/Tenant property form control or canonical property-contract field | Displayed as Not provided; introducing collection/storage needs a product decision |

## Financial and agreement fields

| Business meaning | Stored field | Protection against conflation |
| --- | --- | --- |
| Expected selling price | `sellingPrice` | Separate admin row |
| Expected monthly rent | additive `expectedRent` | Separate from active rent |
| Finalized monthly rent | `monthlyRent` | Used by occupied tenancy/agreement workflows |
| Security deposit | `securityDeposit` | Current agreement value; tenant detail also retains its value |
| Payment due day | `paymentDueDate` | Server range 1–31 |
| Agreement dates / period | `agreementStartDate`, `agreementEndDate`, `agreementPeriod` | Current agreement section only |
| Notice / lock-in | `noticePeriod`, `lockInPeriod` | Current agreement section only |
| Escalation | `escalationPercentage`, `escalationAmount` | Displayed without replacing rent |
| Year-wise schedule | `rentSchedule[]` | Each year/month/amount/from/to retained and displayed |
| Future agreement | `nextAgreementDraft` | Explicit **Draft — not active** section; duration/date relationship validated server-side |

## Tenant and relationship data

Owner intake stores only the minimum reported tenant identity and initial occupied-agreement terms. Add Tenant remains canonical for first/last name, verified-email invitation address, contact phone, emergency contact, prior address, employment, spouse, notes, rent, deposit, due day, lease dates, escalation, notice, lock-in, schedules, and future draft.

Detailed tenants are stored in the `tenants` collection and embedded in the owning property transactionally. Updates synchronize active agreement fields without replacing the tenant/property ID. Optimistic property timestamps and tenancy revisions reject stale writes. The admin dossier now distinguishes linked UID, pending confirmation and reported contact states.

Tenant-created properties retain `submittedByUID`, `reportedOwner`, pending `ownershipVerification`, the authenticated tenant relationship, and the original property ID. Reported owner contact data remains an unverified discovery input and is visible only in authorized responses.

## Files and documents

Property images use the existing property image upload service and private internal images remain on authenticated media routes. Tenant supporting documents use property-scoped private upload APIs and are not embedded in property JSON. The administrator dossier reads the authorized document and inspection endpoints, distinguishes loading/failure/empty states, and shows document type, name, status and evidence reference. Upload transport and real private-object retrieval were not exercised against production.

## Compatibility and known limits

- Existing records with distinct `title` and `buildingName` keep both stored values. The canonical title is displayed first; a distinct legacy society name remains secondary where useful.
- Public property responses remain projected and do not include tenants, reported-owner identity, future agreement drafts, internal images or private agreement data.
- No destructive migration was introduced.
- Maintenance charge amount is not collected by the audited property forms. Adding it requires an agreed canonical contract and migration policy.
- Actual file chooser behavior, large uploads, browser date widgets and R2/Firebase production configuration require controlled staging verification.
