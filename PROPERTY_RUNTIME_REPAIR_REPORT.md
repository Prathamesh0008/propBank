# Property creation and email runtime investigation

## Status: reported port-8080 failure is not yet reproduced

The exact root cause of the user's failing authenticated Add Property submission **has not been established**. The available browser connector reports “Browser not connected,” and no failing request payload, response or authenticated browser session was available. No production Firebase records were used to compensate for that missing evidence. This report does not declare the reported browser problem resolved.

This investigation went beyond mocks: the current Next.js server code was exercised over real HTTP against separate Firebase Auth and Firestore emulators, using the actual Firebase Admin SDK and transaction implementation. Five valid creation scenarios succeeded while outbound email was deliberately rejected by an isolated transport guard. The remaining port-8080 reproduction requires the actual failure response or its new correlation reference.

## Actual local/runtime evidence

- Port **8080** belongs to the existing project's `next dev --port 8080` process, not a production build. The original development server was preserved.
- Actual unauthenticated `POST http://localhost:8080/api/properties` returned **401**, JSON `{success:false,message:"Firebase ID token required"}`. `GET /add-property` returned **200** HTML. These are not authenticated creation tests.
- Existing `.next/dev/logs/next-development.log` contained transactional-email failure entries. It did not contain the hidden property exception. Unexpected property exceptions previously disappeared behind the generic route-level “Failed to create property” response in `src/lib/server/http.ts` / `src/app/api/properties/route.ts`.
- Local Firebase credential JSON was parseable, its configured projects matched, and browser/Auth project settings agreed. These checks did not validate live IAM permissions or read live account records.
- `RESEND_API_KEY`, `FROM_EMAIL`, `APP_URL` and `ADMIN_EMAIL` were populated; `APP_URL` used HTTPS. `NEXT_PUBLIC_APP_URL` and `SUPPORT_EMAIL` were absent, both optional with the configured alternatives. Secret values were neither printed nor changed.

### Real isolated HTTP/SDK run

Separate server: **http://127.0.0.1:8081**. Demo project: **demo-propbank-runtime**. Auth emulator: **127.0.0.1:9198**. Firestore emulator: **127.0.0.1:8288**. Real Resend requests were intercepted before leaving the process and replaced with synthetic HTTP 403 responses. Real R2 objects were not uploaded; image binding used an isolated synthetic managed-file record.

| Request/scenario | Observed result |
| --- | --- |
| Owner creates ordinary property | 200, persisted property |
| Owner creates rented property with tenant email | 200, property/tenancy/claim/invitation persisted |
| Tenant creates property with reported owner email | 200, private property and pending owner claim/invitation persisted |
| Tenant creates property without owner email | 200, pending relationship persisted without owner invitation |
| Owner attaches existing isolated managed-image reference | 200, media binding points to the original new property ID |
| Repeat identical owner submission | 200, “Property already submitted,” same property ID |
| Invalid explicit tenant email | 400, `fieldErrors.tenantEmail` |
| Invalid explicit reported owner email | 400, `fieldErrors["reportedOwner.email"]` |
| Verified tenant discovers and accepts authorized invitation | 200, relationship `linked` |
| Tenant queries rented properties after confirmation | 200, original property visible |
| Owner queries properties after tenant confirmation | 200, original property retained |
| Verified candidate requests documentary ownership review | 200, owner UID still empty pending admin approval |
| Administrator retries an eligible failed standard notification | 200, delivery queued under existing immutable key |

The run persisted **5 properties, 3 relationship claims and 14 outbox events**, including confirmed-relationship notifications. All synthetic provider failures were persisted as `failed` with HTTP 403 metadata. The actual dev-server console emitted the transport guard marker and delivery failure entries after the HTTP responses, confirming that `after()` ran. No read-after-write transaction exception occurred in these SDK-backed scenarios.

Machine-readable evidence: `PROPERTY_RUNTIME_REPAIR_EVIDENCE.json`. Reusable guarded HTTP smoke driver: `scripts/verify-property-runtime.cjs`.

## Confirmed email blocker

A fresh **read-only** Resend `GET /domains` request returned **HTTP 200**, establishing that the local credential can perform that read. The configured sender domain's status remains **failed**. Public TXT lookups for `resend._domainkey.propbank.shop` and `send.propbank.shop` returned **ENOTFOUND**. Earlier read-only domain details also identified the sending MX record as failed.

This is a confirmed shared sender-domain configuration blocker for normal property notifications and relationship invitations. It is separate from property creation and cannot be repaired by weakening Firestore transactions or relationship authorization. DNS/provider configuration was not changed. Exact DNS instructions remain in `EMAIL_SENDER_DNS_DIAGNOSIS.md`.

The emulator's HTTP 403 responses were **synthetic**, not actual Resend send results. No actual email-send API call was made, so this investigation does not assert a live provider rejection body, message ID or recipient mailbox result.

## Implemented source repairs and their evidence

1. **Property diagnostics** — `src/lib/server/services/properties.ts:161` wraps creation with sanitized correlation responses and source-frame logging. Permission/database failures get safe operational messages; raw exception messages, submitted property data and credentials are not exposed. Single-string structured logging avoids the empty `{}` metadata seen in the existing development log. The original submitted browser exception remains unknown; this fixes the observability gap rather than inventing its cause.
2. **Optional recipient pre-discovery** — `src/lib/server/services/relationship-links.ts:89` and `:105` no longer make an optional recipient lookup failure abort valid intake. On lookup outage the original claim persists with no bound candidate. Verified self-discovery, tenant confirmation, owner approval and administrator documentary review retain their current identity checks. An isolated permission-error regression test reproduces and verifies this failure path; it was not observed in the successful real HTTP run.
3. **Post-commit dispatch scheduling** — `src/lib/server/services/transactional-email.ts:89` catches failures registering `after()` after the transaction commits. A durable pending outbox remains eligible for authorized retry instead of reporting a saved property as failed. A focused injected scheduling failure verifies this repair. Normal real Next.js `after()` execution was observed working; it was not the failing component in the isolated runtime.
4. **Provider diagnostics** — `src/lib/server/services/resend.ts:4` and transactional delivery now preserve safe provider HTTP status and allowlisted error codes. Unverified-domain responses, when returned by the provider, receive a fixed actionable DNS message. Raw provider bodies are never persisted/logged. Existing retry-window, lease, terminal-claim and recipient safeguards remain.
5. **Field-level validation** — `src/lib/server/services/properties.ts:188`, `src/features/properties/property-response.ts`, and both creation forms preserve sanitized server messages and field-specific email errors. Missing optional owner email remains accepted.
6. **Submission state** — `src/features/properties/AddPropertyForm.tsx:1916` disables submit while React Hook Form is submitting. The tenant form also checks its busy state. Server fingerprints continue preventing duplicate properties on identical retries. Related caches are refreshed after success.
7. **Operational UI** — `src/features/admin/AdminEmailDeliveries.tsx` displays safe provider status/code alongside failure information. Persisted events retain the existing administrator-only delivery/retry path.

Essential property, tenancy, claim and outbox persistence stays transactional. An outbox persistence failure still rolls back the entire business write and returns an error. **Optional transport or post-commit scheduling failure does not undo an already committed property.** Missing invitation URL/rate-limit suppression also preserves business records. An email match still grants no property authorization.

## Files changed in this task

- `src/lib/server/services/properties.ts`
- `src/lib/server/services/relationship-links.ts`
- `src/lib/server/services/transactional-email.ts`
- `src/lib/server/services/resend.ts`
- `src/features/admin/AdminEmailDeliveries.tsx`
- `src/features/properties/AddPropertyForm.tsx`
- `src/features/properties/TenantPropertyForm.tsx`
- `src/features/properties/property-response.ts`
- `tests/fixtures/native-server.cjs`
- `tests/relationship-links.test.cjs` — persistence-failure expectation adjusted from 500 to the new explicit 503 response.
- `tests/property-runtime-repair.test.cjs` (new)
- `scripts/verify-property-runtime.cjs` (new)
- `PROPERTY_RUNTIME_REPAIR_EVIDENCE.json` (new)
- `PROPERTY_RUNTIME_REPAIR_REPORT.md` (new)

The temporary dev server/emulators were stopped; port 8080 remains running. Only temporary Next.js include additions and emulator-generated changes to previously unchanged tracked logs were removed from the diff. Other existing uncommitted source work was preserved. Generated scratch output is isolated under `node_modules/.cache/propbank-runtime-repair` and `.next-runtime-repair`.

## Checks and limitations

- Real isolated HTTP/SDK smoke run — passed, as detailed above.
- `npm run typecheck` — passed.
- Focused account/auth/property/relationship/email regression run — **144 passed, 0 failed**.
- Seven selected native-route, image and infrastructure checks — **7 passed, 0 failed**.
- `git diff --check` — passed after removing this investigation's generated log changes; line-ending warnings only.
- An earlier broader `native-group1.test.cjs` run exposed **five legacy assertion failures** involving historical phone registration, account-search disclosure, public listing expectations, immediate tenant auto-linking and old notification subjects. Those expectations conflict with previous secure-linking/moderation/account changes, and were not used to justify weakening current rules. They were not silently rewritten or claimed passing. The newly changed persistence-error status assertion was updated separately.
- The isolated Next.js startup emitted a package security-upgrade reminder before allowing the retry. No dependency upgrade was attempted in this repair.

No Playwright, full suite, production build, real customer record access, live Firebase writes, real mail, DNS/Resend settings changes, deployment or push was performed.

## Remaining controlled reproduction required

1. In the existing authenticated browser on **localhost:8080**, retry the failing submission once with DevTools Network open. Keep the failed `POST /api/properties` status and response message/reference; do not share tokens, passwords or customer documents.
2. State whether it is the owner or tenant form and whether images were attached. If no POST occurs, capture the visible field-validation message instead.
3. The server now logs `property_creation_failed` with the same reference, safe error code and source frames. Correlating those identifies the actual port-8080 exception without production data inspection.
4. The browser connector can alternatively be enabled for direct inspection, but it was unavailable during this run.
5. Separately correct sender DNS and verify the domain, then explicitly authorize one controlled mail test before claiming real delivery success. Do not blindly resend old ambiguous attempts or recreate existing properties.

The primary port-8080 diagnosis remains open pending that evidence.
