import {handle,OPTIONS} from '@/lib/server/http';
import {listAdvertisements} from '@/lib/server/services/advertisements';
export {OPTIONS};
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=handle((request:Request)=>listAdvertisements(request),'Could not load advertisements',true);
