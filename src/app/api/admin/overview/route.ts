import {requireUser} from '@/lib/server/auth';
import {requireAdmin} from '@/lib/server/permissions';
import {getDatabase,COLLECTIONS} from '@/lib/server/firestore';
import {handle,jsonResponse,unsupported} from '@/lib/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=handle(async(request:Request)=>{
  requireAdmin(await requireUser(request));
  const db=getDatabase(),open=db.collection(COLLECTIONS.serviceRequests).where('status','in',['pending','in_progress']);
  const [requests,archived]=await Promise.all([open.count().get(),open.where('isArchived','==',true).count().get()]);
  return jsonResponse({success:true,openRequests:requests.data().count-archived.data().count});
},'Could not load administrative overview',true);
export const POST=unsupported;
