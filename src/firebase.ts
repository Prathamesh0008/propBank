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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
const emulator=process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
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
