import {handle,OPTIONS,unsupported} from '@/lib/server/http';
import {recordAccountSecurityEvent} from '@/lib/server/services/account';
export const runtime='nodejs';export const dynamic='force-dynamic';export {OPTIONS};
export const POST=handle(recordAccountSecurityEvent,'Failed to record account security activity',true);
export const GET=unsupported,PUT=unsupported,PATCH=unsupported,DELETE=unsupported,HEAD=unsupported;
