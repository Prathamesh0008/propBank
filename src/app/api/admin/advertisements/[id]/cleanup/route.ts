import {handle,OPTIONS} from '@/lib/server/http';
import {recoverAdvertisement} from '@/lib/server/services/advertisements';
export {OPTIONS};
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export const POST=handle(async(request:Request,context:Context)=>recoverAdvertisement(request,(await context.params).id),'Could not recover advertisement upload',true);
