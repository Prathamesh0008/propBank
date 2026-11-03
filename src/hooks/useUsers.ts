import { apiFetch } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '../utils/config';

export const useAllUsers = (active=true) => {
  return useQuery({
    queryKey: ['allUsers'],
    enabled: active,
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
