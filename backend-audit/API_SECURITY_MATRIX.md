# Current API authorization matrix

Derived from all 43 current route files. See API_INVENTORY.md for every caller, request method, mapped handler and response compatibility. Unsupported methods return 405. Legacy trailing-slash health responses contain no data and perform no mutations. No live calls were made by this audit.

| Endpoint | Exported methods | Authentication / authorization |
| --- | --- | --- |
| /api/admin/notifications | OPTIONS, GET, POST | Public inquiry intake or authenticated allowed request types; property/self reads; global list/admin actions require admin |
| /api/admin/notifications/[id]/read | OPTIONS, PUT | Public inquiry intake or authenticated allowed request types; property/self reads; global list/admin actions require admin |
| /api/admin/notifications/[id]/remarks | OPTIONS, PUT | Public inquiry intake or authenticated allowed request types; property/self reads; global list/admin actions require admin |
| /api/admin/notifications/[id] | OPTIONS, DELETE | Public inquiry intake or authenticated allowed request types; property/self reads; global list/admin actions require admin |
| /api/admin/site-settings | OPTIONS, GET, PUT, PATCH | Public GET content; admin writes |
| /api/agreements/renew | OPTIONS, POST | Firebase bearer; active tenant request or actual owner approval/termination; pending request ID checked |
| /api/agreements/request-renewal | OPTIONS, POST | Firebase bearer; active tenant request or actual owner approval/termination; pending request ID checked |
| /api/agreements/request-termination | OPTIONS, POST | Firebase bearer; active tenant request or actual owner approval/termination; pending request ID checked |
| /api/agreements/terminate | OPTIONS, POST | Firebase bearer; active tenant request or actual owner approval/termination; pending request ID checked |
| /api/auth/login | OPTIONS, POST | Firebase bearer; registration allows own UID, admin assignment only; login UID must match token |
| /api/auth/user | OPTIONS, POST | Firebase bearer; registration allows own UID, admin assignment only; login UID must match token |
| /api/cron/reminders | OPTIONS, GET, POST | CRON_SECRET bearer only; missing secret/email configuration fails closed; transactional delivery leases and provider deduplication |
| /api/documents/property | OPTIONS, GET | Firebase bearer; property member metadata; deletion author/owner/admin plus membership; PATCH status admin |
| /api/documents/property/[propertyId] | OPTIONS, GET | Firebase bearer; property member metadata; deletion author/owner/admin plus membership; PATCH status admin |
| /api/documents | OPTIONS, GET, POST | Firebase bearer; property member metadata; deletion author/owner/admin plus membership; PATCH status admin |
| /api/documents/[id] | OPTIONS, GET, PATCH, DELETE | Firebase bearer; property member metadata; deletion author/owner/admin plus membership; PATCH status admin |
| /api/files | OPTIONS, DELETE | Firebase bearer; reserved property/document folders guarded; generic uploads namespaced by UID; legacy deletion admin |
| /api/files/[...path] | OPTIONS, DELETE | Firebase bearer; reserved property/document folders guarded; generic uploads namespaced by UID; legacy deletion admin |
| /api/inspection-reports/property/[propertyId] | OPTIONS, GET | Firebase bearer; property relationship required; user report queries self/admin plus membership filtering |
| /api/inspection-reports | OPTIONS, POST | Firebase bearer; property relationship required; user report queries self/admin plus membership filtering |
| /api/inspection-reports/user/[userId] | OPTIONS, GET | Firebase bearer; property relationship required; user report queries self/admin plus membership filtering |
| /api/negotiations | OPTIONS, GET, POST | Firebase bearer; owner/customer/assigned broker/admin reads; owner approval and customer acceptance; optimistic version |
| /api/negotiations/[id] | OPTIONS, PATCH | Firebase bearer; owner/customer/assigned broker/admin reads; owner approval and customer acceptance; optimistic version |
| /api/properties | OPTIONS, GET, POST | Public GET browsing projection; ownerUID query self/admin; tenant lookup verified identity; writes owner/admin |
| /api/properties/search | OPTIONS, GET | Public GET browsing projection; ownerUID query self/admin; tenant lookup verified identity; writes owner/admin |
| /api/properties/tenant | OPTIONS, GET | Public GET browsing projection; ownerUID query self/admin; tenant lookup verified identity; writes owner/admin |
| /api/properties/[id] | OPTIONS, GET, PUT, PATCH | Public GET browsing projection; ownerUID query self/admin; tenant lookup verified identity; writes owner/admin |
| /api/reviews | OPTIONS, GET, POST | Firebase bearer; property relationship and reviewer context; GET history member/admin |
| /api/service-requests | OPTIONS, GET, POST | Firebase bearer; creator self/admin and property membership; resolution writes admin only |
| /api/service-requests/[id] | OPTIONS, PUT | Firebase bearer; creator self/admin and property membership; resolution writes admin only |
| /api/services | OPTIONS, GET | Public catalog; no startup writes; existing service records override built-in categories |
| /api/tenants | OPTIONS, GET, POST | Firebase bearer; owner/admin assignment and mutation; Firebase account link validation; property member/self reads; atomic embedded/collection writes |
| /api/tenants/[id] | OPTIONS, GET, PUT, DELETE | Firebase bearer; owner/admin assignment and mutation; Firebase account link validation; property member/self reads; atomic embedded/collection writes |
| /api/upload/document | OPTIONS, POST | Firebase bearer; reserved property/document folders guarded; generic uploads namespaced by UID; legacy deletion admin |
| /api/upload/image | OPTIONS, POST | Firebase bearer; reserved property/document folders guarded; generic uploads namespaced by UID; legacy deletion admin |
| /api/upload/property-images | OPTIONS, POST | Firebase bearer; reserved property/document folders guarded; generic uploads namespaced by UID; legacy deletion admin |
| /api/upload | OPTIONS, POST | Firebase bearer; reserved property/document folders guarded; generic uploads namespaced by UID; legacy deletion admin |
| /api/upload/service-request-image | OPTIONS, POST | Firebase bearer; reserved property/document folders guarded; generic uploads namespaced by UID; legacy deletion admin |
| /api/users | OPTIONS, GET, POST | Firebase bearer; list admin only; own/admin writes; peers receive minimal profile; Firebase email checked |
| /api/users/search | OPTIONS, GET | Firebase bearer; list admin only; own/admin writes; peers receive minimal profile; Firebase email checked |
| /api/users/[id] | OPTIONS, GET, PUT, PATCH | Firebase bearer; list admin only; own/admin writes; peers receive minimal profile; Firebase email checked |
| /api/visits | OPTIONS, GET, POST | Firebase bearer; requester/self/admin CRUD; partial field and status validation; missing updates return 404; owner notified |
| /api/visits/[id] | OPTIONS, GET, PUT, DELETE | Firebase bearer; requester/self/admin CRUD; partial field and status validation; missing updates return 404; owner notified |
