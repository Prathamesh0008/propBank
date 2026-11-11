import {useAuth} from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { useQuery,useInfiniteQuery } from '@tanstack/react-query';
import { User } from 'firebase/auth';
import { API_BASE_URL } from '../utils/config';

function usePropertyPages(key:unknown[],url:string,enabled:boolean){
 const query=useInfiniteQuery({queryKey:[...key,'paged-v1'],enabled,initialPageParam:'',queryFn:async({pageParam,signal})=>{const response=await apiFetch(`${API_BASE_URL}/${url}${url.includes('?')?'&':'?'}cursor=${encodeURIComponent(pageParam)}`,{signal,cache:'no-store'}),data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'Could not load properties');return data;},getNextPageParam:(last)=>last.nextCursor||undefined,staleTime:60_000,refetchOnWindowFocus:false,retry:false});
 const rows=[...new Map<string,any>((query.data?.pages.flatMap(p=>p.properties||[])||[]).map(p=>[p.id,p])).values()];return {...query,data:query.data?rows:undefined};
}
export const useUserProperties=(currentUser:User|null)=>{const query=usePropertyPages(['userProperties',currentUser?.uid],`properties?ownerUID=${encodeURIComponent(currentUser?.uid||'')}`,!!currentUser),uid=currentUser?.uid,rows=query.data||[];return {...query,data:query.data?{owned:rows.filter(p=>p.ownerUID===uid&&p.isActive!==false&&p.status!=='inactive').map(p=>({...p,userRole:'owner'})),tenant:rows.filter(p=>p.userRole==='tenant'&&p.ownerUID!==uid&&p.isActive!==false&&p.status!=='inactive')}:undefined};};
export const useAllProperties=(active=true)=>{const {user,loading}=useAuth();return usePropertyPages(['allProperties',user?.uid],'properties?admin=true',active&&!!user&&!loading);};
export const useArchivedProperties=(ownerUID:string|undefined)=>{const {user}=useAuth();const query=usePropertyPages(['userProperties',ownerUID],`properties?ownerUID=${encodeURIComponent(ownerUID||'')}`,!!ownerUID&&user?.uid===ownerUID);return {...query,data:query.data?.filter(p=>p.status==='inactive'||p.isActive===false)};};

export const usePropertyDetails = (propertyId: string | undefined) => {
  const {user,loading:authLoading}=useAuth();
  return useQuery({
    queryKey: ['property', propertyId,user?.uid||'public'],
    queryFn: async () => {
      if (!propertyId) return null;
      const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch property details');
      }
      const data = await response.json();
      if (data.success) {
        // Normalize furnished checklist for backward compatibility
        let furnishedChecklist = data.property.furnishedChecklist;
        if (furnishedChecklist && Array.isArray(furnishedChecklist)) {
          furnishedChecklist = furnishedChecklist.map((item: any) => {
            if (typeof item === 'object' && item !== null && item.name) {
              return item;
            }
            if (typeof item === 'string') {
              return {
                id: `legacy-${Date.now()}-${Math.random()}`,
                name: item,
                checked: true,
                quantity: 1,
                category: 'other'
              };
            }
            return item;
          });
        }
        
        return {
          ...data.property,
          furnishedChecklist
        };
      }
      throw new Error(data.message || 'Failed to fetch property details');
    },
    enabled: !!propertyId&&!authLoading,
    staleTime: 5 * 60 * 1000,
  });
};
