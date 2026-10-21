# PropBank — Batch 4, Part 1

Date: 2026-10-21. Local UI pass only. No backend, API, auth, data or cloud changes.

## Scope

- Manage Property: scoped `ManageProperty.module.css` replaces prominent card-style framing with refined separators, quieter surface, clearer workspace heading and property rows. Existing filters, role-specific tabs, property actions, React Query state and handlers are retained.
- Property 360: `PropertyHub.module.css` adds section navigation, typographic hierarchy, clean separators, readable action list and quiet portfolio metrics. Ledger, documents, owner/tenant relationships, service history, visits, negotiation and admin-note handlers are retained.
- Enquiry inbox: `EnquiryInbox.module.css` makes the broker/admin assignment interface simpler and more readable, preserving version checks, private notes, assignment and status updates.
- Corrected stale document title `ShoPROP` to `PropBank` on Manage Property.
- All styling is locally scoped using CSS Modules. No global stylesheet updates.

## Verification

- PASS: TypeScript `transpileModule` TSX syntax diagnostics for all three edited components (zero errors).
- PASS: Homepage hero component/source and hero photo byte comparison against Batch 3 cumulative workspace (unchanged).
- PASS: Cumulative ZIP and changed-files ZIP created and readable.
- BLOCKED: `npm run typecheck`, build and browser/regression checks (clean source contains no installed dependencies); these must run in user environment before deployment.
- No live app render or screenshot visual comparison was performed.

## Next

Batch 4 Part 2: rental and agreement workflows, tenant forms, document/service screens. Continue preserving the locked homepage hero and handlers.
