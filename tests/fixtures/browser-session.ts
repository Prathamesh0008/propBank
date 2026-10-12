import type {Page} from '@playwright/test';
export async function signIn(page:Page,uid:string) {
  const apiKey=process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if(!apiKey)throw new Error('Browser Firebase configuration is required for acceptance tests');
  await page.route('**/api/**',async route=>{
    try {
    const req=route.request();
    const response=await page.request.fetch(`http://127.0.0.1:18081${new URL(req.url()).pathname}${new URL(req.url()).search}`,{method:req.method(),headers:req.headers(),maxRetries:req.method()==='GET'?2:0,...(req.postDataBuffer()?{data:req.postDataBuffer()!}:{})});
    await route.fulfill({response});
    } catch(error) {
      // Closing a test context can dispose an outstanding read after assertions finish.
      if(!page.isClosed())throw error;
    }
  });
  await page.route('**/identitytoolkit.googleapis.com/**',route=>route.fulfill({json:{users:[{localId:uid,email:`${uid}@test.invalid`,emailVerified:true,displayName:uid,providerUserInfo:[{providerId:'google.com',rawId:uid,email:`${uid}@test.invalid`}]}]}}));
  await page.addInitScript(({apiKey,uid})=>{
    const value={uid,email:`${uid}@test.invalid`,emailVerified:true,displayName:uid,isAnonymous:false,providerData:[{providerId:'google.com',uid,email:`${uid}@test.invalid`,displayName:uid,photoURL:null,phoneNumber:null}],stsTokenManager:{refreshToken:'fixture-refresh',accessToken:uid,expirationTime:Date.now()+3600000},createdAt:'1700000000000',lastLoginAt:'1700000000000',apiKey,appName:'[DEFAULT]'};
    // Force the in-memory SDK to wait for the fixture IndexedDB transaction.
    const open=indexedDB.open('firebaseLocalStorageDb',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('firebaseLocalStorage',{keyPath:'fbase_key'});
    open.onsuccess=()=>{const db=open.result;const tx=db.transaction('firebaseLocalStorage','readwrite');tx.objectStore('firebaseLocalStorage').put({fbase_key:`firebase:authUser:${apiKey}:[DEFAULT]`,value});tx.oncomplete=()=>db.close();};
  },{apiKey,uid});
}
