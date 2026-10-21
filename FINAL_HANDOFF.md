# PropBank — Final consolidated source handoff

## Scope
This source package combines the local UI changes through Batch 7 Part 2, including brand/navigation, homepage content below the preserved hero, property search and detail views, property forms, management and tenant/broker views, admin operations, information pages, and additional layout refinement. It retains the Next.js API and service sources supplied with the project.

## Verified in this packaging session
- Latest cumulative ZIP integrity: PASS (406 archived entries; no corrupt ZIP members).
- TS/TSX/JS/JSX parser check of `src/`: PASS, 267 files parsed, zero parse errors.
- Locked homepage hero code/assets SHA-256 comparison against the Batch 6 cumulative archive: PASS for six matching paths.
- No `.env` filename present in the imported archive.

## NOT verified here
- `npm run typecheck`, `npm run build`, `npm run lint`, `npm run test`, Playwright and visual browser rendering. Dependencies are not installed in this environment and these checks have not been run for the consolidated UI changes.
- Real Firebase/Firestore, live R2 authenticated private file delivery, Resend email delivery, deployed cron jobs, and production access controls.
- Cross-page visual responsiveness and accessibility compliance. These require browser review; source-level syntax does not establish them.

## Critical outstanding deployment prerequisites from earlier technical audit
- Create/verify Firestore composite indexes for `visits(userId ASC, visitDate ASC)` and `inspection_reports(propertyId ASC, createdAt DESC)` and `(userId ASC, createdAt DESC)` on the intended Firebase project.
- Verify deployed R2 public/private bucket policies and confidential historical URL migration/revocation separately.
- Configure and isolate email recipients and verify deployment schedules before sending live messages.
- Validate all important business workflows with controlled test accounts before production use.

## How to run on your Windows PC
1. Extract into a *new folder*, not over a working copy with uncommitted changes.
2. Restore your existing environment variables securely; never place credentials in Git or a public archive.
3. `npm ci`
4. `npm run typecheck`
5. `npm run lint`
6. `npm run build`
7. `npm run test`
8. `npx playwright test --config=playwright.acceptance.config.ts` (browser dependencies may need installing).
9. `npm run dev` and visually review guest, owner, tenant, broker and admin routes on mobile/tablet/desktop.

Do not treat this archive as production-certified until these checks pass and live configuration blockers are resolved.

## Design lock
The current homepage hero is intentionally retained pending client approval. Do not modify its components, imagery, behavior or styling through the redesign process.
