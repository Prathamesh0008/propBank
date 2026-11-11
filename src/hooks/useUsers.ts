import {apiFetch} from '@/lib/api-client';
import {useInfiniteQuery} from '@tanstack/react-query';
import {API_BASE_URL} from '../utils/config';
import {useAuth} from '@/contexts/AuthContext';
export const useAllUsers=(active=true,role='')=>{const {user,loading}=useAuth();const query=useInfiniteQuery({queryKey:['allUsers',user?.uid,role,'paged-v1'],enabled:active&&!!user&&!loading,initialPageParam:'',queryFn:async({pageParam,signal})=>{const response=await apiFetch(`${API_BASE_URL}/users?role=${encodeURIComponent(role)}&cursor=${encodeURIComponent(pageParam)}`,{signal}),data=await response.json();if(!response.ok)throw Error(data.message||'Failed to fetch users');return data;},getNextPageParam:last=>last.nextCursor||undefined,staleTime:300000,refetchOnWindowFocus:false,retry:false});return {...query,data:query.data?[...new Map<string,any>(query.data.pages.flatMap(p=>p.data||[]).map((u:any)=>[u.uid,u])).values()]:undefined};};
