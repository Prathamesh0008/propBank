import 'server-only';
import {COLLECTIONS, getDatabase} from '../firestore';
import {requireAdmin} from '../permissions';
import type {AuthenticatedUser} from '../auth';
import {ApiError, jsonResponse} from '../http';
import {documentsById, pageOptions, validId} from '../query-pages';
import {identity} from './domain-contracts';
import {wireValue, isRecord, stringValue as s, type RecordData} from './contracts';

function dated(value: unknown) {
  const wire = wireValue(value);
  return typeof wire === 'string' && !wire.startsWith('0001-') && Number.isFinite(Date.parse(wire));
}
async function enrich(rows: RecordData[]): Promise<RecordData[]> {
  const [profiles, properties] = await Promise.all([
    documentsById(COLLECTIONS.users, rows.map(r => s(r.userUID))),
    documentsById(COLLECTIONS.properties, rows.map(r => s(r.propertyId))),
  ]);
  return rows.map(row => {
    const uid = s(row.userUID), profile = profiles.get(uid), property = properties.get(s(row.propertyId));
    // Relationship belongs to the actual requester UID, never the first tenant
    // or the property's owner by assumption. Contacts prefer trusted profiles;
    // historical submission snapshots remain explicitly identified if deleted.
    const tenant = uid && Array.isArray(property?.tenants) ? property.tenants.find((t: RecordData) => t.userUID === uid) : undefined;
    const role = uid && property?.ownerUID === uid ? 'Owner' : tenant ? tenant.isActive === false ? 'Former tenant' : tenant.linkConfirmationRequired ? 'Tenant (awaiting confirmation)' : 'Tenant' :
      profile?.role === 'admin' ? 'Administrator' : profile?.role === 'agent' ? 'Agent' : 'Registered user';
    return {...row, requester: {uid, name: s(profile ? profile.name : row.userName), email: s(profile ? profile.email : row.userEmail), mobile: s(profile ? profile.phoneNumber : row.userPhone),
      role: profile || property ? role : 'Relationship not recorded', profileAvailable: !!profile, source: profile ? 'current_profile' : 'submission_snapshot'},
      propertySummary: {id:s(row.propertyId), name:s(property?.buildingName) || s(property?.title), unit:s(property?.unitNumber),
        address:s(property?.address) || s(property?.location), available:!!property}};
  });
}
export async function adminServiceRequestPage(params: URLSearchParams, user: AuthenticatedUser) {
  requireAdmin(user);
  const {size, cursor} = pageOptions(params, 50), mode = params.get('mode') || 'dated';
  if (!['dated','undated'].includes(mode)) throw new ApiError(400,'Invalid service request history mode');
  const base = getDatabase().collection(COLLECTIONS.serviceRequests);
  // Firestore's implicit document-name tie-break follows createdAt DESC. A
  // snapshot cursor retains timestamp precision, including nanoseconds.
  let query: FirebaseFirestore.Query = base.orderBy(mode === 'dated' ? 'createdAt' : '__name__', 'desc').limit(size + 1);
  if (cursor) {
    const snapshot = await base.doc(cursor).get();
    if (!snapshot.exists) throw new ApiError(409,'This request page changed. Refresh the directory to restart pagination.');
    if (mode === 'dated' && snapshot.data()?.createdAt === undefined) throw new ApiError(400,'Invalid dated request cursor');
    query = query.startAfter(snapshot);
  }
  const snapshot = await query.get(), page = snapshot.docs.slice(0,size);
  const rows = page.map(doc => ({...doc.data(),id:doc.id} as RecordData)).filter(row => dated(row.createdAt) === (mode === 'dated'));
  const data = await enrich(rows);
  // Do not send full histories, media or resolution forms for every table row.
  const directory = params.get('directory') === 'true';
  const fields = ['id','userUID','propertyId','serviceId','serviceName','status','isArchived','createdAt','updatedAt','requester','propertySummary'];
  return jsonResponse({success:true,data:wireValue(directory ? data.map(row => Object.fromEntries(fields.map(key => [key,row[key] ?? null]))) : data),
    nextCursor:snapshot.docs.length > size ? page.at(-1)!.id : null, coverageComplete:snapshot.docs.length <= size, examined:page.length, scope:'loaded_page', mode});
}
export async function readAdminServiceRequest(request: Request, id: string) {
  requireAdmin(await identity(request));
  if (!validId(id)) throw new ApiError(400,'Invalid service request reference');
  const doc = await getDatabase().collection(COLLECTIONS.serviceRequests).doc(id).get();
  if (!doc.exists) throw new ApiError(404,'Service request not found');
  const [record] = await enrich([{...doc.data(),id}]);
  const history:RecordData[] = Array.isArray(record.history) ? record.history.filter(isRecord) : [];
  // Resolve only the selected request's actors, with a hard per-request bound.
  const ids = [...new Set<string>(history.map(entry => s(entry.actorUID)).filter(Boolean))];
  const actors = await documentsById(COLLECTIONS.users, ids.slice(0,100));
  return jsonResponse({success:true,request:wireValue({...record,history:history.map((entry:RecordData) => ({...entry,actorName:s(actors.get(s(entry.actorUID))?.name)}))}),actorsComplete:ids.length<=100});
}
