import {handle,OPTIONS} from '@/lib/server/http';
import {saveAdvertisement,deleteAdvertisement} from '@/lib/server/services/advertisements';
export {OPTIONS};
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
export const PUT=handle(async(request:Request,context:Context)=>saveAdvertisement(request,(await context.params).id),'Could not update advertisement',true);
export const DELETE=handle(async(request:Request,context:Context)=>deleteAdvertisement(request,(await context.params).id),'Could not delete advertisement',true);
