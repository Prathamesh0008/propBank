import { apiFetch } from '@/lib/api-client';
import { API_BASE_URL } from '../utils/config';

interface Property {
  rentSchedule: any;
  id: string;
  title: string;
  description: string;
  price: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  listingType?: string; // 'rent' | 'sell'
  projectCondition?: string; // 'New Project' | 'Ready Project' | 'Preleased'
  internalImages?: string[];
  possessionDate?: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  images: string[];
  rentalStatus?: string; // 'available' | 'rented'
  furnishedChecklist?: any[]; // Array of furnished items
  ownerUID: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ownerRole?: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  unitNumber?: string; // Optional unit number
  floor?: string;
  location?: string;
  configuration?: string; // e.g., "2 BHK"
  unitCondition?: string; // e.g., "Unfurnished"
  carpetArea?: string; // e.g., "1200 sqft"
  constructedArea?: string; // e.g., "1500 sqft"
  plotArea?: string; // added plotArea
  monthlyRent?: string;
  sellingPrice?: string;
  personName?: string;
  tenantName?: string;
  mobileNumber?: string;
  primaryNo?: string;
  ultNo?: string;
  monthlyRent1stYear?: string;
  monthlyRent2ndYear?: string;
  monthlyRent3rdYear?: string;
  monthlyRent4thYear?: string;
  rentFromDate1?: string;
  rentToDate1?: string;
  rentFromDate2?: string;
  rentToDate2?: string;
  paymentDueDate?: string;
  escalationPercentage?: string;
  escalationAmount?: string;
  securityDeposit?: string;
  agreementPeriod?: string;
  agreementStartDate?: string;
  agreementEndDate?: string;
  noticePeriod?: string;
  lockInPeriod?: string;
  maintenanceToBePaidBy?: string;
  specificComments?: string;
  tenants?: any[];
  buyers?: any[];
  wantToSell?: boolean;
  isRented?: boolean;
  isSold?: boolean;

  // Pre-leased Details
  isPreLeased?: boolean;
  preLeasedType?: string;
  agreementTerm?: string;
  lockInPeriodPreLeased?: string;
  rentalIncome?: string;
  escalation?: string;
  tenantDetails?: string;
  purpose?: string;
  specificRequirement?: string;
}

// Site settings from admin
interface SiteSettings {
  quote?: string;
  quoteAuthor?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  announcementText?: string;
  isAnnouncementActive?: boolean;
  bannerImages?: string[];
}

interface PropertiesResponse {
  success: boolean;
  properties: Property[];
  count: number;
  listingType?: string;
  // Site settings fields
  quote?: string;
  quoteAuthor?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  announcementText?: string;
  isAnnouncementActive?: boolean;
  bannerImages?: string[];
}

// Combined response with properties and site settings
interface PropertiesWithSettingsResponse {
  properties: Property[];
  siteSettings: SiteSettings;
}

class PropertyService {
  private async getHeaders(): Promise<Record<string, string>> {
    return {
      'Content-Type': 'application/json',
    };
  }

  async getAllProperties(): Promise<Property[]> {
    const headers = await this.getHeaders();

    const response = await apiFetch(`${API_BASE_URL}/properties`, {
      method: 'GET',
      headers,
    });



    const data: PropertiesResponse = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch properties');
    }

    return data.properties || [];
  }

  // Get properties with site settings (quote, hero text, etc.)
  async getAllPropertiesWithSettings(): Promise<PropertiesWithSettingsResponse> {
    const headers = await this.getHeaders();

    const response = await apiFetch(`${API_BASE_URL}/properties`, {
      method: 'GET',
      headers,
    });



    const data: PropertiesResponse = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch properties');
    }

    return {
      properties: data.properties || [],
      siteSettings: {
        quote: data.quote,
        quoteAuthor: data.quoteAuthor,
        heroTitle: data.heroTitle,
        heroSubtitle: data.heroSubtitle,
        announcementText: data.announcementText,
        isAnnouncementActive: data.isAnnouncementActive,
        bannerImages: data.bannerImages,
      }
    };
  }

  async getPropertiesByListingType(listingType: 'rent' | 'sell'): Promise<Property[]> {
    const headers = await this.getHeaders();

    const response = await apiFetch(`${API_BASE_URL}/properties?listingType=${listingType}`, {
      method: 'GET',
      headers,
    });

    const data: PropertiesResponse = await response.json();

    if (!data.success) {
      throw new Error(`Failed to fetch ${listingType} properties`);
    }

    return data.properties || [];
  }

  async getRentalProperties(): Promise<Property[]> {
    return this.getPropertiesByListingType('rent');
  }

  async getSaleProperties(): Promise<Property[]> {
    return this.getPropertiesByListingType('sell');
  }

  async getPropertyById(propertyId: string): Promise<Property> {
    const headers = await this.getHeaders();

    const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch property details');
    }

    return data.property;
  }

  async getPropertiesByOwner(ownerUID: string): Promise<Property[]> {
    const headers = await this.getHeaders();

    const response = await apiFetch(`${API_BASE_URL}/properties?ownerUID=${ownerUID}`, {
      method: 'GET',
      headers,
    });

    const data: PropertiesResponse = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch owner properties');
    }

    return data.properties || [];
  }

  async searchProperties(query: string, listingType?: 'buy' | 'rent', projectCondition?: string): Promise<Property[]> {
    const headers = await this.getHeaders();

    // Build query parameters
    const searchParams = new URLSearchParams();
    if (query) searchParams.append('q', query);
    if (listingType) {
      // Map frontend types to backend types
      const backendType = listingType === 'buy' ? 'sell' : 'rent';
      searchParams.append('listingType', backendType);
    }
    if (projectCondition && projectCondition !== '') {
      searchParams.append('projectCondition', projectCondition);
    }

    const response = await apiFetch(`${API_BASE_URL}/properties/search?${searchParams.toString()}`, {
      method: 'GET',
      headers,
    });

    const data: PropertiesResponse = await response.json();

    if (!data.success) {
      throw new Error('Failed to search properties');
    }

    return data.properties || [];
  }
}

export const propertyService = new PropertyService();
export type { Property, SiteSettings, PropertiesWithSettingsResponse };
