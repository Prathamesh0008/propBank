import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup2 } from '@/lib/server/native-group2';
import { deleteNotification } from '@/lib/server/services/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup2(corsOptions);
export const GET = nativeGroup2(unsupported);
export const POST = nativeGroup2(unsupported);
export const PUT = nativeGroup2(unsupported);
export const PATCH = nativeGroup2(unsupported);
export const DELETE = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return deleteNotification(request, id); }, 'Failed to delete notification', false));
export const HEAD = nativeGroup2(unsupported);
