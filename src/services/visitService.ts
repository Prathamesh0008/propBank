import { apiFetch } from '@/lib/api-client';
import { auth } from '../firebase';

import { API_BASE_URL } from '../utils/config';

interface Visit {
  id: string;
  userId: string;
  title: string;
  description: string;
  propertyId?: string;
  visitDate: string;
  reminderType: 'email';
  reminderTime: number;
  status: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  notifiedAt?: string;
}

interface CreateVisitRequest {
  title: string;
  description?: string;
  propertyId?: string;
  visitDate: string; // ISO 8601 format
  reminderType: 'email';
  reminderTime: number;
}

interface UpdateVisitRequest {
  title?: string;
  description?: string;
  visitDate?: string;
  reminderType?: string;
  reminderTime?: number;
  status?: string;
  isCompleted?: boolean;
}

interface VisitResponse {
  success: boolean;
  message: string;
  visit?: Visit;
  visits?: Visit[];
}

class VisitService {
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (user) {
      headers['X-User-ID'] = user.uid;
    }
    
    return headers;
  }

  async createVisit(visitData: CreateVisitRequest): Promise<Visit> {
    const headers = await this.getAuthHeaders();
    
    const response = await apiFetch(`${API_BASE_URL}/visits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(visitData),
    });

    const data: VisitResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to create visit');
    }

    return data.visit!;
  }

  async getVisitsByUser(userId?: string, status?: 'active' | 'completed'): Promise<Visit[]> {
    const headers = await this.getAuthHeaders();
    const user = auth.currentUser;
    const targetUserId = userId || user?.uid;

    if (!targetUserId) {
      throw new Error('User ID is required');
    }

    let url = `${API_BASE_URL}/visits?userId=${targetUserId}`;
    if (status) {
      url += `&status=${status}`;
    }

    const response = await apiFetch(url, {
      method: 'GET',
      headers,
    });

    const data: VisitResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch visits');
    }

    return data.visits || [];
  }

  async getVisitById(visitId: string): Promise<Visit> {
    const headers = await this.getAuthHeaders();
    
    const response = await apiFetch(`${API_BASE_URL}/visits/${visitId}`, {
      method: 'GET',
      headers,
    });

    const data: VisitResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch visit');
    }

    return data.visit!;
  }

  async updateVisit(visitId: string, updateData: UpdateVisitRequest): Promise<Visit> {
    const headers = await this.getAuthHeaders();
    
    const response = await apiFetch(`${API_BASE_URL}/visits/${visitId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData),
    });

    const data: VisitResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to update visit');
    }

    return data.visit!;
  }

  async deleteVisit(visitId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    const response = await apiFetch(`${API_BASE_URL}/visits/${visitId}`, {
      method: 'DELETE',
      headers,
    });

    const data: VisitResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete visit');
    }
  }

  async toggleVisitCompletion(visitId: string, isCompleted: boolean): Promise<Visit> {
    return this.updateVisit(visitId, { isCompleted });
  }
}

export const visitService = new VisitService();
export type { Visit, CreateVisitRequest, UpdateVisitRequest };
