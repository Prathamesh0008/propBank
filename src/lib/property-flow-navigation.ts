"use client";

import {useEffect} from 'react';
import {useLocation,useNavigate} from './navigation';

const historyKey='propbankPropertyFlow';
let pendingStep:{from:string;to:string}|undefined;

export function propertyCategoryUrl(mode:'owner'|'tenant',adminOwnerUID=''):string {
  const params=new URLSearchParams({as:mode});
  if(adminOwnerUID)params.set('adminOwnerUID',adminOwnerUID);
  return `/select-property-type?${params.toString()}`;
}

export function usePropertyFlowNavigation() {
  const navigate=useNavigate(),location=useLocation();
  const current=location.pathname+location.search;

  useEffect(()=>{
    if(pendingStep?.to!==current)return;
    // Keep Next.js history fields intact. This breadcrumb belongs only to the
    // current entry, so browser Back/Forward and refresh retain the same parent.
    window.history.replaceState({...window.history.state,[historyKey]:pendingStep},'',window.location.href);
    pendingStep=undefined;
  },[current]);

  const forward=(to:string)=>{
    pendingStep={from:window.location.pathname+window.location.search,to};
    navigate(to);
  };

  const back=(fallback:string)=>{
    const step=window.history.state?.[historyKey];
    const expected=new URL(fallback,window.location.origin);
    const previous=typeof step?.from==='string'?new URL(step.from,window.location.origin):null;
    const matches=previous?.origin===window.location.origin&&previous.pathname===expected.pathname&&
      [...expected.searchParams].every(([key,value])=>previous.searchParams.get(key)===value);
    if(step?.to===current&&matches&&window.history.length>1)navigate(-1);
    else navigate(fallback,{replace:true});
  };

  return {forward,back};
}
