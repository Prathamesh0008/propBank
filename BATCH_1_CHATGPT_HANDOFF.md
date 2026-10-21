# PropBank — Batch 1 navigation/footer refinements

Changes: simpler public links; account-dependent workspace/admin links; mobile menu sections; clearer desktop nav typography; footer contact CTA instead of unverified contact details and unavailable newsletter/social UI; resets previous account role on auth change.

Homepage hero source files, images, and legacy global CSS remain untouched. No backend/API edits.

Testing: structural/static inspection and comparison of locked files with the uploaded baseline ZIP passed. `npm run typecheck`, `npm run build`, and Playwright could not be executed in this workspace because `node_modules` is not included and dependencies were not installed. Run these on your PC.

Quick checks on your PC:
1. `npm run typecheck`
2. `npm run build`
3. `npm run test`
4. Test guest vs individual/agent/admin desktop/mobile navigation, logout, footer, and hero visual comparison.

Do not deploy until normal live integration blockers are resolved.
