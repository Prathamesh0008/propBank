import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup1 } from '@/lib/server/native-group1';
import { listUsers, createUser } from '@/lib/server/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup1(corsOptions);
export const GET = nativeGroup1(handle(async (request: Request) => listUsers(request), 'Failed to fetch users', true));
export const POST = nativeGroup1(handle(async (request: Request) => createUser(request), 'Failed to create/update user', true));
export const PUT = nativeGroup1(unsupported);
export const PATCH = nativeGroup1(unsupported);
export const DELETE = nativeGroup1(unsupported);
export const HEAD = nativeGroup1(unsupported);
