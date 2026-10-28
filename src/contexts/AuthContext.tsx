"use client";
import {useQueryClient} from '@tanstack/react-query';
import {createContext,useContext,useEffect,useState,useRef,useCallback,type ReactNode} from 'react';
import {apiFetch} from '@/lib/api-client';
import {useToast} from '@/hooks/use-toast';
import {ToastAction} from '@/ui/toast';
import {auth} from '@/firebase';
import {onIdTokenChanged,type User} from 'firebase/auth';
import {privateFileSession,claimFileSessionNotice} from '@/lib/private-file-client';
import {INITIAL_FILE_SESSION,type FileSessionState} from '@/lib/private-file-session';

interface AuthContextType {user:User|null;loading:boolean;fileAccess:FileSessionState;retryFileAccess:()=>Promise<void>}
const AuthContext=createContext<AuthContextType>({user:null,loading:true,fileAccess:INITIAL_FILE_SESSION,retryFileAccess:async()=>{}});
export const useAuth=()=>useContext(AuthContext);

export const AuthProvider=({children}:{children:ReactNode})=>{
  const queryClient=useQueryClient(),{toast,dismiss}=useToast();
  const previousUID=useRef<string|undefined>(undefined),publishedUID=useRef<string|undefined>(undefined);
  const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true);
  const [fileAccess,setFileAccess]=useState(privateFileSession.snapshot);
  const notice=useRef<string|undefined>(undefined),readyRevision=useRef(-1);
  const retryFileAccess=useCallback(()=>privateFileSession.retry(),[]);

  useEffect(()=>privateFileSession.subscribe(setFileAccess),[]);
  useEffect(()=>{
    let generation=0;
    // Do not hold the Firebase observer open while acquiring tokens or cookies.
    const unsubscribe=onIdTokenChanged(auth,identity=>{
      const firebaseUser=identity?.emailVerified===true?identity:null,current=++generation;
      if(previousUID.current!==firebaseUser?.uid)queryClient.clear();
      previousUID.current=firebaseUser?.uid;
      const session=privateFileSession.setUser(firebaseUser);
      if(!firebaseUser){publishedUID.current=undefined;setUser(null);setLoading(false);return;}
      if(publishedUID.current!==firebaseUser.uid)setLoading(true);
      void session.then(()=>{
        if(current!==generation||auth.currentUser?.uid!==firebaseUser.uid||!auth.currentUser.emailVerified)return;
        publishedUID.current=firebaseUser.uid;setUser(firebaseUser);setLoading(false);
        void apiFetch('/api/relationship-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'discover'})}).catch(()=>{});
      });
    });
    const renew=()=>{void privateFileSession.renew();};
    const interval=window.setInterval(renew,10*60*1000);
    window.addEventListener('online',renew);window.addEventListener('focus',renew);
    return ()=>{generation++;unsubscribe();window.clearInterval(interval);window.removeEventListener('online',renew);window.removeEventListener('focus',renew);};
  },[queryClient]);

  useEffect(()=>{
    if(fileAccess.phase==='ready'&&fileAccess.revision!==readyRevision.current){
      readyRevision.current=fileAccess.revision;
      void Promise.all(['userProperties','property','productHub','documents'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));
    }
    if(fileAccess.phase!=='failed'){if(notice.current){dismiss(notice.current);notice.current=undefined;}return;}
    if(!user||fileAccess.uid!==user.uid||auth.currentUser?.uid!==user.uid||!claimFileSessionNotice(fileAccess.revision))return;
    notice.current=toast({title:'Secure file access',description:fileAccess.message,variant:'destructive',action:<ToastAction altText="Retry secure file access" onClick={()=>void retryFileAccess()}>Retry</ToastAction>}).id;
  },[fileAccess,user,queryClient,toast,dismiss,retryFileAccess]);

  return <AuthContext.Provider value={{user,loading,fileAccess,retryFileAccess}}>{children}</AuthContext.Provider>;
};
