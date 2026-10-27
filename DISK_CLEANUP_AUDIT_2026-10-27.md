# PropBank disk cleanup audit ? 27 October 2026

Branch: `feature/property-management-improvements`.

Before: 7,496,528,014 bytes (7.496528 GB). Logical file sizes; directory junctions were not followed.

## Outcome

No existing files deleted. Cleanup was blocked by automatic approval review. The verified exact path `.next-acceptance-test` was rejected with ?blocked by policy?. No bypass or live-service operation was attempted.

## Measured categories

| Category | Before | Decision |
| --- | ---: | --- |
| `node_modules` | 781.162 MB | Preserved; reinstalling restores its size. |
| `.next` | 744.261 MB | Preserved; active dev server on port 8080 and next-env.d.ts references its generated types. |
| `.next-acceptance-test` | 2256.444 MB | Verified inactive generated output; deletion blocked. |
| `.next-backend-build` | 122.243 MB | Verified generated output; deletion blocked. |
| `.next-native-test` | 240.438 MB | Verified inactive generated output; deletion blocked. |
| `.next-email-verification` | 25.299 MB | Verified inactive generated output; deletion blocked. |
| `.cache` | 43.199 MB | Preserved; Go build cache is tracked in Git. |
| `test-results` | 3.303 MB | Verified test-generated screenshots and last-run metadata; deletion blocked. |
| `.git` | 3264.177 MB | Protected; no garbage collection or history changes. |
| `public` | 1.789 MB | All assets preserved. |
| `.firebase-emulator-data` | 0.005 MB | Protected persisted emulator data. |
| Audit/report directories | 7.947 MB | All preserved; root documentation also preserved. |
| Firebase export directory | 0 bytes | Empty export directory preserved. |
| `tsconfig.tsbuildinfo` | 448,743 bytes | Generated/recreated by typecheck; preserved. |

## Twenty largest directories before cleanup

| Directory | Bytes |
| --- | ---: |
| `.git` | 3,264,177,345 |
| `.git/objects` | 3,263,823,373 |
| `.next-acceptance-test/dev` | 2,256,443,828 |
| `.next-acceptance-test` | 2,256,443,828 |
| `.git/objects/18` | 2,240,614,353 |
| `.next-acceptance-test/dev/cache` | 2,081,672,390 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2` | 2,081,672,286 |
| `.next-acceptance-test/dev/cache/turbopack` | 2,081,672,286 |
| `node_modules` | 781,161,946 |
| `.next` | 744,261,096 |
| `.next/dev` | 744,260,241 |
| `.next/dev/cache` | 515,691,860 |
| `.next/dev/cache/turbopack/v16.4.0-e273d5b2` | 515,265,173 |
| `.next/dev/cache/turbopack` | 515,265,173 |
| `.next-native-test/dev` | 240,438,105 |
| `.next-native-test` | 240,438,105 |
| `.git/objects/e4` | 239,673,572 |
| `node_modules/next` | 192,532,111 |
| `node_modules/next/dist` | 192,267,301 |
| `.next/dev/server` | 172,765,042 |

Nested directory totals overlap and must not be added together.

## Twenty largest files before cleanup

| File | Bytes |
| --- | ---: |
| `.git/objects/18/64cfc8fe44f4b22dd91ffb643910c42c991330` | 2,240,586,716 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000744.sst` | 250,605,109 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000742.sst` | 250,016,858 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000751.sst` | 249,368,547 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000753.sst` | 248,980,439 |
| `.git/objects/e4/05a2f8be597e55ff5782014e7d573d19914fda` | 239,465,877 |
| `.next/dev/cache/turbopack/v16.4.0-e273d5b2/00000439.sst` | 238,305,108 |
| `.git/objects/14/37f03dd280808ac8bb344276d26a7814710b32` | 151,649,691 |
| `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` | 110,263,296 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000846.sst` | 94,601,641 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000845.sst` | 94,012,897 |
| `.next/dev/cache/turbopack/v16.4.0-e273d5b2/00000442.sst` | 93,774,492 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000847.sst` | 92,243,354 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000878.sst` | 90,832,699 |
| `.git/objects/ca/07c1f75e8537a81e90c8f8561cfd6166c13bcd` | 81,455,396 |
| `.next-native-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000031.sst` | 77,932,706 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000750.sst` | 72,533,639 |
| `.next/dev/cache/turbopack/v16.4.0-e273d5b2/00000601.sst` | 60,951,333 |
| `.git/objects/d6/b3db0bec15f2e7200247591bc114466f848790` | 59,372,045 |
| `.next-acceptance-test/dev/cache/turbopack/v16.4.0-e273d5b2/00000749.sst` | 55,295,274 |

## Source review ? no removals

Static TypeScript import, re-export and literal dynamic-import analysis found these candidates. This does not prove they are unused by tests, tooling, manual scripts or external consumers.

- `src/App.css`
- `src/common components/GradientSpotlight.tsx`
- `src/features/admin/AdminEmailDeliveries.tsx`
- `src/features/admin/AdminPropertyOperations.tsx`
- `src/features/landing-page/LeftHeroSection.tsx`
- `src/features/landing-page/RightHeroSection.tsx`
- `src/features/properties/PropertyCard.tsx`
- `src/features/search/CommercialPropertySearchForm.tsx`
- `src/features/search/PropertySearchForm.tsx`
- `src/features/search/SearchBar.tsx`
- `src/lib/auth.ts`
- `src/services/serviceApi.ts`
- `src/ui/accordion.tsx`
- `src/ui/alert-dialog.tsx`
- `src/ui/alert.tsx`
- `src/ui/aspect-ratio.tsx`
- `src/ui/carousel.tsx`
- `src/ui/chart.tsx`
- `src/ui/collapsible.tsx`
- `src/ui/command.tsx`
- `src/ui/context-menu.tsx`
- `src/ui/drawer.tsx`
- `src/ui/input-otp.tsx`
- `src/ui/menubar.tsx`
- `src/ui/navigation-menu.tsx`
- `src/ui/pagination.tsx`
- `src/ui/progress.tsx`
- `src/ui/radio-group.tsx`
- `src/ui/resizable.tsx`
- `src/ui/sidebar.tsx`
- `src/ui/slider.tsx`
- `src/ui/table.tsx`
- `src/ui/toggle-group.tsx`
- `src/ui/use-toast.ts`

Potential old branding assets: `public/images/logo.png`, `public/images/pb1_logo.png`, `public/images/pb_footer.png`. Preserve pending product review. Conventional assets such as robots.txt, offline.html and documentation are not classified as unused merely because they lack imports.

Possible unused imports include `CardHeader` and `CardTitle` in GeneralInquiryForm, `ImageIcon` and `Input` in PropertyDetails, and several imports in management/admin/server code. Full review details and manually invoked script candidates are in the JSON report. No source or script was changed.

The only byte-identical source pair found is `src/app/api/files/route.ts` and `src/app/api/files/[...path]/route.ts`. They are separate API routes and must remain intact.

## Protection and verification

- Compared SHA-256 hashes of 1196 pre-existing tracked files plus untracked src/public files. Changed: 0. Missing: 0.
- All existing edits, source, tests, fixtures, secrets, lockfiles, assets, exports, backups, audit evidence, screenshots and .git were preserved.
- node_modules retained. No npm ci required.
- npm run typecheck: passed.
- git diff --check: passed (only existing LF/CRLF advisories).
- No Playwright, full tests, production build, deployment, push, remote-service modification or live database operations.

Final size and net change are recorded in the JSON report and chat after both report files are written. No existing artifact was removed.
