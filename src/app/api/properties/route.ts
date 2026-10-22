import { handle, OPTIONS as corsOptions, unsupported } from '@/lib/server/http';
import { nativeGroup1 } from '@/lib/server/native-group1';
import { propertyJsonRoute, listProperties, createProperty } from '@/lib/server/services/properties';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = propertyJsonRoute(nativeGroup1(corsOptions));
export const GET = propertyJsonRoute(nativeGroup1(handle(async (request: Request) => listProperties(request), 'Failed to get properties', true)));
export const POST = propertyJsonRoute(nativeGroup1(handle(async (request: Request) => createProperty(request), 'Failed to create property', true)));
export const PUT = propertyJsonRoute(nativeGroup1(unsupported));
export const PATCH = propertyJsonRoute(nativeGroup1(unsupported));
export const DELETE = propertyJsonRoute(nativeGroup1(unsupported));
export const HEAD = propertyJsonRoute(nativeGroup1(unsupported));
