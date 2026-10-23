# Property Database Reset Report

## Final status

**PASS — the revised authorized property reset completed successfully.**

No backup was created. No Firebase Authentication account or Firestore user profile was deleted. No email, notification, deployment, or scheduler invocation occurred.

## Verified targets

- Firestore project: `propbank-944fc`
- Firestore database: `(default)`
- Firebase Authentication project: `propbank-7601b`
- Git branch: `feature/property-management-improvements`

The preflight revalidated every approved collection count, all 23 property IDs, dependency relationships, profile references, storage bindings, bucket locations, email retry states, and preserved account totals before its first write.

## Firestore results

| Collection | Before | Deleted | After | Status |
|---|---:|---:|---:|---|
| `properties` | 23 | 23 | 0 | PASS |
| `admin_notifications` | 55 | 55 | 0 | PASS |
| `documents` | 9 | 9 | 0 | PASS |
| `inspection_reports` | 1 | 1 | 0 | PASS |
| `property_submissions` | 4 | 4 | 0 | PASS |
| `reviews` | 2 | 2 | 0 | PASS |
| `tenants` | 7 | 7 | 0 | PASS |
| `storage_objects` | 15 | 9 | 6 | PASS — uncertain orphans retained |

Total Firestore documents deleted: **110** (23 properties, 78 dependent records, and 9 exclusive storage metadata records).

## User profiles

- User profiles preserved: **15**
- Profiles with confirmed relationships to deleted properties: **2**
- Confirmed property-reference fields cleared: `rentedPropertyId`, `rentedPropertyOwnerId`, and `rentedPropertyOwnerName`
- Profiles still pointing to deleted property IDs: **0**
- Roles, verification status, identity data, and unrelated profile fields were preserved.

## Email deliveries and reminders

- Historical email-delivery records preserved: **8**
- Sent historical deliveries preserved: **6**
- Failed property-related deliveries preserved and made ineligible for retry: **2**
- Retryable deliveries referring to deleted properties after cleanup: **0**
- Pending property reminder source records after cleanup: **0**

Property reminders are derived from property and tenancy records. Removing all properties and tenants prevents the reminder scheduler from rediscovering the removed relationships.

## Storage results

### Deleted managed private objects

- Exclusive managed objects deleted from private storage: **9**
- Corresponding `storage_objects` metadata deleted: **9**
- Expected managed objects already missing: **0**
- Managed deletion failures: **0**

### Retained unattached managed objects

The following six records and their underlying files were retained because they were pending/unattached and were not proven to belong exclusively to the removed properties:

- `071f412d-fda0-4f90-a087-a7fa5b9f1d14`
- `957c5eb1-e377-48ae-a86d-41fbf2eb16ac`
- `adb6199a-4cce-499c-bdb0-c6ce58f14fc4`
- `b57e19f6-2382-4c6a-90fa-61afd1e5c7df`
- `d4f3c778-d0f3-47b6-b462-f7b7049d6c58`
- `e1bf8450-f4c1-4c93-8301-6467391b510d`

No storage URLs or access tokens are included in this report.

### Legacy objects

- Legacy URL candidates inspected: **27**
- Exclusive configured-bucket objects deleted: **25**
- Objects already missing: **0**
- Deletion failures: **0**
- Uncertain legacy objects retained: **2**

The two uncertain objects were retained as required. Their URLs are intentionally omitted.

## Preserved records

| Record type | Before | After | Status |
|---|---:|---:|---|
| Firebase Authentication accounts | 18 | 18 | PRESERVED |
| Firestore user profiles | 15 | 15 | PRESERVED |
| Authentication activity records | 17 | 17 | PRESERVED |
| Site settings | 1 | 1 | PRESERVED |
| General visits without property links | 6 | 6 | PRESERVED |
| Historical email deliveries | 8 | 8 | PRESERVED |

## Final verification

- Admin Properties backing collection returns zero property records: **PASS**
- Public listing backing collection returns zero property records: **PASS**
- Approved dependent collections contain zero targeted records: **PASS**
- Preserved profiles contain no references to the deleted property IDs: **PASS**
- No property-related failed delivery remains eligible for retry: **PASS**
- No property or tenancy record remains available to generate rent/agreement reminders: **PASS**
- Authentication accounts and preserved unrelated data retain their original counts: **PASS**

The reset is complete. Six unattached managed objects and two uncertain legacy objects remain intentionally retained and are not counted as failures.

