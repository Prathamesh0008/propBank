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
  reminderType: 'email' | 'none';
  reminderTime: number;
  status: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  managementVersion?: number;
  notifiedAt?: string;
}

interface CreateVisitRequest {
  title: string;
  description?: string;
  propertyId?: string;
  visitDate: string; // ISO 8601 format
  reminderType: 'email' | 'none';
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
  expectedVersion?: number;
}

interface VisitResponse {
  success: boolean;
  message: string;
  visit?: Visit;
  visits?: Visit[];
}

class VisitService {
  private getHeaders(): Record<string, string> {
    return {'Content-Type': 'application/json'};
  }

  private async read(response:Response):Promise<VisitResponse> {
    const type=response.headers.get('content-type')||'';
    const data=type.includes('application/json')?await response.json() as VisitResponse:null;
    if(!response.ok||!data?.success)throw new Error(data?.message||`Visit request failed (${response.status})`);
    return data;
  }

  async createVisit(visitData: CreateVisitRequest): Promise<Visit> {
    const response = await apiFetch(`${API_BASE_URL}/visits`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(visitData),
    });

    const data=await this.read(response);

    return data.visit!;
  }

  async getVisitsByUser(userId?: string, status?: 'active' | 'completed' | 'cancelled',signal?:AbortSignal): Promise<Visit[]> {
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
      headers: this.getHeaders(),signal,
    });
    const data=await this.read(response);

    return data.visits || [];
  }

  async getVisitById(visitId: string): Promise<Visit> {
    const response = await apiFetch(`${API_BASE_URL}/visits/${visitId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    const data=await this.read(response);

    return data.visit!;
  }

  async updateVisit(visitId: string, updateData: UpdateVisitRequest): Promise<Visit> {
    const response = await apiFetch(`${API_BASE_URL}/visits/${visitId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updateData),
    });

    const data=await this.read(response);

    return data.visit!;
  }

  async deleteVisit(visitId: string): Promise<void> {
    const response = await apiFetch(`${API_BASE_URL}/visits/${visitId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    await this.read(response);
  }

  async toggleVisitCompletion(visitId: string, isCompleted: boolean): Promise<Visit> {
    return this.updateVisit(visitId, { isCompleted });
  }
}

export const visitService = new VisitService();
export type { Visit, CreateVisitRequest, UpdateVisitRequest };
