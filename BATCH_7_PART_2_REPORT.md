# PropBank — Batch 7 Part 2: Property flow polish

## Scope
- Updated `SelectPropertyType` to give owners and tenants a clear first step with a readable responsive layout, prominent keyboard-accessible native buttons, and unchanged navigation to `/add-property?type=...&as=...`.
- Updated `PropertyTypeSelector` from legacy elevated cards and gradients to three editorial, native-button rows; kept residential/commercial/industrial selection callbacks.
- Updated `ArchivedProperties` with clearer workspace title, responsive image-led archival rows, accessible per-property actions, no legacy orange card-heavy styling, and an empty state. Existing query, permissions, view/edit/unarchive handlers are unchanged.
- Added three component-local CSS Modules; no global theme/hero changes.

## Files changed
- `src/features/properties/SelectPropertyType.tsx` and `SelectPropertyType.module.css`
- `src/features/properties/PropertyTypeSelector.tsx` and `PropertyTypeSelector.module.css`
- `src/features/properties/ArchivedProperties.tsx` and `ArchivedProperties.module.css`

## Verification
- PASS: TypeScript transpileModule reports zero syntax diagnostics for the three edited TSX files.
- PASS: Six locked hero/style/image files matched SHA-256 against Batch 7 Part 1 cumulative archive.
- NOT RUN: project-wide typecheck, build, functional and responsive browser tests (source archive omits installed node_modules).

## Limitations
- This is a focused Batch 7 Part 2 polish pass. It is not a full WCAG or route-by-route responsive signoff.
- No real provider operations or deployment.
- Run `npm run typecheck`, `npm run build`, `npm run test`, browser tests after applying the final ZIP.
