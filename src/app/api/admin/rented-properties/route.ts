import {handle,unsupported} from '@/lib/server/http';
import {rentedProperties} from '@/lib/server/services/admin-directories';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=handle(rentedProperties,'Could not load rented properties',true);
export const POST=unsupported;
