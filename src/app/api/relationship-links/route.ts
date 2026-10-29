import { handle, OPTIONS, jsonResponse } from '@/lib/server/http';
import { actOnRelationshipLink, listRelationshipLinks } from '@/lib/server/services/relationship-links';

export const runtime = 'nodejs';
export const GET = handle(listRelationshipLinks, 'Pending connections could not be loaded.', true);
export const POST = handle(actOnRelationshipLink, 'The connection could not be updated.', true);
export { OPTIONS };
const unsupported = () => jsonResponse({success: false, message: 'Method not allowed'}, 405);
export const PUT = unsupported, PATCH = unsupported, DELETE = unsupported, HEAD = unsupported;
