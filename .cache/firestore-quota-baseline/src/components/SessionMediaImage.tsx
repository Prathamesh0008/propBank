"use client";
import {forwardRef,type ImgHTMLAttributes} from 'react';
import {useAuth} from '@/contexts/AuthContext';

/** Retry managed image elements after session recovery, without changing the
 * stored URL, object key, fallback behavior or server authorization. */
export default forwardRef<HTMLImageElement,ImgHTMLAttributes<HTMLImageElement>>(function SessionMediaImage(props,ref){
  const {fileAccess}=useAuth();
  const managed=typeof props.src==='string'&&props.src.startsWith('/api/media/');
  return <img {...props} ref={ref} key={managed?`${props.src}:${fileAccess.readyRevision||0}`:undefined}/>;
});
