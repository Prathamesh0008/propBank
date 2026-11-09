# AUTH AND SECURITY

> Current mobile policy: schema-2 legacy reservations supersede earlier all-conflicts-must-be-fixed activation requirements. Unique contacts are reserved; duplicate numbers are ownerless blocked claims; missing/invalid profiles are locked in mobile_number_registry_accounts. Historical users stay unchanged. Three private registry collections make 25 total source collections; no new API. [Current design, tests and controlled runbook](../MOBILE_LEGACY_RESERVATIONS.md).


> Implementation update (2026-11-06): K05 has a tested transaction-backed mobile registry implementation on `fix/mobile-number-uniqueness`, but production reconciliation/backfill/activation is pending. The historical statements below describe the audited starting commit. Current behavior, two new server-only collections (24 total), fail-closed rollout requirements and test limits supersede those mobile-specific statements: [Mobile uniqueness implementation and rollout](../MOBILE_NUMBER_UNIQUENESS.md).


> Source audit: 2026-11-06 (Asia/Calcutta). Branch `main`, commit `fa98b7e0e53d29053365be4c1a1b8230a313f686`. Static inspection only; no production database access, external service health checks, browser tests, migrations, push or deployment. ?Implemented? means a source-complete path with identifiable validation and authorization; it does not certify successful runtime operation. Historical reports are secondary evidence only.

## Trust model and account identity

Firebase Authentication UID is the durable account identity. The data project stores `users/{uid}` using that same UID; email/mobile/name are attributes, not primary keys. Auth project and data project are distinct named Admin apps. Browser config must match the Auth Admin project. Roles are read from Firestore profiles, not caller headers or custom role claims.

`src/lib/server/auth.ts` verifies bearer ID tokens with revocation checking. Protected requests also fetch the current Firebase account and profile, reject disabled users, require verified current email, require matching profile email, allowed role, at least two name characters and a normalized Indian mobile. `X-User-ID` is only a checked hint in `identity`, never authentication. Some onboarding handlers deliberately call `verifyFirebaseIdentity` without requiring completed/verified profile.

## Registration, password and Google

`src/features/auth/GoogleAuth.tsx` implements email/password creation, Firebase display name updates, profile POST to `/api/auth/user`, Firebase verification email, verification refresh, login and password reset. It offers `individual` or `agent` account selection. Mandatory mobile uses `src/features/auth/RegistrationMobileField.tsx` and `src/lib/indian-phone.ts`; a valid national number is 10 digits starting 6?9, optionally prefixed +91, stored canonically as +91 plus national digits during creation.

Google uses `signInWithPopup` via `src/firebase.ts`. A new Google identity still needs a completed PropBank profile. For `auth/account-exists-with-different-credential`, the UI retains the pending Google credential, requires password authentication to the existing identity, then calls `linkWithCredential`. Linking does not create a second Firestore UID. Provider enablement, Firebase one-account-per-email behavior, authorized domains and console email policies remain external unknowns.

Firebase handles password hashing, verification links, reset emails and provider login. `/api/auth/login` validates a UID against the bearer identity, synchronizes metadata/activity and discovers links; it returns the existing Firebase ID token, not a separately signed application JWT. Reset activity logging does not prove Firebase sent email or that a password changed.

## Session lifecycle

`src/contexts/AuthContext.tsx` observes ID token changes and exposes only verified, profile-complete users. Profile service failure has a retryable unavailable state instead of treating it as a missing account. Auth profile requests are coalesced. Cache is cleared on UID change; media sessions are cleared/renewed on auth transitions.

Normal APIs use bearer tokens. `/api/media/session` creates a 20-minute Firebase session cookie (`propbank_media`), HttpOnly, SameSite=Strict, Secure in HTTPS/production, Path=/api/media. GET verifies cookie UID against the bearer user; DELETE expires it. It is for file delivery, not general application login. Client renewal runs every ten minutes and on focus/online; secure file failure can be retried. `src/lib/private-file-client.ts`, `src/lib/private-file-session.ts` and `src/components/SessionMediaImage.tsx` coordinate this.

## Permission matrix

| Actor/context | Allowed boundaries | Explicit limits |
| --- | --- | --- |
| Anonymous | Approved eligible public listings, search, static info, active service catalogue, unauthenticated general inquiry | No protected property contacts/documents or role authority |
| Incomplete or unverified Firebase user | Own onboarding profile status and onboarding creation | Cannot use completed-profile services |
| Individual | Own profile; own properties; linked active tenancy; own visits; customer offers; property enquiries | No global inbox/account controls |
| Agent | Same relationship-based personal access; submit for separate registered owner; edit own submitted listing content; assigned enquiries; assigned broker proposals | Agent role grants no general property membership/private files or admin access |
| Owner relationship | Property editing/tenancy operations, member documents/services, rent ledger and owner agreement decisions | Agreement owner endpoints require exact owner UID, even for admin |
| Tenant relationship | Active member services/files/inspections/reviews and tenant agreement requests | No owner approvals, rent ledger edits or arbitrary tenant reassignment |
| Administrator | Global users/properties, moderation, verification, visits, enquiries/assignments, notifications, settings, service request resolution, document review, managed-storage reconciliation, email retry | Cannot use owner-only agreement decisions solely due to admin role; POST user upsert guards self role/status changes; PUT/PATCH user update does not apply the same guard |
| Scheduler | Reminder endpoint using CRON_SECRET bearer secret | Firebase user tokens are not scheduler credentials |

`src/lib/server/permissions.ts` supplies self/admin, owner/admin and property membership checks. Tenant authorization requires an active embedded tenancy: exact `userUID`, or legacy verified-token email match only when no UID and no confirmation requirement. Phone equality never grants tenancy access. Some services support legacy root tenant email fallback; do not generalize this to every endpoint.

## Relationship linking and ownership

`src/lib/server/services/relationship-links.ts` discovers only claims matching the current Firebase Admin verified email, or a phone present in both token and current Firebase Auth record. Email claims never fall back to phone. Ordinary editable profile mobile is deliberately excluded. Claims require eligible current property/tenant data and expire after 30 days unless already terminal. Confirmation actions require recent auth (five minutes), recheck live identity/profile, reject self-claims, and atomically bind the standalone tenant and embedded row. Owner authorization is explicit; tenant confirmation alone may stop at `pending_owner_authorization`.

Tenant-intake ownership claims move to `pending_admin_verification`, not directly to owner. `owner-verification.ts` requires an administrator, current verified owner account, property-linked evidence document and review note; versioned approval writes owner identity and updates tenant owner references. It refuses active tenant-as-owner. Rejection/reconsideration preserve tenancy. No automated legal ownership verification service exists.

## Profile editing and duplicate prevention

`src/lib/server/services/users.ts` checks duplicate `phoneNumber` through an equality query, then creates the UID profile in a transaction that checks only that UID. Two different UIDs can pass the phone precheck concurrently: there is no transactional unique-mobile reservation. Legacy formatting may also defeat exact-string duplicate checks. `updateUser` has a missing-profile creation branch without the duplicate precheck used by `createUser`.

Firebase email duplication rules depend on console settings; Firestore has no independent unique email constraint. Two accounts with different emails but the same person are not deduplicated. Google/password linking is explicit when Firebase signals a provider conflict. Failed profile completion can leave a Firebase user without a complete data profile; completion UI is intended to recover it. A duplicate-phone 409 does not undo Firebase account creation.

`src/lib/server/services/account.ts` allows name, photo, bio, notification preferences and agent agency fields. Email/role/status are not editable through that endpoint. Email changes use Firebase verify-before-update flows, and password changes use Firebase reauthentication. Mobile changes require recent authentication plus matching verified token/current Auth phone; there is no OTP/reCAPTCHA phone enrollment UI or delivery integration, and relationship responses explicitly report `phoneVerificationAvailable:false`. Mandatory registration phone is syntactically validated contact data, not verified ownership.

## Rules, limits and sensitive data

No Firestore rules/index manifest, Storage rules or deployed IAM policy is checked in. Actual client access restrictions, private bucket public exposure, Firebase security settings and service-account privileges cannot be verified here. Admin SDK operations bypass Firestore rules; every newly added endpoint must enforce its own identity and object scope.

Enquiry intake uses transactional replay protection (10-minute window) and per-minute quotas: global 60, contact 5, trusted peer 10 (otherwise shared 60). Only an explicitly configured and trustworthy stripped ingress header (`cf-connecting-ip` or `x-real-ip`) should be used. Relationship reads/lookups, discovery and claims have distributed per-user minute quotas. Invitation mail quotas are sender 10/hour and 30/day, recipient 3/day, enforced transactionally. There is no general API-wide application limiter, and unauthenticated password-reset activity logging has no application limiter in its handler.

Public property projection redacts owner/tenant contact and private fields, supplies only the cover image and omits operational arrays. Media validates property scope and live bindings, rejects arbitrary private external file attachment, and limits bytes/MIME. MIME allowlists do not inspect magic bytes or scan malware. CORS uses wildcard origin without credential allowance in the shared helper; cookie-bound media requires separate same-origin handling. Unexpected server errors are sanitized and logged with references. Logs/history/environment files are sensitive local material; never upload them as project context. See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for confirmed gaps and conditional risks.
