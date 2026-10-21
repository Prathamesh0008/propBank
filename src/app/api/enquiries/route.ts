import {handle, OPTIONS, unsupported} from '@/lib/server/http';
import {listEnquiries} from '@/lib/server/services/enquiries';
export const runtime='nodejs';
export {OPTIONS};
export const GET=handle(listEnquiries);
export const POST=unsupported, PUT=unsupported, PATCH=unsupported, DELETE=unsupported, HEAD=unsupported;
