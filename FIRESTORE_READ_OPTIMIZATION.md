# Firestore read optimization

Implemented locally on 2026-11-04. Auth remains `propbank-7601b`; Firestore remains
`propbank-944fc/(default)`. No live database queries, writes, jobs, migrations,
emails, uploads or load tests were executed to validate this work.

## Audit and changes

| Read source | Implemented change | Practical limit |
|---|---|---|
| Manage Property | Reuse the already combined owner/tenant response; remove the second tenant endpoint request. Preserve its tenant projection. | The remaining tenant-membership query scans properties because legacy embedded tenant arrays have no queryable UID index. |
| Admin route guards and role/profile-only consumers | Request `users/{uid}?summary=true`, which skips property relationships and auth activity. | Server identity, active profile, verified email and role are checked freshly; full user-detail requests retain their dossier. |
| Query focus, mount and retries | 60-second freshness for core property, hub, enquiry and admin visit queries; remove forced `always` refetches. Default query retry is disabled. | Stale navigation/focus still refreshes. Manual refresh and successful mutations remain available. This is presentation caching, not server permission caching. |
| Admin user directory | Enable only on its own tab; remove duplicate imperative refetch; scope its key to UID. | Opening the directory still retrieves all users. |
| Pending Connections | Keep mutation/manual/stale-focus refresh and change fallback polling from 30 to 120 seconds. | Other-device changes can take up to two minutes; legacy per-status queries remain. |
| Auth initialization | Run initial discovery once per verified UID/email per provider lifetime, not again on each same-identity token renewal. | Pending Connections retains its own discovery/manual refresh. Failed initial discovery is eligible on a later identity callback. |
| Hidden query observers | Invalidation marks data stale without immediate hidden-tab refetch; visible broadcasts do not cancel/restart an in-flight query. | Active imperative screens have their own refresh callbacks; those are not universally deferred. |
| Admin refresh events | Refresh notifications/settings only on relevant tabs, and property details only when open. | Required mutation invalidation is preserved. |
| Visit Planner | Load public property choices only when the form opens; share cached public results with the landing page. | Visit history still loads normally. |
| Landing and search | Share/deduplicate public reads for 60 seconds; cache searches by actual server parameters; avoid the redundant first query when multiple listing types are selected. | Different uncached searches still issue requests. Results remain complete for client filters. |
| Public list/search | Add the existing required `moderationStatus == approved` condition to Firestore, before existing visibility checks. | Arbitrary text/category filtering still scans the approved candidate set. |
| Document lists | Move the optional document-type filter into the property-scoped Firestore query. | Membership authorization remains before query execution. |
| Archived notifications | Query `isRead == true` instead of loading unread and read records together. | An archive page still loads all matching notifications. |
| Admin enquiries and visit filters | Query only enquiry-related email events; push the exact visit property-ID filter into Firestore. | Enquiry assignment lookups remain per enquiry. Unfiltered admin visits and date/status filtering still load the complete visit collection. |
| Admin email history | Read 50 records plus one lookahead per UI page, newest first; snapshot cursors handle equal timestamps. Load more explicitly. | Filters apply to loaded/scanned pages; continue loading older history for more matches. This avoids adding composite indexes. A separate bounded legacy mode retains access to undated records. Cursor lookup adds one document read on subsequent pages. |
| Portfolio hub and reminders | Reviewed existing implementations; preserve batched `propertyId in` related reads and bounded reminder scans/cursors. | Portfolio initially scans properties; rent reminders scan up to 250 properties and visit reminders up to 1,000 visits per invocation. Scheduler frequency is an external cost multiplier. |

Sorting and Pending Approval counts still operate on the complete authorized
property set. They were not changed to a partial page, which would make their
counts and global submission ordering incorrect. No new collection, persisted
counter, timestamp, role, Firebase environment or permission system was added.

## Diagnostics

Run `node scripts/audit-firestore-reads.cjs` for a static source inventory in
`backend-audit/firestore-read-inventory.json`. It performs no network calls and
records file, line and operation only. Generic `.get()` candidates include
Map/Headers/URL operations; the inventory is not a billed-read counter.

Optional server-only `PROPBANK_READ_METRICS=1` enables process-local counters for
property lists, property detail reads and email-history pages. No setting was
changed automatically. Logs include fixed labels, query counts, returned-document
counts and estimated document reads only. They do not include document IDs,
customer data, URLs, filters or credentials. Counters reset when the process
restarts and do not include all application reads, index-entry charges, cursor
lookups, SDK retries or transaction retries. Do not interpret them as a billing meter.

## Verification and expected impact

Isolated fixtures verify one Manage Property request instead of two, a one-profile
admin role check without property/activity scans, bounded history pages, filtered
document/archive reads, public approval filtering, cache deduplication and
invalidation, role changes, account separation, approval counts and legacy sorting.
Tests use mocked Firebase, Auth, Resend and storage; they do not measure production.

The timer change permits one quarter as many fallback refreshes while pending
rows remain (30 versus 120 potential requests per hour of active use). Actual
query cost varies by results and activity. No daily savings, quota recovery or
maximum production read budget has been measured or guaranteed.

Remaining expensive paths include legacy tenant membership, portfolio discovery,
admin properties/users/visits, enquiry lists and assignment lookups, auth activity retention and
unindexed arbitrary search. Eliminating those scans completely requires additional
schema/index and pagination design that preserves legacy relationships and full
directory counts. Other deployments, devices and external schedulers can still
consume the same project quota.

References: [Firestore billing](https://firebase.google.com/docs/firestore/pricing),
[cursor pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors),
[stale-query focus behavior](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching).
