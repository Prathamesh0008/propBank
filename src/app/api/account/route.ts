import {handle,OPTIONS,unsupported} from '@/lib/server/http';
import {readMyAccount,updateMyAccount} from '@/lib/server/services/account';
export const runtime='nodejs';export const dynamic='force-dynamic';export {OPTIONS};
export const GET=handle(readMyAccount,'Failed to load account',true);
export const PATCH=handle(updateMyAccount,'Failed to update account',true);
export const POST=unsupported,PUT=unsupported,DELETE=unsupported,HEAD=unsupported;
