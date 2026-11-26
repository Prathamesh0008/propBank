import {handle,OPTIONS} from '@/lib/server/http';
import {advertisementImage} from '@/lib/server/services/advertisements';
export {OPTIONS};
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export const GET=handle(async(request:Request,context:Context)=>advertisementImage(request,(await context.params).id),'Advertisement image unavailable',true);
