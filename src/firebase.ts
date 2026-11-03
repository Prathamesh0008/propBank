import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const emulator=process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
const emulatorMode=process.env.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE==='emulator'||!!emulator;
if(emulatorMode){
  if(process.env.NODE_ENV==='production')throw new Error('Firebase Auth emulator configuration is forbidden in production.');
  let endpoint:URL;try{endpoint=new URL(emulator||'');}catch{throw new Error('Local Auth emulator URL is required. Run npm run dev.');}
  if(!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith('demo-')||endpoint.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||!endpoint.port||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/')throw new Error('Local Auth requires a demo project and a loopback emulator URL.');
}
const developmentFirebase=process.env.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE==='firebase';
if(developmentFirebase){
  const project=process.env.NEXT_PUBLIC_FIREBASE_DEV_PROJECT_ID;
  if(!project||['propbank-7601b','propbank-944fc'].includes(project)||project.startsWith('demo-')||firebaseConfig.projectId!==project||firebaseConfig.authDomain!==`${project}.firebaseapp.com`||!firebaseConfig.apiKey||!firebaseConfig.appId||emulator)throw new Error('Invalid isolated development Firebase browser configuration. Restart the server after configuring it.');
}
if(process.env.NODE_ENV==='development'&&!emulatorMode&&!developmentFirebase&&process.env.NEXT_PUBLIC_PROPBANK_FIREBASE_MODE!=='live')throw new Error('Select an explicit Firebase environment before using Auth.');
const existingApps=getApps();
const app = existingApps.length ? getApp() : initializeApp(firebaseConfig);
if(existingApps.length&&(app.options.projectId!==firebaseConfig.projectId||app.options.apiKey!==firebaseConfig.apiKey||app.options.authDomain!==firebaseConfig.authDomain||app.options.appId!==firebaseConfig.appId))throw new Error('Firebase project changed. Reload the browser before continuing.');
export const auth = getAuth(app);
if(process.env.NODE_ENV!=='production'&&emulator&&!(globalThis as typeof globalThis&{__propbankAuthEmulator?:boolean}).__propbankAuthEmulator){connectAuthEmulator(auth,emulator,{disableWarnings:true});(globalThis as typeof globalThis&{__propbankAuthEmulator?:boolean}).__propbankAuthEmulator=true;}
export const provider = new GoogleAuthProvider();
provider.addScope('email');
provider.addScope('profile');
export const signInWithGoogle = () => signInWithPopup(auth, provider);
export const signOutUser = async () => {
  await signOut(auth);
  localStorage.removeItem("authToken");
  for (const name of ["userEmail", "userName"]) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Strict`;
  }
};
