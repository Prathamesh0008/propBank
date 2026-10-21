import {publicListing} from '../listing-policy';
// Pure response projection: never return confidential legacy object URLs.
export const fileFields:Record<string,string[]>={
  properties:['images','internalImages'],documents:['fileUrl'],
  inspection_reports:['possessionLetterFile','handoverLetterFile','electricityBillMeterImage','electricityBillReceipt','apartmentConditionImage','apartmentConditionImages','mglBillMeterImage','mglBillReceipt','internetImage','internetReceipt'],
  service_requests:['image','adminImage'],admin_notifications:['serviceImage','adminImage'],siteSettings:['bannerImages'],
};
export function mediaId(url:unknown):string|null {
  return typeof url==='string'?/^\/api\/media\/([a-f0-9-]{36})(?:#file\.pdf)?$/.exec(url)?.[1]||null:null;
}
export function legacyFileUrl(collection:string,id:string,field:string,index?:number) {
  return `/api/media/legacy?resource=${encodeURIComponent(collection)}&id=${encodeURIComponent(id)}&field=${encodeURIComponent(field)}${index===undefined?'':`&index=${index}`}`;
}
function kind(v:Record<string,unknown>):string {
  if('fileUrl' in v&&'propertyId' in v)return 'documents';
  if('reportType' in v&&'propertyId' in v)return 'inspection_reports';
  if('serviceName' in v&&'userUID' in v)return 'service_requests';
  if('type' in v&&('isRead' in v||'priority' in v))return 'admin_notifications';
  if('ownerUID' in v&&('listingType' in v||'internalImages' in v))return 'properties';
  return '';
}
export function projectFiles(input:unknown):unknown {
  if(Array.isArray(input))return input.map(projectFiles);
  if(!input||typeof input!=='object'||input instanceof Date)return input;
  const raw=input as Record<string,unknown>,output=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,projectFiles(v)]));
  const collection=kind(raw),id=String(raw.id||'');
  if(!collection||!id)return output;
  if(collection==='documents'&&!raw.contentType){const source=String(raw.fileUrl||'');output.contentType=source.startsWith('data:')?source.slice(5,source.indexOf(';')):/\.pdf(?:[?#]|$)/i.test(source)?'application/pdf':/\.png(?:[?#]|$)/i.test(source)?'image/png':/\.jpe?g(?:[?#]|$)/i.test(source)?'image/jpeg':'';}
  for(const field of fileFields[collection]||[]) {
    const wrap=(url:unknown,index?:number)=>{
      if(typeof url!=='string'||!url||url.startsWith('/api/media/'))return url;
      // Public listing cover photography is already public, and stays public.
      const published=collection==='properties'&&field==='images'&&index===0&&publicListing(raw);
      if(published)return url;
      const hint=url.startsWith('data:application/pdf')||/\.pdf(?:[?#]|$)/i.test(url)?'#file.pdf':'';
      return legacyFileUrl(collection,id,field,index)+hint;
    };
    if(Array.isArray(raw[field]))output[field]=(raw[field] as unknown[]).map((url,index)=>wrap(url,index));
    else if(field in raw)output[field]=wrap(raw[field]);
  }
  return output;
}
export function restoreFileReferences(collection:string,id:string,data:Record<string,unknown>,before:Record<string,unknown>) {
  for(const field of fileFields[collection]||[])if(field in data) {
    const restore=(value:unknown,index?:number)=>{
      if(typeof value==='string') {
        const reference=value.split('#')[0];
        if(index===undefined&&reference===legacyFileUrl(collection,id,field))return before[field];
        if(Array.isArray(before[field])){const prior=before[field] as unknown[];const oldIndex=prior.findIndex((_,i)=>reference===legacyFileUrl(collection,id,field,i));if(oldIndex>=0)return prior[oldIndex];}
      }
      return value;
    };
    data[field]=Array.isArray(data[field])?(data[field] as unknown[]).map((v,i)=>restore(v,i)):restore(data[field]);
  }
  return data;
}
