"use client";

import { apiFetch } from '@/lib/api-client';

import { useEffect, useState, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/utils/config";
import { useToast } from "@/hooks/use-toast";

export default function RouteGuard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, profileStatus, profileError, fileAccess, refreshProfile, signOut } = useAuth();
  const uid=user?.uid;
  const router = useRouter();
  const { toast } = useToast();
  const redirecting=useRef('');
  const [adminError,setAdminError]=useState(''),[adminAttempt,setAdminAttempt]=useState(0);
  const [verifiedUid, setVerifiedUid] = useState<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (profileStatus === 'unavailable'||profileStatus==='checking'||profileStatus==='incomplete'||profileStatus==='unverified') return;
    if (!user) {
      setVerifiedUid(null);
      const intended=`${window.location.pathname}${window.location.search}${window.location.hash}`;
      const target=`/auth?next=${encodeURIComponent(intended)}`;
      if(redirecting.current!==target){redirecting.current=target;router.replace(target);}
      return;
    }
    redirecting.current='';
    if (!admin) return;
    const controller = new AbortController();
    setVerifiedUid(null);setAdminError('');
    void apiFetch(`${API_BASE_URL}/users/${user.uid}?summary=true`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error([401,403].includes(response.status)?"Access denied":"Unable to verify administrative access. Please retry.");
        const data = await response.json();
        if (data.user?.role !== "admin") throw new Error("Access denied");
        if(!controller.signal.aborted)setVerifiedUid(user.uid);
      }).catch(error => {
        if (controller.signal.aborted) return;
        if(!(error instanceof Error)||error.message!=="Access denied"){setAdminError("Unable to verify administrative access. Please retry.");return;}
        toast({ title: "Access Denied", description: "You do not have administrative privileges.", variant: "destructive" });
        router.replace("/");
      });
    return () => controller.abort();
  }, [uid, loading, profileStatus, admin, adminAttempt, router, toast]);
  if (!loading && profileStatus === 'unavailable') return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Unable to load your account</h1>
        <p className="mt-3 text-sm text-muted-foreground">{profileError || 'Unable to load your account right now. Please try again.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="min-h-11 bg-primary px-5 text-primary-foreground" onClick={()=>void refreshProfile()}>Retry</button>
          <button type="button" className="min-h-11 border px-5" onClick={()=>void signOut().catch(()=>{})}>Sign Out / Switch Account</button>
        </div>
      </div>
    </main>
  );
  if(!loading&&user&&admin&&adminError)return <main className="flex min-h-screen items-center justify-center"><div role="alert"><p>{adminError}</p><button type="button" onClick={()=>setAdminAttempt(value=>value+1)}>Retry</button></div></main>;
  if (loading || !user || (admin && verifiedUid !== user.uid)) return (
    <div className="flex items-center justify-center min-h-screen"><div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
      <p>{loading&&['preparing','retrying'].includes(fileAccess?.phase)?fileAccess.message:admin ? "Verifying admin access..." : "Loading..."}</p>
    </div></div>
  );
  return children;
}
