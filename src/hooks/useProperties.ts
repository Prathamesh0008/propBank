import {useAuth} from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { User } from 'firebase/auth';
import { API_BASE_URL } from '../utils/config';

export const useUserProperties = (currentUser: User | null) => {
  return useQuery({
    queryKey: ['userProperties', currentUser?.uid],
    queryFn: async () => {
      if (!currentUser) return { owned: [], tenant: [] };

      const ownerUID = currentUser.uid;

      // Fetch owned properties
      const ownedResponse = await apiFetch(`${API_BASE_URL}/properties?ownerUID=${ownerUID}`);
      const ownedData = await ownedResponse.json();

      let owned: any[] = [];
      if (ownedData.success) {
        owned = (ownedData.properties || [])
          .filter((p: any) => {
            const isActive = (p.status === 'active' || (!p.status && p.isActive !== false));
            const isOwnedByUser = p.ownerUID === ownerUID;
            return isActive && isOwnedByUser;
          })
          .map((p: any) => ({ ...p, userRole: 'owner' }));
      }

      if(!ownedResponse.ok)throw new Error(ownedData.message||'Could not load properties');
      const tenantResponse=await apiFetch(API_BASE_URL+'/properties/tenant?tenantUID='+encodeURIComponent(ownerUID));
      const tenantData=await tenantResponse.json();
      if(!tenantResponse.ok)throw new Error(tenantData.message||'Could not load rented properties');
      const tenant=(tenantData.properties||[]).filter((p:any)=>p.ownerUID!==ownerUID&&p.isActive!==false&&p.status!=='inactive').map((p:any)=>({...p,userRole:'tenant'}));

      return { owned, tenant };
    },
    enabled: !!currentUser, // Only run the query if we have a user
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
};

export const useAllProperties = (active=true) => {
  const {user,loading:authLoading}=useAuth();
  return useQuery({
    queryKey: ['allProperties',user?.uid],
    enabled: !!user&&!authLoading&&active,
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE_URL}/properties?admin=true`,{cache:'no-store'});
      const data = await response.json();
      if(!response.ok||!data.success)throw new Error(data.message||'Could not load administrator properties');
      if (data.success) {
        return data.properties || [];
      }
      return [];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: active?5000:false,
  });
};

export const useArchivedProperties = (ownerUID: string | undefined) => {
  return useQuery({
    queryKey: ['archivedProperties', ownerUID],
    queryFn: async () => {
      if (!ownerUID) return [];
      const response = await apiFetch(`${API_BASE_URL}/properties?ownerUID=${ownerUID}`);
      const data = await response.json();
      if (data.success) {
        return (data.properties || []).filter((p: any) => p.status === 'inactive' || p.isActive === false);
      }
      return [];
    },
    enabled: !!ownerUID,
    staleTime: 5 * 60 * 1000,
  });
};

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
