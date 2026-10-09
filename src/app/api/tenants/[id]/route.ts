import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup2 } from '@/lib/server/native-group2';
import { getTenant, updateTenant, deleteTenant } from '@/lib/server/services/tenants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup2(corsOptions);
export const GET = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return getTenant(request, id); }, 'Failed to retrieve tenant', false));
export const POST = nativeGroup2(unsupported);
export const PUT = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return updateTenant(request, id); }, 'Failed to update tenant', false));
export const PATCH = nativeGroup2(unsupported);
export const DELETE = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return deleteTenant(request, id); }, 'Failed to delete tenant', false));
export const HEAD = nativeGroup2(unsupported);
