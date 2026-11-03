import { handle, OPTIONS, unsupported } from '@/lib/server/http';
import { createNegotiation, listNegotiations } from '@/lib/server/services/negotiations';
export const runtime='nodejs';
export { OPTIONS };
export const GET=handle(listNegotiations);
export const POST=handle(createNegotiation);
export const PUT=unsupported, PATCH=unsupported, DELETE=unsupported, HEAD=unsupported;
