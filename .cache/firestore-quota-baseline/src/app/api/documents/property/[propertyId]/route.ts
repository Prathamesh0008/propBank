import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup2 } from '@/lib/server/native-group2';
import { listDocuments } from '@/lib/server/services/documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup2(corsOptions);
export const GET = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ propertyId: string }> }) => { const { propertyId } = await context.params; return listDocuments(request, propertyId); }, 'Failed to delete document', true));
export const POST = nativeGroup2(unsupported);
export const PUT = nativeGroup2(unsupported);
export const PATCH = nativeGroup2(unsupported);
export const DELETE = nativeGroup2(unsupported);
export const HEAD = nativeGroup2(unsupported);
