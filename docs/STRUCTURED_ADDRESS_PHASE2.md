# Structured property addresses - Phase 2

Local implementation on feature/homepage-redesign. No production data access, migrations, infrastructure changes or deployments.

## Files

New:
- src/lib/property-address.ts
- src/components/StructuredAddressFields.tsx
- src/components/StructuredAddressFields.module.css
- tests/property-structured-address.test.cjs
- docs/STRUCTURED_ADDRESS_PHASE2.md

Updated:
- src/features/properties/AddPropertyForm.tsx
- src/features/properties/EditProperty.tsx
- src/features/properties/TenantPropertyForm.tsx
- src/lib/property-edit-payload.ts
- src/lib/server/services/properties.ts
- src/lib/server/services/contracts.ts
- tests/property-category-ui.test.cjs
- tests/fixtures/native-server.cjs

All pre-existing changes remain in place. Phase 1 helpers and inventory remain unchanged.

## Flow

Residential and Commercial add/edit paths, including tenant-origin property registration, reuse the eight-field StructuredAddressFields control. Industrial input presentation remains unchanged. The existing owner/admin property title remains distinct from the optional address building/society name. Unit is optional for standalone properties. Desktop uses two columns, mobile one; original free text is an editable textarea only when present. Controlled draft values retain typed spaces; formatting/validation normalizes for preview and submission.

The additive property field is:

    structuredAddress: {
      structured: {unitNumber?, buildingName?, streetLocality?, city?, district?, state?, postalCode?, country?},
      legacyText: string
    }
    addressVersion: integer

The object is not a new document and contains no personal tenant/owner address. New structured entry requires street/locality, city and country. Explicit India/IN/IND also requires state and a valid six-digit PIN. Other countries do not inherit Indian state/PIN requirements; postal codes, when supplied, support Unicode letters/numbers, spaces and hyphens with a 32-character maximum. No postal verification service or global country-specific postal database is introduced. Unit, building and district remain optional. An original free-text address remains a valid editable legacy fallback without inferred components.

POST /api/properties validates and resolves the object BEFORE request projection, computes the legacy display aliases, and copies the additive object/version through the existing storage projection and transaction. Native schema additions are explicit; generated Go contract files are untouched. New canonical records start at addressVersion 1.

PUT/PATCH /api/properties/[id] retains existing authorization and lifecycle rules. Canonical address updates require expectedAddressVersion. Partial structured updates are validated, merged with saved explicit components, then revalidated. Blank/missing fields do not erase populated values. Version comparison happens inside the existing authoritative write transaction; a stale edit returns HTTP 409 before staging writes. A failed transaction rolls back property changes and staged notification records. No extra Firestore queries or indexes are added.

address and location derive from one formatter; unitNumber/buildingName/city/state/zipCode aliases track applicable structured fields. Postal codes remain strings. The existing location/address/city/state search and listing behavior remains available. On canonical records, independently changing legacy aliases is rejected rather than allowing conflicting sources. Legacy-only clients and records remain supported; legacy alias edits synchronize address/location and blank optional fields preserve populated values.

Existing property IDs, owner/tenant relationships, rent data and approval rules are unchanged. Address edits count as listing-content edits under the existing moderation process. Versions are server-controlled. Unknown/malformed address members return HTTP 400. The existing generated serializers are supplemented only for structuredAddress/addressVersion in authorized property responses. Public responses continue using existing approved public fields; the retained original legacy envelope and edit version are not added to public responses.

## Editing and history

EditProperty now renders the missing address control. It initializes from structuredAddress when available, otherwise from explicit legacy unit/building/city/state/zipCode plus opaque location/address text. Unrelated dirty-field updates omit the address object entirely. Changed address payloads carry the current address version. No historical text is parsed into guessed unit, district, street or PIN values.

When a user supplies a street explicitly, structured fields drive the display string. Original legacyText remains saved for compatibility/review instead of being appended as a duplicate full address. Missing/blank patch values cannot clear saved components or legacy text; an explicit destructive clearing workflow is outside this phase. Historical agreement/document snapshots are not rewritten.

## Tests

Synthetic native API fixtures exercise all eight Residential/Commercial x Rent/Sale/Pre-Leased/To Manage combinations; create/storage/detail/owner-directory round trips; international and no-unit examples; invalid data; legacy editing; unchanged updates; partial blank-safe merges; rollback; stale and concurrent requests; server-controlled versions; public/owner/admin/unauthorized boundaries; responsive control markup; dirty-field payloads and in-progress typing spaces.

Existing category UI fixtures now include valid structured address data and mock React useId. Existing property category/title/structure assertions remain; the obsolete title-to-building-only assertion now verifies explicit address building-name priority. Native Firebase fixtures load the actual local Zod package and apply their existing collection-failure injection to update operations as well as set/create, so rollback is meaningfully exercised. No live services are used.

## Remaining display work / limits

- Existing admin/owner/public summaries receive the formatted address aliases. Dedicated district/country/address-component rows are not added in Phase 2.
- AdminPropertyDetailsDialog currently appends city/zipCode to its location/address text with the older formatAddress helper. It may repeat those components already contained in a full address; adopting the structured formatter at display-only consumers remains a subsequent phase.
- Existing structured records must be edited through the updated form/object, not old alias-only API consumers. No deployed clients are changed by this local work.
- No personal address form, service/visit form, uploaded PDF or historical snapshot was migrated.
- Responsive CSS and isolated rendering are covered; real browser interaction and country-specific UX require manual review before release. No live browser mutations were performed.
