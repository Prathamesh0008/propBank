# Batch 6 — Public informational pages

Updated About, Contact, FAQ and the shared informational-page renderer used by Services, Blog, Support, Privacy and Terms. Each has scoped CSS Modules.

- About: removed illustrative, unverified named property developments and replaced them with factual platform-capability content.
- Contact: retained the existing GeneralInquiryForm and its submit behavior; replaced remote hero photography and old styling with scoped editorial layout.
- FAQ: expanded the questions to reflect current listing moderation and enquiry workflows, retained accessible expand/collapse controls, removed a nonfunctional Learn More button and added a working Contact link.
- Services, Blog, Support, Privacy and Terms: re-presented existing route-specific content through an accessible, border-led editorial renderer and meaningful linked next actions; their legal text was not rewritten or legally reviewed. Blog remains a static informational landing page, not a CMS.
- Design: Manrope/Instrument Serif and Mineral/Oxide tokens; no new global CSS; no generic nested card layouts.
- Homepage hero: unmodified; compared with previous cumulative archive.

## Verification

- PASS: TypeScript TSX parser for four modified TSX files.
- PASS: previous hero source/asset bytes unchanged.
- PASS: ZIP archive integrity validation.
- NOT RUN: full `npm run typecheck`, `npm run build`, `npm run test`, Playwright; node_modules not included in source archive.

## Before production

- Have the client approve legal/privacy wording and contact details.
- Verify redesigned responsive layouts and the enquiry form with a running browser.
- Resolve previously identified Firestore indexes, storage historical privacy, and live integration blockers.
