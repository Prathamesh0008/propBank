import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup2 } from '@/lib/server/native-group2';
import { getVisit, updateVisit, deleteVisit } from '@/lib/server/services/visits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup2(corsOptions);
export const GET = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return getVisit(request, id); }, 'Failed to retrieve visit', true));
export const POST = nativeGroup2(unsupported);
export const PUT = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return updateVisit(request, id); }, 'Failed to update visit', true));
export const PATCH = nativeGroup2(unsupported);
export const DELETE = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return deleteVisit(request, id); }, 'Failed to delete visit', true));
export const HEAD = nativeGroup2(unsupported);
