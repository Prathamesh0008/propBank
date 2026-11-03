import { handle, OPTIONS, unsupported } from '@/lib/server/http';
import { actOnRelationshipLink, listRelationshipLinks } from '@/lib/server/services/relationship-links';

export const runtime = 'nodejs';
export const GET = handle(listRelationshipLinks);
export const POST = handle(actOnRelationshipLink);
export { OPTIONS };
export const PUT = unsupported, PATCH = unsupported, DELETE = unsupported, HEAD = unsupported;
