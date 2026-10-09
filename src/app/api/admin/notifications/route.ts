import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup2 } from '@/lib/server/native-group2';
import { listNotifications, postNotification } from '@/lib/server/services/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup2(corsOptions);
export const GET = nativeGroup2(handle(async (request: Request) => listNotifications(request), 'Failed to update admin remarks', false));
export const POST = nativeGroup2(handle(async (request: Request) => postNotification(request), 'Failed to create notification', false));
export const PUT = nativeGroup2(unsupported);
export const PATCH = nativeGroup2(unsupported);
export const DELETE = nativeGroup2(unsupported);
export const HEAD = nativeGroup2(unsupported);
