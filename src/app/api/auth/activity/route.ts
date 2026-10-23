import {handle,OPTIONS,unsupported} from '@/lib/server/http';
import {authenticationActivity} from '@/lib/server/services/auth-activity';
export const runtime='nodejs';export const dynamic='force-dynamic';export {OPTIONS};
export const POST=handle(authenticationActivity,'Authentication activity failed',true);
export const GET=unsupported,PUT=unsupported,PATCH=unsupported,DELETE=unsupported,HEAD=unsupported;
