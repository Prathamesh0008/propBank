import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup2 } from '@/lib/server/native-group2';
import { getDocument, deleteDocument, updateDocument } from '@/lib/server/services/documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup2(corsOptions);
export const GET = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return getDocument(request, id); }, 'Failed to delete document', true));
export const POST = nativeGroup2(unsupported);
export const PUT = nativeGroup2(unsupported);
export const PATCH = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => updateDocument(request,(await context.params).id), 'Failed to update document', true));
export const DELETE = nativeGroup2(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => { const { id } = await context.params; return deleteDocument(request, id); }, 'Failed to delete document', true));
export const HEAD = nativeGroup2(unsupported);
