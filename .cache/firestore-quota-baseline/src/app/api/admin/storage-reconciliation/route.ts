import {handle,OPTIONS,unsupported} from '@/lib/server/http';
export const runtime='nodejs';
export {OPTIONS};
import {reconcileMedia} from '@/lib/server/services/media';
export const GET=handle(reconcileMedia),POST=handle(reconcileMedia);
export const PUT=unsupported,PATCH=unsupported,DELETE=unsupported,HEAD=unsupported;
