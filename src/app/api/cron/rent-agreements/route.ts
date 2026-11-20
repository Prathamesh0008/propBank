import {handle,OPTIONS,unsupported} from '@/lib/server/http';
import {canonicalRemindersEndpoint} from '@/lib/server/services/canonical-reminders';
export const runtime='nodejs';
export const maxDuration=300;
export {OPTIONS};
export const GET=handle(canonicalRemindersEndpoint),POST=handle(canonicalRemindersEndpoint);
export const PUT=unsupported,PATCH=unsupported,DELETE=unsupported,HEAD=unsupported;
