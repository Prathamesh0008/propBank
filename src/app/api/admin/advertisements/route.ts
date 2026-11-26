import {handle,OPTIONS} from '@/lib/server/http';
import {listAdvertisements,saveAdvertisement} from '@/lib/server/services/advertisements';
export {OPTIONS};
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=handle((request:Request)=>listAdvertisements(request,true),'Could not load advertisements',true);
export const POST=handle((request:Request)=>saveAdvertisement(request),'Could not save advertisement',true);
