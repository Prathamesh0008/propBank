import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { manageAdminTenancy } from '@/lib/server/services/tenants';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const OPTIONS=corsOptions;
export const POST=handle(async(request:Request,context:{params:Promise<{id:string}>})=>{const {id}=await context.params;return manageAdminTenancy(request,id);},'Failed to update tenancy',true);
export const GET=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const DELETE=unsupported;
export const HEAD=unsupported;
