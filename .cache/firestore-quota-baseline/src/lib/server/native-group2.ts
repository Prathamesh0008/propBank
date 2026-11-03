import 'server-only';
import { plainError, jsonResponse, unsupported, OPTIONS as corsOptions } from './http';

// Permanently native; preserve local validation and compatibility responses.
export function nativeGroup2<T extends unknown[]>(handler:(request:Request,...args:T)=>Promise<Response>|Response) {
  return (request:Request,...args:T) => {
    const path=new URL(request.url).pathname;
    if(path==='/api/files'||path==='/api/documents/property')return new Response(null,{status:301,headers:{Location:`${path}/${new URL(request.url).search}`}});
    if(path==='/api/documents/property/'&&request.method!=='OPTIONS')return request.method==='GET'?jsonResponse({success:false,message:'Property ID is required'},400):unsupported();
    if(path==='/api/visits/' && request.method!=='OPTIONS') {
      return ['GET','PUT','DELETE'].includes(request.method)?plainError('Visit ID is required',400):unsupported();
    }
    if(path==='/api/tenants/'&&request.method!=='OPTIONS')return ['GET','PUT','DELETE'].includes(request.method)?plainError('Tenant ID is required',400):unsupported();
    if(path==='/api/documents/'&&request.method!=='OPTIONS')return request.method==='GET'?plainError('Document ID is required',400):request.method==='DELETE'?jsonResponse({success:false,message:'Document ID is required'},400):unsupported();
    if(path==='/api/admin/notifications/'&&request.method!=='OPTIONS')return request.method==='DELETE'?plainError('Notification ID is required',400):unsupported();
    // Preserve the historical trailing-slash response without invoking a mutation.
    if(/^\/api\/(?:upload(?:\/[^/]+)?|agreements\/[^/]+)\/$/.test(path)) {
      const response=corsOptions();
      if(request.method==='OPTIONS')return response;
      const headers=new Headers(response.headers);headers.set('Content-Type','application/json');
      return new Response(request.method==='HEAD'?null:'{"message": "ShoPROP Backend API is running! (v2)", "status": "success"}',{status:200,headers});
    }
    return handler(request,...args);
  };
}
