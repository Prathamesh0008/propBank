import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup1 } from '@/lib/server/native-group1';
import { propertyJsonRoute, readProperty, updateProperty } from '@/lib/server/services/properties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = propertyJsonRoute(nativeGroup1(corsOptions));
export const GET = propertyJsonRoute(nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => readProperty(request, (await context.params).id), 'Failed to get property', true)));
export const POST = propertyJsonRoute(nativeGroup1(unsupported));
export const PUT = propertyJsonRoute(nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => updateProperty(request, (await context.params).id), 'Failed to update property', true)));
export const PATCH = propertyJsonRoute(nativeGroup1(handle(async (request: Request, context: { params: Promise<{ id: string }> }) => updateProperty(request, (await context.params).id), 'Failed to update property', true)));
export const DELETE = propertyJsonRoute(nativeGroup1(unsupported));
export const HEAD = propertyJsonRoute(nativeGroup1(unsupported));
