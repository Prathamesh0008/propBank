import {handle,jsonResponse,OPTIONS as corsOptions,unsupported,ApiError} from '@/lib/server/http';
import {preflightMobileRegistration} from '@/lib/server/mobile-registry';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const OPTIONS=corsOptions;
export const POST=handle(async(request:Request)=>{
  let body:unknown;
  try{body=await request.json();}catch{throw new ApiError(400,'Invalid registration request');}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='phoneNumber'))throw new ApiError(400,'Only a mobile number is accepted by this check');
  await preflightMobileRegistration((body as {phoneNumber?:unknown}).phoneNumber);
  return jsonResponse({success:true});
},'Registration availability could not be verified. Please try again.',true);
export const GET=unsupported;
export const PUT=unsupported;
export const PATCH=unsupported;
export const DELETE=unsupported;
export const HEAD=unsupported;
