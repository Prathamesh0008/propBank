import {handle,unsupported} from '@/lib/server/http';
import {tenantInventory} from '@/lib/server/services/agreement-inventory';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const operation=handle(async(request:Request,context:{params:Promise<{id:string}>})=>tenantInventory(request,(await context.params).id),'Inventory operation failed',true);
export const GET=operation,PUT=operation,POST=operation;
export const PATCH=unsupported,DELETE=unsupported;

export {OPTIONS} from '@/lib/server/http';
