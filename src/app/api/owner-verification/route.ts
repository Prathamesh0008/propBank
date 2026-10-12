import { handle, OPTIONS, unsupported } from '@/lib/server/http';
import { verifyPropertyOwner } from '@/lib/server/services/owner-verification';
export const runtime='nodejs';
export const POST=handle(verifyPropertyOwner);
export { OPTIONS };
export const GET=unsupported,PATCH=unsupported,PUT=unsupported,DELETE=unsupported,HEAD=unsupported;
