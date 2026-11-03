import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { retryEmailDelivery } from '@/lib/server/services/transactional-email';
export const runtime='nodejs';export const dynamic='force-dynamic';export const OPTIONS=corsOptions;
export const POST=handle(async(request:Request,context:{params:Promise<{id:string}>})=>retryEmailDelivery(request,(await context.params).id),'Failed to retry email delivery',true);
export const GET=unsupported;export const PUT=unsupported;export const PATCH=unsupported;export const DELETE=unsupported;export const HEAD=unsupported;
