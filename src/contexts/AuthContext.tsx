"use client";
import {useQueryClient} from '@tanstack/react-query';


import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import {apiFetch} from '@/lib/api-client';
import {useToast} from '@/hooks/use-toast';
import { auth } from "@/firebase";
import { User, onIdTokenChanged } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient=useQueryClient();
  const {toast}=useToast();
  const previousUID=useRef(auth.currentUser?.uid);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let generation=0;
    let sessionWork=Promise.resolve();
    const sync=(firebaseUser:User|null)=>{
      sessionWork=sessionWork.catch(()=>{}).then(async()=>{
        const response=firebaseUser?await apiFetch('/api/media/session',{method:'POST',signal:AbortSignal.timeout(15000)}):await fetch('/api/media/session',{method:'DELETE',signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error('Private file session could not be initialized');
      });
      return sessionWork;
    };
    const unsubscribe = onIdTokenChanged(auth, async (firebaseIdentity) => {
      const firebaseUser=firebaseIdentity?.emailVerified===true?firebaseIdentity:null;
      const current=++generation;
      setLoading(true);
      if(previousUID.current!==firebaseUser?.uid)queryClient.clear();
      previousUID.current=firebaseUser?.uid;
      // Guest redirects/logout must not depend on a storage-route network round trip.
      if(!firebaseUser){setUser(null);setLoading(false);void sync(null).catch(()=>{});return;}
      try{await sync(firebaseUser);}catch{if(current===generation)toast({title:'Private files unavailable',description:'File access could not be initialized. Reload when connected to try again.',variant:'destructive'});}
      if(current!==generation)return;
      setUser(firebaseUser);
      setLoading(false);
    });
    const interval=window.setInterval(()=>{if(auth.currentUser)void sync(auth.currentUser).catch(()=>{});},10*60*1000);
    return () => {generation++;window.clearInterval(interval);unsubscribe();};
  }, [queryClient,toast]);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};
