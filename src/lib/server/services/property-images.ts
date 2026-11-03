import 'server-only';
import type {AuthenticatedUser} from '../auth';
import {ApiError} from '../http';
import {mediaId} from '../file-projection';
import {prepareFile,cleanupMedia} from './media';

// Legacy base64 property callers now use the same private managed storage as multipart/R2.
// No new object is written to GCS and no makePublic ACL is issued.
export async function uploadPropertyImages(images:string[],propertyID:string,user:AuthenticatedUser,privateImages=false,previous:string[]=[]):Promise<string[]> {
  const urls:string[]=[],staged:string[]=[];let failed=0;
  for(const [index,image]of images.entries()) {
    try {
      if(!image)throw new Error('Empty image');
      if(!privateImages&&/^https?:\/\//.test(image)){urls.push(image);continue;}
      const url=await prepareFile(image,user,propertyID,`image_${index+1}`,previous.includes(image)?image:undefined,!privateImages);urls.push(url);
      if(image.startsWith('data:'))staged.push(url);
    }catch{failed++;}
  }
  if(failed){for(const url of staged){const id=mediaId(url);if(id)try{await cleanupMedia(id,user,true);}catch{/* Reconciliation retains failed cleanup. */}}throw new ApiError(502,`${failed} of ${images.length} images failed. Property changes were not saved; please retry.`);}
  return urls;
}
