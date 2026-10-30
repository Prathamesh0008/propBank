import 'server-only';
import { AccessError } from './auth';
import { projectFiles } from './file-projection';
import {randomUUID} from 'node:crypto';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const redactDiagnostic=(value:unknown)=>String(value||'').slice(0,500)
  .replace(/Bearer\s+\S+/gi,'Bearer [redacted]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-email]')
  .replace(/projects\/[^/\s]+/gi,'projects/[redacted]')
  .replace(/-----BEGIN[\s\S]*?-----END[^-]+-----/g,'[redacted-key]');
export function dependencyDiagnostic(error:unknown){
  const value=error as {message?:unknown;details?:unknown;metadata?:{getMap?:()=>Record<string,unknown>}};
  let metadata:Record<string,string>={};
  try{for(const [key,item] of Object.entries(value?.metadata?.getMap?.()||{}))metadata[key]=/(auth|token|cookie|credential)/i.test(key)?'[redacted]':redactDiagnostic(item);}catch{/* Metadata is diagnostic-only. */}
  return {detail:redactDiagnostic(value?.details||value?.message),metadata};
}

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-ID, Idempotency-Key' };
export function jsonResponse(body: unknown, status = 200) {
    return new Response(`${JSON.stringify(projectFiles(body))}\n`, { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control':'private, no-store' } });
}
export function plainError(message: string, status: number) {
  return new Response(`${message}\n`, { status, headers: { ...cors, 'Content-Type':'text/plain; charset=utf-8', 'X-Content-Type-Options':'nosniff' } });
}
export const OPTIONS = () => new Response(null,{status:200,headers:cors});
export const unsupported = () => plainError('Method not allowed',405);
export function handle<T extends unknown[]>(fn: (...args:T)=>Promise<Response>, message = 'Internal server error', json = false) {
  return async (...args:T) => {
    const started=Date.now();
    try { return await fn(...args); }
    catch (error) {
      if (error instanceof AccessError || error instanceof ApiError) {const response=jsonResponse({success:false,message:error.message,...(error instanceof AccessError&&error.code?{code:error.code}:{})},error.status);if(error.status===429)response.headers.set('Retry-After','60');return response;}
      const code=String((error as {code?:unknown}).code||(error instanceof Error?error.name:'UNKNOWN')),reference=randomUUID();
      const request=args[0] instanceof Request?args[0]:undefined;
      console.error('api_route_failed',JSON.stringify({reference,path:request?new URL(request.url).pathname:'unknown',method:request?.method||'unknown',code,durationMs:Date.now()-started,...dependencyDiagnostic(error)}));
      if(['8','RESOURCE_EXHAUSTED'].includes(code))return jsonResponse({success:false,code:'FIRESTORE_RESOURCE_EXHAUSTED',message:'The database has reached a temporary service limit. Please try again later.',reference},503);
      if(['4','13','14','DEADLINE_EXCEEDED','INTERNAL','UNAVAILABLE'].includes(code))return jsonResponse({success:false,code:'SERVICE_UNAVAILABLE',message:'The requested service is temporarily unavailable.',reference},503);
      // Do not expose SDK configuration, credentials or customer data in errors.
      return json ? jsonResponse({success:false,message},500) : plainError(message,500);
    }
  };
}
