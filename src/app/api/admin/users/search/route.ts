import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { searchUsersForAdmin } from '@/lib/server/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = corsOptions;
export const GET = handle(async (request:Request)=>searchUsersForAdmin(request),'Failed to search users',true);
export const POST = unsupported;
export const PUT = unsupported;
export const PATCH = unsupported;
export const DELETE = unsupported;
export const HEAD = unsupported;
