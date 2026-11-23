# Structured address foundation - Phase 1

Local source audit only. No application documents were read, no migrations ran, and no forms, API contracts, authorization or persistence paths changed. Existing homepage work is preserved.

## Canonical opt-in model

`src/lib/structured-address.ts` exports `structuredAddressSchema`, `StructuredAddress`, `AddressValue`, `validateStructuredAddress`, `readAddress`, `formatStructuredAddress`, `mergeAddress`, and `addressCompatibilityFields`.

| Canonical string field | Meaning / existing source | Future form label |
|---|---|---|
| unitNumber | Existing `unitNumber`; optional, never derived from free text | Flat / House / Unit Number; Plot / Office / Shop where appropriate |
| buildingName | Existing additive `buildingName`, independently entered/confirmed; do not infer from title | Building / Society / Property Name |
| streetLocality | New explicit component; **not** an automatic alias of legacy full `location` | Street / Area / Locality |
| city | Existing `city` | City |
| district | New explicit component; no city-to-district inference | District (optional unless country/address policy requires) |
| state | Existing `state` | State / Province / Region |
| postalCode | Explicit canonical name; safe legacy read alias `zipCode` | PIN Code for India, Postal Code elsewhere |
| country | New explicit component; country name or country code string | Country |
| legacyText (envelope) | Original `address`, `location`, `previousAddress` or `currentAddress` supplied by caller | Existing address (reviewable, not silently parsed) |

All structured components are strings to preserve alphanumeric unit/postal values and leading zeroes. Values are trimmed, limited to 200 characters (postal 32), strict-schema checked without number coercion. Country is not guessed/defaulted. `IN`, `IND` and `India` activate six-digit Indian PIN validation (first digit nonzero); international postal codes are not forced into Indian patterns. Default validation supports partial drafts. Callers explicitly select required fields and whether a unit is required; standalone houses must not use `requireUnit`. Country-specific completeness policies and labels belong to the later form phase, not a new global requirement on historical data.

The envelope `{structured, legacyText}` is a proposed shared value object, **not a new deployed Firestore schema**. Preserve `location` and `address`, and legacy `zipCode`, when integration is approved. `addressCompatibilityFields` is a pure proposed projection, never a writer. It derives matching address/location strings, retains opaque legacy text, and does not propagate unrelated source properties. Do not spread its `structured`/`legacyText` into existing API requests until serializers explicitly support them.

## Field and data-flow inventory

| Workflow / source | Current input / canonical storage | Validation, serializer and API | Current outputs / integration concern |
|---|---|---|---|
| Residential/commercial/industrial owner or admin-assisted creation: `AddPropertyForm.tsx`, `ClientPropertyFields.tsx` | `unitNumber` optional; `floor` separate; required free-text `location`; `propertyTitle` / additive `buildingName` | Zod `location.min(1)`; POST `/api/properties` -> `properties.ts` `createPropertyRecord`; generated `CreatePropertyRequest` accepts unitNumber/location, not city/state/zipCode. Server copies location to address and propertyTitle to title; buildingName uses title fallback | Same shared form for purposes Rent, Sale, Pre-Leased Sale, To Manage. Geographic components are not separately collected. Keep floor out of inferred unit/street. Property name is not always a postal building name |
| Editing: `EditProperty.tsx`, `property-edit-payload.ts` | Initializes location from `location || address`; unit/floor/name maintained separately | PATCH `/api/properties/[id]`; dirty-field projection prevents unrelated resets; `properties.ts` synchronizes address when location changes unless explicitly supplied | Later integration must retain dirty tracking, canonical aliases, moderation revision checks and legacy prefill. New defaults must not blank existing components |
| Tenant-origin property registration: `TenantPropertyForm.tsx` | Required `location`, optional unit/floor; category-aware unit labels; buildingName follows propertyTitle | Existing POST property path and relationship approval gates | Do not confuse reported ownership contact with an owner postal address |
| Tenant initial information: generated creation schema (no current address input found in AddPropertyForm) | `tenantPreviousAddress` free text | Creation maps request field to embedded `TenantInfo.previousAddress` | Treat as private person history, never public property location |
| Tenant assignment/edit/replacement: `AddTenant.tsx` | Each tenant's `previousAddress` initialized, edited and submitted independently | `/api/tenants` -> `tenants.ts`; generated `Tenant`/`TenantInfo` string field; property embedded tenancy plus canonical relationship synchronization | Existing read summary shows previousAddress; never merge independent tenant addresses or overwrite historical contracts |
| Buyer information / legacy models | `BuyerInfo.currentAddress` string | Generated model `go-contracts.ts`; property/buyer serialization | `PropertyDetails.tsx` renders currentAddress in authorized buyer details. No separate structured buyer address editor found in current UI |
| Owner identity/profile | Owner reported name/email/phone; no dedicated owner postal address form found | Account/user authorization and mobile registry remain unchanged | Future owner address must be independently supplied; never copy property location into personal address |
| User account / admin user details: `MyAccount.tsx`, `AdminUserDetailsDialog.tsx` | Current account form does not collect a postal address; email address is an identity field, not physical address | `/api/account`, `/api/users`; existing field allowlists | No auth/email/mobile fields belong in structured address. Admin user details mainly exposes authorized profile and related records |
| Service requests: `ServiceRequestWorkflow.tsx`, `AdminServiceRequestsWorkspace.tsx` | Property selection; no separate postal-address input | `admin-service-requests.ts` batches requester/property enrichment; response `propertySummary.address` is existing address/location | Preserve admin-only requester PII, bounded enrichment, property reference and permissions; no address lookup per row |
| Visits: `VisitPlanner.tsx`, `AdminVisits.tsx` | Select property; free-text visit notes may contain directions, not a canonical postal field | `/api/visits`, `visits.ts`; authorized property title/address enrichment | Do not split notes or replace them with required address fields; selector search uses existing location/address |
| Inspection and services / Property Hub | Bound to property; no new independent physical-address collector found | Existing property hub/service/inspection APIs and document bindings | `PropertyHub.tsx` displays location/address. Preserve member/owner/admin gating and lazy related-record loads |
| Owner/tenant details and cards: `ManageProperty.tsx`, `ArchivedProperties.tsx`, `PropertyDetails.tsx`, `PropertyDetailsDialog.tsx`, `PropertyCard.tsx` | Existing property address/location and authorized tenant previous/buyer current addresses | `propertyResponse` in contracts.ts supplies role-aware response | Existing `formatAddress` only removes empty comma components; does not deduplicate appended city tokens. Phase 1 leaves it unchanged to avoid unreviewed global display changes |
| Public listings: `PropertiesSection.tsx`, `SearchResults.tsx`, `propertyService.ts` | Property location/address/city and current listing result fields | Property listing visibility/redaction and cursor/search queries | Existing query scans/filter matches location/address/city/state; keep aliases and search tokens stable. No private person addresses in public projections |
| Admin directories/details: `AdminPropertiesTab.tsx`, `AdminPropertyDetailsDialog.tsx`, `AdminRentedProperties.tsx`, `admin-property-directory.ts`, `admin-property-views.ts` | Title/building/unit/address plus city/zipCode where available | Existing authorized directory/detail APIs; no new lookups | Details may append city/zipCode already present in legacy address; opt-in exact component deduplication fixes this only when adopted in later phase |
| Agreements / related documents: `AgreementWorkflow.tsx`, `agreements.ts`, agreement inventory panels | Reference property and tenancy, do not collect an independent mailing address | Existing agreement snapshots/date/rent lifecycle | Preserve immutable finalized agreement information. No standalone address CSV/PDF import/export pipeline found in current src/scripts audit; do not infer document contents or rewrite uploaded PDFs |
| Notification/email snapshots: `property-activity.ts`, `admin-lifecycle.ts`, `group2-mail.ts`, `relationship-links.ts`, `enquiries.ts`, `notifications.ts`, `email-design.ts`, `email-legacy.ts`, reminder services | `propertyAddress` snapshot or formatted property address/location plus city/state/zipCode | Durable intent/outbox, generated AdminNotification/CreateAdminNotificationRequest, historical template compatibility | Some assembled strings repeat city already in address. Future use must format at producer boundary without resending old deliveries or replacing immutable historical snapshots |
| Demo / previews | `demo-form-data.ts` synthetic address values; `scripts/preview-transactional-emails.cjs` | Nonproduction fixture tooling | No personal data imported. Keep synthetic fixtures; do not treat demo full text as authoritative structured fields |

## Generated storage/response contracts (actual source)

`src/lib/server/services/go-contracts.ts` defines matching JSON/store string names:
- Property and PropertyResponse: unitNumber, location, address, city, state, zipCode.
- CreatePropertyRequest: unitNumber, location, tenantPreviousAddress.
- TenantInfo and Tenant: previousAddress.
- BuyerInfo: currentAddress.
- AdminNotification and CreateAdminNotificationRequest: propertyAddress.
- `buildingName` is an additive native field outside those generated Go schemas.
- No existing district/country/streetLocality canonical physical-address fields were found in those contracts.

`contracts.ts` `model` iterates known schemas; arbitrary new components may be lost unless explicitly supported. `propertyResponse` and `publicPropertyResponse` allowlists must be reviewed independently; do not expose a whole structured envelope just because property location is public. `properties.ts` additiveFields, listingContentFields, create request projection and edit aliases must be updated together in a later phase. Do not manually edit generated schemas as a shortcut.

Existing routes: property GET/POST `/api/properties`, property GET/PATCH `/api/properties/[id]`, tenant route family, property hub, admin directories, visits, account and services keep all current contracts. Phase 1 performs no API integration and adds zero Firestore reads.

## Compatibility safeguards and deliberate limits

- `readAddress` accepts strings or explicit supported components; legacy text is retained verbatim. No regex extraction of unit/district/PIN, no geocoding, no inferred country or district.
- A caller reading tenant/buyer addresses passes the specific string, not the whole person record. This prevents accidental selection of another relationship's address.
- `mergeAddress` preserves nonempty existing components for missing/null/blank patches and does not mutate inputs. It is a draft helper, **not validation**; validate request objects before merge and validate the merged result afterward. Explicit clearing needs a separately designed authorized operation.
- Formatting trims/joins valid components, omits missing values and literal undefined/null display tokens, and deduplicates exact case/whitespace-normalized comma components (e.g. repeated city). It does not collapse substring matches such as Pune Road vs Pune, guess equivalent district/city spellings or interpret international address ordering.
- Structured plus opaque legacy text may repeat partially overlapping descriptions; this is safer than losing historical information. User review must resolve ambiguity; no automatic rewrite.
- No production record inspected; source proves supported schemas, not completeness of historical data.
- No existing formatting consumer changed. The complete application rollout and shared accessible address input are explicitly deferred to reviewed subsequent phases.

## Next phases (review before implementation)

1. Shared accessible address fieldset with country-aware labels/required rules, standalone house/unit handling, legacy-text review and read-only preview. Choose a vetted country selector; do not assume every country has a state, district or postal code.
2. Owner/admin/tenant property creation and edit integration together: additive fields, strict request validation, storage/read projections, dirty-field merging, aliases, search compatibility and full eight-purpose/category round trips. Preserve existing IDs and role redaction; no bulk migration.
3. Separate personal previous/current/owner address integration with explicit authorization and history handling. Do not publish private addresses.
4. Opt-in authorized displays, service/visit summaries, email/document renderers and import/export formats using shared formatter; snapshot history remains unchanged. Add fixture coverage for search/cursors, public restrictions, duplicate city and edit/resave.
5. Browser acceptance for all address-bearing forms; any historical migration, country-specific postal rules or persisted backfill requires a separate reviewed plan.

## Additional audit findings

- `EditProperty.tsx` registers and validates location and initializes it, but the current JSX has no `name="location"` FormField. Thus stored addresses prefill internally but a distinct editable location control is not currently rendered there. This existing UI gap is documented only; fixing forms is outside Phase 1.
- Search location inputs (`PropertySearchForm.tsx`, `HeroPropertySearch.tsx`, `SearchFilterSection.tsx`, SearchResults and directory search) are search queries, not physical-address collectors. Do not replace them with eight-field forms.
- `tenantPreviousAddress` exists in creation request/server mapping but no current JSX collector was found; `previousAddress` is actively collected in AddTenant. Buyer currentAddress is an authorized display/model field, not a current buyer form input.
- The generated-contract header references `scripts/generate-native-contracts.cjs`, which is absent in this checkout. Verify the contract generation source before extending generated models; Phase 1 does not regenerate or edit them.
