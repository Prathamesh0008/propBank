import { apiFetch } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../utils/config';
import {useAuth} from '@/contexts/AuthContext';

export const useAllUsers = (active=true) => {
  const {user,loading}=useAuth();
  return useQuery({
    queryKey: ['allUsers',user?.uid],
    enabled: active&&!!user&&!loading,
    queryFn: async () => {
      const response = await apiFetch(`${API_BASE_URL}/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
};
