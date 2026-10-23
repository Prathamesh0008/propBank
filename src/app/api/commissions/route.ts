import {handle,OPTIONS,unsupported} from '@/lib/server/http';
import {createCommission,listCommissions} from '@/lib/server/services/commissions';
export const runtime='nodejs';export const dynamic='force-dynamic';export {OPTIONS};
export const GET=handle(listCommissions);export const POST=handle(createCommission);export const PUT=unsupported, PATCH=unsupported, DELETE=unsupported, HEAD=unsupported;
