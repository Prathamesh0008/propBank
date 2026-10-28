"use client";
import {auth} from '@/firebase';
import {createPrivateFileSession} from './private-file-session';

// Module scope survives React Strict Mode effect setup/cleanup. All consumers
// share the same cookie mutation queue; no token or storage key is persisted.
export const privateFileSession=createPrivateFileSession({
  ready:()=>auth.authStateReady(),currentUser:()=>auth.currentUser,
  request:(method,token,signal)=>fetch('/api/media/session',{method,signal,credentials:'same-origin',cache:'no-store',headers:token?{Authorization:`Bearer ${token}`}:{}}),
});
let notifiedRevision=-1;
export function claimFileSessionNotice(revision:number){if(revision===notifiedRevision)return false;notifiedRevision=revision;return true;}
