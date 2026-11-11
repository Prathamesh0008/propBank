import { apiFetch } from '@/lib/api-client';
import { API_BASE_URL } from '../utils/config';

interface Property {
  preLeased?: any;managementServices?:string[];managementDescription?:string;investment?:{monthlyRentalIncome:number;annualRentalIncome:number;grossYield:number;leaseEndDate:string;leaseReviewRequired:boolean;verificationStatus:string};
  moderationStatus?: string;
  moderationRevision?: number;
  moderationReason?: string;
  moderationHistory?: Array<{action:string;actorUID:string;at:string;reason?:string}>;
  createdAs?:'owner'|'tenant';
  submittedByUID?:string;
  ownershipVerification?:string;
  ownershipVerificationVersion?:number;
  ownershipVerificationReason?:string;
  ownershipVerificationHistory?:Array<{action:string;actorUID:string;at:string;reason:string}>;
  reportedOwner?:Record<string,string>;
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
  propertyCategory?:string;
  structure?:string;
  buildingName?:string;
  listingType?: string; // 'rent' | 'sell' | 'sell_rent' | 'manage'
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
  areaUnit?:string;
  carpetAreaUnit?:string;
  constructedAreaUnit?:string;
  plotAreaUnit?:string;
  expectedRent?:string;
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
  nextAgreementDraft?:{durationMonths?:string;startDate:string;endDate:string;monthlyRent:string;securityDeposit:string;noticePeriod:string;lockInPeriod:string};
  agreementStatus?:string;
  tenancyRevision?:number;
  maintenanceCharges?:string;
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
  nextCursor?:string|null;
  coverageComplete?:boolean;
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
  nextCursor?:string|null;
  coverageComplete?:boolean;
  properties: Property[];
  siteSettings: SiteSettings;
}

class PropertyService {
  private legacyArray(data:PropertiesResponse):Property[]{if(data.nextCursor)throw new Error('More property pages remain. Use the paginated property lookup to continue; this result is not complete.');return data.properties||[];}
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

    return this.legacyArray(data);
  }

  // Get properties with site settings (quote, hero text, etc.)
  async getAllPropertiesWithSettings(cursor=''): Promise<PropertiesWithSettingsResponse> {
    const headers = await this.getHeaders();

    const response = await apiFetch(`${API_BASE_URL}/properties?cursor=${encodeURIComponent(cursor)}`, {
      method: 'GET',
      headers,
    });



    const data: PropertiesResponse = await response.json();

    if (!data.success) {
      throw new Error('Failed to fetch properties');
    }

    return {
      nextCursor:data.nextCursor,coverageComplete:data.coverageComplete,properties: data.properties || [],
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

    return this.legacyArray(data);
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

    return this.legacyArray(data);
  }

  async searchPropertyPage(query: string, listingType?: 'buy' | 'rent', projectCondition?: string,cursor=''): Promise<PropertiesResponse> {
    const headers = await this.getHeaders();

    // Build query parameters
    const searchParams = new URLSearchParams({cursor});
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

    return data;
  }
  async searchProperties(query:string,listingType?:'buy'|'rent',projectCondition?:string):Promise<Property[]>{return this.legacyArray(await this.searchPropertyPage(query,listingType,projectCondition));}

}

export const propertyService = new PropertyService();
export type { Property, SiteSettings, PropertiesWithSettingsResponse };
