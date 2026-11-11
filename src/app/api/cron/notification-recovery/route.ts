import {handle} from '@/lib/server/http';
import {recoveryEndpoint} from '@/lib/server/services/notification-recovery';
export const runtime='nodejs';
export const GET=handle(recoveryEndpoint);
export const POST=handle(recoveryEndpoint);
export const maxDuration=300;
