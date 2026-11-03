# Forward-only October 30 restoration

This branch prepares the selected October 30, 2026 PropBank source (`649fdf98f4d563fddbb5ebcb060fe42dcf31b318`) plus the verified real-development Firebase/quota/provider-isolation improvements as a new commit on top of shared main (`38c70ef907804b214ee10166560363f3a0de0b60`). It does not merge the old developer branch, reset main or delete later history.

The source/script/test tree is copied from the verified recovered reference. Ten pre-existing trailing-whitespace lines in SearchResults.tsx were trimmed so the restoration diff passes git diff --check; its code and rendering behavior are unchanged. `restoration/source-comparison.json` records comparison with October 30, the recovered source, and current main. The October 30 UI, forms, auth flow, property APIs/workflows and permission code are retained, with only the already-reviewed quota/transport additions from the reference. Production `.env.production` and package-lock are unchanged from main. The separate security-upgrade worktree is not imported automatically.

## Runtime and local secrets

Ordinary `npm run dev` uses the explicit safe launcher and requires the gitignored `.env.firebase-dev.local`. Local Auth and Firestore both target **propbanktest**, database **(default)**. Both known production project IDs are rejected. The local credential path refers to the existing development-only service account outside Git; private JSON and production `.env.local` are not part of this tree. The template uses placeholders for machine-specific paths and web app keys.

Email defaults to capture. The optional exact-allowlist resend-test mode remains available through separate gitignored `.env.email-dev.local`, with sender confirmation, recipient/attempt limits and blocked local scheduler/bulk scripts. It is not enabled by this restoration. R2 remains a local filesystem mock. No real customer data or provider credentials are imported.

Production Auth remains propbank-7601b and production Firestore remains propbank-944fc for the existing production configuration. No Console settings, data, billing, IAM, hosting variables or live provider configuration were changed. Historical recovery/audit reports copied alongside this source describe their earlier snapshots; this document and the final restoration receipt describe the current forward-only commit.

## Preview deployment is a blocking unknown

Read-only GitHub API inspection found main at 38c70ef, no Actions workflows, main reported unprotected, and recent Production deployments by vercel[bot]. There is no local Vercel link metadata or repository manifest establishing Preview isolation. A GitHub App can deploy without an Actions file. Hosting Preview/Production variables, branch overrides, Git integration, deploy hooks and access protection remain unverified.

**Do not push this branch or open a PR until the owner verifies preview isolation.** A Next production/Preview build can load tracked public production browser defaults and hosting secrets; localhost guards do not isolate Preview builds. Confirm Preview has development-only Firebase/provider configuration or disable preview deployment through approved hosting controls, leaving existing Production configuration unchanged. No hosting setting, branch protection, push, PR or deployment is performed by this task.

## Safe integration after review

1. Review the source comparisons, local commit diff, secret audit, test results and known pre-existing failures. Confirm this restores the chosen snapshot instead of retaining the November 2 UI/business changes.
2. Have the hosting owner verify Preview isolation and Git deployment triggers before remote action. No remote push/PR is authorized while that is unknown.
3. After that review, manually publish this temporary restoration branch and create a restoration PR targeting main. Merge it only after explicit reviewer approval; preserve all existing main history. If main has advanced, prepare/review the updated restoration against the new main before integration instead of force-updating shared history.
4. Once the approved PR is merged, use the original `C:/Users/Nova Tech/Desktop/propBank` as the everyday folder on main. Preserve its untracked/local files first; stop any old server. Then the owner may manually run:

```powershell
Set-Location 'C:\Users\Nova Tech\Desktop\propBank'
git status --short
git fetch origin
git switch main
git pull --ff-only origin main
npm ci
npm run dev:check
npm run dev -- --verify-connection
npm run typecheck
npm run dev
```

Do not run these switch/pull steps before the restoration is on main. Do not force a checkout conflict or blindly stage cache/local files. Preserve the original `.env.firebase-dev.local`; the restored launcher masks production dotenv values instead of overwriting them. A separate email-local file is optional and capture remains the default.

The commit is also a descendant of today's local main, so an explicitly approved local-only `git merge --ff-only restore/oct30-firebase-20261103` while on main could advance local main without rewriting history. That is a merge operation and is deliberately not automated here; it would leave local main ahead of GitHub and does not grant permission to push or deploy.

## Preservation

The original checkout, the recovered worktree and their uncommitted changes remain intact. Protected snapshots were created outside the repository before construction. No permanent developer-branch workflow is required: main can be the everyday branch after reviewed integration; this restoration branch is temporary. Keep dev/my-work and other worktrees until all unique work is committed/archived and restored main is verified. No branch/worktree deletion is part of restoration.

Validation results and the resulting commit hash are recorded in the final local restoration receipt outside Git. The new commit's single parent must match latest main at commit time. Known baseline failures are reported rather than fixed by weakening validation/authorization.

## Recorded validation of this restoration

- Typecheck passed before and after local startup.
- Development configuration and actual Auth/Firestore connection checks passed for propbanktest / (default), with no writes.
- npm run dev reached Ready; HTTP 200 was confirmed. Its first invocation stopped for the existing Next 16.4.0 security reminder; retry continued. The separate security-upgrade branch remains untouched.
- 100 focused safety/Firebase/quota/email/profile/session/Pending Connections tests passed.
- 81 targeted property/agent/tenant/admin/agreement/visit/storage tests produced 69 passes and 12 previously recorded baseline failures. The exact failures and comparison are committed in restoration/validation-results.json. No new failure names were found and no application permissions were weakened.
- Source comparison: 469 present source/script/test paths exactly match the recovered reference, 1 differs only by documented trailing whitespace, and 9 unwanted incoming source/test paths are absent as selected. Root historical November report removal is also explicit in the commit diff.
- git diff --check passed after the whitespace-only cleanup. Current-snapshot secret audit found no exposure; staging is separately audited before commit.
- No real email, Resend/R2 provider test, production Firebase data operation, deployment, remote push, PR or merge was performed.

Known failing cases are admin user search; two admin property intake/validation scenarios; agent intake; residential owner/tenant category intake; industrial owner/tenant category intake; category editing; base64 image failure status; missing-profile media-session error code; and overlapping-email visit notification authorization. Existing baseline business functionality therefore remains subject to those recorded issues; restoration is not a claim that every old test is green.
