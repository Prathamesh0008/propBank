import 'server-only';
import { getFirebaseAdminStorage } from '../firebase-admin';
import { randomUUID } from 'node:crypto';

// Legacy Go property base64 uploads use GCS; ordinary frontend uploads use R2.
export async function uploadPropertyImages(images:string[],propertyID:string):Promise<string[] | null> {
  if (!images.length) return [];
  const urls:string[]=[];
  for (const [index,image] of images.entries()) {
    if (!image) continue;
    if (image.startsWith('http://') || image.startsWith('https://')) { urls.push(image); continue; }
    const parts=image.split(',');
    if (parts.length!==2 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(parts[1].replace(/[\r\n]/g,''))) continue;
    const extension=['png','gif','webp'].find(ext=>parts[0].includes(`image/${ext}`)) || 'jpg';
    const contentType=extension==='jpg'?'image/jpeg':`image/${extension}`;
    const filename=`properties/${propertyID}/image_${index+1}_${randomUUID()}.${extension}`;
    try {
      const bucketName=process.env.FIREBASE_DATA_STORAGE_BUCKET||process.env.STORAGE_BUCKET||process.env.FIREBASE_STORAGE_BUCKET;
      const bucket=getFirebaseAdminStorage().bucket(bucketName);
      const object=bucket.file(filename);
      await object.save(Buffer.from(parts[1],'base64'),{resumable:false,metadata:{contentType,cacheControl:'public, max-age=86400'}});
      try { await object.makePublic(); } catch { /* Go also ignores failed public ACL changes. */ }
      urls.push(`https://storage.googleapis.com/${bucket.name}/${filename}`);
    } catch { /* Go skips individual image failures. */ }
  }
  return urls.length?urls:null;
}
