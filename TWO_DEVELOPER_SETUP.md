# Two developers on Windows

Both laptops use **Firebase Auth and Firestore `(default)` in `propbanktest`**. Git shares source code; Firebase shares development records. Each laptop keeps its own credentials, captured email and mock files. Production Auth `propbank-7601b` and Firestore `propbank-944fc` are never ordinary development targets.

## Prerequisites and clone

Install Git for Windows and Node.js **24.x** with npm. The first laptop was verified with **Node 24.11.0 / npm 11.11.1**; use a maintained 24.x patch on the second laptop. Node's `util.parseEnv` is required by the launcher. Node version guidance is documentation only: no production runtime/hosting settings were changed.

The repository owner must first review and commit/push the required implementation files listed in `GITHUB_WORKFLOW_REPORT.md`. A clone cannot contain changes still uncommitted on laptop one. No commit or push was performed automatically.

From a new PowerShell terminal, choose your own workspace path:

```powershell
Set-Location "$env:USERPROFILE\Desktop"
git clone https://github.com/Prathamesh0008/propBank.git
Set-Location propBank
git switch -c dev/developer-two/setup
node --version
npm --version
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed; resolve the installation before continuing.' }
if (!(Test-Path -LiteralPath '.env.firebase-dev.local')) {
    Copy-Item -LiteralPath '.env.firebase-dev.example' -Destination '.env.firebase-dev.local'
}
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.firebase-keys" | Out-Null
notepad .env.firebase-dev.local
```

`npm ci` uses the committed `package-lock.json`; do not replace it with `npm install` just to resolve a mismatch. Do not copy laptop one's node_modules, build output, `.env.local`, captured email, mock uploads or production key files. No emulator installation or second terminal is needed for this mode.

## Development credentials and web configuration

An authorized project owner must provide developer two with a separate development-only service account/key, preferably a separate service account for independent revocation. It must belong to `propbanktest`: JSON `project_id` is `propbanktest` and `client_email` ends in `@propbanktest.iam.gserviceaccount.com`. Do not reuse a production identity, or an identity granted access to production projects. Do not alter laptop one's working key. This work does not create keys or change IAM.

Store the JSON outside the clone, for example:

```text
C:/Users/YOUR_WINDOWS_USER/.firebase-keys/propbanktest-service-account.json
```

Use a private owner-approved credential channel, not GitHub commits/issues/PRs or chat messages. Restrict the local folder/key to the developer's Windows account and necessary system administrators; do not store it in a public/shared or automatically synchronized folder. Keep keys out of terminal output and screenshots. Revocation/key rotation is an owner operation, never a routine fixture cleanup.

The runtime service account needs development Auth user/session administration and Firestore read/write access. Practical predefined roles, scoped **only to `propbanktest`**, are:

- Firebase Authentication Admin (`roles/firebaseauth.admin`), including `firebaseauth.users.createSession` for Firebase session cookies. This role also permits Auth configuration changes; an owner may choose a narrower custom runtime role after assessing all required app operations.
- Cloud Datastore User (`roles/datastore.user`) for Firestore document reads/writes. Existing server authorization remains essential because Admin bypasses Firestore security rules.

No Owner, Editor, billing administration, production-project role, Resend/R2 credential or Cloud Storage permission is required for this local workflow. A local JSON private key signs SDK requests directly; do not add Token Creator or key-creation permissions to the runtime identity merely to run the app. Project-owner key provisioning and the developer's optional Console access are separate from runtime permissions. See [Auth roles](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaseauth), [Firestore IAM](https://firebase.google.com/docs/firestore/security/iam), and [Admin credentials](https://firebase.google.com/docs/admin/setup).

In **Firebase Console > propbanktest > Project settings > General > Your apps**, select the existing development **Web app**. Both laptops use that same web config, while each uses its own private key path. Set these values in `.env.firebase-dev.local`:

| Setting | Value/source |
| --- | --- |
| `PROPBANK_FIREBASE_MODE` | `firebase` |
| `FIREBASE_DEV_PROJECT_ID` | `propbanktest` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `propbanktest` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `propbanktest.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Existing development Web app `apiKey` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Existing development Web app `appId` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Existing development Web app `messagingSenderId` (optional) |
| `FIREBASE_AUTH_PROJECT_ID` | `propbanktest` |
| `FIREBASE_DATA_PROJECT_ID` | `propbanktest` |
| `FIREBASE_PROJECT_ID` | `propbanktest` |
| `FIRESTORE_DATABASE_ID` | `(default)` |
| `FIREBASE_AUTH_CREDENTIALS` | Your absolute development JSON path |
| `FIREBASE_DATA_CREDENTIALS` | The exact same path as Auth, on your own laptop |
| `APP_URL` | `http://localhost:8080` |

Replace `YOUR_WINDOWS_USER` in both paths. Forward slashes work on Windows. Values are literal: `$env:USERPROFILE` and `$VARIABLE` expressions inside this file are not expanded. No private JSON contents go into the example. Browser keys identify the Web app and are public configuration; service-account private keys are secrets. Copy neither the production web configuration nor production server credentials.

Email/Password and Google are already enabled in the shared project. Verify `localhost` exists under **Authentication > Settings > Authorized domains**. If Google OAuth is in testing, an owner may need to authorize developer two's test identity. Use only test inboxes you control: Firebase Auth verification/reset email is real, even while application Resend delivery is captured.

## Validate and start

```powershell
Remove-Item Env:PROPBANK_FIREBASE_MODE -ErrorAction SilentlyContinue
npm run dev:check
if ($LASTEXITCODE -ne 0) { throw 'Development configuration check failed.' }
# Explicit read-only check of development Auth and one development Firestore document:
npm run dev:check -- --verify-connection
if ($LASTEXITCODE -ne 0) { throw 'Development Firebase connection check failed.' }
npm run typecheck
node --test tests/firebase-environment.test.cjs
node scripts/audit-repository-secrets.cjs
npm run dev
```

Open http://localhost:8080. The banner must show `firebase`, `propbanktest`, `(default)`, captured email, local filesystem mock and localhost:8080. Stop old servers from their original terminals before switching modes; don't kill a process solely because it occupies port 8080. Reload old browser tabs after changes. Next may still print `.env.local` as a dotenv source; the launcher masks app-owned credential/provider variables before Next loads it. The dedicated file is the only source of real-development Firebase credentials.

Ordinary development rejects either known production ID, mismatched browser/server project IDs, missing web values, foreign service accounts and ADC/legacy credential fallback. `dev:check` validates configuration without Firebase reads; `--verify-connection` explicitly reads only the development project. Browser email/Google sign-in and profile completion still require a manual test. Don't weaken guards to work around a failed check.

Optional emulator workflow is unchanged; see `DEVELOPMENT_TESTING_GUIDE.md`. Use `npm run dev:emulator` after starting loopback Auth/Firestore emulators with a `demo-` project. Never use `dev:live` to solve a missing development credential.

## Shared data without collisions

- Create separate test accounts for each developer with distinct UIDs and developer-controlled addresses. Complete verified email, Indian mobile and Individual/Agent role onboarding normally. Coordinate any development admin access through an existing authorized development administrator.
- Prefix fictional property titles, invitation subjects and other user-visible test labels with a unique developer/task marker, for example `DEV-A-visit-123` or `DEV-B-agreement-456`. This is a naming convention, not an added schema field or authorization rule.
- Each developer owns and edits their own test properties. For a two-user owner/tenant scenario, agree which developer owns each role/record and reserve it while testing. Share the relevant development record IDs privately; never use customer records.
- Announce before editing shared settings, changing another tester's role, archiving/restoring shared properties or testing approvals. Test those changes sequentially. There is no new optimistic-concurrency or record-lock guarantee: simultaneous saves may overwrite fields according to the existing contracts.
- Cleanup only records you created, through existing application permissions. Coordinate relationship/agreement cleanup. No collection wipe, Auth bulk delete, production import or database reset is part of setup. Shared project quotas are consumed by both laptops; use emulators for bulk/load tests.
- `email_deliveries` and notifications are shared Firestore metadata. Application email is captured **only on the laptop handling the request**, under `.cache/firebase-dev-email/`; it remains undelivered in the outbox. Existing retry limits and configuration errors remain visible. Do not assume the other laptop has your captured email.
- Uploaded file metadata is shared, but mock file bytes under `.cache/firebase-dev-files/` are local. A file uploaded on laptop A will not download on B unless B has the matching mock bytes. Keep file scenarios on one laptop; a cross-laptop mock-file download limitation is expected. No production R2 fallback is allowed.

## Git and deployment discipline

Work on separate `dev/<developer>/<task>` branches. Keep the lockfile tracked, pull/rebase shared source before opening a PR, resolve conflicts in source and run focused checks. Do not overwrite another developer's uncommitted work. Before staging, run the read-only audit; stage only the reviewed explicit file list in `GITHUB_WORKFLOW_REPORT.md`, then run the audit again so staged-only data is checked too. `.gitignore` does not remove already tracked files or stop `git add -f`.

```powershell
node scripts/audit-repository-secrets.cjs
git status --short
git diff --check
# Stage only reviewed source/template/documentation paths; do not blindly add everything.
# After manually staging:
node scripts/audit-repository-secrets.cjs
git diff --cached --stat
```

No commit/push is necessary to validate laptop one's configuration. Historical tracked build caches (566 files) and logs (79 files) remain tracked; new ignore rules prevent new artifacts, but an owner must separately review/remove existing artifacts from Git if desired. This task stages/deletes none of them. The audit reports filenames/rules, not matching content, and scans current tracked/index and addable worktree files, including staged-only blobs. It compares known local private values and checks common token/key formats. It is not an exhaustive history or cloud-secret audit. Enable GitHub secret scanning/push protection where available as an additional owner-managed control.

**A feature-branch push can trigger deployment.** Read-only GitHub API inspection found a public repository, default branch `main`, no GitHub Actions workflows, `main` reported unprotected, and recent `Production` deployments created by `vercel[bot]`. No tracked Vercel/Firebase deployment manifest or local `.vercel/project.json` was found. A tracked `.env.production` contains public production Firebase browser settings (and application settings), with no private server credentials detected; it was deliberately preserved. A preview build can consume those production browser defaults unless hosting overrides them. GitHub App integration can deploy without a workflow file. Vercel normally creates Preview deployments for non-production branches and Production deployments for its configured production branch; the actual Vercel branch mappings, environment variables, webhooks and protection settings are not visible from this checkout. See [Vercel Git integration](https://vercel.com/docs/git) and [deployment environments](https://vercel.com/docs/deployments/environments).

Before the first push, the repository/hosting owner must review **Vercel project > Settings > Git** (connected repository, production branch and branch deployment controls), **Settings > Environment Variables** (Preview vs Production scope and branch overrides), existing deployment hooks, and **GitHub Settings > Rules/Branches, Webhooks and Installed GitHub Apps**. Confirm preview builds have no production Firebase, Resend or R2 credentials. If previews aren't needed, disable them using owner-approved hosting controls. These settings were not changed here.

Git pushes do not upload ignored local environment/key files or directly change Firebase configuration/IAM/data. They can build/deploy committed application code; deployed code may then access whichever resources hosting variables allow. `next build` uses `NODE_ENV=production`, so ordinary local-development guards are not a preview-production-data isolation policy. Do not assume a preview URL means development Firebase. Verify preview resources separately before pushing. Keep production provider variables in their existing Production scope; never replace them with the local development file. Never merge to/push `main` or promote a deployment as part of laptop setup. Request PR review and owner-approved branch protection; no remote settings were changed by this task.

Optional per-laptop controlled email tests now use a separate gitignored `.env.email-dev.local`. See [LOCAL_EMAIL_TESTING.md](LOCAL_EMAIL_TESTING.md); capture is still the default and no Resend key/recipient list should be copied from production or committed. Reminder jobs and R2 remain isolated.
