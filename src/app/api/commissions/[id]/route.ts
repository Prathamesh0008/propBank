import {handle,OPTIONS,unsupported} from '@/lib/server/http';
import {updateCommission} from '@/lib/server/services/commissions';
export const runtime='nodejs';export const dynamic='force-dynamic';export {OPTIONS};
export const PATCH=handle(async(request:Request,context:{params:Promise<{id:string}>})=>updateCommission(request,(await context.params).id));export const GET=unsupported, POST=unsupported, PUT=unsupported, DELETE=unsupported, HEAD=unsupported;
