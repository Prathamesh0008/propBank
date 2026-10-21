import {handle, OPTIONS, unsupported} from '@/lib/server/http';
import {updateEnquiry} from '@/lib/server/services/enquiries';
export const runtime='nodejs';
export {OPTIONS};
export const PATCH=handle(async(request:Request,context:{params:Promise<{id:string}>})=>updateEnquiry(request,(await context.params).id));
export const GET=unsupported, POST=unsupported, PUT=unsupported, DELETE=unsupported, HEAD=unsupported;
