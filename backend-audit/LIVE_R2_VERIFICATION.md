# Controlled R2 verification — 12 October 2026

All five configured R2 variables were detected without printing their values. Bucket selection matched the existing `propbank` bucket. No production Firestore records were read or written.

## Successful rerun after configuration correction

The user corrected the account ID. The existing harness was rerun once with a new uniquely scoped 68-byte PNG in the existing `propbank` bucket.

Object key: `uploads/owner/live-r2-verification-4f36b23a-1449-4942-9226-03c80dfb9bb9/temporary-pixel_6dae7e08-6ff2-4ea0-a079-595b46f13ad2.png`.

| Check | Result |
|---|---|
| Exact-key preflight HEAD | 404 NotFound |
| Upload API / R2 PutObject | 200 / 200 |
| R2 HEAD | 200, 68 bytes, uploader metadata owner |
| Public URL GET | 200, exact 68-byte match |
| Uploader namespace and UUID naming | PASS |
| Traversal upload/delete | 400 / 400 |
| Cross-user/cross-property delete | 403 / 403 |
| R2 operations during rejected requests | 0 |
| Delete API / R2 DeleteObject | 200 / 204 |
| Post-delete R2 HEAD | 404 NotFound |
| Post-delete canonical and cache-busted public GET | Both 404 |

Exactly one object was uploaded and that exact object was deleted. No object listing was performed, no customer object was modified, and production/isolated Firestore writes were both zero. Authentication and relationship tests used isolated fixtures; actual R2 transport and public URL retrieval were live. No application bug was found and no business logic was changed. This verifies these helper/handler operations, not deployment auth configuration or every historical object's policy.

## Earlier configuration blocker (resolved)

`CLOUDFLARE_ACCOUNT_ID` failed the expected 32-hexadecimal-character format and contains a URL/path. The existing helper constructs `https://<accountId>.r2.cloudflarestorage.com`; supplying a URL instead of an account ID produces an invalid endpoint. Read-only HEAD of the unique proposed test key failed with `ENOTFOUND`, with no HTTP/provider response. General external DNS and the configured public URL DNS resolved successfully.

The safety preflight required a definitive 404 before creating an object. It failed closed, so no PutObject or DeleteObject operation occurred. Upload API returned 400. No object exists from this attempt, no customer object was touched, and no cleanup deletion was needed. Public file fetch and post-delete verification could not be performed. Credentials have not yet been provider-validated.

Proposed key (not uploaded): `uploads/owner/live-r2-verification-1012d19a-7a97-4a18-9648-9e0db32fc3ee/temporary-pixel_4fb342d8-ff66-4899-9a99-ba8269d210e1.png`. It uses the authorized uploader namespace and UUID folder/filename.

## Test harness

`scripts/verify-live-r2.cjs --live-one-file` invokes existing upload/delete route handlers with isolated auth/database fixtures, real AWS R2 transport and a single tiny PNG. Only the chosen `propbank` bucket, exact uniquely scoped test key and one PutObject/DeleteObject are permitted. Cleanup runs in finally after confirmed upload. Public bytes, object HEAD, deleted public URLs and rejected traversal/cross-user/cross-property deletion are recorded. It never lists or mutates customer objects. Do not count this blocked run as live upload/delete verification.

Configuration format checks now stop immediately when an account URL is supplied instead of an account ID. No application business logic was changed. Correct the account ID locally, retain the existing bucket and credentials, and rerun controlled verification.

Files added: `scripts/verify-live-r2.cjs`, this report, `backend-audit/live-r2-verification.log`, `backend-audit/live-r2-security-regression.log`. Existing email test files and `next-env.d.ts` changes remain untouched. Nothing committed or pushed; branch remains `feature/property-management-improvements`.
