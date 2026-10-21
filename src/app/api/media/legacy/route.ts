import {handle,OPTIONS,unsupported} from '@/lib/server/http';
export const runtime='nodejs';
export {OPTIONS};
import {deliverLegacy} from '@/lib/server/services/media';
export const GET=handle(deliverLegacy);
export const POST=unsupported,PUT=unsupported,PATCH=unsupported,DELETE=unsupported,HEAD=unsupported;
