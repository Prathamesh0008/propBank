# Property submission failure: c6206a14-3dee-4243-a02d-8a9cb1db82c5

## Confirmed diagnosis

The exact reference is present at `.next/dev/logs/next-development.log:77`:

```text
timestamp: 00:40:27.258
event: property_creation_failed
reference: c6206a14-3dee-4243-a02d-8a9cb1db82c5
code: 8
```

The frames are Google gRPC/Google GAX frames. Code 8 is RESOURCE_EXHAUSTED.
Nearby Firestore-backed property, user, listing, relationship and image-upload
requests explicitly log `Quota exceeded.` with the same code. This establishes
a Firestore service quota failure, rather than evidence of a frontend validation
failure or R2 object-storage rejection. The creation catch did not recognize code
8, so it replaced the failure with the generic message reported by the user.

The historical entry did not log its application operation or dependency details.
It cannot establish whether that submission failed at its profile read, receipt
read, image metadata write, or business transaction. It also cannot establish
which quota dimension was exhausted or whether that request committed anything.
Those details must not be inferred from the generic stack frames. New diagnostics
record the application stage to resolve this gap on any subsequent failure.

## Architecture and configuration inspection

- Submission, admin review and public listing APIs share the existing server
  Firebase data app and `properties` collection. The Firebase Auth app is separate.
- Local Auth and data service-account JSON both parse and match their configured
  project IDs. The browser project matches the Auth project. No secret values
  were printed or changed. This is a configuration-shape check, not a live IAM test.
- Images use managed private R2 storage, with Firestore `storage_objects`
  metadata and authenticated `/api/media/...` URLs. Uploading requires a durable
  Firestore intent before the R2 write and a metadata update afterwards. Thus a
  Firestore quota outage can prevent image upload even if R2 is healthy.
- R2 credential variables and a separate private bucket are configured locally.
  Actual R2 access and Firestore connectivity after quota restoration need live
  verification. No live records, objects, billing settings or permissions were changed.

## Code changes in this task

- `src/lib/server/services/properties.ts`: recognize Firestore quota, permission,
  credential and availability codes; return JSON with safe messages and support
  references; log stage, dependency code/name, safe storage HTTP status, elapsed
  time and source frames. Track authentication/profile, receipt, image, transaction
  read/binding/commit and post-commit stages. Reuse an already validated self
  profile to avoid a redundant Firestore read. Check concurrent duplicate receipt
  resolution before acknowledging success. Return HTTP 400 for invalid tenant
  phone input rather than misclassifying it as infrastructure failure.
- `src/lib/server/http.ts`: allow API errors to retain their original cause.
- `src/lib/server/services/media.ts`: retain the underlying upload or metadata
  update failure when cleanup handling wraps it.
- `src/lib/server/services/property-images.ts`: preserve the dependency cause,
  stop after the first failure and retain existing cleanup behavior.
- `src/features/properties/property-response.ts`: preserve structured failure
  code/reference and refuse a success acknowledgement without a property ID.
- `src/features/properties/AddPropertyForm.tsx` and `TenantPropertyForm.tsx`:
  synchronous in-flight guards prevent duplicate submissions before React's
  disabled-button state updates; do not submit while image uploads are in flight.

The earlier public-listing changes already present in the working tree are
preserved. No approval field, collection, dependency, or database was added.

## Persistence and approval guarantees inspected

The existing transaction still saves the property, required tenant/relationship
records, managed image bindings, deduplication receipt and notification outbox
together. Success follows the awaited commit. Identical retries resolve the same
receipt/property; the duplicate branch now checks that the property exists.
Selected image failures prevent the property transaction from starting.
Provider delivery is dispatched after commit through the existing guarded outbox.

Creation sets `moderationStatus: pending_review` and revision 1. Only authorized
admin decisions can persist `approved` or `rejected`, with revision checks and
history. Both public list endpoints query approved records and apply the shared
eligibility policy; public detail reads use the same policy. Pending/rejected,
inactive, tenant-created, managed-only, sold and rented records remain excluded
as required by the existing policy. Public responses retain their privacy
allowlist. Existing mutation refresh events keep mounted list views synchronized.

## Verification and required infrastructure action

`npm.cmd run typecheck` passed. `git diff --check` also passed (line-ending warnings
only). Only TypeScript checking was run as an executable application check for this
task. Source tracing, log correlation
and configuration-shape inspection are lightweight read-only checks, not live
submission/approval tests. No unit suites, Playwright, browser E2E or production
build were run. Successful live persistence cannot be asserted from these checks.

In the Firebase **data** project, inspect Firestore Usage and the Google Cloud
Firestore API quota pages, plus billing status. Identify the exhausted dimension.
If daily free quota was exhausted, wait for its reset or enable billing; if another
configured quota is responsible, resolve that specific limit. No code change can
restore an exhausted service quota. Official documentation:
https://firebase.google.com/docs/firestore/quotas

After service is restored, verify one valid submission with images, confirm one
pending property and its stored managed URLs, retry the identical submission to
confirm its ID is reused, approve it as admin, and refresh both public list pages
and its detail page. Separately verify a rejected submission stays hidden. Check
any new error reference against the operation recorded in the server log. Do not
assume the historical failed request saved nothing; inspect My Properties/admin
before recreating it with changed details.
