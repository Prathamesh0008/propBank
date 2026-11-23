# Structured addresses - Phase 3: Personal address workflows

Local-only changes on feature/homepage-redesign. No production records were accessed, no migrations ran, and no infrastructure was changed.

## Audit scope and applicability

| Workflow | Existing physical-address input | Phase 3 decision |
|---|---|---|
| Owner registration/profile | None in current auth/account UI | No new postal-address field invented |
| User account settings (MyAccount) | None; email address is an identity field, not a physical address | No new field, API or account persistence change |
| Tenant registration / Google onboarding | None | No registration/auth changes |
| Owner/admin tenant information entry/edit (AddTenant) | Optional free-text previousAddress | Replace this collector with shared optional structured address control |
| Buyer details | BuyerInfo.currentAddress exists in legacy model and authorized detail display; no current address editor found | Preserve stored field and owner/admin display; redact from linked non-owner responses |
| Tenant-origin property registration | Property location, not a personal-address collector | Phase 2 behavior preserved |

Consequently, owner-home-address and user-profile-address create/edit tests are not applicable: these forms do not collect those addresses. Tests verify they did not gain invented fields. Owner/admin-managed tenant address create/edit is covered through actual tenant API entry points.

## Exact files changed in this phase

New:
- src/lib/personal-address.ts
- tests/personal-structured-address.test.cjs
- docs/STRUCTURED_ADDRESS_PHASE3.md

Updated:
- src/components/StructuredAddressFields.tsx
- src/features/services/AddTenant.tsx
- src/lib/server/services/tenants.ts
- src/lib/server/services/contracts.ts
- src/lib/server/services/property-hub.ts
- src/lib/server/services/properties.ts
- tests/property-structured-address.test.cjs

All prior uncommitted homepage, property-address, reminder and other work remains in place.

## Model and persistence

The tenancy-specific object is `previousAddressStructured: {structured: {...eight address components}, legacyText: string}`. The existing `previousAddress` string remains the formatted compatibility alias, and `previousAddressVersion` is server controlled. These keys are separate from property.structuredAddress/address/location and never replace a property location.

The shared component gains optional legend/optional-address props; defaults retain Phase 2 property validation and presentation. It preserves spaces during manual entry, provides the eight fields in the existing responsive two-column/single-column layout, and shows a legacy textarea when text is present. Missing personal address remains valid because previousAddress was optional. If structured information is entered, the existing street/city/country rules and India-specific state/PIN requirements apply. International postal codes retain the established Unicode letter/number, space and hyphen convention. No components are inferred from historical text.

POST /api/tenants validates the additive object before legacy request projection. Tenant/TenantInfo native extensions retain it through model/store/wire serialization. Both the canonical tenants document and embedded property.tenants relationship receive the same value in the existing transaction. Admin tenancy assignment/replacement uses the same address validation, preserving its existing explicit tenancy-revision and identity-confirmation checks.

PUT/PATCH /api/tenants/[id] retains owner/admin write authorization. A structured address edit supplies expectedPreviousAddressVersion. Parsing and blank-safe merging occur before the write; the version is checked against the canonical document inside syncTenant's existing Firestore transaction. A stale or concurrent edit returns 409. Canonical and embedded values update together and roll back together on failure. Existing expectedPropertyUpdatedAt and rent/inventory guards remain intact. No new reads, indexes or records are added for address handling.

Unrelated UI edits omit the structured payload. Blank legacy updates do not erase populated text; blank/missing structured components preserve stored values. Raw legacy-only clients remain supported. Once a canonical object exists, clients must edit it with its version rather than independently replacing previousAddress. Server-controlled version changes and alternate field-name spellings are rejected. Generic property PATCH tenant-array writes cannot bypass the personal-address workflow or version checks.

Original free text remains in legacyText even after explicit structured components become the display source. Explicit destructive clearing is not added in this phase. Finalized agreement/inventory histories are not rewritten.

## Privacy

- Canonical tenant GET/list retains existing authorization: owner/admin may read; active confirmed tenant reads their own record; unrelated users and sibling tenants cannot read it.
- Generic property responses recursively omit previous/current personal addresses, their structured values and versions for non-owner/admin roles, including nested tenancy/history snapshots. Public listing responses remain redacted.
- Property Hub's separate top-level tenancy/history data uses the same redaction for non-owner/admin roles, preventing a bypass outside propertyResponse.
- Linked tenants retain ordinary property/tenancy details and can obtain their own previous address through the existing tenant-detail API; they do not receive everyone else's address through a property response.
- Property owner/admin access remains authorized. Actor roles are resolved on the server; request-supplied role labels do not control redaction.
- No personal address values are introduced into email templates, notification text or URLs. Isolated tests inspect staged email payloads for a synthetic private-address sentinel.
- No Firebase rules, authentication, account roles, media authorization, property-location data, payments or reminder behavior are changed.

## Verification

Synthetic fixtures cover owner/admin tenant address creation, optional blank addresses, international addresses, malformed PIN/postal data, legacy conversion, blank-safe partial edits, unrelated edits, concurrent requests, rollback, server-controlled versions, unauthorized writes and reads, sibling-tenant isolation, generic property/Hub redaction, email payload privacy and shared component rendering.

Relevant existing tests cover property address round trips, property privacy/evidence, tenant invitation and identity confirmation, rent editor behavior, account safeguards, serializer security and server foundation. A Phase 2 component test loader was extended to resolve the newly shared personal-address helper; its assertions are unchanged.

No live browser mutations or real email deliveries were performed. Responsive CSS/isolated markup is verified, not actual browser acceptance. Real UI testing must use an isolated environment, since localhost may target production Firebase.
