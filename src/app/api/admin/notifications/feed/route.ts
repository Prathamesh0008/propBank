import {handle} from '@/lib/server/http';
import {notificationFeed} from '@/lib/server/services/admin-directories';
export const runtime='nodejs';export const dynamic='force-dynamic';
export const GET=handle(notificationFeed,'Could not load notifications',true);export const POST=GET;
