import { handle, OPTIONS, unsupported } from '@/lib/server/http';
import { updateNegotiation } from '@/lib/server/services/negotiations';
export const runtime='nodejs';
export { OPTIONS };
export const PATCH=handle(async(request:Request,context:{params:Promise<{id:string}>})=>updateNegotiation(request,(await context.params).id));
export const GET=unsupported, POST=unsupported, PUT=unsupported, DELETE=unsupported, HEAD=unsupported;
