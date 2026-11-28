import {handle,unsupported} from '@/lib/server/http';
import {createAdminProperty} from '@/lib/server/services/properties';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=handle(createAdminProperty,'Administrator property creation failed',true);
export const GET=unsupported;
