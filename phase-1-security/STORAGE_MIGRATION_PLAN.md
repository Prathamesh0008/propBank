# Historical storage migration and revocation plan

Status: **PREPARED; NOT EXECUTED.** Copying customer files, switching live records, deleting originals, changing bucket policies and purging customer-object caches require explicit approval of the exact scope. No such operation occurred in Phase 1.

## Inventory evidence

`node scripts/storage-migration-inventory.cjs --live-readonly` performed a bounded, field-selected Firestore read. It did not list buckets, download stored objects, send email, invoke reminders or write records.

| Collection | Records scanned | Scan complete |
| --- | ---: | --- |
| properties | 15 | Yes |
| documents | 9 | Yes |
| inspection_reports | 1 | Yes |
| service_requests | 0 | Yes |
| admin_notifications | 45 | Yes |
| siteSettings | 1 | Yes |

35 historical file references: **29 confidential / 6 public**. These correspond to 33 distinct values, including **27 distinct confidential values**. Provider counts by reference: 33 R2 URLs and 2 embedded data values. No GCS or arbitrary external URL was found in this snapshot. Alias references may point to the same object; do not delete once per reference. New records created after this snapshot require a fresh inventory.

The Git-ignored `private-inventory.local.json` contains collection, record ID, field/index, classification, provider and SHA-256 of the original value. It contains no full URLs, file contents, signed URL tokens, names or contacts. Resolve each value from its source record only inside an approved migration execution. The committed summary contains counts only. The read-only script scans at most 1,000 records per collection and explicitly flags truncation; this run was complete.

## Approval and prerequisites

1. Confirm the target environment and approve an explicit manifest of record paths/object identities, retention requirements and maintenance window. Back up source records. Validate source hash and related property before each operation; stop on concurrent edits. Never treat a prefix or an entire bucket as authorization for deletion.
2. Provision a **separate private R2 bucket**, without an r2.dev public endpoint or public custom domain. Configure `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME`; it must differ from the existing public bucket. Restrict credentials/IAM. Application configuration checks cannot prove bucket privacy.
3. Test a disposable **approved staging object**: anonymous origin/CDN GET and guessed-key access must fail; server SDK read must succeed; authorized application download must succeed; unrelated/expired/revoked access must fail. Verify HTTPS/Secure cookies and Firebase Admin session-cookie creation. Do not perform these tests using customer files.
4. Merge and review Firestore rules so browser clients cannot read/write `storage_objects`, `enquiry_controls` or `legacy_storage_cleanup`, or bypass server ownership checks on business records. An added `allow false` does not override a broader matching `allow true`; evaluate the complete deployed rules. Admin SDK bypasses rules. Verify staging rules before rollout.

## Approved migration procedure

1. Group references by source URL hash and related property. Separate public cover/banner references from private references, even if they share bytes or the same old URL. Preserve current public photography. Never attach one private managed object to unrelated properties.
2. Re-read each source record and verify the saved hash, property relationship and file field. Resolve only configured R2/GCS buckets; do not fetch arbitrary external hosts or redirects. Use IAM SDK reads, not public URL tokens.
3. Copy each confidential object into `managed/<new UUID>` in the private bucket, or upload bounded decoded embedded bytes. Create a durable `storage_objects` upload intent first. Retain a checksum, size, MIME and verification evidence; verify target bytes before switching references. No new GCS public ACLs are needed.
4. Atomically replace all approved references and establish registry bindings using compare-and-set source hashes. Mark the managed asset private-only. Copies in notifications, inspection fields, service responses and property history must be included where applicable. If metadata commit fails, leave the private target reconcilable; retain the original source.
5. Validate owner, current tenant, administrator and unrelated-user downloads, property transfer/revocation, previews and deletion behavior. Keep source→target audit evidence server-side. Reconcile aliases so no live approved reference is missed. Do not regard replacing metadata as revoking the old URL.
6. **Separate explicit revocation approval:** delete only verified obsolete source object keys, or change the exact approved policy/ACL needed to revoke access. A public R2 bucket has no per-object private ACL escape hatch: copying to a private bucket does not make the old copy private. Disabling the entire public bucket would break remaining public photos and is not approved by this plan.
7. For GCS, review public ACLs/IAM and Firebase download-token metadata. Revocation/deletion/token rotation and CDN cache invalidation all modify live customer delivery and require approval. Purge relevant cached originals after approved source revocation. Previously downloaded copies cannot be recalled.
8. Re-scan Firestore and verify anonymous access to each retired test scope fails, while public photographs remain usable. Record exceptions, inaccessible sources, legal holds and failed revocations. Do not mark migration complete while old public copies remain accessible.

## Cleanup and ongoing operations

- `GET /api/admin/storage-reconciliation` is admin-only and dry-run; follow `nextCursor` to inspect all pages.
- `POST` accepts at most 20 explicit managed IDs. It rechecks live bindings in a transaction, honors a 24-hour grace period for unused uploads, and uses deletion leases. It cannot delete an object by an arbitrary key or legacy URL. Do not run it against live customer scope during this development task.
- Failed document deletion retains a visible pending document and private registry intent, revokes delivery, returns an error and supports retry. The reconciler can finish the exact authorized deletion intent. Failed SDK deletion never silently becomes success.
- `legacy_storage_cleanup` entries require approval and manual/migration review; the reconciler intentionally does not execute these historical deletions.
- Configure an approved recurring dry-run/reconciliation process and monitoring before production rollout. No automatic production scheduler was installed or invoked here.
- Enable Firestore TTL on `enquiry_controls.ttlAt` after deployment approval. Replay validity/rate windows do not depend on timely TTL deletion, but TTL prevents indefinite control-record growth. Registry/deletion audit retention needs an explicit policy.

## Rollback

Before source revocation, pause migration and restore only compare-and-set metadata snapshots if authorized, retaining target registry evidence. Do not restore public URLs for confidential material as an automatic rollback. After revocation, recover from the approved private backup/copy and maintain authenticated delivery. Never roll back by reopening a private bucket.

Production storage privacy remains **BLOCKED until deployed IAM/public endpoints, client rules, real sessions and approved migration/revocation are tested**. No live policy claim follows from isolated passing tests.
