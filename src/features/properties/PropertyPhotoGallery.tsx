"use client";
import {useEffect,useState} from 'react';
import {Home,Image as ImageIcon} from 'lucide-react';
import SessionMediaImage from '@/components/SessionMediaImage';
import {useAuth} from '@/contexts/AuthContext';
import styles from './PropertyDetails.module.css';
/** Only URLs already included in the authorized property response are used. */
export default function PropertyPhotoGallery({title,cover,internal=[]}:{title:string;cover?:string;internal?:string[]}){
 const photos=[...new Set([cover,...internal].filter((value):value is string=>typeof value==='string'&&!!value.trim()))];
 const [selected,setSelected]=useState(internal.find(Boolean)||cover||'');
 const current=photos.includes(selected)?selected:photos[0];
 const [failed,setFailed]=useState(false);
 const {fileAccess}=useAuth();
 useEffect(()=>setFailed(false),[current,fileAccess.readyRevision]);
 return <section className={styles.gallery} aria-label="Property gallery">
  <div className={styles.galleryMain}>
   <div className={styles.photoFallback} aria-hidden={!!current&&!failed}><Home aria-hidden="true"/><span>{photos.length?'Photograph unavailable':'No property photographs available'}</span></div>
   {current&&<SessionMediaImage key={current} src={current} alt={`${title} - ${current===cover?'cover photograph':'interior photograph'}`} loading="lazy" className={styles.galleryImage} style={failed?{visibility:'hidden'}:undefined} onLoad={()=>setFailed(false)} onError={()=>setFailed(true)}/>}
  </div>
  {photos.length>1&&<div className={styles.thumbnails} role="group" aria-label="Select a property photograph">{photos.map((src,index)=><button key={src} type="button" aria-label={`Show property photograph ${index+1}`} aria-pressed={current===src} onClick={()=>setSelected(src)}>
   <ImageIcon aria-hidden="true"/>
   <SessionMediaImage src={src} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/>
  </button>)}</div>}
  {current&&<p className={styles.photoCaption} role="status">{failed?'This photograph is currently unavailable.':`${current===cover?'Cover photograph':'Interior photograph'}${photos.length>1?` - ${photos.indexOf(current)+1} of ${photos.length}`:''}`}</p>}
 </section>;
}
