"use client";
import {useQueryClient} from '@tanstack/react-query';
import {createContext,useContext,useEffect,useState,useRef,useCallback,type ReactNode} from 'react';
import {apiFetch,loadAuthProfile,invalidateAuthProfile} from '@/lib/api-client';
import {useToast} from '@/hooks/use-toast';
import {ToastAction} from '@/ui/toast';
import {auth,signOutUser} from '@/firebase';
import {onIdTokenChanged,type User} from 'firebase/auth';
import {privateFileSession,claimFileSessionNotice} from '@/lib/private-file-client';
import {INITIAL_FILE_SESSION,type FileSessionState} from '@/lib/private-file-session';
import {queryKeysByDomain,subscribeDataRefresh} from '@/lib/data-refresh';

export type ProfileStatus='checking'|'anonymous'|'unverified'|'incomplete'|'complete'|'unavailable';
export type AuthLifecycle='initializing'|'unauthenticated'|'authenticating'|'email_verification_required'|'profile_completion_required'|'authenticated'|'authentication_error'|'signing_out';
interface AuthContextType {lifecycle:AuthLifecycle;profileRole:string;signOut:()=>Promise<void>;user:User|null;loading:boolean;profileStatus:ProfileStatus;profileError:string;fileAccess:FileSessionState;retryFileAccess:()=>Promise<void>;refreshProfile:()=>Promise<boolean>}
const AuthContext=createContext<AuthContextType>({lifecycle:'initializing',profileRole:'',signOut:async()=>{},user:null,loading:true,profileStatus:'checking',profileError:'',fileAccess:INITIAL_FILE_SESSION,retryFileAccess:async()=>{},refreshProfile:async()=>false});
export const useAuth=()=>useContext(AuthContext);

export const AuthProvider=({children}:{children:ReactNode})=>{
  const queryClient=useQueryClient(),{toast,dismiss}=useToast();
  const previousUID=useRef<string|undefined>(undefined),publishedUID=useRef<string|undefined>(undefined);
  const discoveredIdentity=useRef<string|undefined>(undefined);
  const validateProfile=useRef<(identity:User|null,force?:boolean)=>Promise<boolean>>(async()=>false);
  const signOutRequest=useRef<Promise<void>|null>(null);
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[profileStatus,setProfileStatus]=useState<ProfileStatus>('checking'),[profileError,setProfileError]=useState(''),[profileRole,setProfileRole]=useState(''),[signingOut,setSigningOut]=useState(false);
  const [fileAccess,setFileAccess]=useState(privateFileSession.snapshot);
  const notice=useRef<string|undefined>(undefined),readyRevision=useRef(-1);
  const retryFileAccess=useCallback(()=>privateFileSession.retry(),[]);
  const refreshProfile=useCallback(()=>validateProfile.current(auth.currentUser,true),[]);
  const signOut=useCallback(()=>{if(signOutRequest.current)return signOutRequest.current;setSigningOut(true);const request=signOutUser().catch(error=>{setProfileError('Unable to sign out. Please try again.');setProfileStatus('unavailable');throw error;}).finally(()=>{signOutRequest.current=null;setSigningOut(false);});signOutRequest.current=request;return request;},[]);

  useEffect(()=>privateFileSession.subscribe(setFileAccess),[]);
  useEffect(()=>subscribeDataRefresh(event=>{const keys=[...new Set(event.domains.flatMap(domain=>queryKeysByDomain[domain]))];void Promise.all(keys.map(key=>queryClient.invalidateQueries({queryKey:[key],refetchType:document.visibilityState==='hidden'?'none':'active'},{cancelRefetch:false})));}),[queryClient]);
  useEffect(()=>{const refresh=()=>{void refreshProfile();};window.addEventListener('propbank:profile-completed',refresh);return()=>window.removeEventListener('propbank:profile-completed',refresh);},[refreshProfile]);
  useEffect(()=>{
    let generation=0,active=true;
    let inFlight:{key:string;forced:boolean;promise:Promise<boolean>}|undefined;
    let lastIdentityKey='';
    const validate=(identity:User|null,force=false):Promise<boolean>=>{
      if(!active||identity?.uid!==auth.currentUser?.uid)return Promise.resolve(false);
      const firebaseUser=identity?.emailVerified===true?identity:null;
      const key=identity?`${identity.uid}:${identity.email||''}:${identity.emailVerified}`:'';
      if(inFlight?.key===key&&(!force||inFlight.forced))return inFlight.promise;
      const current=++generation;
      if(identity&&(force||key!==lastIdentityKey))invalidateAuthProfile(identity.uid);
      lastIdentityKey=key;
      const identityChanged=previousUID.current!==identity?.uid;
      if(identityChanged){queryClient.clear();discoveredIdentity.current=undefined;publishedUID.current=undefined;}
      previousUID.current=identity?.uid;
      if(!firebaseUser){void privateFileSession.setUser(null);publishedUID.current=undefined;setUser(null);setProfileRole('');setProfileError('');setProfileStatus(identity?'unverified':'anonymous');setLoading(false);inFlight=undefined;return Promise.resolve(false);}
      if(publishedUID.current!==firebaseUser.uid){setLoading(true);setProfileStatus('checking');setUser(null);setProfileRole('');}
      setProfileError('');if(identityChanged)void privateFileSession.setUser(null);
      const valid=()=>active&&current===generation&&auth.currentUser?.uid===firebaseUser.uid&&auth.currentUser?.emailVerified===true&&`${auth.currentUser.uid}:${auth.currentUser.email||''}:${auth.currentUser.emailVerified}`===key;
      const promise=loadAuthProfile(firebaseUser.uid).then(async({response,data})=>{
        if(!valid())return false;
        if(!response.ok){
          // Only a successful authoritative profile response can request onboarding.
          // Temporary failures keep the known identity, but protected views stay gated.
          if(response.status<500){publishedUID.current=undefined;setUser(null);setProfileRole('');void privateFileSession.setUser(null);}
          setProfileError(data.message||'Unable to load your account right now. Please try again.');setProfileStatus('unavailable');setLoading(false);return false;
        }
        if(typeof data.profileComplete!=='boolean')throw new Error('Invalid account profile response');
        if(data.profileComplete!==true){publishedUID.current=undefined;setUser(null);setProfileRole('');void privateFileSession.setUser(null);setProfileStatus('incomplete');setLoading(false);return false;}
        // File readiness is independent of validated account readiness.
        void privateFileSession.setUser(firebaseUser);
        if(!valid())return false;
        publishedUID.current=firebaseUser.uid;setUser(firebaseUser);setProfileRole(data.role||'');setProfileStatus('complete');setLoading(false);
        const discoveryKey=`${firebaseUser.uid}:${firebaseUser.email}`;
        if(discoveredIdentity.current!==discoveryKey){discoveredIdentity.current=discoveryKey;void apiFetch('/api/relationship-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'discover'})}).catch(()=>{if(discoveredIdentity.current===discoveryKey)discoveredIdentity.current=undefined;});}
        return true;
      }).catch(()=>{if(valid()){setProfileError('Unable to load your account right now. Please try again.');setProfileStatus('unavailable');setLoading(false);}return false;}).finally(()=>{if(current===generation)inFlight=undefined;});
      inFlight={key,forced:force,promise};return promise;
    };
    validateProfile.current=validate;
    // Keep one observer mounted; explicit refresh returns its validation promise.
    const unsubscribe=onIdTokenChanged(auth,identity=>{void validate(identity);},()=>{generation++;inFlight=undefined;setProfileError('Unable to initialize your account. Please try again.');setProfileStatus('unavailable');setLoading(false);void privateFileSession.setUser(null);});
    const renew=()=>{void privateFileSession.renew();};
    const interval=window.setInterval(renew,10*60*1000);
    window.addEventListener('online',renew);window.addEventListener('focus',renew);
    return ()=>{active=false;generation++;inFlight=undefined;unsubscribe();window.clearInterval(interval);window.removeEventListener('online',renew);window.removeEventListener('focus',renew);};
  },[queryClient]);

  useEffect(()=>{
    if(fileAccess.phase==='ready'&&fileAccess.revision!==readyRevision.current){
      readyRevision.current=fileAccess.revision;
      void Promise.all(['userProperties','property','productHub','documents'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));
    }
    // Optional background setup must not announce platform denial as file authorization.
    // The document viewer retains the failed state and offers contextual manual retry.
    if(fileAccess.phase!=='failed'||fileAccess.failure==='platform_blocked'){if(notice.current){dismiss(notice.current);notice.current=undefined;}return;}
    if(!user||fileAccess.uid!==user.uid||auth.currentUser?.uid!==user.uid||!claimFileSessionNotice(fileAccess.revision))return;
    notice.current=toast({title:'Secure file access',description:fileAccess.message,variant:'destructive',action:<ToastAction altText="Retry secure file access" onClick={()=>void retryFileAccess()}>Retry</ToastAction>}).id;
  },[fileAccess,user,queryClient,toast,dismiss,retryFileAccess]);

  const lifecycle:AuthLifecycle=signingOut?'signing_out':loading?(previousUID.current?'authenticating':'initializing'):profileStatus==='anonymous'?'unauthenticated':profileStatus==='unverified'?'email_verification_required':profileStatus==='incomplete'?'profile_completion_required':profileStatus==='complete'?'authenticated':'authentication_error';
  return <AuthContext.Provider value={{lifecycle,profileRole,signOut,user,loading,profileStatus,profileError,fileAccess,retryFileAccess,refreshProfile}}>{children}</AuthContext.Provider>;
};
