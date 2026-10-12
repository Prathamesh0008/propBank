"use client";
import Feature from '@/features/properties/AddPropertyForm';
import TenantPropertyForm from '@/features/properties/TenantPropertyForm';
import {useSearchParams} from '@/lib/navigation';
export default function Page() {const [params]=useSearchParams();return params.get('as')==='tenant'?<TenantPropertyForm category={params.get('type')||'residential'}/>:<Feature/>;}
