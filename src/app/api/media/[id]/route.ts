import {handle,OPTIONS,unsupported} from '@/lib/server/http';
export const runtime='nodejs';
export {OPTIONS};
import {deliverMedia} from '@/lib/server/services/media';
export const GET=handle(async(request:Request,context:{params:Promise<{id:string}>})=>deliverMedia(request,(await context.params).id));
export const POST=unsupported,PUT=unsupported,PATCH=unsupported,DELETE=unsupported,HEAD=unsupported;
