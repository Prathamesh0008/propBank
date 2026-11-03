import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup2 } from '@/lib/server/native-group2';
import { deleteFile } from '@/lib/server/services/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup2(corsOptions);
export const GET = nativeGroup2(unsupported);
export const POST = nativeGroup2(unsupported);
export const PUT = nativeGroup2(unsupported);
export const PATCH = nativeGroup2(unsupported);
export const DELETE = nativeGroup2(handle(async (request: Request) => deleteFile(request), 'Failed to update property', false));
export const HEAD = nativeGroup2(unsupported);
