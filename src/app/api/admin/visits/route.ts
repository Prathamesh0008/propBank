import {handle,OPTIONS,unsupported} from '@/lib/server/http';
import {listAdminVisits} from '@/lib/server/services/visits';
export const runtime='nodejs';
export {OPTIONS};
export const GET=handle(listAdminVisits);
export const POST=unsupported,PUT=unsupported,PATCH=unsupported,DELETE=unsupported,HEAD=unsupported;
