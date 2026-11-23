# Public property location policy — unit identifiers only

This document describes the local implementation in the original propBank workspace. No production configuration or stored records were changed.

## Public projection
- Property Name, building/society names, streets/localities, city, district, state, country and postal code may be public. The previous building-name keyword/English-vocabulary rejection is removed.
- Exact flat, house, room, unit and door identifiers remain private. Public APIs use one allowlisted property projection; neither unit fields nor the full structuredAddress object are returned.
- Structured non-unit components are screened individually and formatted without duplicate separators/components. Canonical stored addresses and authorized owner/admin responses remain unchanged.
- Legacy address text is split only at existing comma/semicolon/newline boundaries. Each whole fragment is accepted or omitted. Ambiguous unit-bearing fragments are not repaired using regex replacement, and missing fields are not guessed.
- Names and descriptions containing unit identifiers are withheld as a whole. Safe names and descriptions retain their text. An unsafe name uses the existing category fallback.
- Screening uses explicit unit labels, known stored unit identifiers (including spacing/punctuation/case variants), and conservative numeric-context checks. No automated classifier can infer arbitrary encoded prose; ambiguous numeric fragments fail closed.
- Anonymous users and unrelated authenticated visitors receive the same projection. Listing approval, private management properties and relationship authorization remain enforced.

## Other paths
- Search matches only the public projection: names, building/street/area/postal components and existing listing filters. It cannot search the private unit fields. Existing bounded cursors and query limits are unchanged.
- Enquiry receipts use the same public name/address and omit unit-bearing free-text fragments. Internal admin records remain authoritative and retain full authorized information.
- Prospective-visitor notices and newly staged visit reminders screen unit-bearing title/detail fragments. Authorized admin/owner information remains complete. No agreement, rent calculation, tenancy, scheduler, recipient or idempotency logic changed.
- Generic page metadata and property-derived titles use the public API data; no full structured address is embedded in public metadata.
- Existing private-document/evidence checks and media delivery remain unchanged. Public image responses still use opaque references, generic filenames and metadata-stripped bytes.
- API/media cache headers remain private, no-store. Previously sent messages, published historical links and downloaded/cached copies cannot be revoked by this local code change.

## Files for this policy update
- src/lib/public-unit-privacy.ts (new shared whole-fragment classifier)
- src/lib/public-listing-title.ts
- src/lib/public-property-location.ts
- src/lib/server/services/contracts.ts
- src/lib/server/services/notifications.ts
- src/lib/server/services/visits.ts
- src/lib/server/services/reminders.ts (visit notice text only)
- tests/public-listing-title.test.cjs
- tests/public-property-location-privacy.test.cjs
- docs/PUBLIC_PROPERTY_LOCATION_PRIVACY.md

## Local verification
Focused synthetic tests cover structured/legacy addresses, names, unit variants, postal codes, descriptions, enquiries, visits, owner/admin access, moderation, media restrictions and reminder idempotency/escaping. No full suite was run.

On localhost:8080, read-only checks and browser checks verified all three existing names are displayed: heights, Demo — Sahyadri Heights and Kaveri CHS. Public API name/location fields were checked against the stored unit identifiers using narrow read-only document projections, without logging those identifiers. Browser checks used mocked auth state with actual read-only local public API responses; no authenticated production mutations were performed. Four unit-free address/title fixture variants and internal full-address behavior are covered by the automated tests. No real emails or Cron jobs were invoked.

Final targeted verification covers 89 distinct checks across the focused runs (33 unit/title/enquiry checks, 25 property privacy checks, 20 listing moderation checks and 11 negotiation/reminder checks), with no unresolved failures. TypeScript and git diff --check passed. No full regression suite was run.
