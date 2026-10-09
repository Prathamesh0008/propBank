import { apiFetch } from '@/lib/api-client';
export interface Service {
  id: string;
  name: string;
  description: string;
  category: 'legal' | 'other';
  code: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRequest {
  id: string;
  userUID: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  serviceId: string;
  serviceName: string;
  propertyId?: string;
  message: string;
  image?: string; // Image URL for service request
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceResponse {
  success: boolean;
  message: string;
  data?: Service[];
  service?: Service;
}

export interface ServiceRequestResponse {
  success: boolean;
  message: string;
  data?: ServiceRequest[];
  serviceRequest?: ServiceRequest;
}

import { API_BASE_URL } from '../utils/config';

export const serviceApi = {
  // Get all services
  async getServices(): Promise<Service[]> {
    const response = await apiFetch(`${API_BASE_URL}/services`);
    const data: ServiceResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    return data.data || [];
  },

  // Create a service request
  async createServiceRequest(request: {
    userUID: string;
    serviceId: string;
    propertyId?: string;
    message: string;
    image?: string; // Base64 image string
  }): Promise<ServiceRequest> {
    const response = await apiFetch(`${API_BASE_URL}/service-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    const data: ServiceRequestResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    return data.serviceRequest!;
  },

  // Get service requests for a user
  async getServiceRequests(userUID: string): Promise<ServiceRequest[]> {
    const response = await apiFetch(`${API_BASE_URL}/service-requests?userUID=${userUID}`);
    const data: ServiceRequestResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    return data.data || [];
  },

  // Get all service requests (admin only)
  async getAllServiceRequests(): Promise<ServiceRequest[]> {
    const response = await apiFetch(`${API_BASE_URL}/service-requests?admin=true`);
    const data: ServiceRequestResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
    
    return data.data || [];
  },

  // Update service request status (admin only)
  async updateServiceRequestStatus(
    requestId: string, 
    status: ServiceRequest['status'], 
    adminNotes?: string
  ): Promise<void> {
    const response = await apiFetch(`${API_BASE_URL}/service-requests/${requestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, adminNotes }),
    });
    
    const data: ServiceRequestResponse = await response.json();
    
    if (!data.success) {
      throw new Error(data.message);
    }
  },
};
