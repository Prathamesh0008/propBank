import { handle, OPTIONS, unsupported } from '@/lib/server/http';
import { remindersEndpoint } from '@/lib/server/services/reminders';
export const runtime='nodejs';
export const maxDuration=300;
export { OPTIONS };
export const GET=handle(remindersEndpoint), POST=handle(remindersEndpoint);
export const PUT=unsupported, PATCH=unsupported, DELETE=unsupported, HEAD=unsupported;
