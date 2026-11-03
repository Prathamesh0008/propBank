# Two-developer GitHub workflow report

## Outcome and exact commit candidates

Both laptops use shared development Firebase Auth and Firestore `(default)` in **propbanktest**. Laptop one's `.env.firebase-dev.local` and production `.env.local` have identical content hashes before/after this task. Its service-account JSON remains outside the repository. No commit, stage, push, deployment, production data/billing/IAM change, hosting-setting change or production environment modification was performed.

These are the **exact workflow files safe to commit after review** (credential-free source/templates/docs; audit cleared):

- `.gitignore`
- `.env.firebase-dev.example`
- `.env.emulator.example`
- `DEVELOPMENT_TESTING_GUIDE.md`
- `README.md`
- `TWO_DEVELOPER_SETUP.md`
- `GITHUB_WORKFLOW_REPORT.md`
- `scripts/audit-repository-secrets.cjs`
- `tests/repository-secret-audit.test.cjs`

The working Firebase implementation is also still uncommitted. A clone cannot reproduce laptop one until its required runtime files are reviewed and committed too. The following **other pending non-artifact files** passed the exposure scan; they include pre-existing work and are not automatically approved as one feature or a substitute for reviewing their diffs:

- `.env.example`
- `next-env.d.ts`
- `next.config.ts`
- `package.json`
- `scripts/audit-providers-readonly.cjs`
- `scripts/auth-emulator-fixtures.cjs`
- `scripts/check-migration-readonly.cjs`
- `scripts/start-emulator-dev.cjs`
- `scripts/test-native-routing.cjs`
- `src/contexts/AuthContext.tsx`
- `src/features/admin/AdminPortal.tsx`
- `src/features/properties/PendingConnections.tsx`
- `src/features/properties/PropertyHub.tsx`
- `src/features/visit-planner/VisitPlanner.tsx`
- `src/firebase.ts`
- `src/hooks/useProperties.ts`
- `src/hooks/useUsers.ts`
- `src/lib/server/firebase-admin.ts`
- `src/lib/server/r2.ts`
- `src/lib/server/services/documents.ts`
- `src/lib/server/services/media.ts`
- `src/lib/server/services/notifications.ts`
- `src/lib/server/services/properties.ts`
- `src/lib/server/services/resend.ts`
- `tests/fixtures/native-server.cjs`
- `tests/pending-connections-ui.test.cjs`
- `tests/server-foundation.test.cjs`
- `tests/visit-form.test.cjs`
- `tsconfig.json`
- `FIRESTORE_READ_BUDGET_REPORT.md`
- `LOCAL_FIREBASE_SAFETY_REPORT.md`
- `backend-audit/firestore-read-inventory.json`
- `scripts/audit-firestore-reads.cjs`
- `scripts/start-firebase-dev.cjs`
- `scripts/start-live-dev.cjs`
- `src/lib/firebase-environment.cjs`
- `src/lib/firebase-environment.d.cts`
- `src/lib/server/local-development-storage.ts`
- `tests/firebase-environment.test.cjs`
- `tests/firestore-read-budget.test.cjs`

Do not blindly stage every path: preserve unrelated work in its appropriate commit/PR. Include package.json commands, start-firebase-dev/start-emulator-dev/start-live-dev scripts, next.config guard, shared environment policy/declarations, browser/Admin setup, isolated Resend/R2/local-storage code and focused tests when publishing the runtime change. Keep the existing committed package-lock.json; its root dependencies match package.json. No dependency/runtime version was changed in this task.

## Must remain local

- Secret-filled dotenv files: `.env.local`, `.env.firebase-dev.local`, `.env.test-accounts.local` and future secret-bearing mode-specific files. Only credential-free examples are newly addable.
- All service-account/private-key files, including `C:/Users/Nova Tech/.firebase-keys/propbanktest-service-account.json` and developer two's personal key path. Never copy production credentials to laptop two.
- `.firebase-keys/`, `.vercel/`, node_modules, Next build output, emulator exports, captures/mock uploads, logs and caches.

Historical artifacts already tracked (566 cache files, 79 logs) remain tracked; ignore rules do not remove them. They were scanned without credential findings. No cleanup/deletion was staged. An owner should separately review historical privacy/retention.

The tracked `.env.production` contains public Firebase browser/application settings, with no private server credentials detected. It was preserved because removing it could change deployed behavior. Never add server secrets to it. Its production browser defaults may also affect Preview builds.

## Second laptop and permissions

Follow **TWO_DEVELOPER_SETUP.md** for exact PowerShell clone, branch, npm ci, configuration and startup commands. Use Node 24.x (verified baseline 24.11.0) with npm (verified 11.11.1), preferably a maintained 24.x patch. Both laptops retain project IDs propbanktest and share its existing Web app config; each uses a personal development JSON path, identical for Auth/Data on that laptop.

An authorized owner provisions a separate development-only identity/key for developer two. Practical runtime roles on **propbanktest only** are Firebase Authentication Admin (`roles/firebaseauth.admin`, including session creation) and Cloud Datastore User (`roles/datastore.user`). An owner may choose a reviewed narrower custom role. No production grants, Owner/Editor/billing role, R2/Resend permission or Token Creator role is required by local JSON signing. IAM was not changed or exhaustively inspected.

Use distinct test users and developer-prefixed fictional properties. Reserve shared scenarios and coordinate changes to shared settings; no new record-lock/concurrency guarantee is introduced. Never reset the shared database. Firestore metadata is shared, but captured emails and mock upload bytes remain local to the handling laptop. Cross-laptop mock-file downloads can fail because the other laptop lacks the bytes; no production fallback is allowed.

## GitHub and deployment findings

Read-only unauthenticated GitHub API calls observed:

- Public repository Prathamesh0008/propBank; default and current branch `main`.
- Branch API reports `main` protected=false. Detailed protection endpoint returned 401; an owner must verify rulesets/protection in Settings.
- No repository Actions workflows were returned. No tracked CI/deployment manifest was found.
- Three recent deployment records were `Production` deployments by `vercel[bot]`. GitHub App automation can deploy without a workflow file.
- No local `.vercel/project.json` exists. Actual Vercel branch mapping, variable scopes, webhooks and deployment controls remain unverified.

**A feature-branch push may automatically deploy a Vercel Preview; pushes/merges to the configured production branch may deploy production.** Review Vercel Settings > Git and Environment Variables (including branch overrides), GitHub Settings > Rules/Branches, Webhooks and Installed Apps before pushing. Preview needs isolated resources and no production server/provider credentials, or previews should be disabled by the owner. No hosting policy was changed here.

A Next production build may load tracked `.env.production` browser defaults and hosting secrets. Ordinary local guards do not isolate Preview. Pushes do not upload properly ignored files or directly change Firebase IAM/Console settings/data, but deployed code may access hosting-configured resources. Production-neutral pushing cannot be guaranteed without dashboard review. Existing production defaults and production-ID rejection in ordinary local mode remain unchanged.

Sources: [Vercel Git deployments](https://vercel.com/docs/git), [deployment environments](https://vercel.com/docs/deployments/environments), [Auth roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth), [Firestore IAM](https://firebase.google.com/docs/firestore/security/iam).

## Verification

- `npm run typecheck`: passed.
- `npm run dev:check`: passed, target propbanktest / (default), captured mail and filesystem storage mock.
- `node --test tests/firebase-environment.test.cjs tests/repository-secret-audit.test.cjs`: 26 passed. Covers production rejection, missing/mixed settings, service-account validation, emulator compatibility, isolated providers, staged-only secrets and ignore/template behavior.
- `npm run dev`: executed and selected propbanktest; duplicate startup refused with EADDRINUSE because the existing working server owns port 8080. That process was preserved and returned HTTP 200.
- `git diff --check`: passed (existing CRLF notices only).
- `node scripts/audit-repository-secrets.cjs`: current tracked/index blobs, staged-only content and addable worktree files scanned, with no findings and no staged files. Ignore rules and safe template exceptions pass. Known local private values were compared in memory; no values were printed. Firebase browser API keys are public configuration, not Admin secrets.

This is a current-snapshot pattern/known-secret audit, not an exhaustive history or cloud-secret audit. Historical commits and hosting secrets require independent owner review. No Playwright/E2E/full suites, production operations, email delivery, R2 operation or deployment ran. npm ci is documented for laptop two and was not repeated over laptop one's working node_modules.

## Remaining manual steps

Owner: review candidate diffs, audit again after staging, commit/push only after deployment review, provision a development-only identity/key without production grants, and confirm branch/Preview isolation. Developer two: install tools, clone the reviewed commit, npm ci, obtain development Web config/key through approved channels, set personal paths, run dev:check and optional development connection check, then npm run dev. Test sign-in/onboarding with a separate controlled account. Review the existing Next.js security warning separately; this task does not upgrade dependencies.
