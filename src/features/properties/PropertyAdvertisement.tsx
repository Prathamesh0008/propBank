"use client";
import {useEffect,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {advertisementDestination,type PropertyAdvertisementContent} from './property-advertisement';
import styles from './PropertyAdvertisement.module.css';
function displayable(value:PropertyAdvertisementContent){
  try{return /^[a-f0-9-]{36}$/i.test(value.id)&&value.imageUrl.startsWith(`/api/advertisements/${value.id}/image?`)
    &&Number.isInteger(value.width)&&value.width>0&&Number.isInteger(value.height)&&value.height>0
    &&advertisementDestination(value.destinationUrl)===value.destinationUrl;}catch{return false;}
}
export default function PropertyAdvertisement(){
 const query=useQuery({queryKey:['publicAdvertisements'],queryFn:async({signal})=>{
  const response=await fetch('/api/advertisements',{signal,cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Advertisements unavailable');
  const body=await response.json();return (Array.isArray(body.items)?body.items:[]).filter(displayable) as PropertyAdvertisementContent[];
 },staleTime:30000,refetchInterval:60000,refetchOnWindowFocus:true,retry:false});
 const [index,setIndex]=useState(0),[motion,setMotion]=useState(false),[visible,setVisible]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
 const [ready,setReady]=useState<Set<string>>(()=>new Set());
 const [failed,setFailed]=useState<Set<string>>(()=>new Set());
 useEffect(()=>setFailed(new Set()),[query.dataUpdatedAt]);
 const slides=(query.data||[]).filter(ad=>!failed.has(ad.id)),active=slides.length?index%slides.length:0;
 useEffect(()=>{const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const updateMotion=()=>setMotion(!preference.matches),updateVisibility=()=>setVisible(!document.hidden);
  updateMotion();updateVisibility();preference.addEventListener('change',updateMotion);document.addEventListener('visibilitychange',updateVisibility);
  return()=>{preference.removeEventListener('change',updateMotion);document.removeEventListener('visibilitychange',updateVisibility);};
 },[]);
 const slideCount=slides.length,nextImage=slides[(active+1)%slideCount]?.imageUrl;
 useEffect(()=>{if(slideCount<2||!motion||!visible||hovered||focused||!ready.has(nextImage))return;
  const timer=setInterval(()=>setIndex(value=>(value+1)%slideCount),3000);return()=>clearInterval(timer);
 },[slideCount,nextImage,active,motion,visible,hovered,focused,ready]);
 if(query.isError||!slides.length)return null;
 return <section className={styles.card} aria-label="Advertisement" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
  onFocusCapture={()=>setFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}}>
  <div className={styles.slides}>{slides.map((ad,position)=>{
   const image=<img src={ad.imageUrl} alt="Advertisement" width={ad.width} height={ad.height} loading="eager" decoding="async" className={styles.image}
    onLoad={()=>setReady(previous=>new Set([...previous,ad.imageUrl]))} onError={()=>setFailed(previous=>new Set([...previous,ad.id]))}/>;
   return <div key={ad.id} className={styles.slide} data-active={position===active} aria-hidden={position!==active} inert={position!==active}>
    {ad.destinationUrl?<a href={ad.destinationUrl} target="_blank" rel="noopener noreferrer sponsored" className={styles.link}>{image}</a>:image}
   </div>;
  })}</div>
  <span className={styles.badge}>Ad</span>
 </section>;
}
