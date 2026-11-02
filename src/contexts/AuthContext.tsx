"use client";
import {useQueryClient} from '@tanstack/react-query';
import {createContext,useContext,useEffect,useState,useRef,useCallback,type ReactNode} from 'react';
import {apiFetch,loadAuthProfile,type AuthProfile} from '@/lib/api-client';
import {useToast} from '@/hooks/use-toast';
import {ToastAction} from '@/ui/toast';
import {auth} from '@/firebase';
import {onIdTokenChanged,type User} from 'firebase/auth';
import {privateFileSession,claimFileSessionNotice} from '@/lib/private-file-client';
import {INITIAL_FILE_SESSION,type FileSessionState} from '@/lib/private-file-session';
import {queryKeysByDomain,subscribeDataRefresh} from '@/lib/data-refresh';

export type ProfileStatus='checking'|'anonymous'|'incomplete'|'complete'|'unavailable';
interface AuthContextType {user:User|null;profile:AuthProfile|null;loading:boolean;profileStatus:ProfileStatus;profileError:string;fileAccess:FileSessionState;retryFileAccess:()=>Promise<void>;refreshProfile:()=>Promise<void>;completeLogin:(profile:AuthProfile)=>Promise<void>}
const AuthContext=createContext<AuthContextType>({user:null,profile:null,loading:true,profileStatus:'checking',profileError:'',fileAccess:INITIAL_FILE_SESSION,retryFileAccess:async()=>{},refreshProfile:async()=>{},completeLogin:async()=>{}});
export const useAuth=()=>useContext(AuthContext);

export const AuthProvider=({children}:{children:ReactNode})=>{
  const queryClient=useQueryClient(),{toast,dismiss}=useToast();
  const previousUID=useRef<string|undefined>(undefined),publishedUID=useRef<string|undefined>(undefined);
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[profileStatus,setProfileStatus]=useState<ProfileStatus>('checking'),[profileError,setProfileError]=useState(''),[profileRevision,setProfileRevision]=useState(0);
  const [profile,setProfile]=useState<AuthProfile|null>(null);
  const generation=useRef(0),completingUID=useRef<string|null>(null);
  const [fileAccess,setFileAccess]=useState(privateFileSession.snapshot);
  const notice=useRef<string|undefined>(undefined),readyRevision=useRef(-1);
  const retryFileAccess=useCallback(()=>privateFileSession.retry(),[]);
  const refreshProfile=useCallback(async()=>{setProfileRevision(value=>value+1);},[]);
  const completeLogin=useCallback(async(confirmedProfile:AuthProfile)=>{
    const identity=auth.currentUser;
    if(!identity?.emailVerified||identity.uid!==confirmedProfile.uid)throw new Error('Your account changed during sign-in. Please try again.');
    const current=++generation.current;
    completingUID.current=identity.uid;
    setLoading(true);setProfileStatus('checking');setProfileError('');
    if(previousUID.current!==identity.uid){queryClient.clear();setProfile(null);}
    previousUID.current=identity.uid;
    try{
      await privateFileSession.setUser(identity);
      if(current!==generation.current||auth.currentUser?.uid!==identity.uid)throw new Error('Your account changed during sign-in. Please try again.');
      // Do not fetch an inactive homepage here; its next mount performs one read.
      await queryClient.invalidateQueries({queryKey:['publicProperties'],refetchType:'none'});
      if(current!==generation.current||auth.currentUser?.uid!==identity.uid)throw new Error('Your account changed during sign-in. Please try again.');
      publishedUID.current=identity.uid;setProfile(confirmedProfile);setUser(identity);setProfileStatus('complete');setLoading(false);
    }catch(error){if(current===generation.current){setUser(null);setProfile(null);setProfileStatus('unavailable');setProfileError('Unable to initialize your session. Please sign in again.');setLoading(false);}throw error;}
    finally{if(completingUID.current===identity.uid)completingUID.current=null;}
  },[queryClient]);

  useEffect(()=>privateFileSession.subscribe(setFileAccess),[]);
  useEffect(()=>subscribeDataRefresh(event=>{const keys=[...new Set(event.domains.flatMap(domain=>queryKeysByDomain[domain]))];void Promise.all(keys.map(key=>queryClient.invalidateQueries({queryKey:[key]})));}),[queryClient]);
  useEffect(()=>{const refresh=()=>setProfileRevision(value=>value+1);window.addEventListener('propbank:profile-completed',refresh);return()=>window.removeEventListener('propbank:profile-completed',refresh);},[]);
  useEffect(()=>{
    // Do not hold the Firebase observer open while acquiring tokens or cookies.
    const unsubscribe=onIdTokenChanged(auth,identity=>{
      const firebaseUser=identity?.emailVerified===true?identity:null;
      if(firebaseUser&&completingUID.current===firebaseUser.uid)return;
      const current=++generation.current;
      const identityChanged=previousUID.current!==firebaseUser?.uid;
      if(identityChanged)queryClient.clear();
      previousUID.current=firebaseUser?.uid;
      if(!firebaseUser){void privateFileSession.setUser(null);publishedUID.current=undefined;setUser(null);setProfile(null);setProfileError('');setProfileStatus(identity?'incomplete':'anonymous');setLoading(false);return;}
      if(publishedUID.current!==firebaseUser.uid)setLoading(true);
      setProfileStatus('checking');setProfileError('');setUser(null);setProfile(null);if(identityChanged)void privateFileSession.setUser(null);
      void loadAuthProfile(firebaseUser.uid).then(async ({response,data})=>{
        if(current!==generation.current||auth.currentUser?.uid!==firebaseUser.uid)return;
        if(!response.ok){publishedUID.current=undefined;setUser(null);if(response.status>=500){setProfileError(data.message||'Unable to load your account right now. Please try again.');setProfileStatus('unavailable');}else setProfileStatus('incomplete');setLoading(false);return;}
        if(data.profileComplete!==true){publishedUID.current=undefined;setProfileStatus('incomplete');setLoading(false);return;}
        await privateFileSession.setUser(firebaseUser);
        if(current!==generation.current||auth.currentUser?.uid!==firebaseUser.uid)return;
        publishedUID.current=firebaseUser.uid;setProfile(data.user?.uid===firebaseUser.uid?data.user:null);setUser(firebaseUser);setProfileStatus('complete');setLoading(false);
        void apiFetch('/api/relationship-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'discover'})}).catch(()=>{});
      }).catch(()=>{if(current===generation.current){publishedUID.current=undefined;setUser(null);setProfile(null);setProfileError('Unable to load your account right now. Please try again.');setProfileStatus('unavailable');setLoading(false);}});
    });
    const renew=()=>{void privateFileSession.renew();};
    const interval=window.setInterval(renew,10*60*1000);
    window.addEventListener('online',renew);window.addEventListener('focus',renew);
    return ()=>{generation.current++;unsubscribe();window.clearInterval(interval);window.removeEventListener('online',renew);window.removeEventListener('focus',renew);};
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

  return <AuthContext.Provider value={{user,profile,loading,profileStatus,profileError,fileAccess,retryFileAccess,refreshProfile,completeLogin}}>{children}</AuthContext.Provider>;
};
