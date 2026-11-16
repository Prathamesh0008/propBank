/** Accept only same-site page destinations; never redirect back into auth or an API. */
export function safeAuthNext(value:unknown):string {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//'))return '';
 try {
  let decoded=value;
  for(let i=0;i<6;i++){let next:string;try{next=decodeURIComponent(decoded);}catch{if(i===0)return '';break;}if(next===decoded)break;decoded=next;if(i===5)return '';}
  if(!decoded.startsWith('/')||decoded.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(decoded.split(/[?#]/)[0])||/[\\\u0000-\u001f\u007f]/.test(decoded))return '';
  const url=new URL(value,'https://propbank.invalid');
  if(url.origin!=='https://propbank.invalid'||/^\/(auth|api)(\/|$)/i.test(decodeURIComponent(url.pathname)))return '';
  return url.pathname+url.search+url.hash;
 }catch{return '';}
}
export function authDestination(next:unknown,role?:string):string {
 return safeAuthNext(next)||(role==='admin'?'/admin':'/');
}
