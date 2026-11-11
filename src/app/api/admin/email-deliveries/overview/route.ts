import {handle} from '@/lib/server/http';
import {recoveryOverview} from '@/lib/server/services/notification-recovery';
export const runtime='nodejs';
export const GET=handle(recoveryOverview);
