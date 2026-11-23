# Structured address display - Phase 4

Local-only work on feature/homepage-redesign. Phases 1-3 and all unrelated dirty work remain intact. No application documents were inspected or written, no migration ran and no infrastructure changed.

## Exact files changed

- src/lib/property-address.ts
- src/services/propertyService.ts
- src/lib/server/services/contracts.ts
- src/features/admin/AdminPropertyDetailsDialog.tsx
- src/features/admin/AdminPropertyDetailsDialog.module.css
- src/features/admin/AdminServiceRequestsWorkspace.tsx
- src/features/properties/PropertyDetails.tsx
- src/features/properties/PropertyDetailsDialog.tsx
- src/features/properties/PropertyHub.tsx
- src/features/properties/PropertyCard.tsx
- src/features/properties/ManageProperty.tsx
- src/features/properties/ArchivedProperties.tsx
- src/features/landing-page/PropertiesSection.tsx
- src/features/search/SearchResults.tsx
- tests/address-format.test.cjs
- tests/property-address-display.test.cjs
- docs/STRUCTURED_ADDRESS_PHASE4.md

## Rendering policy

`formatPropertyAddress` reuses Phase 1's structured formatter and Phase 2's canonical address reader. It reads only property location fields, never tenant previous/current residential address objects. Complete canonical addresses render the recorded components in the established order, with exact case-insensitive component deduplication. City/district with the same name appear only once in the full line, while each remains available under its explicit component label.

Opaque legacy text is displayed safely without appending city/state/PIN aliases. This fixes the old Admin detail renderer, which appended geography already present in the full line. No unit, street, district or country is guessed from free text. If the legacy line is absent or contains only invalid display placeholders, explicitly recorded fields can provide a fallback. Empty canonical envelopes likewise fall back to existing explicit legacy data. Display formatting does not mutate source records.

`propertyAddressRows` returns only actually recorded components with labels for Flat / Unit Number, Building / Society Name, Street / Locality, City, District, State, PIN / Postal Code and Country. Missing values do not become fabricated rows. Admin Property Details uses its existing section and label/value styling. The prior unit row is included in the address group; other operations, sections, financial fields, navigation and lazy related-data queries remain unchanged.

Property detail pages/dialogs, owner/tenant Manage Property cards, Property Hub, archived cards, public property cards, featured cards and search results use the shared formatter. Property Hub retains its separate unit identity reference, including when a legacy address does not contain the unit. Admin service-request property summaries also clean their existing authorized address line. Admin All Properties/Rented Properties tables remain compact: no district/country/full-address columns were added. Their existing detail actions still load the authorized detail API. Moderation/review controls keep their existing behavior and use the corrected detail header.

## API and data flow

Property input callbacks -> existing structured form payload -> POST/PATCH property APIs -> existing Firestore transaction/storage -> authorized property GET -> propertyService -> Admin Property Details.

Phases 2/3 persistence and concurrency logic is unchanged. The client Property type explicitly includes structuredAddress and addressVersion. Authorized GET already supplies all eight components. Public responses still exclude the structured legacy envelope/edit version; they receive the existing formatted address/location aliases.

The response serializer now derives canonical property address/location display aliases from the same formatter when structuredAddress exists. This corrects historical aliases that may have appended city/PIN on a legacy canonical fallback, without rewriting stored data or changing search, visibility, ownership or query policy. No API fields, documents, queries or indexes were added by this phase.

## Privacy

Personal previous/current addresses remain separately stored and authorized under Phase 3 rules. Generic tenant/agent/public property responses redact them, including nested history. Public cards/details receive only existing approved public fields and do not receive original structured legacy envelopes. Owner/admin detail access is preserved. To Manage, pending moderation and Pre-Leased evidence protections are unchanged; their existing isolated regressions pass.

No personal address is used to fill a missing property location. No new private-file URL, media request or relationship lookup is introduced.

## Verification

Synthetic tests drive the actual shared address control callbacks for Residential and Commercial properties, create via the actual API, verify every stored component, fetch authorized Admin detail, render the actual Admin dialog, edit using the actual dirty-field payload helper/API, approve using the existing moderation API, and verify anonymous detail/card rendering. Existing property and personal-address regressions protect legacy persistence and privacy.

Coverage includes all eight component labels, duplicate city/district/PIN prevention, complete and partial addresses, legacy lines with combined state/PIN text, international postal values, missing/invalid display placeholders, empty canonical envelopes, personal-address isolation, immutable source records, unchanged pagination and read budgets. Existing Admin dialog tests verify zero eager related-data requests.

The broader targeted run initially passed 135/136 checks; the new display coverage caught a missed Property Hub heading replacement. It was corrected. The affected display/service-request follow-up passed all 26 checks, including one additional fallback case. Across these executions, 154 distinct targeted scenarios are verified, with no unresolved failure. TypeScript and git diff --check pass. This is not a claim of a newly executed full-project suite.

## Remaining display scope and manual review

- Historical notification message strings, emails, generated documents and uploaded files are not rewritten or reformatted in Phase 4.
- Legacy free text cannot supply separate unknown district/country fields; only existing explicit components are shown.
- Deduplication is exact component matching. Ambiguous repeated words already embedded inside one historical free-text component are not semantically parsed or guessed.
- No actual browser acceptance or screenshot verification was performed in this phase. Review desktop/mobile Admin detail layout and authorized owner/tenant/public views in an isolated environment before release.
- No production reads/writes, emails, commits, pushes or deployments occurred.
