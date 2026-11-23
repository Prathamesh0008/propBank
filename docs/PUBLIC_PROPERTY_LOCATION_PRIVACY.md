# Public property location privacy

Implemented locally on feature/public-property-location-privacy from ff887b42f4a8c65b90d9166765193bf167a9b3f5.

## Server policy
- Public property list, search and detail responses, regardless of login, use one allowlisted projection in contracts.ts. The shared serializer also applies it when there is no authorized relationship role (including buyer/visitor).
- Public geography uses only explicit city, district and state. Opaque address/location text and the combined streetLocality field are never parsed or published. If no coarse fields exist, use "Location available on request".
- Unit, building/society, wing/floor/door identifiers, postal code, complete structuredAddress, arbitrary nested objects and map coordinates/links are omitted.
- Titles can be building names and descriptions can repeat full addresses. Both are withheld pending an explicit public-content approval workflow: use a category label and empty description. No new approval fields/workflows are introduced.
- Search still uses the existing bounded cursor query and listing filters, but cannot match private street/unit/building data. Public title search uses the safe label.
- Owner/admin and existing authorized active tenancy/submitting-agent access remain subject to existing relationship authorization; their internal address data and agreement/rent workflows are unchanged. Enquiries confer no new access.

## Other disclosure paths
- Enquiry receipts do not echo the internal property address/title. Stored admin records and admin email context retain the authoritative information.
- Customer negotiation responses (including historical records) and customer Property Hub action labels suppress building titles. Newly staged negotiation notices use a neutral label; recipient eligibility/idempotency remain unchanged.
- Visit requester email context uses approximate geography. Admin/owner context retains full information. No reminder schedule or agreement logic changed.
- Public page metadata currently is generic; no property JSON-LD, map coordinates or property-specific server metadata source exists. Client property titles derive from the redacted API response.

## Photographs and caching
- Public covers use existing managed media routes or opaque legacy proxy references; original object names/URLs are not returned. Only already publishable legacy covers are anonymous. Private images/evidence retain authorization.
- Public property image responses decode/re-encode to WebP without EXIF/XMP/IPTC metadata or original filenames; decoding failures fail closed. Sharp 0.35.5 is now a direct dependency (already present through Next). Images are processed on demand, not enumerated or rewritten in storage.
- API and media responses retain private, no-store headers. Property detail query keys already include the current UID/public scope.
- Listing/search projections add zero reads. On-demand legacy cover delivery now requires one property-document authorization read rather than fetching a raw CDN URL; managed images retain their existing binding checks. No scans or new indexes.

## Required release review / limits
- This local patch cannot revoke historical public URLs, previously sent notices, cached responses or photos already downloaded. Review historical CDN/object access and cache purging separately before claiming complete production containment. No such production operation was performed.
- StreetLocality combines exact street and area: publishing a separate verified locality needs a future explicit data contract; do not guess it.
- Building names/signage visibly photographed in image pixels cannot be automatically hidden by stripping metadata. Review approved cover photos for visible location clues. Unknown/unapproved external legacy media hosts remain unavailable rather than being fetched indiscriminately.
- No live browser/customer/email checks were performed. All mutation tests use synthetic in-memory fixtures.

## Exact files changed
- src/lib/public-property-location.ts (new)
- src/lib/server/services/contracts.ts
- src/lib/server/services/properties.ts
- src/lib/server/services/media.ts
- src/lib/server/services/notifications.ts
- src/lib/server/services/negotiations.ts
- src/lib/server/services/property-hub.ts
- src/lib/server/services/visits.ts
- package.json
- package-lock.json
- tests/public-property-location-privacy.test.cjs (new)
- tests/fixtures/native-server.cjs
- tests/listing-approval.test.cjs
- tests/negotiations-reminders.test.cjs
- tests/storage-security.test.cjs
- docs/PUBLIC_PROPERTY_LOCATION_PRIVACY.md (new)

## Verification
25 new privacy tests passed. The latest results across the focused runs also cover 92 existing listing-approval, owner-directory, storage-security, Firestore read-budget, negotiation/reminder and enquiry-assignment regressions: 117 distinct tests passing, zero unresolved failures, zero test skips. This is not a full-suite run. Affected files were rerun after expectation/fixture corrections. TypeScript --noEmit --incremental false and git diff --check passed. No live application records, emails, Cron jobs or deployment settings were accessed or changed. The primary workspace's .gitignore, next-env.d.ts and firebase-debug.log changes remain untouched.

## Focused browser acceptance
Real local Chrome/CDP smoke checks passed using the application frontend and actual server route handlers backed by synthetic in-memory fixtures. Homepage cards, search results, anonymous/ordinary authenticated details, and owner/admin details were checked. Public rendered text, metadata and API bodies contained none of the synthetic unit/building/street/PIN/coordinate sentinels; generic public titles and full authorized owner/admin addresses were verified. Four public photo deliveries were decoded and checked for stripped metadata. Mobile detail layout was checked at 390px; desktop at 1440px. There were 46 intercepted fixture API requests, no external service deliveries and no production mutations. External access was blocked at browser and server boundaries. Temporary browser/server artifacts remain outside the repository. The primary server/workspace was not changed. This does not verify historical production photos, cached responses or previously published URLs.
