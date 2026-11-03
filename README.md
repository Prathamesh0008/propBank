This tree prepares a forward-only restoration of the selected October 30 PropBank system plus isolated Firebase development. See [FORWARD_RESTORATION.md](FORWARD_RESTORATION.md) for current status and main integration. Earlier recovery reports record their historical snapshots.

# PropBank Next.js

The frontend and API run in one Next.js application. Browser requests use /api. Every specific API route is permanently native. Unmatched API paths and the unused /api root return the standard Next.js 404 response.

Firebase Auth uses propbank-7601b; Firestore data uses propbank-944fc. Existing Firebase Admin credentials, collection names, R2 configuration and public object URLs are retained. Use .env.example for configuration; never commit credentials.

`npm run dev` requires a dedicated real Firebase development project configured in `.env.firebase-dev.local`; it masks production credentials from `.env.local`. See [Windows Firebase development setup](DEVELOPMENT_TESTING_GUIDE.md) and `.env.firebase-dev.example`. `npm run dev:check` validates configuration without live reads. Optional `npm run dev:emulator` preserves the loopback `demo-propbank` workflow.

Production uses `npm run build` followed by `npm start` in its separately configured deployment environment. Authorized live development requires `npm run dev:live -- --allow-live-firebase` in a separate shell; it can consume quota and perform real writes/provider operations.

Run focused Node tests relevant to your changes; `npm test` runs the full suite. Built-server public-read checks require `npm run test:native-routing -- --allow-live-firebase`; direct `node scripts/test-native-routing.cjs --compatibility-only` checks routing without live Firebase/R2. `npm run test:group2-routing` uses Playwright.

Historical migration evidence is retained under migration-audit; the current cleanup report takes precedence over earlier rollout instructions. The external backend project and its separately deployed background scheduler are outside this application cleanup.

For a second Windows laptop and shared `propbanktest` development, follow [TWO_DEVELOPER_SETUP.md](TWO_DEVELOPER_SETUP.md). See [GITHUB_WORKFLOW_REPORT.md](GITHUB_WORKFLOW_REPORT.md) before staging or pushing; feature branches may trigger Vercel deployments.

This worktree restores the pre-pull system on `dev/my-work`. See [RECOVERY_REPORT.md](RECOVERY_REPORT.md) for evidence, checks, known baseline failures and safe branch commands.
