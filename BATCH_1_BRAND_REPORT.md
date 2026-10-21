# PropBank — Brand and navigation, Batch 1

**Implemented locally; stopped for review before Batch 2.** No deployment, backend changes or production data changes were made by this batch.

## Identity and completed components

- Original SVG mark: two offset architectural boundaries with an open threshold. It works in monochrome and uses `currentColor` in the accessible wordmark component. PropBank remains the brand name.
- Chalk/Basalt navigation and footer, Limestone dividers and restrained Oxidized Clay interactions. Mineral Sage and accessible semantic colors are available as additive `--pb-*` tokens.
- Manrope 400/500/600 for the redesigned UI; Instrument Serif 400 for selected editorial moments. `next/font` self-hosts both. Font variables are declared on HTML, but **font families are applied only within redesigned components**.
- Desktop navigation now makes Buy/Rent/Sell immediately available alongside all existing workspace/contact destinations. Profile information and logout remain connected to their original handlers.
- Mobile/tablet navigation uses a locally styled Radix dialog with focus trapping, Escape dismissal, focus return, route dismissal and scrollable content. Existing role/route permissions are unchanged.
- Footer uses an editorial introduction, contact directory and fine divisions. All existing destinations, contact actions and back-to-top behavior remain available. Newsletter/social controls retain their explicit unavailable states.
- Matching SVG favicon, PNG app/apple icons, maskable icon, ICO fallback and updated PropBank manifest/metadata. Legacy hero icon files were deliberately retained.

## Locked hero protection

Before changing the root layout, full homepage baselines were captured at **1440, 768 and 390 pixels**, with About-content baselines at desktop/mobile widths.

Dependencies audited and retained:

- `HeroSection.tsx`, `LeftHeroSection.tsx`, `RightHeroSection.tsx`, `GradientSpotlight.tsx`.
- `LandingPage.tsx`, `useLandingProperties.ts` and existing settings/navigation handlers.
- `src/index.css`: legacy font stack, reset/body styles, gradients, shadows, color variables and utilities.
- `tailwind.config.ts`: container sizing, breakpoints, theme variables and generated hero utilities.
- `/assets/hero-realestate.jpg` and `/icons/icon-512.png` (the latter appears inside the hero).
- Root flex wrappers and inherited body typography. Header content height remains the original `5rem` plus its one-pixel border: **81px at the baseline font size**.

**PASS:** All 10 protected files/assets retain their original SHA-256 hashes. Full hero pixels compare with **zero differing pixels** at all three widths, using crops from the original pre-change full-page images. Geometry, inherited font, heading size and heading color also match. No hero JSX, photography, text, colors, spacing, animation or handler was edited. New font/token declarations do not replace legacy values.

## Files created / modified

| Area | Files |
| --- | --- |
| Foundation — new | `src/styles/brand-tokens.css`, `brand-fonts.ts` |
| Brand — new | `src/features/brand/BrandLogo.tsx`, `BrandLogo.module.css` |
| Navigation — modified | `SiteHeader.tsx`, `DesktopNav.tsx`, `MobileNav.tsx`, `UserMenu.tsx` under `src/features/navbar/` |
| Navigation — new | A separate matching `.module.css` for each of those four components |
| Footer | Modified `src/features/footer/SiteFooter.tsx`; new `SiteFooter.module.css` |
| Metadata/assets | Modified `src/app/layout.tsx`, `public/manifest.webmanifest`, `public/favicon.ico`; new `public/brand/propbank-symbol.svg`, `propbank-32.png`, `propbank-180.png`, `propbank-192.png`, `propbank-512.png`, `propbank-maskable-512.png` |
| Verification | New `playwright.brand.config.ts`, `tests/brand-lock.spec.ts`, `tests/brand-navigation.spec.ts`, baseline snapshots and `brand-batch-1/` evidence. Existing logout regression now waits for cookie cleanup and pending intercepted requests before teardown. |

Each of the six redesigned feature components has its own CSS Module. New shared CSS contains tokens only; there are no new broad element selectors, `!important` rules, `:global()` overrides or inline styles. Redesigned elements do not combine conflicting Tailwind and Module declarations. Legacy global CSS was not deleted or rethemed.

## Actual verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | **PASS**, exit 0 |
| `npm run build` | **PASS**, exit 0; compilation, TypeScript and 32 static pages |
| `npm run test` | **PASS** — 159 tests: **154 passed, 0 failed, 5 skipped** |
| `npx playwright test --config=playwright.brand.config.ts` | **PASS — 16 passed**, including hero/About comparisons, navigation, footer, account/logout and icon assets |
| Existing guest browsing and responsive page checks | **PASS — 4 passed** at desktop/tablet/mobile widths |
| Existing logout/cache regression, focused rerun | **PASS — 1 passed** |
| Protected-source/geometry checks | **PASS** — 10 unchanged hashes and three matching geometry records |
| `git diff --check` | **PASS**, existing line-ending warnings only |

Existing regression commands:

```text
npx playwright test --config=playwright.acceptance.config.ts --grep "logging out clears|guest browses limited|client flows fit"
npx playwright test --config=playwright.acceptance.config.ts --grep "logging out clears"
```

Initial browser runs exposed test-capture/teardown issues: footer crops outside the viewport, an incomplete tall-hero crop, and session requests still in flight when tests ended. Captures now cover the full element; hero expectations were cropped from the saved **original** full-page baseline, not regenerated from the redesign. Session/logout tests wait for actual cookie responses and teardown completion. No functional assertions or checks were disabled. The initial existing regression run had 4 passes and 1 teardown failure; the corrected focused logout regression passed. Final Batch 1 suite: 16/16 passed.

## Visual/accessibility observations and impact

- Reviewed desktop footer and mobile navigation screenshots. Navigation fits at 320, 390, 768, 1024 and 1440px without document overflow; footer layout adapts at desktop/tablet/mobile widths.
- Visible focus outlines, named dialogs/navigation, keyboard operation, active-route indication, reduced-motion styling and mobile touch targets are present. Primary text contrast: Slate/Chalk **6.35:1**, Ink/Chalk **13.39:1**, Chalk/Clay **4.69:1**. This is targeted testing, not a complete WCAG/screen-reader certification.
- Header/footer appearance intentionally changes across routes. Other page-specific styles and shared UI primitives were not changed. About content baseline pixels match; existing form/dashboard overflow checks pass. This does not claim every page has received a full visual audit.
- Root metadata changes installed-app/tab identity and browser theme color. New self-hosted font assets add preload/network cost; production performance was not benchmarked. Hero inheritance remains unchanged.
- Existing contact destinations, including the placeholder-looking phone number, were preserved and should be confirmed by the client before release. No newsletter/social integration was added.
- Five Go-reference tests remain skipped because their original reference sources are unavailable. Live integration/staging blockers from Phase 3A are unchanged; browser tests here use isolated API/auth/database fixtures.

## Review evidence

- Before/after full pages: `brand-batch-1/baseline/home-{1440,768,390}.png` and `brand-batch-1/after/home-{1440,768,390}.png`.
- Desktop/mobile navigation: `brand-batch-1/after/navigation-{1440,1024,768,390,320}.png`.
- Footer: `brand-batch-1/after/footer-{1440,768,390}.png`.
- Protection manifest/results: `brand-batch-1/protected-files.json`, `brand-batch-1/protection-results.json`.

Development screenshots may include Next.js's development indicator. Batch 2 and hero redesign have not started.
