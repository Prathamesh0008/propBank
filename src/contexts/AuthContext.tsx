"use client";
import {useQueryClient} from '@tanstack/react-query';


import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { auth } from "@/firebase";
import { User, onAuthStateChanged } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient=useQueryClient();
  const previousUID=useRef(auth.currentUser?.uid);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if(previousUID.current!==firebaseUser?.uid)queryClient.clear();
      previousUID.current=firebaseUser?.uid;
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [queryClient]);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};
