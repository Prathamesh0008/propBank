# PROJECT OVERVIEW

> Source audit: 2026-11-06 (Asia/Calcutta). Branch `main`, commit `fa98b7e0e53d29053365be4c1a1b8230a313f686`. Static inspection only; no production database access, external service health checks, browser tests, migrations, push or deployment. ?Implemented? means a source-complete path with identifiable validation and authorization; it does not certify successful runtime operation. Historical reports are secondary evidence only.

## Identity and business purpose

PropBank combines a public real estate catalogue with property portfolio and rental operations. Individuals can discover buy/rent listings, submit enquiries and offers, arrange visits, and manage properties and tenancy records. Agents can submit listings for separate registered owners and handle assigned enquiries and negotiations. Administrators moderate listings, verify reported ownership, manage accounts, process requests and oversee visits. This interpretation follows `src/app/layout.tsx`, `src/features/properties/ManageProperty.tsx` and the server services, rather than marketing claims.

## Stack

| Package | Declared version/range | Lockfile version |
| --- | --- | --- |
| next | 16.4.0 | 16.4.0 |
| react | ^19.3.0 | 19.3.0 |
| react-dom | ^19.3.0 | 19.3.0 |
| typescript | ^5.8.3 | 5.9.3 |
| firebase | ^12.4.0 | 12.19.0 |
| firebase-admin | 13.10.0 | 13.10.0 |
| @aws-sdk/client-s3 | ^3.1147.0 | 3.1147.0 |
| @tanstack/react-query | ^5.83.0 | 5.104.1 |
| tailwindcss | ^3.4.17 | 3.4.19 |
| zod | ^3.25.76 | 3.25.76 |
| react-hook-form | ^7.61.1 | 7.89.0 |
| @playwright/test | ^1.63.0 | 1.63.0 |

Next.js App Router runs React/TypeScript UI and Node.js API handlers in one application. Firebase client SDK handles authentication; Firebase Admin handles server identity, Firestore and legacy Storage. Cloudflare R2 uses the AWS S3 SDK. Resend is called over HTTP, not a Resend SDK dependency. Radix UI, Tailwind CSS 3, CSS modules, Lucide, React Hook Form and TanStack Query support the client. Zod is installed; do not assume every server request uses it.

## Roles and relationships

The only persisted roles are `admin`, `agent`, `individual` (`src/lib/server/auth.ts`). ?Owner?, ?tenant?, ?customer? and ?broker? are contextual relationships, not additional account roles. A user can own one property, rent another, and be a prospective buyer elsewhere. `brokerUID` identifies an assigned agent; `agent` alone grants no administrator authority. Self-registration offers individual or agent; administrator promotion requires an existing administrator.

## Main workflows

1. Register through Firebase email/password or Google, complete name/mobile/role profile, verify email, establish PropBank login and private media session.
2. Submit owner listing or tenant intake. Server validates category/structure/terms, creates property, synchronized tenant records, pending relationship claims and selected email outbox records. New listings enter `pending_review`.
3. Administrator approves publication. Public access requires `publicListing` eligibility; editing published listing content triggers another review.
4. A tenant intake stores reported owner information with empty legal `ownerUID`. Verified identity discovery and explicit owner review with document evidence precede owner linkage.
5. Manage tenancy, documents, inspections, service requests, rent schedules, manually recorded rent ledger, renewal and early termination requests.
6. Customer enquiry enters notifications; administrator assigns agent; assigned agent tracks status. Negotiation has a separate versioned state machine with owner and customer acceptance.
7. Visits persist before notification attempts. An authenticated external scheduler must invoke reminders; deployment scheduling is not configured in repository code.

## Current state and decisions

This is a substantial application with 60 API route files and 89 business HTTP method/path operations, not a proof of production readiness. Runtime correctness, provider delivery, live rules/indexes and deployed environment remain unverified. There are numerous unit/source-contract and Playwright tests, plus historical audit artifacts; none were run for this documentation task.

Native handlers preserve older Go JSON semantics through `src/lib/server/services/go-contracts.ts`, `contracts.ts`, `domain-contracts.ts` and `src/lib/server/native-group1.ts` / `native-group2.ts`. The active API base is `/api` (`src/utils/config.ts`); a separate Go runtime is not required by the active route wiring. Legacy comments and compatibility responses still refer to Go/ShoPROP.

Auth and data Firebase apps are intentionally separate, lazy singletons (`src/lib/server/firebase-admin.ts`). Firestore Admin bypasses client security rules: application services are the enforceable authorization layer for these requests. Files now use managed private R2 storage plus Firestore binding metadata; only an eligible cover/banner can be publicly delivered. Transactional writes coordinate selected business mutations with email intents, but other effects remain best effort.

Use [ARCHITECTURE.md](ARCHITECTURE.md), [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md), [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md), [API_REFERENCE.md](API_REFERENCE.md), [AUTH_AND_SECURITY.md](AUTH_AND_SECURITY.md), [KNOWN_ISSUES.md](KNOWN_ISSUES.md), [DEPLOYMENT.md](DEPLOYMENT.md) and the self-contained [PROPBank_AI_CONTEXT.md](PROPBank_AI_CONTEXT.md).

## Documentation consistency validation

Static validation on 2026-11-06 checked 293 existing source references (including cited line bounds), internal documentation links, all 89 documented method/path operations against 60 route files, all 22 collection names against active source literals/constants, 50 numbered feature entries and 23 numbered findings. No missing source paths, broken documentation links, missing/extra API operations or unsupported collection names were found. Exact runtime role union was checked as admin/agent/individual. Secret-pattern checks and comparisons against private environment assignment values found no matches in the documentation. This check does not certify external configuration or service health. No customer records, browser tests or live APIs were accessed. Tracked application/configuration diff remained empty; only documentation and its archive were added.
