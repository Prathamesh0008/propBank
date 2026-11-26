# Property Details advertisements

Implemented locally; no production data, settings or storage were accessed for verification.

## Management and storage

The existing Admin Portal has an Advertisements section. Only verified administrators can list, upload, replace, activate, deactivate, delete or recover advertisements. The browser uses the existing authenticated API client.

Metadata lives in the `advertisements` Firestore collection. Each advertisement has a UUID, private image binding, optional HTTPS destination, active flag, version and creation/update timestamps. The server-only `__inventory` document bounds the inventory to 40 advertisements and 8 active advertisements. Public reads use a bounded single-field active query; no new composite index is required with normal Firestore single-field indexing enabled.

Images use the existing R2 client and configured private bucket, under `advertisements/<advertisement UUID>/<operation UUID>.webp`. The configured private bucket must be distinct from the public bucket. No new provider or credential is introduced. Uploaded JPEG, PNG and WebP files are limited to 4 MB and 24 megapixels, decoded, oriented, resized inside 2400 x 2400 without cropping, and re-encoded as WebP without EXIF/GPS metadata. Animated files are rejected. Public responses expose only ID, application image URL, dimensions and optional destination; raw storage bindings remain private.

## Reliability

Create requests have UUID idempotency keys. Edit/delete requests require the latest version. Transactions persist upload intent before storage writes and preserve the previous image until replacement commits. Unique immutable keys prevent overwriting another advertisement. Deactivation/deletion removes public access before cleanup. Failed cleanup remains visible to administrators. Use Recover upload / retry cleanup after the two-minute upload lease expires; refresh and retry if storage is unavailable. Recovery is manual in Admin, not a new scheduled worker. Deleted metadata remains as an idempotency tombstone; successfully cleaned records leave the bounded inventory.

## Display

`GET /api/advertisements` is read-only, active-only and limited to eight. Image delivery rechecks active state on every request and uses no-store responses. Administrators can preview inactive images through an authenticated request. The image-only component reserves intrinsic dimensions, does not crop, and rotates every three seconds only when the next image has loaded. It pauses on hidden tabs, hover/focus and reduced-motion preference. HTTPS destinations open in a new tab with noopener/noreferrer; absent destinations have no click action. No active advertisements means no banner. Ads follow the main content on mobile using the existing sidebar ordering.

## Verification boundary

Tests use isolated Firestore/Auth/R2 fixtures and real local Sharp decoding with synthetic images. These are not live uploads, production persistence checks or device/browser acceptance tests. Live credentials, deployed Firestore client rules and R2 access remain unverified; no settings were changed. Direct browser Firestore access must remain denied for this server-managed collection. No emulator, emails, cron invocations, commits, pushes or deployments were used.
