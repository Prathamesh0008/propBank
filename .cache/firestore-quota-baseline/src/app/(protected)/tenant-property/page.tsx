import {redirect} from 'next/navigation';
import {propertyCategory} from '@/lib/property-category';

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const params=await searchParams, category=propertyCategory(params.type);
  redirect(category?`/add-property?${new URLSearchParams({as:'tenant',type:category})}`:'/select-property-type?as=tenant');
}
