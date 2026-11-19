# Property form data integrity audit

Scope: residential/commercial owner creation and editing, all four purposes, native property API projections and existing authorized displays. No production writes or migrations.

## Confirmed record
Read-only field-masked inspection of ZFTG0547 found expectedRent="32000", monthlyRent="", securityDeposit="96000", carpetArea="1180", areaUnit="sq ft", listingType=rent, rentalStatus=available, moderationStatus=pending_review and zero embedded tenants/schedule rows. Rent was saved correctly. Asking rent is not contractual rent. Recorded availability is not proof of vacancy.

## Field mapping
Both residential and commercial use AddPropertyForm / EditProperty, ClientPropertyFields and PropertyPurposeFields. Type/category selects the supported structure and configuration controls; this is not eight independent schemas.

| Form field(s) | API/storage | Read/display and policy |
|---|---|---|
| Property name | propertyTitle -> title; buildingName additive | Authorized directory/details; edit rename synchronizes buildingName only when it was the same name |
| Category, structure, configuration | propertyType, propertyCategory, structure, configuration | Native fields retained alongside legacy Property model; residential configuration / category-specific structures |
| Address | location -> address on create and explicit location edit | Shared address formatter; no rewrite of existing records |
| Unit, floor | unitNumber, floor | Owner/admin details; public allowlist unchanged |
| Carpet, constructed, plot area | carpetArea, constructedArea, plotArea + distinct unit fields / areaUnit | Native projection retains units; owner/admin details show separate units, no implicit unit conversion |
| Furnishing | unitCondition, furnishedChecklist | Checked original property items; agreement inventory remains separate |
| Project condition, possession | projectCondition, possessionDate | Existing purpose rules and canonical date strings; display DD/MM/YYYY; unrelated edits no longer send defaults |
| Asking rent | expectedRent | Positive server validation; display Expected monthly asking rent for available rentals |
| Contract rent | monthlyRent + rentSchedule and tenancy records | Existing date-aware resolver; never use asking rent as payment/reminder default |
| Deposit | securityDeposit or preLeased.securityDeposit | Nonnegative validation; explicit zero preserved; private public-response fields remain redacted |
| Sale price | sellingPrice | Ordinary sale and Pre-Leased; no rental-field requirement for sale |
| Investment income | preLeased.monthlyRentalIncome | Existing investment summary, distinct from internal tenancy rent |
| Lease tenure/dates | preLeased.leaseTenureMonths, leaseStartDate, leaseEndDate | Existing month-end-inclusive calculation/validation; legacy missing tenure compatibility unchanged |
| Lock-in, escalation, frequency | preLeased.lockInPeriod, escalation, paymentFrequency | Existing private authorized lease summary; not an internal PropBank tenant assignment |
| Existing investment tenant | preLeased.existingTenant (type, name, mobile, email, occupancyStartDate) | Owner/admin only; excluded from public and unrelated roles |
| Contract dates / due day / notice / escalation / maintenance | agreementPeriod, agreementStartDate, agreementEndDate, paymentDueDate, noticePeriod, lockInPeriod, escalationPercentage, escalationAmount, maintenanceToBePaidBy | Existing agreement/tenant authorization and concurrency rules retained; unrelated edits omit tenancy changes |
| Tenant / buyer fields | tenant identity fields / tenants; buyer fields / buyers | Existing relationship and lifecycle validation; no blanket update of multiple independent contracts |
| Comments | specificComments | Existing purpose normalization and authorized-only policy retained |
| Photos | images, internalImages | Existing media ingestion and binding authorization; only approved public cover is publishable |
| Supporting documents | separate document/media APIs and authoritative bindings | Not embedded document URLs in listing payload; private evidence remains owner/admin only |
| Owner identity | ownerUID and authoritative owner snapshot | Existing server authorization and trusted account resolution |
| Legacy alternate money keys | expected_rent, monthly_rent, selling_price | Read-only compatible response fallback only when canonical value is missing and alternate is a positive decimal |

Generic amenities, bedroom/bathroom counts and independently editable city/state/ZIP fields are not collected by these current owner forms; legacy schema entries are not evidence of a dropped submitted input. Existing stored legacy fields are preserved by partial edits. Commercial structure/plot controls differ from residential BHK configuration; no new business fields were introduced.

## Purpose coverage
- Rent: expected rent without an active contract; contractual rent uses existing resolver when tenancy exists. Zero deposit remains valid.
- Sale: selling price, existing sale/buyer behavior; no invented rent.
- Pre-Leased: selling price, income, full private tenant and lease details; investment evidence does not establish internal occupancy.
- To Manage: private registration and services, existing hidden-marketing-field normalization retained; never public.

## Corrections
1. Directory legacy projection discarded native fields. Retain fetched source fields before canonical response redaction; no extra reads.
2. Detail/card price readers omitted expectedRent. Central display-only pricing distinguishes asking/contractual/investment/sale; ledger/reminder calculations untouched.
3. Available rental edit incorrectly required monthlyRent. Purpose-aware field now edits expectedRent once.
4. Full edit defaults could overwrite unrelated fields/tenant terms. Submit dirty fields only; keep zero deposit; reject ambiguous multi-contract edits.
5. Location edit left address alias stale. Synchronize within existing property write.
6. Authorized read projections accept existing finite numeric money/area values and known positive legacy monetary aliases without changing stored values. Normal response price now follows the applicable asking/contractual/sale source, so public cards and budget filters stay consistent.
7. Existing edit controls omitted possession date and project condition; both now populate and submit explicit changes using existing date controls.
8. User availability badge implied vacancy. Use confirmed relationship-based occupancy with unknown fallback; listing availability remains independent.

## Verification limits
Isolated API/storage/presentation fixtures are not live browser acceptance. No production record corrections, public moderation decisions, documents, emails or live authenticated mutations were performed. Manual browser acceptance remains required for all eight forms, edit dirty-state behavior, details and authorized photo/document actions. Unsupported/unavailable fields are not fabricated.
