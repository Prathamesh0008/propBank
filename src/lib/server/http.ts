import 'server-only';
import { AccessError } from './auth';
import { projectFiles } from './file-projection';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
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
    try { return await fn(...args); }
    catch (error) {
      if (error instanceof AccessError || error instanceof ApiError) {const response=jsonResponse({success:false,message:error.message},error.status);if(error.status===429)response.headers.set('Retry-After','60');return response;}
      // Do not expose SDK configuration, credentials or customer data in errors.
      return json ? jsonResponse({success:false,message},500) : plainError(message,500);
    }
  };
}
