import {handle,OPTIONS,unsupported} from '@/lib/server/http';
export const runtime='nodejs';
export {OPTIONS};
import {mediaSession} from '@/lib/server/services/media';
export const POST=handle(mediaSession),DELETE=handle(mediaSession);
export const GET=unsupported,PUT=unsupported,PATCH=unsupported,HEAD=unsupported;
