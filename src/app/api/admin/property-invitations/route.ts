import {handle} from '@/lib/server/http';
import {adminPropertyInvitations,replaceAdminPropertyInvitation} from '@/lib/server/services/admin-property-invitations';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=handle(adminPropertyInvitations,'Invitations unavailable',true);
export const POST=handle(replaceAdminPropertyInvitation,'Invitation update failed',true);
