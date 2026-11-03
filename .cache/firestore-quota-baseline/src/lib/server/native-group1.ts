import 'server-only';
import { jsonResponse, plainError, unsupported } from './http';

// Permanently native; preserve collection-path validation responses.
export function nativeGroup1<T extends unknown[]>(handler:(request:Request,...args:T)=>Promise<Response>|Response) {
  return (request:Request,...args:T) => {
    const path=new URL(request.url).pathname;
    // A trailing collection slash historically means a missing document ID.
    if (/^\/api\/(users|properties)\/$/.test(path) && request.method!=='OPTIONS') {
      const label=path.includes('/users/')?'User':'Property';
      if (request.method==='GET'||request.method==='PUT'||request.method==='PATCH') {
        if(label==='User'&&request.method!=='GET') return jsonResponse({success:false,message:'User ID is required'},400);
        return plainError(`${label} ID is required`,400);
      }
      return unsupported();
    }
    return handler(request,...args);
  };
}
