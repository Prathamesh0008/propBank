import { auth } from '@/firebase';

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
  return fetch(input,{...init,headers});
}
