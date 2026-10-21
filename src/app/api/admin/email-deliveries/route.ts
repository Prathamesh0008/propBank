import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { listEmailDeliveries } from '@/lib/server/services/transactional-email';
export const runtime='nodejs';export const dynamic='force-dynamic';export const OPTIONS=corsOptions;
export const GET=handle(async(request:Request)=>listEmailDeliveries(request),'Failed to list email deliveries',true);
export const POST=unsupported;export const PUT=unsupported;export const PATCH=unsupported;export const DELETE=unsupported;export const HEAD=unsupported;
