import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup1 } from '@/lib/server/native-group1';
import { readProperty, updateProperty } from '@/lib/server/services/properties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = nativeGroup1(corsOptions);
export const GET = nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => readProperty(request, (await context.params).id), 'Failed to get property', false));
export const POST = nativeGroup1(unsupported);
export const PUT = nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => updateProperty(request, (await context.params).id), 'Failed to update property', false));
export const PATCH = nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => updateProperty(request, (await context.params).id), 'Failed to update property', false));
export const DELETE = nativeGroup1(unsupported);
export const HEAD = nativeGroup1(unsupported);
