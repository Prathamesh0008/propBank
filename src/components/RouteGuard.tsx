"use client";

import { apiFetch } from '@/lib/api-client';

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/utils/config";
import { useToast } from "@/hooks/use-toast";

export default function RouteGuard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [verifiedUid, setVerifiedUid] = useState<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!user) {
      setVerifiedUid(null);
      const pendingEntry = window.location.pathname === '/manage-property' && window.location.hash === '#pending-connections';
      router.replace(pendingEntry ? '/auth?next=%2Fmanage-property%23pending-connections' : '/auth');
      return;
    }
    if (!admin) return;
    const controller = new AbortController();
    setVerifiedUid(null);
    void apiFetch(`${API_BASE_URL}/users/${user.uid}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Access denied");
        const data = await response.json();
        if (data.user?.role !== "admin") throw new Error("Access denied");
        setVerifiedUid(user.uid);
      }).catch(() => {
        if (controller.signal.aborted) return;
        toast({ title: "Access Denied", description: "You do not have administrative privileges.", variant: "destructive" });
        router.replace("/");
      });
    return () => controller.abort();
  }, [user, loading, admin, router, toast]);
  if (loading || !user || (admin && verifiedUid !== user.uid)) return (
    <div className="flex items-center justify-center min-h-screen"><div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
      <p>{admin ? "Verifying admin access..." : "Loading..."}</p>
    </div></div>
  );
  return children;
}
