import Feature from '@/features/properties/AddPropertyForm';
import TenantPropertyForm from '@/features/properties/TenantPropertyForm';
import {redirect} from 'next/navigation';
import {propertyCategory} from '@/lib/property-category';

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams, category=propertyCategory(params.type);
  const mode=params.as==='tenant'?'tenant':'owner';
  if(!category){
    const query=new URLSearchParams({as:mode});
    if(typeof params.adminOwnerUID==='string')query.set('adminOwnerUID',params.adminOwnerUID);
    redirect(`/select-property-type?${query.toString()}`);
  }
  return mode==='tenant'?<TenantPropertyForm key={category} category={category}/>:<Feature key={category} category={category}/>;
}
