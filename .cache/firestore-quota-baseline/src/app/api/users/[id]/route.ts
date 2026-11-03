import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup1 } from '@/lib/server/native-group1';
import { readUser, updateUser } from '@/lib/server/services/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup1(corsOptions);
export const GET = nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => readUser(request, (await context.params).id), 'Failed to fetch user', true));
export const POST = nativeGroup1(unsupported);
export const PUT = nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => updateUser(request, (await context.params).id), 'Failed to update user', true));
export const PATCH = nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => updateUser(request, (await context.params).id), 'Failed to update user', true));
export const DELETE = nativeGroup1(unsupported);
export const HEAD = nativeGroup1(unsupported);
