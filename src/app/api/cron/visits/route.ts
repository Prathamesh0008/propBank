import {handle,OPTIONS,unsupported} from '@/lib/server/http';
import {visitRemindersEndpoint} from '@/lib/server/services/canonical-reminders';
export const runtime='nodejs';
export const maxDuration=300;
export {OPTIONS};
export const GET=handle(visitRemindersEndpoint),POST=handle(visitRemindersEndpoint);
export const PUT=unsupported,PATCH=unsupported,DELETE=unsupported,HEAD=unsupported;
