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

      // Fetch properties where user is a tenant
      let userEmail = currentUser.email || "";

      if (!userEmail) {
        const match = document.cookie.match(new RegExp('(^| )userEmail=([^;]+)'));
        if (match) {
          userEmail = match[2];
        }
      }

      if (!userEmail) {
        try {
          const userProfileResponse = await apiFetch(`${API_BASE_URL}/users/${currentUser.uid}`);
          if (userProfileResponse.ok) {
            const userProfile = await userProfileResponse.json();
            if (userProfile.email) {
              userEmail = userProfile.email;
            }
          }
        } catch (e) {
          console.error("Failed to fetch user profile for email lookup", e);
        }
      }

      let tenant: any[] = [];
      if (userEmail) {
        const tenantResponse = await apiFetch(`${API_BASE_URL}/properties/tenant/?userEmail=${userEmail}`);
        if (tenantResponse.ok) {
          const tenantData = await tenantResponse.json();
          if (tenantData.success) {
            tenant = (tenantData.properties || [])
              .filter((p: any) => {
                const isActive = (p.status === 'active' || (!p.status && p.isActive !== false));
                const notOwnedByUser = p.ownerUID !== currentUser.uid;
                return isActive && notOwnedByUser;
              })
              .map((p: any) => ({ ...p, userRole: 'tenant' }));
          }
        }
      }

      return { owned, tenant };
    },
    enabled: !!currentUser, // Only run the query if we have a user
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
};

export const useAllProperties = () => {
  return useQuery({
    queryKey: ['allProperties'],
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE_URL}/properties?all=true`);
      const data = await response.json();
      if (data.success) {
        return data.properties || [];
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
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
  return useQuery({
    queryKey: ['property', propertyId],
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
    enabled: !!propertyId,
    staleTime: 5 * 60 * 1000,
  });
};
