# API REFERENCE

> Current mobile policy: schema-2 legacy reservations supersede earlier all-conflicts-must-be-fixed activation requirements. Unique contacts are reserved; duplicate numbers are ownerless blocked claims; missing/invalid profiles are locked in mobile_number_registry_accounts. Historical users stay unchanged. Three private registry collections make 25 total source collections; no new API. [Current design, tests and controlled runbook](../MOBILE_LEGACY_RESERVATIONS.md).


> Implementation update (2026-11-06): K05 has a tested transaction-backed mobile registry implementation on `fix/mobile-number-uniqueness`, but production reconciliation/backfill/activation is pending. The historical statements below describe the audited starting commit. Current behavior, two new server-only collections (24 total), fail-closed rollout requirements and test limits supersede those mobile-specific statements: [Mobile uniqueness implementation and rollout](../MOBILE_NUMBER_UNIQUENESS.md).


> Source audit: 2026-11-06 (Asia/Calcutta). Branch `main`, commit `fa98b7e0e53d29053365be4c1a1b8230a313f686`. Static inspection only; no production database access, external service health checks, browser tests, migrations, push or deployment. ?Implemented? means a source-complete path with identifiable validation and authorization; it does not certify successful runtime operation. Historical reports are secondary evidence only.

## Coverage and shared behavior

60 route files; **89 business HTTP method/path operations**, excluding OPTIONS and explicit unsupported exports. Methods below are statically wired; none were called against live services. Route paths use Next segment notation [id]/[propertyId]/[userId] and [...path]; substitute an encoded ID/path on actual requests. All route source files are listed per operation.

Shared source: `src/lib/server/http.ts`, `src/lib/server/auth.ts`, `src/lib/server/permissions.ts`. Authentication below means a Firebase bearer token plus active, verified-email, completed Firestore profile unless explicitly excepted. Refer to AUTH_AND_SECURITY for contextual roles. Same-origin browser requests use `apiFetch`; server Admin SDK bypasses client rules.

Unless explicitly stated otherwise, success is HTTP 200. Creates often use 201; idempotent replays often use 200. API envelopes vary: bare arrays, data/user/property/record fields, null collections and omitted data fields coexist. Clients must check HTTP status and success semantics. JSON helper adds private,no-store and projects private file references; plain errors can be text/plain. Shared AccessError/ApiError is JSON {success:false,message,code?} with 401/403 or its explicit status; 429 adds Retry-After:60. Unexpected failures produce sanitized 500 plain/JSON depending handler; Firestore quota -> 503 FIRESTORE_RESOURCE_EXHAUSTED; transient dependency codes -> 503 SERVICE_UNAVAILABLE with reference. Domain code also returns direct 400/404/409/413/502/503 responses. Unsupported exported methods return 405; OPTIONS supports CORS preflight.

`native-group1.ts` and `native-group2.ts` preserve legacy trailing-slash redirects/missing-ID responses. In particular bare files and documents/property routes redirect; certain upload/agreement trailing-slash requests return a legacy 200 compatibility response without invoking mutation. Do not interpret that response as a successful business operation.

## Operation reference

### GET `/api/account`

- **Purpose:** read my account.
- **Authentication/permissions:** Completed self identity; recent auth and verified Auth phone for mobile changes.
- **Request contract:** PATCH JSON: name required; phoneNumber, photoURL, bio, agencyName, agencyPhone, agencyWebsite, notificationPreferences. GET has no input.
- **Response:** GET {success,account:{profile,agency,provider metadata,activity,phoneVerified}}; PATCH {success,message}.
- **Database operations/dependencies:** users, auth_activity, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/account/route.ts`.
- **Handler evidence:** `src/lib/server/services/account.ts:38` (readMyAccount).

### PATCH `/api/account`

- **Purpose:** update my account.
- **Authentication/permissions:** Completed self identity; recent auth and verified Auth phone for mobile changes.
- **Request contract:** PATCH JSON: name required; phoneNumber, photoURL, bio, agencyName, agencyPhone, agencyWebsite, notificationPreferences. GET has no input.
- **Response:** GET {success,account:{profile,agency,provider metadata,activity,phoneVerified}}; PATCH {success,message}.
- **Database operations/dependencies:** users, auth_activity, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error()`; `new ApiError(400,'Invalid account update')`; `new ApiError(400,'Account role, status and email cannot be changed through profile settings')`; `new ApiError(400,'Enter a valid full name')`; `new AccessError(403,'Recent authentication is required to change the mobile number')`; `new ApiError(503,'Phone verification is not configured or the new number has not been verified')`; `new ApiError(409,'This phone number is already registered with another account')`.
- **Route source:** `src/app/api/account/route.ts`.
- **Handler evidence:** `src/lib/server/services/account.ts:55` (updateMyAccount).

### POST `/api/account/security-event`

- **Purpose:** record account security event.
- **Authentication/permissions:** Completed self identity, auth_time within 300 seconds. Logs a client-reported operation.
- **Request contract:** JSON action=password_changed or email_change_requested; operationId UUID-shaped string.
- **Response:** {success,message}.
- **Database operations/dependencies:** auth_activity, users, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error()`; `new ApiError(400,'Invalid security event')`; `new ApiError(400,'A valid security operation reference is required')`; `new AccessError(403,'Recent authentication is required for security changes')`; `new ApiError(400,'Unsupported security event')`.
- **Route source:** `src/app/api/account/security-event/route.ts`.
- **Handler evidence:** `src/lib/server/services/account.ts:86` (recordAccountSecurityEvent).

### GET `/api/admin/email-deliveries`

- **Purpose:** list email deliveries.
- **Authentication/permissions:** Admin.
- **Request contract:** Query status, eventType, pageSize integer 1..200 default 100, after document ID, legacy=true.
- **Response:** {success,deliveries:[masked recipient, no html/text],nextCursor}; filters apply inside a bounded page.
- **Database operations/dependencies:** email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required')`; `new ApiError(400,'Invalid delivery page')`; `new ApiError(409,'Delivery page changed; refresh history')`.
- **Route source:** `src/app/api/admin/email-deliveries/route.ts`.
- **Handler evidence:** `src/lib/server/services/transactional-email.ts:141` (listEmailDeliveries).

### POST `/api/admin/email-deliveries/[id]/retry`

- **Purpose:** retry email delivery.
- **Authentication/permissions:** Admin; existing eligible pending/failed or expired-lease send, attempts below 5, still-current invitation/reminder.
- **Request contract:** Path id; POST JSON {} only; no message/recipient edits.
- **Response:** {success,message}; delivery queued for after-response attempt.
- **Database operations/dependencies:** email_deliveries, relationship_links, properties, tenants, users. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required')`; `new ApiError(400,'Retry does not accept message or recipient changes')`; `new ApiError(404,'Delivery not found')`; `new ApiError(409,'Reminder is obsolete and cannot be retried')`; `new ApiError(409,'Invitation is obsolete and cannot be retried')`; `new ApiError(409,'Delivery is not eligible for retry')`.
- **Route source:** `src/app/api/admin/email-deliveries/[id]/retry/route.ts`.
- **Handler evidence:** `src/lib/server/services/transactional-email.ts:190` (retryEmailDelivery).

### GET `/api/admin/notifications`

- **Purpose:** list notifications.
- **Authentication/permissions:** GET admin globally; property member for property scope. POST public only general_inquiry with no userId or Authorization; otherwise completed identity with type/property restrictions.
- **Request contract:** GET query propertyId or unread=true/false. POST CreateAdminNotificationRequest: type,title,message, userId and propertyId as applicable; general_inquiry also inquiryType,propertyType,userName,userEmail,userPhone,requestVisit/visitDate/visitTime. Optional Idempotency-Key 16..128 safe characters for enquiry intake.
- **Response:** GET bare notification array (not success envelope). POST {success,message,duplicate,notification,emailNotification?}, 201 or duplicate 200.
- **Database operations/dependencies:** admin_notifications, users, properties, storage_objects, enquiry_controls, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/admin/notifications/route.ts`.
- **Handler evidence:** `src/lib/server/services/notifications.ts:93` (listNotifications).

### POST `/api/admin/notifications`

- **Purpose:** post notification.
- **Authentication/permissions:** GET admin globally; property member for property scope. POST public only general_inquiry with no userId or Authorization; otherwise completed identity with type/property restrictions.
- **Request contract:** GET query propertyId or unread=true/false. POST CreateAdminNotificationRequest: type,title,message, userId and propertyId as applicable; general_inquiry also inquiryType,propertyType,userName,userEmail,userPhone,requestVisit/visitDate/visitTime. Optional Idempotency-Key 16..128 safe characters for enquiry intake.
- **Response:** GET bare notification array (not success envelope). POST {success,message,duplicate,notification,emailNotification?}, 201 or duplicate 200.
- **Database operations/dependencies:** admin_notifications, users, properties, storage_objects, enquiry_controls, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Internal notification types are server controlled')`; `new ApiError(404,'Property not found')`; `new ApiError(404,'Available property not found')`; `new ApiError(400,'Enter a valid Indian mobile number')`; `new ApiError(400,'Enquiry details exceed the allowed size')`; `new ApiError(400,'Valid inquiry type, property type, name, email and phone are required')`; `new ApiError(400,'Valid future preferred date and time are required')`.
- **Route source:** `src/app/api/admin/notifications/route.ts`.
- **Handler evidence:** `src/lib/server/services/notifications.ts:34` (postNotification).

### PUT `/api/admin/notifications/[id]/read`

- **Purpose:** read notification.
- **Authentication/permissions:** Admin.
- **Request contract:** Path id; optional JSON action=unarchive; defaults archive. Optional body parsing depends on Content-Length>0.
- **Response:** {message,id,action}; uses isRead as archive state.
- **Database operations/dependencies:** admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/admin/notifications/[id]/read/route.ts`.
- **Handler evidence:** `src/lib/server/services/notifications.ts:103` (readNotification).

### PUT `/api/admin/notifications/[id]/remarks`

- **Purpose:** remarks notification.
- **Authentication/permissions:** Admin.
- **Request contract:** Path id; JSON remarks, optional adminImage managed reference/base64.
- **Response:** {success,message,id,remarks,adminImage}.
- **Database operations/dependencies:** admin_notifications, users, storage_objects, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error('Invalid string')`; `new ApiError(404,'Notification not found')`.
- **Route source:** `src/app/api/admin/notifications/[id]/remarks/route.ts`.
- **Handler evidence:** `src/lib/server/services/notifications.ts:110` (remarksNotification).

### DELETE `/api/admin/notifications/[id]`

- **Purpose:** delete notification.
- **Authentication/permissions:** Admin.
- **Request contract:** Path id; DELETE no body.
- **Response:** {message,id}.
- **Database operations/dependencies:** admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/admin/notifications/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/notifications.ts:122` (deleteNotification).

### POST `/api/admin/properties/[id]/tenancy`

- **Purpose:** manage admin tenancy.
- **Authentication/permissions:** Admin; assignment requires registered active identity and consistent tenant contact.
- **Request contract:** Path property id; JSON action assign/replace/remove, expectedRevision nonnegative integer; assign/replace tenant object with firstName,lastName,email,phone,userUID and terms; remove tenantId for the active row.
- **Response:** {success,message,tenancyRevision,tenant?}; conflicts if tenancy revision changed.
- **Database operations/dependencies:** properties, tenants, users, relationship_links, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required')`; `new ApiError(404,'Property not found')`; `new ApiError(409,'Verified property ownership is required before assigning a tenant')`; `new ApiError(409,'Tenancy changed; refresh before continuing')`; `new ApiError(409,'Property already has an active tenant; use replace instead')`; `new ApiError(409,'Tenant already has an active relationship with this property')`; `new ApiError(409,'Property has no active tenant to replace')`; `new ApiError(409,'Active tenant relationship not found')`; `new ApiError(409,'Property relationship history limit reached')`.
- **Route source:** `src/app/api/admin/properties/[id]/tenancy/route.ts`.
- **Handler evidence:** `src/lib/server/services/tenants.ts:111` (manageAdminTenancy).

### GET `/api/admin/site-settings`

- **Purpose:** site settings.
- **Authentication/permissions:** GET public in service; PUT/PATCH admin.
- **Request contract:** GET no body; PUT/PATCH SiteSettings fields: quote,quoteAuthor,heroTitle,heroSubtitle,announcementText,isAnnouncementActive,bannerImages.
- **Response:** GET {success,settings}; PUT/PATCH {success,message,settings}; defaults when document missing/read fails.
- **Database operations/dependencies:** siteSettings/main_settings, storage_objects. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/admin/site-settings/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:195` (siteSettings).

### PUT `/api/admin/site-settings`

- **Purpose:** site settings.
- **Authentication/permissions:** GET public in service; PUT/PATCH admin.
- **Request contract:** GET no body; PUT/PATCH SiteSettings fields: quote,quoteAuthor,heroTitle,heroSubtitle,announcementText,isAnnouncementActive,bannerImages.
- **Response:** GET {success,settings}; PUT/PATCH {success,message,settings}; defaults when document missing/read fails.
- **Database operations/dependencies:** siteSettings/main_settings, storage_objects. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/admin/site-settings/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:195` (siteSettings).

### PATCH `/api/admin/site-settings`

- **Purpose:** site settings.
- **Authentication/permissions:** GET public in service; PUT/PATCH admin.
- **Request contract:** GET no body; PUT/PATCH SiteSettings fields: quote,quoteAuthor,heroTitle,heroSubtitle,announcementText,isAnnouncementActive,bannerImages.
- **Response:** GET {success,settings}; PUT/PATCH {success,message,settings}; defaults when document missing/read fails.
- **Database operations/dependencies:** siteSettings/main_settings, storage_objects. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/admin/site-settings/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:195` (siteSettings).

### GET `/api/admin/storage-reconciliation`

- **Purpose:** reconcile media.
- **Authentication/permissions:** Admin; POST performs real managed-object deletion after cleanup/grace checks.
- **Request contract:** GET query cursor UUID. POST JSON ids array at most 20 UUIDs; optional query cursor still processed.
- **Response:** GET {success,dryRun:true,candidates,limited,nextCursor}; POST {success,results:[{id,status,message?}]}.
- **Database operations/dependencies:** storage_objects and records referenced by bindings; documents for pending delete. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Invalid reconciliation cursor')`; `new ApiError(400,'Invalid reconciliation request')`; `new ApiError(400,'Supply at most 20 managed file IDs')`.
- **Route source:** `src/app/api/admin/storage-reconciliation/route.ts`.
- **Handler evidence:** `src/lib/server/services/media.ts:257` (reconcileMedia).

### POST `/api/admin/storage-reconciliation`

- **Purpose:** reconcile media.
- **Authentication/permissions:** Admin; POST performs real managed-object deletion after cleanup/grace checks.
- **Request contract:** GET query cursor UUID. POST JSON ids array at most 20 UUIDs; optional query cursor still processed.
- **Response:** GET {success,dryRun:true,candidates,limited,nextCursor}; POST {success,results:[{id,status,message?}]}.
- **Database operations/dependencies:** storage_objects and records referenced by bindings; documents for pending delete. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Invalid reconciliation cursor')`; `new ApiError(400,'Invalid reconciliation request')`; `new ApiError(400,'Supply at most 20 managed file IDs')`.
- **Route source:** `src/app/api/admin/storage-reconciliation/route.ts`.
- **Handler evidence:** `src/lib/server/services/media.ts:257` (reconcileMedia).

### GET `/api/admin/users/search`

- **Purpose:** search users for admin.
- **Authentication/permissions:** Admin; also checks Firebase Auth account active state.
- **Request contract:** Query q 2..100 characters.
- **Response:** {success,users:[{uid,name,email,phoneNumber,role,isActive}]}, at most 20 matches after full scan.
- **Database operations/dependencies:** users. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required')`.
- **Route source:** `src/app/api/admin/users/search/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:95` (searchUsersForAdmin).

### GET `/api/admin/visits`

- **Purpose:** list admin visits.
- **Authentication/permissions:** Admin.
- **Request contract:** Query status=scheduled/completed/cancelled, propertyId, dateFrom/dateTo YYYY-MM-DD optional.
- **Response:** {success,visits:[visit plus managementVersion,visitAdminHistory,requester,property]}.
- **Database operations/dependencies:** visits, users, properties. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Invalid visit filter')`; `new ApiError(400,'Invalid visit date filter')`; `new ApiError(400,'Visit date range is reversed')`.
- **Route source:** `src/app/api/admin/visits/route.ts`.
- **Handler evidence:** `src/lib/server/services/visits.ts:153` (listAdminVisits).

### POST `/api/agreements/renew`

- **Purpose:** owner agreement.
- **Authentication/permissions:** Active tenant for request-* route; exact property.ownerUID for owner route. Admin role alone does not bypass exact owner.
- **Request contract:** JSON propertyId required; action; requestId for resolving pending requests; terms object of string agreement/rent fields for renewal; noticePeriod,noticeStartDate,terminationDate for notice. Renewal actions request/approve/complete/reject; termination request/terminate/reject. Tenant request routes allow request only.
- **Response:** {success,message,property,request}; existing pending/version/state conflicts 409.
- **Database operations/dependencies:** properties, tenants, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/agreements/renew/route.ts`.
- **Handler evidence:** `src/lib/server/services/agreements.ts:130` (ownerAgreement).

### POST `/api/agreements/request-renewal`

- **Purpose:** tenant agreement.
- **Authentication/permissions:** Active tenant for request-* route; exact property.ownerUID for owner route. Admin role alone does not bypass exact owner.
- **Request contract:** JSON propertyId required; action; requestId for resolving pending requests; terms object of string agreement/rent fields for renewal; noticePeriod,noticeStartDate,terminationDate for notice. Renewal actions request/approve/complete/reject; termination request/terminate/reject. Tenant request routes allow request only.
- **Response:** {success,message,property,request}; existing pending/version/state conflicts 409.
- **Database operations/dependencies:** properties, tenants, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/agreements/request-renewal/route.ts`.
- **Handler evidence:** `src/lib/server/services/agreements.ts:131` (tenantAgreement).

### POST `/api/agreements/request-termination`

- **Purpose:** tenant agreement.
- **Authentication/permissions:** Active tenant for request-* route; exact property.ownerUID for owner route. Admin role alone does not bypass exact owner.
- **Request contract:** JSON propertyId required; action; requestId for resolving pending requests; terms object of string agreement/rent fields for renewal; noticePeriod,noticeStartDate,terminationDate for notice. Renewal actions request/approve/complete/reject; termination request/terminate/reject. Tenant request routes allow request only.
- **Response:** {success,message,property,request}; existing pending/version/state conflicts 409.
- **Database operations/dependencies:** properties, tenants, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/agreements/request-termination/route.ts`.
- **Handler evidence:** `src/lib/server/services/agreements.ts:131` (tenantAgreement).

### POST `/api/agreements/terminate`

- **Purpose:** owner agreement.
- **Authentication/permissions:** Active tenant for request-* route; exact property.ownerUID for owner route. Admin role alone does not bypass exact owner.
- **Request contract:** JSON propertyId required; action; requestId for resolving pending requests; terms object of string agreement/rent fields for renewal; noticePeriod,noticeStartDate,terminationDate for notice. Renewal actions request/approve/complete/reject; termination request/terminate/reject. Tenant request routes allow request only.
- **Response:** {success,message,property,request}; existing pending/version/state conflicts 409.
- **Database operations/dependencies:** properties, tenants, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/agreements/terminate/route.ts`.
- **Handler evidence:** `src/lib/server/services/agreements.ts:130` (ownerAgreement).

### POST `/api/auth/activity`

- **Purpose:** authentication activity.
- **Authentication/permissions:** password_reset_requested branch public and generic; other branches completed user.
- **Request contract:** JSON action=password_reset_requested and email; or action=session_established/account_linked.
- **Response:** Reset generic {success,message}; authenticated {success,authentication}.
- **Database operations/dependencies:** auth_activity, users. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error()`; `new ApiError(400,'Invalid authentication activity request')`; `new ApiError(400,'Unsupported authentication activity')`.
- **Route source:** `src/app/api/auth/activity/route.ts`.
- **Handler evidence:** `src/lib/server/services/auth-activity.ts:32` (authenticationActivity).

### POST `/api/auth/login`

- **Purpose:** login.
- **Authentication/permissions:** Completed verified active profile. Firebase password/Google authentication happens in client SDK first.
- **Request contract:** JSON uid required, must equal bearer identity UID.
- **Response:** {success,token,user,message}; token is input Firebase token, not a new JWT.
- **Database operations/dependencies:** users, auth_activity, relationship_links, email_deliveries (legacy discovery). Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Access denied')`; `new AccessError(403,'Verify your email before signing in','EMAIL_VERIFICATION_REQUIRED')`; `new AccessError(403,'Active user profile required')`.
- **Route source:** `src/app/api/auth/login/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:32` (login).

### GET `/api/auth/user`

- **Purpose:** registration profile.
- **Authentication/permissions:** Verified Firebase bearer identity required, but onboarding does not require completed/verified-email profile. Own UID; cannot self-create admin.
- **Request contract:** GET no identifiers accepted for lookup; own onboarding status. POST JSON uid,email,name,photoURL,phoneNumber,role, optional isActive parsed but existing status preserved.
- **Response:** GET {success,profileExists,profileComplete,status}; POST {success,message,user}, 200.
- **Database operations/dependencies:** users, auth_activity, relationship_links, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Active user profile required','ACCOUNT_DISABLED')`; `new ApiError(503,Account service is temporarily unavailable. Retry using reference ${reference}.)`.
- **Route source:** `src/app/api/auth/user/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:142` (registrationProfile).

### POST `/api/auth/user`

- **Purpose:** create user.
- **Authentication/permissions:** Verified Firebase bearer identity required, but onboarding does not require completed/verified-email profile. Own UID; cannot self-create admin.
- **Request contract:** GET no identifiers accepted for lookup; own onboarding status. POST JSON uid,email,name,photoURL,phoneNumber,role, optional isActive parsed but existing status preserved.
- **Response:** GET {success,profileExists,profileComplete,status}; POST {success,message,user}, 200.
- **Database operations/dependencies:** users, auth_activity, relationship_links, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Access denied')`; `new AccessError(403,'Use another administrator to change your own role or account status')`; `new ApiError(409,'Account profile already exists. Please sign in again.')`.
- **Route source:** `src/app/api/auth/user/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:160` (createUser).

### GET `/api/cron/reminders`

- **Purpose:** reminders endpoint.
- **Authentication/permissions:** Bearer CRON_SECRET (at least 32 characters configured); no Firebase role authentication. maxDuration=300.
- **Request contract:** GET/POST query propertyCursor optional signed continuation; no request body needed.
- **Response:** {success,scanned,sent,failed,skipped,needsReconciliation,limited,properties:{scanned,sent,failed,skipped,needsReconciliation,limited,nextCursor}}; 200 or 503 on recorded failures.
- **Database operations/dependencies:** visits, users, properties, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/cron/reminders/route.ts`.
- **Handler evidence:** `src/lib/server/services/reminders.ts:89` (remindersEndpoint).

### POST `/api/cron/reminders`

- **Purpose:** reminders endpoint.
- **Authentication/permissions:** Bearer CRON_SECRET (at least 32 characters configured); no Firebase role authentication. maxDuration=300.
- **Request contract:** GET/POST query propertyCursor optional signed continuation; no request body needed.
- **Response:** {success,scanned,sent,failed,skipped,needsReconciliation,limited,properties:{scanned,sent,failed,skipped,needsReconciliation,limited,nextCursor}}; 200 or 503 on recorded failures.
- **Database operations/dependencies:** visits, users, properties, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/cron/reminders/route.ts`.
- **Handler evidence:** `src/lib/server/services/reminders.ts:89` (remindersEndpoint).

### GET `/api/documents/property`

- **Purpose:** list documents.
- **Authentication/permissions:** No successful resource access; missing-ID compatibility path.
- **Request contract:** No property ID segment; compatibility route calls listDocuments with empty ID.
- **Response:** Normally 301 to trailing-slash path through wrapper; missing-ID handling returns 400 when reached.
- **Database operations/dependencies:** No successful data read for absent ID. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/documents/property/route.ts`.
- **Handler evidence:** `src/lib/server/services/documents.ts:61` (listDocuments).

### GET `/api/documents/property/[propertyId]`

- **Purpose:** list documents.
- **Authentication/permissions:** Property member/admin.
- **Request contract:** Path propertyId, optional query documentType.
- **Response:** {success,documents:array|null}.
- **Database operations/dependencies:** documents, properties. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/documents/property/[propertyId]/route.ts`.
- **Handler evidence:** `src/lib/server/services/documents.ts:61` (listDocuments).

### GET `/api/documents`

- **Purpose:** list documents.
- **Authentication/permissions:** Completed property member; nonadmin submitted status forced. Supporting file policy enforced.
- **Request contract:** GET query propertyId required and documentType optional; POST CreateDocumentRequest plus financialYear,period,amount,status,receiptDate,idempotencyKey where applicable. propertyId,documentName,documentType,fileUrl required.
- **Response:** GET {success,documents:array|null}; POST {success,message,document}, 201 or existing idempotent 200.
- **Database operations/dependencies:** documents, properties, users, storage_objects. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/documents/route.ts`.
- **Handler evidence:** `src/lib/server/services/documents.ts:61` (listDocuments).

### POST `/api/documents`

- **Purpose:** create document.
- **Authentication/permissions:** Completed property member; nonadmin submitted status forced. Supporting file policy enforced.
- **Request contract:** GET query propertyId required and documentType optional; POST CreateDocumentRequest plus financialYear,period,amount,status,receiptDate,idempotencyKey where applicable. propertyId,documentName,documentType,fileUrl required.
- **Response:** GET {success,documents:array|null}; POST {success,message,document}, 201 or existing idempotent 200.
- **Database operations/dependencies:** documents, properties, users, storage_objects. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error()`; `new AccessError(403,'Document request does not belong to this account')`.
- **Route source:** `src/app/api/documents/route.ts`.
- **Handler evidence:** `src/lib/server/services/documents.ts:18` (createDocument).

### GET `/api/documents/[id]`

- **Purpose:** get document.
- **Authentication/permissions:** GET member; PATCH admin; DELETE member plus uploader/owner/admin. Historic deletion leaves approval-required object cleanup.
- **Request contract:** Path id. PATCH JSON status=submitted/verified/rejected, optional comment <=2000 characters. DELETE no body.
- **Response:** GET {success,document}; PATCH {success,message}; DELETE {success,message,warning?}.
- **Database operations/dependencies:** documents, properties, storage_objects, legacy_storage_cleanup. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Property access required')`.
- **Route source:** `src/app/api/documents/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/documents.ts:69` (getDocument).

### PATCH `/api/documents/[id]`

- **Purpose:** update document.
- **Authentication/permissions:** GET member; PATCH admin; DELETE member plus uploader/owner/admin. Historic deletion leaves approval-required object cleanup.
- **Request contract:** Path id. PATCH JSON status=submitted/verified/rejected, optional comment <=2000 characters. DELETE no body.
- **Response:** GET {success,document}; PATCH {success,message}; DELETE {success,message,warning?}.
- **Database operations/dependencies:** documents, properties, storage_objects, legacy_storage_cleanup. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required')`; `new ApiError(400,'Invalid document update')`; `new ApiError(400,'Invalid document status/comment')`; `new ApiError(404,'Document not found')`.
- **Route source:** `src/app/api/documents/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/documents.ts:74` (updateDocument).

### DELETE `/api/documents/[id]`

- **Purpose:** delete document.
- **Authentication/permissions:** GET member; PATCH admin; DELETE member plus uploader/owner/admin. Historic deletion leaves approval-required object cleanup.
- **Request contract:** Path id. PATCH JSON status=submitted/verified/rejected, optional comment <=2000 characters. DELETE no body.
- **Response:** GET {success,document}; PATCH {success,message}; DELETE {success,message,warning?}.
- **Database operations/dependencies:** documents, properties, storage_objects, legacy_storage_cleanup. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Property access required')`; `new AccessError(403,'Document access required')`; `new AccessError(403,'Document deletion access required')`.
- **Route source:** `src/app/api/documents/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/documents.ts:82` (deleteDocument).

### GET `/api/enquiries`

- **Purpose:** list enquiries.
- **Authentication/permissions:** Admin or agent; agent sees only brokerUID=self.
- **Request contract:** No required query params; identity scopes results.
- **Response:** {success,enquiries:[customer/property allowlist plus assignment/history/delivery status]}.
- **Database operations/dependencies:** admin_notifications, enquiry_assignments, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/enquiries/route.ts`.
- **Handler evidence:** `src/lib/server/services/enquiries.ts:29` (listEnquiries).

### PATCH `/api/enquiries/[id]`

- **Purpose:** update enquiry.
- **Authentication/permissions:** Admin assigns; admin or currently assigned active agent updates status; actor rechecked in transaction.
- **Request contract:** Path id; JSON action=assign/status, expectedVersion required nonnegative int, brokerUID string for assign (empty unassign), status for status action, notes optional <=2000 chars.
- **Response:** {success,enquiry}; 409 stale/unchanged assignment.
- **Database operations/dependencies:** admin_notifications, enquiry_assignments, users, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Invalid enquiry ID')`; `new Error('Unsupported field')`; `new ApiError(400,'Invalid enquiry update')`; `new ApiError(400,'Valid action, version and optional notes (up to 2000 characters) required')`; `new AccessError(403,'Only administrators can assign enquiries')`; `new ApiError(400,'Supply an agent UID or empty string to unassign')`; `new ApiError(400,'Agent account is disabled')`; `new ApiError(400,'Registered agent account required')`; `new ApiError(400,'Valid enquiry status required; assignment changes are admin-only')`; `new ApiError(404,'Property enquiry not found')`; `new AccessError(403,'Active inbox role required')`; `new AccessError(403,'Enquiry is not assigned to your account')`; `new ApiError(409,'Enquiry changed; refresh and retry')`; `new ApiError(400,'Active registered agent required')`; `new ApiError(409,'Assignment is unchanged')`; `new ApiError(409,'Enquiry history limit reached')`.
- **Route source:** `src/app/api/enquiries/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/enquiries.ts:46` (updateEnquiry).

### DELETE `/api/files`

- **Purpose:** delete file.
- **Authentication/permissions:** Authenticated uploader/admin; attached files cannot be cleaned until references removed.
- **Request contract:** DELETE JSON url managed /api/media/{UUID}; catchall path does not select arbitrary object key.
- **Response:** {success,message}; bare /api/files redirects 301 to slash before service. Legacy URL deletion rejects 409.
- **Database operations/dependencies:** storage_objects and bound records. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(409,'Legacy file removal requires the approved migration process')`.
- **Route source:** `src/app/api/files/route.ts`.
- **Handler evidence:** `src/lib/server/services/uploads.ts:98` (deleteFile).

### DELETE `/api/files/[...path]`

- **Purpose:** delete file.
- **Authentication/permissions:** Authenticated uploader/admin; attached files cannot be cleaned until references removed.
- **Request contract:** DELETE JSON url managed /api/media/{UUID}; catchall path does not select arbitrary object key.
- **Response:** {success,message}; bare /api/files redirects 301 to slash before service. Legacy URL deletion rejects 409.
- **Database operations/dependencies:** storage_objects and bound records. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(409,'Legacy file removal requires the approved migration process')`.
- **Route source:** `src/app/api/files/[...path]/route.ts`.
- **Handler evidence:** `src/lib/server/services/uploads.ts:98` (deleteFile).

### GET `/api/inspection-reports/property/[propertyId]`

- **Purpose:** list reports.
- **Authentication/permissions:** Property member/admin.
- **Request contract:** Path propertyId.
- **Response:** {success,reports:array|null}, ordered createdAt descending.
- **Database operations/dependencies:** inspection_reports, properties. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/inspection-reports/property/[propertyId]/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:178` (listReports).

### POST `/api/inspection-reports`

- **Purpose:** create report or review.
- **Authentication/permissions:** Property member/admin; file policy and membership checks.
- **Request contract:** POST CreateInspectionReportRequest: propertyId, reportType=on_possession/on_handover, nonempty report, policy-specific attachment fields.
- **Response:** {success,message,report}, 201.
- **Database operations/dependencies:** inspection_reports, properties, users, storage_objects, admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/inspection-reports/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:123` (createReportOrReview).

### GET `/api/inspection-reports/user/[userId]`

- **Purpose:** list reports.
- **Authentication/permissions:** Self/admin user scope plus current report property access for self.
- **Request contract:** Path userId.
- **Response:** {success,reports:array|null}; nonadmin rechecks property membership for each report.
- **Database operations/dependencies:** inspection_reports, properties. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/inspection-reports/user/[userId]/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:178` (listReports).

### GET `/api/media/legacy`

- **Purpose:** deliver legacy.
- **Authentication/permissions:** Bearer or media session; current property/record scope. Trusted R2/GCS hosts and key scoping only.
- **Request contract:** Query resource allowlisted collection, id, field allowlisted file field, optional numeric index.
- **Response:** Binary bytes with safe headers; not JSON.
- **Database operations/dependencies:** Referenced record, properties, users for historic uploader checks. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Invalid file reference')`; `new ApiError(404,'File record not found')`; `new ApiError(404,'File not found')`; `new ApiError(413,'File too large')`; `new ApiError(400,'Legacy file needs migration')`; `new ApiError(409,'Legacy file host is not approved; migration required')`; `new AccessError(403,'Stored object belongs to another property')`; `new AccessError(403,'Historical uploader scope does not match this record; migration review required')`; `new AccessError(403,'Historical object has no trusted property scope; migration review required')`; `new ApiError(502,'Legacy file could not be downloaded')`.
- **Route source:** `src/app/api/media/legacy/route.ts`.
- **Handler evidence:** `src/lib/server/services/media.ts:190` (deliverLegacy).

### POST `/api/media/session`

- **Purpose:** media session.
- **Authentication/permissions:** POST/GET completed user; DELETE clears cookie without requiring identity.
- **Request contract:** POST/GET Firebase bearer; GET also existing media cookie; DELETE no input.
- **Response:** 204; POST sets propbank_media cookie, DELETE clears; GET confirms UID match. Error {success:false,code,message,reference?}.
- **Database operations/dependencies:** users for identity/profile checks. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/media/session/route.ts`.
- **Handler evidence:** `src/lib/server/services/media.ts:95` (mediaSession).

### DELETE `/api/media/session`

- **Purpose:** media session.
- **Authentication/permissions:** POST/GET completed user; DELETE clears cookie without requiring identity.
- **Request contract:** POST/GET Firebase bearer; GET also existing media cookie; DELETE no input.
- **Response:** 204; POST sets propbank_media cookie, DELETE clears; GET confirms UID match. Error {success:false,code,message,reference?}.
- **Database operations/dependencies:** users for identity/profile checks. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/media/session/route.ts`.
- **Handler evidence:** `src/lib/server/services/media.ts:95` (mediaSession).

### GET `/api/media/session`

- **Purpose:** media session.
- **Authentication/permissions:** POST/GET completed user; DELETE clears cookie without requiring identity.
- **Request contract:** POST/GET Firebase bearer; GET also existing media cookie; DELETE no input.
- **Response:** 204; POST sets propbank_media cookie, DELETE clears; GET confirms UID match. Error {success:false,code,message,reference?}.
- **Database operations/dependencies:** users for identity/profile checks. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/media/session/route.ts`.
- **Handler evidence:** `src/lib/server/services/media.ts:95` (mediaSession).

### GET `/api/media/[id]`

- **Purpose:** deliver media.
- **Authentication/permissions:** Public only approved cover/site banner with no private veto; otherwise bearer/media session and live object relationship.
- **Request contract:** Path managed UUID.
- **Response:** Binary bytes; private no-store and content disposition/security headers; not JSON.
- **Database operations/dependencies:** storage_objects, live bound records, users/properties when private. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(404,'File not found')`; `new AccessError(403,'Upload access required')`; `new AccessError(403,'File access required')`; `new ApiError(409,'Invalid managed file location')`; `new ApiError(502,'Stored file could not be downloaded')`; `new ApiError(413,'Stored file exceeds download limit')`.
- **Route source:** `src/app/api/media/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/media.ts:173` (deliverMedia).

### GET `/api/negotiations`

- **Purpose:** list negotiations.
- **Authentication/permissions:** Completed identity; customer cannot offer on own property; available approved listing. List only participant/admin.
- **Request contract:** GET optional propertyId. POST JSON propertyId and amount positive finite number <=1e10 with <=2 decimals.
- **Response:** GET {success,negotiations,limited}; POST {success,negotiation}, 201.
- **Database operations/dependencies:** negotiations, properties, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError( 400, 'Invalid property ID' )`.
- **Route source:** `src/app/api/negotiations/route.ts`.
- **Handler evidence:** `src/lib/server/services/negotiations.ts:167` (listNegotiations).

### POST `/api/negotiations`

- **Purpose:** create negotiation.
- **Authentication/permissions:** Completed identity; customer cannot offer on own property; available approved listing. List only participant/admin.
- **Request contract:** GET optional propertyId. POST JSON propertyId and amount positive finite number <=1e10 with <=2 decimals.
- **Response:** GET {success,negotiations,limited}; POST {success,negotiation}, 201.
- **Database operations/dependencies:** negotiations, properties, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400, 'Invalid request body')`; `new ApiError(400, 'Property ID required')`; `new ApiError( 404, 'Available property not found' )`; `new ApiError( 400, 'You cannot submit an offer on your own property' )`.
- **Route source:** `src/app/api/negotiations/route.ts`.
- **Handler evidence:** `src/lib/server/services/negotiations.ts:70` (createNegotiation).

### PATCH `/api/negotiations/[id]`

- **Purpose:** update negotiation.
- **Authentication/permissions:** Participant/admin read boundary plus exact owner/customer or assigned agent/admin action rules.
- **Request contract:** Path id; JSON action, version integer; amount for propose/counter, brokerUID for assign_broker. Actions propose/accept/reject/counter/customer_accept/withdraw/complete/assign_broker.
- **Response:** {success,negotiation}; 409 changed version, ownership, availability or invalid transition.
- **Database operations/dependencies:** negotiations, properties, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError( 400, 'Invalid request body' )`; `new ApiError( 400, 'Current version is required' )`; `new ApiError( 404, 'Negotiation not found' )`; `new AccessError( 403, 'Negotiation access required' )`; `new ApiError( 409, 'Property ownership changed' )`; `new ApiError( 409, 'Property is no longer available' )`; `new ApiError( 409, 'Negotiation changed; reload before continuing' )`; `new ApiError( 409, 'Negotiation is closed' )`; `new ApiError( 409, 'Negotiation history limit reached' )`; `new ApiError( 409, 'Cannot assign a closed proposal' )`; `new ApiError( 400, 'Broker UID required' )`; `new ApiError( 400, 'Active agent required' )`; `new AccessError( 403, 'Assigned broker or administrator access required' )`; `new ApiError( 409, 'Proposal cannot be changed after approval' )`; `new AccessError( 403, 'Only the property owner can counter' )`; `new ApiError( 409, 'Proposal cannot be countered now' )`; `new AccessError( 403, 'Only the property owner can approve' )`; `new ApiError( 409, 'No proposal awaiting owner approval' )`; `new AccessError( 403, 'Only the customer can accept this amount' )`; `new ApiError( 409, 'Owner approval is required' )`; `new AccessError( 403, 'Only the property owner can reject' )`; `new ApiError( 409, 'Cannot reject a confirmed agreement' )`; `new AccessError( 403, 'Only the customer can withdraw' )`; `new ApiError( 409, 'Cannot withdraw a confirmed agreement' )`; `new ApiError( 409, 'Owner and customer acceptance required' )`; `new ApiError( 400, 'Unsupported negotiation action' )`.
- **Route source:** `src/app/api/negotiations/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/negotiations.ts:235` (updateNegotiation).

### POST `/api/owner-verification`

- **Purpose:** verify property owner.
- **Authentication/permissions:** Admin revalidated inside transaction; target active verified separate owner and same-property available evidence.
- **Request contract:** JSON propertyId; action approve(default)/reject/reconsider; expectedVersion required after first decision and for nonapprove; approve ownerUID,evidenceDocumentId,reviewNote; reject reason.
- **Response:** {success,message,verification:{status,version,reason,history}}.
- **Database operations/dependencies:** properties, users, documents, tenants, relationship_links, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Invalid verification request')`; `new ApiError(400,'Valid property and decision required')`; `new ApiError(400,'Invalid verification version')`; `new ApiError(400,'Verification version required')`; `new ApiError(400,'A rejection reason is required (up to 2000 characters)')`; `new ApiError(400,'Property, owner UID, evidence document and review note are required')`; `new ApiError(400,'Invalid identifier')`; `new ApiError(400,'Owner account does not exist')`; `new ApiError(400,'Owner requires an active account with verified Firebase email')`; `new ApiError(409,'Owner identity changed; sign in and verify again')`; `new ApiError(404,'Property not found')`; `new ApiError(403,'Active administrator required')`; `new ApiError(409,'Verification changed; refresh and retry')`; `new ApiError(409,'Property is not awaiting this verification decision')`; `new ApiError(409,'Claimant identity changed; review the ownership request again')`; `new ApiError(409,'Verification history limit reached')`; `new ApiError(400,'An active tenant cannot be linked as this property owner')`; `new ApiError(400,'Owner must have an active platform profile')`; `new ApiError(400,'Evidence document must be available and belong to this property')`.
- **Route source:** `src/app/api/owner-verification/route.ts`.
- **Handler evidence:** `src/lib/server/services/owner-verification.ts:15` (verifyPropertyOwner).

### GET `/api/properties`

- **Purpose:** list properties.
- **Authentication/permissions:** GET public filtered; ownerUID self/admin; admin=true admin. POST complete user; owner self/admin, agent separate registered owner, tenant intake self.
- **Request contract:** GET query ownerUID, admin=true, listingType optional. POST CreatePropertyRequest plus category/structure/area units, expectedRent, createdAs, reportedOwner, nextAgreementDraft, agentOwnerEmail as applicable. propertyTitle,propertyType,location plus ownerUID for normal owner path.
- **Response:** GET {success,properties:array|null,count,site settings or ownerUID/listingType}; POST {success,message,property}, 201 or dedupe 200.
- **Database operations/dependencies:** properties, users, siteSettings, tenants, storage_objects, relationship_links, property_submissions, email_deliveries, admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required')`.
- **Route source:** `src/app/api/properties/route.ts`.
- **Handler evidence:** `src/lib/server/services/properties.ts:81` (listProperties).

### POST `/api/properties`

- **Purpose:** create property.
- **Authentication/permissions:** GET public filtered; ownerUID self/admin; admin=true admin. POST complete user; owner self/admin, agent separate registered owner, tenant intake self.
- **Request contract:** GET query ownerUID, admin=true, listingType optional. POST CreatePropertyRequest plus category/structure/area units, expectedRent, createdAs, reportedOwner, nextAgreementDraft, agentOwnerEmail as applicable. propertyTitle,propertyType,location plus ownerUID for normal owner path.
- **Response:** GET {success,properties:array|null,count,site settings or ownerUID/listingType}; POST {success,message,property}, 201 or dedupe 200.
- **Database operations/dependencies:** properties, users, siteSettings, tenants, storage_objects, relationship_links, property_submissions, email_deliveries, admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/properties/route.ts`.
- **Handler evidence:** `src/lib/server/services/properties.ts:170` (createProperty).

### GET `/api/properties/search`

- **Purpose:** search properties.
- **Authentication/permissions:** Public approved eligible only.
- **Request contract:** Query q,listingType,projectCondition; matching over selected text fields in memory.
- **Response:** {success,properties:array|null,count,query,listingType?}.
- **Database operations/dependencies:** properties. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/properties/search/route.ts`.
- **Handler evidence:** `src/lib/server/services/properties.ts:108` (searchProperties).

### GET `/api/properties/tenant`

- **Purpose:** list tenant properties.
- **Authentication/permissions:** Completed identity; requested UID self/admin, requested email verified token match/admin.
- **Request contract:** Query tenantUID, userEmail or X-User-ID: at least one required.
- **Response:** {success,properties:array|null,count}.
- **Database operations/dependencies:** properties. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Access denied')`.
- **Route source:** `src/app/api/properties/tenant/route.ts`.
- **Handler evidence:** `src/lib/server/services/properties.ts:126` (listTenantProperties).

### GET `/api/properties/[id]`

- **Purpose:** read property.
- **Authentication/permissions:** Public GET if available; optional authenticated owner/tenant/admin/submitting-agent expanded projection. Mutation owner/admin or submitting agent limited content. Moderation admin except editor resubmit.
- **Request contract:** Path id. PUT/PATCH property fields or separate {moderationAction,reason?,expectedRevision}. Moderation approve/reject/request_changes/resubmit; protected identity/history fields cannot be reassigned.
- **Response:** GET {success,property}; PUT/PATCH {success,message,property}; JSON property-specific error envelope.
- **Database operations/dependencies:** properties, users, tenants, storage_objects, relationship_links, email_deliveries, admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/properties/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/properties.ts:140` (readProperty).

### PUT `/api/properties/[id]`

- **Purpose:** update property.
- **Authentication/permissions:** Public GET if available; optional authenticated owner/tenant/admin/submitting-agent expanded projection. Mutation owner/admin or submitting agent limited content. Moderation admin except editor resubmit.
- **Request contract:** Path id. PUT/PATCH property fields or separate {moderationAction,reason?,expectedRevision}. Moderation approve/reject/request_changes/resubmit; protected identity/history fields cannot be reassigned.
- **Response:** GET {success,property}; PUT/PATCH {success,message,property}; JSON property-specific error envelope.
- **Database operations/dependencies:** properties, users, tenants, storage_objects, relationship_links, email_deliveries, admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error()`; `new Error('Property disappeared after update')`.
- **Route source:** `src/app/api/properties/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/properties.ts:306` (updateProperty).

### PATCH `/api/properties/[id]`

- **Purpose:** update property.
- **Authentication/permissions:** Public GET if available; optional authenticated owner/tenant/admin/submitting-agent expanded projection. Mutation owner/admin or submitting agent limited content. Moderation admin except editor resubmit.
- **Request contract:** Path id. PUT/PATCH property fields or separate {moderationAction,reason?,expectedRevision}. Moderation approve/reject/request_changes/resubmit; protected identity/history fields cannot be reassigned.
- **Response:** GET {success,property}; PUT/PATCH {success,message,property}; JSON property-specific error envelope.
- **Database operations/dependencies:** properties, users, tenants, storage_objects, relationship_links, email_deliveries, admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error()`; `new Error('Property disappeared after update')`.
- **Route source:** `src/app/api/properties/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/properties.ts:306` (updateProperty).

### GET `/api/property-hub`

- **Purpose:** property hub.
- **Authentication/permissions:** GET member/admin; internal_note admin; rent_ledger owner/admin, expected version and same-property receipt.
- **Request contract:** GET optional propertyId. PATCH action=internal_note {propertyId,note}; or action=rent_ledger {propertyId,version,month,expectedRent,dueDate,status,receiptId,notes}.
- **Response:** GET {success,hubs,actions,metrics,pipeline,truncated}; PATCH {success,message}.
- **Database operations/dependencies:** properties, documents, inspection_reports, service_requests, visits, negotiations, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(404,'Property not found')`.
- **Route source:** `src/app/api/property-hub/route.ts`.
- **Handler evidence:** `src/lib/server/services/property-hub.ts:23` (propertyHub).

### PATCH `/api/property-hub`

- **Purpose:** update property hub.
- **Authentication/permissions:** GET member/admin; internal_note admin; rent_ledger owner/admin, expected version and same-property receipt.
- **Request contract:** GET optional propertyId. PATCH action=internal_note {propertyId,note}; or action=rent_ledger {propertyId,version,month,expectedRent,dueDate,status,receiptId,notes}.
- **Response:** GET {success,hubs,actions,metrics,pipeline,truncated}; PATCH {success,message}.
- **Database operations/dependencies:** properties, documents, inspection_reports, service_requests, visits, negotiations, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Property ID required')`; `new ApiError(404,'Property not found')`; `new AccessError(403,'Administrator access required')`; `new ApiError(400,'Note must contain 1â€“2000 characters')`; `new ApiError(409,'Internal note limit reached')`; `new ApiError(400,'Invalid action')`; `new ApiError(409,'Rent ledger changed; refresh before saving')`; `new ApiError(400,'Invalid ledger entry')`; `new ApiError(400,'Receipt must belong to this property')`; `new ApiError(409,'Rent tracking history limit reached')`.
- **Route source:** `src/app/api/property-hub/route.ts`.
- **Handler evidence:** `src/lib/server/services/property-hub.ts:81` (updatePropertyHub).

### GET `/api/relationship-links`

- **Purpose:** list relationship links.
- **Authentication/permissions:** Completed user; current verified identity; owner/candidate operation rules; five-minute recent auth for claim actions; scoped discovery.
- **Request contract:** GET optional propertyId admin scope. POST action=discover/request_owner_verification/confirm_tenancy/approve_tenancy/authorize_tenancy_invitation/reject; non-discover claimId SHA256 and optional expectedVersion.
- **Response:** GET {success,emailVerified,phoneVerified,phoneVerificationAvailable:false,connections,links,approvals,sentInvitations,truncated} or admin {success,links}; POST {success,status?,message} or discovery counts.
- **Database operations/dependencies:** relationship_links, relationship_link_limits, properties, tenants, users, email_deliveries, email_invitation_limits. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403, 'Administrator access required')`.
- **Route source:** `src/app/api/relationship-links/route.ts`.
- **Handler evidence:** `src/lib/server/services/relationship-links.ts:219` (listRelationshipLinks).

### POST `/api/relationship-links`

- **Purpose:** act on relationship link.
- **Authentication/permissions:** Completed user; current verified identity; owner/candidate operation rules; five-minute recent auth for claim actions; scoped discovery.
- **Request contract:** GET optional propertyId admin scope. POST action=discover/request_owner_verification/confirm_tenancy/approve_tenancy/authorize_tenancy_invitation/reject; non-discover claimId SHA256 and optional expectedVersion.
- **Response:** GET {success,emailVerified,phoneVerified,phoneVerificationAvailable:false,connections,links,approvals,sentInvitations,truncated} or admin {success,links}; POST {success,status?,message} or discovery counts.
- **Database operations/dependencies:** relationship_links, relationship_link_limits, properties, tenants, users, email_deliveries, email_invitation_limits. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400, 'Invalid relationship request')`; `new ApiError(400, 'Relationship discovery and claims are scoped to your authenticated identity')`; `new ApiError(400, 'Invalid relationship action')`; `new ApiError(400, 'Invalid relationship reference')`; `new ApiError(400, 'Invalid connection version')`; `new ApiError(403, 'Verify your Firebase account email before claiming a relationship')`; `new AccessError(403, 'Sign in again before confirming a relationship')`; `new ApiError(404, 'Relationship request unavailable')`; `new AccessError(403, 'Relationship request unavailable')`; `new ApiError(409, 'This connection is already linked')`; `new ApiError(409, 'This relationship request was rejected')`; `new ApiError(409, 'Connection changed; refresh and review it again')`; `new ApiError(409, 'Relationship changed; contact support')`; `new ApiError(409, 'A valid current tenant email is required')`; `new ApiError(409, 'Ownership is not awaiting verification')`; `new ApiError(409, 'Tenancy invitation required')`; `new AccessError(403, 'Owner approval is not available')`; `new ApiError(400, 'Invalid tenancy action')`; `new ApiError(409, 'The invited identity changed; a new verification is required')`; `new ApiError(409, 'Tenancy changed; refresh before confirming')`; `new ApiError(409, 'This account already has an active tenancy here')`; `new ApiError(409, 'This connection has expired. Ask for a new invitation through the existing property workflow.')`.
- **Route source:** `src/app/api/relationship-links/route.ts`.
- **Handler evidence:** `src/lib/server/services/relationship-links.ts:271` (actOnRelationshipLink).

### GET `/api/reviews`

- **Purpose:** list reviews.
- **Authentication/permissions:** GET property member; POST actual active owner/tenant, reviewerType derived/checked by server.
- **Request contract:** GET query propertyId required. POST CreateReviewRequest propertyId,reviewerType,tenantPart/ownerPart questionnaire.
- **Response:** GET {success,reviews}; POST {success,message,review}, 201.
- **Database operations/dependencies:** reviews, properties, users, admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/reviews/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:188` (listReviews).

### POST `/api/reviews`

- **Purpose:** create report or review.
- **Authentication/permissions:** GET property member; POST actual active owner/tenant, reviewerType derived/checked by server.
- **Request contract:** GET query propertyId required. POST CreateReviewRequest propertyId,reviewerType,tenantPart/ownerPart questionnaire.
- **Response:** GET {success,reviews}; POST {success,message,review}, 201.
- **Database operations/dependencies:** reviews, properties, users, admin_notifications. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/reviews/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:123` (createReportOrReview).

### GET `/api/service-requests`

- **Purpose:** list service requests.
- **Authentication/permissions:** GET member/requester or admin. POST self/admin userUID, member if property supplied.
- **Request contract:** GET propertyId or userUID or admin=true; POST JSON userUID,serviceId required, propertyId,message<=2000,image optional.
- **Response:** GET {success,message,data}; POST {success,message,serviceRequest}, 201.
- **Database operations/dependencies:** service_requests, services, properties, users, storage_objects, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/service-requests/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:58` (listServiceRequests).

### POST `/api/service-requests`

- **Purpose:** create service request.
- **Authentication/permissions:** GET member/requester or admin. POST self/admin userUID, member if property supplied.
- **Request contract:** GET propertyId or userUID or admin=true; POST JSON userUID,serviceId required, propertyId,message<=2000,image optional.
- **Response:** GET {success,message,data}; POST {success,message,serviceRequest}, 201.
- **Database operations/dependencies:** service_requests, services, properties, users, storage_objects, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/service-requests/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:77` (createServiceRequest).

### PUT `/api/service-requests/[id]`

- **Purpose:** update service request.
- **Authentication/permissions:** Admin.
- **Request contract:** Path id; PUT JSON status pending/in_progress/completed/cancelled/resolved, adminNotes,resolutionReport,adminImage; or action archive/unarchive separately.
- **Response:** {success,message}.
- **Database operations/dependencies:** service_requests, storage_objects, properties, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(404,'Service request not found')`.
- **Route source:** `src/app/api/service-requests/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:97` (updateServiceRequest).

### GET `/api/services`

- **Purpose:** list services.
- **Authentication/permissions:** Public.
- **Request contract:** No parameters.
- **Response:** {success,message,data?}; merges persisted active services with hardcoded defaults by ID.
- **Database operations/dependencies:** services. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/services/route.ts`.
- **Handler evidence:** `src/lib/server/services/migration-remainder.ts:53` (listServices).

### GET `/api/tenants`

- **Purpose:** list tenants.
- **Authentication/permissions:** GET member; tenant sees own row. POST owner/admin; relationships pending confirmation rather than trusting supplied UID.
- **Request contract:** GET query propertyId required. POST CreateTenantRequest propertyId,ownerUID,tenants array of details/terms.
- **Response:** GET {success,tenants:array|null}; POST {success,message,tenants}.
- **Database operations/dependencies:** tenants, properties, users, relationship_links, email_deliveries, email_invitation_limits. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/tenants/route.ts`.
- **Handler evidence:** `src/lib/server/services/tenants.ts:76` (listTenants).

### POST `/api/tenants`

- **Purpose:** create tenants.
- **Authentication/permissions:** GET member; tenant sees own row. POST owner/admin; relationships pending confirmation rather than trusting supplied UID.
- **Request contract:** GET query propertyId required. POST CreateTenantRequest propertyId,ownerUID,tenants array of details/terms.
- **Response:** GET {success,tenants:array|null}; POST {success,message,tenants}.
- **Database operations/dependencies:** tenants, properties, users, relationship_links, email_deliveries, email_invitation_limits. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Property owner access required')`; `new AccessError(403,'Property access required')`; `new AccessError(403,'Property owner changed')`; `new ApiError(409,'Tenant already has an active relationship with this property')`; `new AccessError(403,'Property tenant relationship limit reached')`; `new AccessError(403,'Agreement history limit reached')`.
- **Route source:** `src/app/api/tenants/route.ts`.
- **Handler evidence:** `src/lib/server/services/tenants.ts:16` (createTenants).

### GET `/api/tenants/[id]`

- **Purpose:** get tenant.
- **Authentication/permissions:** GET admin/owner or exact active tenant UID. PUT owner/admin. DELETE owner self/admin.
- **Request contract:** Path id; PUT tenant mutable fields and optional expectedPropertyUpdatedAt, nextAgreementDraft; identity/link fields protected. DELETE deactivates.
- **Response:** GET {success,tenant}; PUT/DELETE {success,message}.
- **Database operations/dependencies:** tenants, properties, relationship_links. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Tenant access required')`.
- **Route source:** `src/app/api/tenants/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/tenants.ts:83` (getTenant).

### PUT `/api/tenants/[id]`

- **Purpose:** update tenant.
- **Authentication/permissions:** GET admin/owner or exact active tenant UID. PUT owner/admin. DELETE owner self/admin.
- **Request contract:** Path id; PUT tenant mutable fields and optional expectedPropertyUpdatedAt, nextAgreementDraft; identity/link fields protected. DELETE deactivates.
- **Response:** GET {success,tenant}; PUT/DELETE {success,message}.
- **Database operations/dependencies:** tenants, properties, relationship_links. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Relationship field aliases cannot be changed')`; `new AccessError(403,'Tenant relationships cannot be reassigned')`; `new AccessError(403,'Relationship verification fields are server controlled')`.
- **Route source:** `src/app/api/tenants/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/tenants.ts:88` (updateTenant).

### DELETE `/api/tenants/[id]`

- **Purpose:** delete tenant.
- **Authentication/permissions:** GET admin/owner or exact active tenant UID. PUT owner/admin. DELETE owner self/admin.
- **Request contract:** Path id; PUT tenant mutable fields and optional expectedPropertyUpdatedAt, nextAgreementDraft; identity/link fields protected. DELETE deactivates.
- **Response:** GET {success,tenant}; PUT/DELETE {success,message}.
- **Database operations/dependencies:** tenants, properties, relationship_links. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/tenants/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/tenants.ts:106` (deleteTenant).

### POST `/api/upload/document`

- **Purpose:** multipart upload.
- **Authentication/permissions:** Property member; 20 MiB general file, supporting types 5 MiB PDF/JPEG/PNG/WebP.
- **Request contract:** multipart document field, propertyId required, docType optional default general.
- **Response:** {success,message,url}, 200.
- **Database operations/dependencies:** storage_objects, properties. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(413,'Multipart upload exceeds 21 MiB')`.
- **Route source:** `src/app/api/upload/document/route.ts`.
- **Handler evidence:** `src/lib/server/services/uploads.ts:41` (multipartUpload).

### POST `/api/upload/image`

- **Purpose:** base64 upload.
- **Authentication/permissions:** Authenticated scoped folder; listingCandidate only permitted property/banner image usage.
- **Request contract:** JSON image data URI required, folder and identifier optional.
- **Response:** {success,message,url}, 200.
- **Database operations/dependencies:** storage_objects; relevant permission reads. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error('Empty image')`.
- **Route source:** `src/app/api/upload/image/route.ts`.
- **Handler evidence:** `src/lib/server/services/uploads.ts:72` (base64Upload).

### POST `/api/upload/property-images`

- **Purpose:** base64 upload.
- **Authentication/permissions:** Existing property owner/admin.
- **Request contract:** JSON propertyId, images nonempty array (up to 50), managed references/data URI.
- **Response:** {success,message,urls}; if any fails 502 {success:false,message,failedIndices,urls:[]} with staged cleanup attempts.
- **Database operations/dependencies:** storage_objects, properties. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error('Empty image')`.
- **Route source:** `src/app/api/upload/property-images/route.ts`.
- **Handler evidence:** `src/lib/server/services/uploads.ts:72` (base64Upload).

### POST `/api/upload`

- **Purpose:** multipart upload.
- **Authentication/permissions:** Authenticated; scoped namespace; owner/admin properties, member documents, admin banners, requester/admin service-request folder.
- **Request contract:** multipart image field; folder optional default uploads.
- **Response:** {success,message,url}, 200. Upload alone does not attach to business record.
- **Database operations/dependencies:** storage_objects; property/service request permission reads. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(413,'Multipart upload exceeds 21 MiB')`.
- **Route source:** `src/app/api/upload/route.ts`.
- **Handler evidence:** `src/lib/server/services/uploads.ts:41` (multipartUpload).

### POST `/api/upload/service-request-image`

- **Purpose:** base64 upload.
- **Authentication/permissions:** Authenticated; supplied requestId requires requester/admin folder authorization.
- **Request contract:** JSON image required, requestId optional.
- **Response:** {success,message,url}.
- **Database operations/dependencies:** storage_objects, service_requests when requestId present. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new Error('Empty image')`.
- **Route source:** `src/app/api/upload/service-request-image/route.ts`.
- **Handler evidence:** `src/lib/server/services/uploads.ts:72` (base64Upload).

### GET `/api/users`

- **Purpose:** list users.
- **Authentication/permissions:** GET admin. POST completed user identity; self/admin target; role guard and Firebase email match.
- **Request contract:** GET no parameters. POST JSON uid,email,name required; phoneNumber,role,photoURL.
- **Response:** GET {success,message,data?} (data omitted when empty). POST {success,message,user}, 201.
- **Database operations/dependencies:** users, auth_activity, relationship_links, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required')`.
- **Route source:** `src/app/api/users/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:85` (listUsers).

### POST `/api/users`

- **Purpose:** create user.
- **Authentication/permissions:** GET admin. POST completed user identity; self/admin target; role guard and Firebase email match.
- **Request contract:** GET no parameters. POST JSON uid,email,name required; phoneNumber,role,photoURL.
- **Response:** GET {success,message,data?} (data omitted when empty). POST {success,message,user}, 201.
- **Database operations/dependencies:** users, auth_activity, relationship_links, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Access denied')`; `new AccessError(403,'Use another administrator to change your own role or account status')`; `new ApiError(409,'Account profile already exists. Please sign in again.')`.
- **Route source:** `src/app/api/users/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:160` (createUser).

### GET `/api/users/search`

- **Purpose:** search user.
- **Authentication/permissions:** Completed user; throttled 30/min; admin-only phone lookup disclosure.
- **Request contract:** Query phone required only for admin lookup; nonadmin never receives account contact lookup result.
- **Response:** Nonadmin {success,verificationRequired,message}; admin {success,message,user} or 404.
- **Database operations/dependencies:** users, relationship_link_limits. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/users/search/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:125` (searchUser).

### GET `/api/users/[id]`

- **Purpose:** read user.
- **Authentication/permissions:** GET completed identity, field projection; mutation self/admin, role/status/admin restrictions; self mobile verified recent authentication.
- **Request contract:** Path UID; GET summary=true optional; PUT/PATCH parsed user fields (name,email,photoURL,phoneNumber,role,isActive).
- **Response:** GET {success,message,user} with public identity subset for other nonadmin user; admin full dossier unless summary=true. PUT/PATCH {success,message,user}; missing profile may create 201. Missing user GET uses success:false with HTTP 200.
- **Database operations/dependencies:** users, properties, auth_activity, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/users/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:114` (readUser).

### PUT `/api/users/[id]`

- **Purpose:** update user.
- **Authentication/permissions:** GET completed identity, field projection; mutation self/admin, role/status/admin restrictions; self mobile verified recent authentication.
- **Request contract:** Path UID; GET summary=true optional; PUT/PATCH parsed user fields (name,email,photoURL,phoneNumber,role,isActive).
- **Response:** GET {success,message,user} with public identity subset for other nonadmin user; admin full dossier unless summary=true. PUT/PATCH {success,message,user}; missing profile may create 201. Missing user GET uses success:false with HTTP 200.
- **Database operations/dependencies:** users, properties, auth_activity, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required to change account status')`.
- **Route source:** `src/app/api/users/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:198` (updateUser).

### PATCH `/api/users/[id]`

- **Purpose:** update user.
- **Authentication/permissions:** GET completed identity, field projection; mutation self/admin, role/status/admin restrictions; self mobile verified recent authentication.
- **Request contract:** Path UID; GET summary=true optional; PUT/PATCH parsed user fields (name,email,photoURL,phoneNumber,role,isActive).
- **Response:** GET {success,message,user} with public identity subset for other nonadmin user; admin full dossier unless summary=true. PUT/PATCH {success,message,user}; missing profile may create 201. Missing user GET uses success:false with HTTP 200.
- **Database operations/dependencies:** users, properties, auth_activity, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new AccessError(403,'Administrator access required to change account status')`.
- **Route source:** `src/app/api/users/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/users.ts:198` (updateUser).

### GET `/api/visits`

- **Purpose:** list visits.
- **Authentication/permissions:** Completed identity; GET self/admin; creation active approved available property if specified and valid ADMIN_EMAIL config.
- **Request contract:** GET query userId required, status active/completed/cancelled optional. POST CreateVisitRequest title,visitDate RFC3339 future required, description/propertyId optional; reminder overwritten email/30.
- **Response:** GET {success,message,visits}; POST {success,message,visit}, 201.
- **Database operations/dependencies:** visits, properties, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Invalid visit status filter')`.
- **Route source:** `src/app/api/visits/route.ts`.
- **Handler evidence:** `src/lib/server/services/visits.ts:81` (listVisits).

### POST `/api/visits`

- **Purpose:** create visit.
- **Authentication/permissions:** Completed identity; GET self/admin; creation active approved available property if specified and valid ADMIN_EMAIL config.
- **Request contract:** GET query userId required, status active/completed/cancelled optional. POST CreateVisitRequest title,visitDate RFC3339 future required, description/propertyId optional; reminder overwritten email/30.
- **Response:** GET {success,message,visits}; POST {success,message,visit}, 201.
- **Database operations/dependencies:** visits, properties, users, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(404,'Available property not found')`.
- **Route source:** `src/app/api/visits/route.ts`.
- **Handler evidence:** `src/lib/server/services/visits.ts:66` (createVisit).

### GET `/api/visits/[id]`

- **Purpose:** get visit.
- **Authentication/permissions:** Self/admin; update transaction revalidates actor and optional expectedVersion check (not mandatory even for admin).
- **Request contract:** Path id; PUT title,description,visitDate,status,isCompleted,expectedVersion only; DELETE no body.
- **Response:** GET/PUT {success,message,visit}; DELETE {success,message}.
- **Database operations/dependencies:** visits, users, properties, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/visits/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/visits.ts:99` (getVisit).

### PUT `/api/visits/[id]`

- **Purpose:** update visit.
- **Authentication/permissions:** Self/admin; update transaction revalidates actor and optional expectedVersion check (not mandatory even for admin).
- **Request contract:** Path id; PUT title,description,visitDate,status,isCompleted,expectedVersion only; DELETE no body.
- **Response:** GET/PUT {success,message,visit}; DELETE {success,message}.
- **Database operations/dependencies:** visits, users, properties, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked. Directly declared errors: `new ApiError(400,'Unsupported visit field')`; `new ApiError(400,'Visit date must be in the future')`; `new ApiError(400,'Invalid visit version')`; `new ApiError(404,'Visit not found')`; `new AccessError(403,'Active user required')`; `new AccessError(403,'Access denied')`; `new ApiError(409,'Visit changed; refresh and retry')`; `new ApiError(409,This ${previousStatus} visit can no longer be modified)`; `new ApiError(400,'Visit completion and status disagree')`; `new ApiError(409,'Visit administration history limit reached')`.
- **Route source:** `src/app/api/visits/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/visits.ts:115` (updateVisit).

### DELETE `/api/visits/[id]`

- **Purpose:** delete visit.
- **Authentication/permissions:** Self/admin; update transaction revalidates actor and optional expectedVersion check (not mandatory even for admin).
- **Request contract:** Path id; PUT title,description,visitDate,status,isCompleted,expectedVersion only; DELETE no body.
- **Response:** GET/PUT {success,message,visit}; DELETE {success,message}.
- **Database operations/dependencies:** visits, users, properties, admin_notifications, email_deliveries. Reads/writes follow the operation (GET reads unless noted; create/update/delete through named handler). Side effects can include Auth lookups/updates, R2 and email as described by source.
- **Errors:** Shared errors above apply; invalid input 400, denied scope 401/403, missing record 404 and stale/conflicting state 409 where checked.
- **Route source:** `src/app/api/visits/[id]/route.ts`.
- **Handler evidence:** `src/lib/server/services/visits.ts:145` (deleteVisit).

## Request model field dictionary

Exact legacy request field names/types from `src/lib/server/services/go-contracts.ts`. These model declarations are not independent authorization/validation guarantees; handlers require/ignore/override fields as described above. Native additions are listed in route contracts. `[]` arrays may be nullable in legacy decoding; absent scalar values can become zero/empty/false. Unknown fields are often ignored by Go-compatible model parsing, while newer strict endpoints reject them. Dates/time parsing and money validation are handler-specific.

### `CreatePropertyRequest`

`propertyTitle: string`, `propertyType: string`, `configuration: string`, `listingType: string`, `unitNumber: string`, `floor: string`, `location: string`, `carpetArea: string`, `constructedArea: string`, `tenantFirstName: string`, `tenantLastName: string`, `tenantName: string`, `tenantEmail: string`, `personName: string`, `mobileNumber: string`, `primaryNo: string`, `ultNo: string`, `tenantEmergencyContact: string`, `tenantPreviousAddress: string`, `tenantEmploymentStatus: string`, `tenantEmployer: string`, `tenantMonthlyIncome: string`, `tenantIsMarried: bool`, `tenantSpouse: *SpouseInfo`, `monthlyRent: string`, `sellingPrice: string`, `monthlyRent1stYear: string`, `monthlyRent2ndYear: string`, `monthlyRent3rdYear: string`, `monthlyRent4thYear: string`, `rentFromDate1: string`, `rentToDate1: string`, `rentFromDate2: string`, `rentToDate2: string`, `rentSchedule: []RentScheduleItem`, `paymentDueDate: string`, `escalationPercentage: string`, `escalationAmount: string`, `securityDeposit: string`, `agreementPeriod: string`, `agreementStartDate: string`, `agreementEndDate: string`, `noticePeriod: string`, `lockInPeriod: string`, `unitCondition: string`, `maintenanceToBePaidBy: string`, `projectCondition: string`, `internalImages: []string`, `possessionDate: string`, `rentalStatus: string`, `furnishedChecklist: []FurnishedItem`, `images: []string`, `specificComments: string`, `ownerUID: string`, `isSold: bool`, `buyerFirstName: string`, `buyerLastName: string`, `buyerPhone: string`, `isPreLeased: bool`, `preLeasedType: string`, `agreementTerm: string`, `lockInPeriodPreLeased: string`, `rentalIncome: string`, `escalation: string`, `tenantDetails: string`, `purpose: string`, `specificRequirement: string`.

### `CreateAdminNotificationRequest`

`type: string`, `title: string`, `message: string`, `propertyId: string`, `ownerId: string`, `ownerName: string`, `ownerPhone: string`, `ownerEmail: string`, `ownerRole: string`, `userId: string`, `userName: string`, `userEmail: string`, `userPhone: string`, `tenantName: string`, `tenantPhone: string`, `tenantEmail: string`, `buyers: string`, `propertyTitle: string`, `propertyAddress: string`, `propertyListingType: string`, `serviceType: string`, `serviceComment: string`, `serviceImage: string`, `inquiryType: string`, `propertyType: string`, `requestVisit: bool`, `visitDate: string`, `visitTime: string`, `reviewerType: string`, `tenantPart: TenantReviewPart`, `ownerPart: OwnerReviewPart`, `timestamp: string`, `isRead: bool`, `priority: string`, `adminRemarks: string`.

### `CreateVisitRequest`

`title: string`, `description: string`, `propertyId: string`, `visitDate: string`, `reminderType: string`, `reminderTime: int`.

### `UpdateVisitRequest`

`title: string`, `description: string`, `visitDate: string`, `reminderType: string`, `reminderTime: int`, `status: string`, `isCompleted: bool`.

### `CreateTenantRequest`

`propertyId: string`, `ownerUID: string`, `tenants: []Tenant`.

### `CreateDocumentRequest`

`propertyId: string`, `documentName: string`, `documentType: string`, `fileUrl: string`, `description: string`.

### `CreateReviewRequest`

`propertyId: string`, `reviewerType: string`, `tenantPart: TenantReviewPart`, `ownerPart: OwnerReviewPart`.

### `CreateInspectionReportRequest`

`propertyId: string`, `reportType: string`, `report: string`, `possessionLetterFile: string`, `handoverLetterFile: string`, `keysDetails: string`, `electricityBillMeterImage: string`, `electricityBillReceipt: string`, `apartmentConditionImage: string`, `apartmentConditionImages: []string`, `mglBillMeterImage: string`, `mglBillReceipt: string`, `internetImage: string`, `internetReceipt: string`, `otherDetails: string`.

## Validation and compatibility limitations

- No universal request schema/error envelope. `readObject` intentionally consumes the first JSON value and permits trailing material to preserve legacy Go behavior. Some handlers have no strict unknown-field allowlist. Never assume a UI validator protects direct API calls.
- Property update retains legacy dynamic fields after protecting identity/history/path-like names; tenant update similarly accepts mutable fields beyond a central strict allowlist. Schema dictionary documents declared fields, not a global Firestore field restriction.
- POST notification includes public general inquiry and authenticated private request paths; `/api/enquiries` is the separate admin/agent inbox, not the enquiry-creation endpoint.
- GET account contains attempted email synchronization/activity reads; relationship GET can persist authorized expiry/canonical-state refresh and increments limiter counters. Reads are not universally side-effect free in application semantics. This audit did not call them.
- Bare `/api/documents/property` and `/api/files` are compatibility/missing-ID entry points. Use explicit property-ID document path and managed file URL as appropriate.
- No payment, SMS, email delivery webhook, e-signature or dedicated role-owner/role-tenant API exists in the route tree.
- See KNOWN_ISSUES for mobile uniqueness races, email synchronization ordering, permissive legacy fields, optional concurrency tokens and deployment request-size risks. Source presence is not provider health or successful end-to-end evidence.
