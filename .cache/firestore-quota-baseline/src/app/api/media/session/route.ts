import {handle,OPTIONS,unsupported} from '@/lib/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export {OPTIONS};
import {mediaSession} from '@/lib/server/services/media';
export const POST=handle(mediaSession),DELETE=handle(mediaSession);
export const GET=handle(mediaSession,'Secure file access is unavailable',true),PUT=unsupported,PATCH=unsupported,HEAD=unsupported;
