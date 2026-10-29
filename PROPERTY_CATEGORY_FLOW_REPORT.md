# Add Property category selection

Both creation forms now use the category selected in the preceding step, without another editable category dropdown. Owner and tenant submissions explicitly retain that category in both `propertyType` and `propertyCategory`.

## Behavior

- The existing Add Property page validates `type` before rendering either form. Valid category links, including legacy owner links without `as`, retain their behavior. Missing, invalid or ambiguous category values redirect to the existing selector with the owner/tenant mode and administrator owner context preserved.
- Forms are keyed by category so navigating between category URLs cannot retain a previous category's form state or structure choices.
- Owner creation passes a fixed category into the shared fields component. That mode removes the category control entirely and filters Property Type / Structure. Edit Property does not use that mode: its category control and existing legacy values remain available.
- Tenant creation also removes its category dropdown and uses the same structure definitions. Existing owner configuration choices remain category-specific.
- Residential structures: Flat, Bungalow. Commercial: Office, Shop. Industrial: Unit, RCC Shed, Land.
- Submission handlers derive category metadata from the validated page category, overriding stale or manipulated form values. The API independently validates the category enum, matching category/type metadata and any explicitly supplied structure. Legacy category-only API payloads remain supported and derive canonical category metadata.
- API category verification is applied to creation; the existing authorized editing workflow remains supported. Authentication, ownership verification, invitations and tenant linking are unchanged.
- Existing grids naturally reflow after removing the controls. The final area-unit control spans its row in creation mode to avoid an empty grid cell; Edit Property layout is retained. No global CSS or unrelated pages were redesigned.
- The legacy `/tenant-property` route previously passed the invalid category `tenant`. It now redirects valid category links into the canonical tenant Add Property route, or returns missing categories to tenant category selection.

## Files changed

- `src/lib/property-category.ts` (new shared category/structure definitions)
- `src/app/(protected)/add-property/page.tsx`
- `src/app/(protected)/tenant-property/page.tsx`
- `src/features/properties/AddPropertyForm.tsx`
- `src/features/properties/TenantPropertyForm.tsx`
- `src/features/properties/ClientPropertyFields.tsx`
- `src/lib/server/services/properties.ts`
- `tests/add-property-navigation.test.cjs`
- `tests/property-category.test.cjs` (new)
- `tests/property-category-ui.test.cjs` (new)
- `PROPERTY_CATEGORY_FLOW_REPORT.md` (new)

The existing scoped CSS files, selection page design, Edit Property component and other uncommitted work were preserved.

## Verification

- Focused run: **94 passed, 0 failed**.

  ```text
  node --test tests/property-category.test.cjs tests/property-category-ui.test.cjs tests/add-property-navigation.test.cjs tests/property-runtime-repair.test.cjs tests/relationship-links.test.cjs tests/owner-verification.test.cjs tests/relationship-invitation-email.test.cjs tests/admin-property-operations.test.cjs tests/property-product.test.cjs
  ```

- After the final layout adjustment, all six category UI/handler tests passed again.
- Tests cover both modes across all categories, actual form submission handlers, structure/configuration choices, canonical persistence, invalid/conflicting API metadata, navigation/deep links, redirects, legacy tenant entry and editable category controls/API updates.
- `npm run typecheck` was run. It remains blocked by the same four unrelated `compact`-prop errors in `src/app/blog/page.tsx:6`, `src/app/services/page.tsx:6`, `src/app/support/page.tsx:6` and `src/app/terms/page.tsx:6`. Those public pages and their shared footer-info component were left untouched. No category-flow type errors remain.
- `git diff --check` passed.

No Playwright, full suite, deployment or Git push was performed. Backend tests used isolated fixtures; no live records or real emails were created.
