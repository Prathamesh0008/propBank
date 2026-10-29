# Add Property form audit

## Field decisions

| Field group | Owner intake | Tenant intake | Decision and stored contract |
| --- | --- | --- | --- |
| Category | Selected before the form | Selected before the form | Not repeated. `propertyType` and `propertyCategory` remain server-validated aliases for compatibility. |
| Property type | Required, category-aware | Required, category-aware | `structure` now describes the physical type: apartment/house/villa/plot, office/shop/showroom/plot, or warehouse/factory/shed/plot. Legacy values remain accepted and editable. |
| Residential layout | Residential non-plot only | Residential non-plot only | `configuration` is Studio/BHK. It is no longer a second commercial or industrial type selector. Existing non-residential records with an empty configuration remain editable. |
| Building / Society name | Optional | Optional | Retained as `buildingName`; it identifies the real project, society, tower, or building and is distinct from the title. |
| Property title | Required | Required | Retained as `propertyTitle`, mapped to stored `title`; this is the user's recognizable portfolio label. Label and example were clarified. |
| Purpose | Rent, sale, or private management | Fixed rented tenancy | Stored as `listingType`. Management intake has no empty pricing panel and does not become public through the form. Existing moderation and visibility checks remain authoritative. |
| Unit and floor | Category-aware unit label; floor omitted for plots | Same | Stored as `unitNumber` and `floor`. Hidden values remain in form state while choosing a structure, but irrelevant configuration is normalized at submission. |
| Address | Required | Required | Stored as `location`. |
| Areas | Carpet and built-up for built property; plot area for plot/land | Same | Each value and its unit are collected once. Existing keys (`carpetArea`, `constructedArea`, `plotArea` and unit fields) are retained. `areaUnit` mirrors carpet unit for legacy readers. |
| Asking/final rent | Asking rent for available owner listings; finalized rent for occupied owner and tenant intake | Finalized rent | Both use `monthlyRent`; the label reflects the business state. The unused creation `expectedRent` control remains removed. Property Hub ledger `expectedRent` remains an independent monthly tracking record. |
| Sale price and buyer | Sale only; buyer only when already sold | Not applicable | Retained with existing conditional rules. |
| Current tenant | Owner rent + already rented only | Authenticated tenant is recorded server-side | Owner contact, emergency contact, employment, spouse and agreement data remain conditional and preserve tenancy/invitation workflows. No account is linked from typed contact data. |
| Deposit, due day, agreement, escalation and schedule | Occupied rent conditions as applicable | Active tenancy | Independent financial and agreement fields retained. Year 1 continues to use `monthlyRent`; additional periods continue to use `rentSchedule`. |
| Notice and lock-in | Already-rented property only | Active tenancy | Retained because they drive agreement workflows. |
| Condition, furnishing and maintenance | Applicable property operations | Applicable property operations | Retained. Sale-specific project condition and possession date conditions remain separate. |
| Images and notes | Optional | Optional | Existing private/public storage and listing moderation behavior is unchanged. Management copy no longer promises public display. |
| Reported owner | Not applicable | Required name/entity and valid Indian contact; email optional | Kept separate from authenticated ownership. Existing verified-email discovery and administrator evidence approval remain unchanged. |
| Agent owner email | Agent owner intake only | Not applicable | Retained for the existing legal-owner authorization path. |

## Removed creation noise

- Duplicate category and area-unit selectors.
- Commercial/industrial configuration choices that repeated the property type.
- Empty pricing prompt for private-management intake.
- Invisible `primaryNo`, `ultNo`, and `tenantMonthlyIncome` defaults that had no rendered control.
- Invisible pre-leased creation defaults and unreachable client validation. Backend and stored legacy fields were not removed.

No database migration is required. Existing property IDs and stored records are unchanged.
