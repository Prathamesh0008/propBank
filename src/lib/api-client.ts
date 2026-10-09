import { auth } from '@/firebase';

export async function firebaseAuthorizationHeaders(initial?: HeadersInit): Promise<Headers> {
  const headers=new Headers(initial);
  await auth.authStateReady();
  if (auth.currentUser) headers.set('Authorization',`Bearer ${await auth.currentUser.getIdToken()}`);
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
  return fetch(input,{...init,headers});
}
