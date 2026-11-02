import { auth } from '@/firebase';
import {mutationDomains,publishDataRefresh} from '@/lib/data-refresh';

export async function firebaseAuthorizationHeaders(initial?: HeadersInit): Promise<Headers> {
  const headers=new Headers(initial);
  const startingUID=auth.currentUser?.uid;
  await auth.authStateReady();
  const user=auth.currentUser;
  if(startingUID&&user?.uid!==startingUID){const error=new Error('Account changed before the request could start');error.name='AbortError';throw error;}
  if (user) {
    const token=await user.getIdToken();
    if(auth.currentUser?.uid!==user.uid){const error=new Error('Account changed before the request could start');error.name='AbortError';throw error;}
    headers.set('Authorization',`Bearer ${token}`);
  }
  else headers.delete('Authorization');
  return headers;
}

// Obtain the current Firebase token on each local API request, including after refresh.
// Preserve every other header, body and fetch option; never send tokens to external URLs.
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const href=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const base=typeof window==='undefined'?'http://localhost':window.location.origin;
  const target=new URL(href,base);
  if(target.origin!==base || (target.pathname!=='/api'&&!target.pathname.startsWith('/api/'))) return fetch(input,init);
  const original=new Headers(input instanceof Request?input.headers:undefined);
  new Headers(init?.headers).forEach((value,key)=>original.set(key,value));
  const headers=await firebaseAuthorizationHeaders(original);
  const response=await fetch(input,{...init,headers});
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  const domains=response.ok?mutationDomains(target.pathname,method):[];
  if(domains.length)publishDataRefresh(domains);
  return response;
}

export type AuthProfileResult={response:Response;data:{profileExists?:boolean;profileComplete?:boolean;status?:string;message?:string;code?:string}};
const authProfileRequests=new Map<string,Promise<AuthProfileResult>>();
export function loadAuthProfile(uid:string):Promise<AuthProfileResult>{
  const existing=authProfileRequests.get(uid);if(existing)return existing;
  const request=(async()=>{
    let result:AuthProfileResult|undefined;
    for(let attempt=0;attempt<2;attempt++){
      const response=await apiFetch('/api/auth/user',{cache:'no-store'});
      const data=await response.json().catch(()=>({})) as AuthProfileResult['data'];
      result={response,data};
      if(![500,503].includes(response.status)||data.code==='FIRESTORE_RESOURCE_EXHAUSTED'||attempt===1)return result;
      await new Promise(resolve=>setTimeout(resolve,350));
    }
    return result!;
  })();
  authProfileRequests.set(uid,request);
  const clear=()=>{if(authProfileRequests.get(uid)===request)authProfileRequests.delete(uid);};
  void request.then(clear,clear);
  return request;
}
