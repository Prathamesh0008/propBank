# PropBank Batch 2 — Homepage below hero (first delivery)

## Implemented
- Redesigned the existing homepage search section with a focused search bar, buy/rent/all controls, property categories, collapsible advanced filters and clear action. All existing state callbacks and search handling remain attached.
- Rebuilt homepage property presentation around larger photographs, typography, compact property facts, price, the existing details dialog and enquiry action. Existing infinite scroll / load-more callbacks remain.
- Reworked the quick enquiry section into an editorial split layout, keeping the existing GeneralInquiryForm unmodified (same fields and submit behavior).
- Created separate scoped CSS Modules for all three components. Existing global CSS and brand tokens are unchanged.

## Locked hero
The HeroSection, LeftHeroSection, RightHeroSection, GradientSpotlight, LandingPage and hero assets were not edited. No global styles or root layout changed in this batch.

## Limitations / further work
- Source-level validation only: dependencies (`node_modules`) are omitted from the user-uploaded clean ZIP; Next.js build, TypeScript and Playwright were not run in this container.
- The `/search` results page, Buy/Rent listing journey and other pages remain for the next focused Batch 2 delivery.
- Placeholder images already present in the legacy component remain fallbacks only. No new property data was fabricated.

## Local verification commands
Run `npm run typecheck`, `npm run build`, `npm run test` and the existing browser tests on your workstation after applying the changes. Compare homepage hero visually at desktop and mobile sizes.
