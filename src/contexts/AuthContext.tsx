"use client";
import {useQueryClient} from '@tanstack/react-query';
import {createContext,useContext,useEffect,useState,useRef,useCallback,type ReactNode} from 'react';
import {apiFetch,loadAuthProfile} from '@/lib/api-client';
import {useToast} from '@/hooks/use-toast';
import {ToastAction} from '@/ui/toast';
import {auth} from '@/firebase';
import {onIdTokenChanged,type User} from 'firebase/auth';
import {privateFileSession,claimFileSessionNotice} from '@/lib/private-file-client';
import {INITIAL_FILE_SESSION,type FileSessionState} from '@/lib/private-file-session';
import {queryKeysByDomain,subscribeDataRefresh} from '@/lib/data-refresh';

export type ProfileStatus='checking'|'anonymous'|'incomplete'|'complete'|'unavailable';
interface AuthContextType {user:User|null;loading:boolean;profileStatus:ProfileStatus;profileError:string;fileAccess:FileSessionState;retryFileAccess:()=>Promise<void>;refreshProfile:()=>Promise<void>}
const AuthContext=createContext<AuthContextType>({user:null,loading:true,profileStatus:'checking',profileError:'',fileAccess:INITIAL_FILE_SESSION,retryFileAccess:async()=>{},refreshProfile:async()=>{}});
export const useAuth=()=>useContext(AuthContext);

export const AuthProvider=({children}:{children:ReactNode})=>{
  const queryClient=useQueryClient(),{toast,dismiss}=useToast();
  const previousUID=useRef<string|undefined>(undefined),publishedUID=useRef<string|undefined>(undefined);
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[profileStatus,setProfileStatus]=useState<ProfileStatus>('checking'),[profileError,setProfileError]=useState(''),[profileRevision,setProfileRevision]=useState(0);
  const [fileAccess,setFileAccess]=useState(privateFileSession.snapshot);
  const notice=useRef<string|undefined>(undefined),readyRevision=useRef(-1);
  const retryFileAccess=useCallback(()=>privateFileSession.retry(),[]);
  const refreshProfile=useCallback(async()=>{setProfileRevision(value=>value+1);},[]);

  useEffect(()=>privateFileSession.subscribe(setFileAccess),[]);
  useEffect(()=>subscribeDataRefresh(event=>{const keys=[...new Set(event.domains.flatMap(domain=>queryKeysByDomain[domain]))];void Promise.all(keys.map(key=>queryClient.invalidateQueries({queryKey:[key]})));}),[queryClient]);
  useEffect(()=>{const refresh=()=>setProfileRevision(value=>value+1);window.addEventListener('propbank:profile-completed',refresh);return()=>window.removeEventListener('propbank:profile-completed',refresh);},[]);
  useEffect(()=>{
    let generation=0;
    // Do not hold the Firebase observer open while acquiring tokens or cookies.
    const unsubscribe=onIdTokenChanged(auth,identity=>{
      const firebaseUser=identity?.emailVerified===true?identity:null,current=++generation;
      const identityChanged=previousUID.current!==firebaseUser?.uid;
      if(identityChanged)queryClient.clear();
      previousUID.current=firebaseUser?.uid;
      if(!firebaseUser){void privateFileSession.setUser(null);publishedUID.current=undefined;setUser(null);setProfileError('');setProfileStatus(identity?'incomplete':'anonymous');setLoading(false);return;}
      if(publishedUID.current!==firebaseUser.uid)setLoading(true);
      setProfileStatus('checking');setProfileError('');setUser(null);if(identityChanged)void privateFileSession.setUser(null);
      void loadAuthProfile(firebaseUser.uid).then(async ({response,data})=>{
        if(current!==generation||auth.currentUser?.uid!==firebaseUser.uid)return;
        if(!response.ok){publishedUID.current=undefined;setUser(null);if(response.status>=500){setProfileError(data.message||'Unable to load your account right now. Please try again.');setProfileStatus('unavailable');}else setProfileStatus('incomplete');setLoading(false);return;}
        if(data.profileComplete!==true){publishedUID.current=undefined;setProfileStatus('incomplete');setLoading(false);return;}
        await privateFileSession.setUser(firebaseUser);
        if(current!==generation||auth.currentUser?.uid!==firebaseUser.uid)return;
        publishedUID.current=firebaseUser.uid;setUser(firebaseUser);setProfileStatus('complete');setLoading(false);
        void apiFetch('/api/relationship-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'discover'})}).catch(()=>{});
      }).catch(()=>{if(current===generation){publishedUID.current=undefined;setUser(null);setProfileError('Unable to load your account right now. Please try again.');setProfileStatus('unavailable');setLoading(false);}});
    });
    const renew=()=>{void privateFileSession.renew();};
    const interval=window.setInterval(renew,10*60*1000);
    window.addEventListener('online',renew);window.addEventListener('focus',renew);
    return ()=>{generation++;unsubscribe();window.clearInterval(interval);window.removeEventListener('online',renew);window.removeEventListener('focus',renew);};
  },[queryClient,profileRevision]);

  useEffect(()=>{
    if(fileAccess.phase==='ready'&&fileAccess.revision!==readyRevision.current){
      readyRevision.current=fileAccess.revision;
      void Promise.all(['userProperties','property','productHub','documents'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));
    }
    if(fileAccess.phase!=='failed'){if(notice.current){dismiss(notice.current);notice.current=undefined;}return;}
    if(!user||fileAccess.uid!==user.uid||auth.currentUser?.uid!==user.uid||!claimFileSessionNotice(fileAccess.revision))return;
    notice.current=toast({title:'Secure file access',description:fileAccess.message,variant:'destructive',action:<ToastAction altText="Retry secure file access" onClick={()=>void retryFileAccess()}>Retry</ToastAction>}).id;
  },[fileAccess,user,queryClient,toast,dismiss,retryFileAccess]);

  return <AuthContext.Provider value={{user,loading,profileStatus,profileError,fileAccess,retryFileAccess,refreshProfile}}>{children}</AuthContext.Provider>;
};
