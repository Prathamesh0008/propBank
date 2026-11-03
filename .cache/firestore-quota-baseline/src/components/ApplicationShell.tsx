"use client";

import {useEffect,useRef,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useAuth} from '@/contexts/AuthContext';
import SiteHeader from '@/features/navbar/SiteHeader';
import PublicMain from '@/features/brand/PublicMain';
import SiteFooter from '@/features/footer/SiteFooter';
import DemoFormAutofill from '@/components/DemoFormAutofill';

const loading=<main className="flex min-h-screen items-center justify-center bg-[#f8f6f0] text-sm text-slate-600" role="status" aria-live="polite">Preparing your account…</main>;

export default function ApplicationShell({children}:{children:ReactNode}){
  const {loading:authLoading,profileStatus}=useAuth(),pathname=usePathname(),router=useRouter(),redirecting=useRef('');
  const checking=authLoading||profileStatus==='checking',completionRequired=profileStatus==='incomplete',authRoute=pathname==='/auth';

  useEffect(()=>{
    if(checking||!completionRequired||authRoute)return;
    const intended=typeof window==='undefined'?pathname:`${window.location.pathname}${window.location.search}${window.location.hash}`;
    const target=`/auth?mode=complete&next=${encodeURIComponent(intended)}`;
    if(redirecting.current===target)return;
    redirecting.current=target;router.replace(target);
  },[checking,completionRequired,authRoute,pathname,router]);
  useEffect(()=>{if(!completionRequired||authRoute)redirecting.current='';},[completionRequired,authRoute]);

  if(checking)return loading;
  if(completionRequired){
    if(!authRoute)return loading;
    return <div className="min-h-screen bg-[#f8f6f0]">{children}</div>;
  }
  return <div className="flex min-h-screen flex-col"><SiteHeader/><PublicMain>{children}</PublicMain><SiteFooter/>{process.env.NODE_ENV==='development'&&<DemoFormAutofill/>}</div>;
}
