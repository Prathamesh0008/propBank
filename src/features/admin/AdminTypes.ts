export interface TenantReviewPart {
  ownerUnderstandable?: string;
  softNature?: string;
  ownerTransparent?: string;
  problemSolver?: string;
  easyOnRefundMoney?: string;
  overallExperience?: string;
}

export interface OwnerReviewPart {
  tenantUnderstandable?: string;
  softNature?: string;
  tenantTransparent?: string;
  problemSolver?: string;
  punctualOnPayment?: string;
  overallExperience?: string;
}

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  propertyId: string;
  ownerId: string;
  ownerName: string;
  ownerPhone?: string;
  ownerEmail?: string;
  ownerRole?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  propertyTitle?: string;
  propertyAddress?: string;
  propertyListingType?: string;
  buyers?: string;
  serviceType?: string;
  serviceComment?: string;
  serviceImage?: string;
  inquiryType?: string;
  propertyType?: string;
  requestVisit?: boolean;
  visitDate?: string;
  visitTime?: string;
  reviewerType?: string;
  tenantPart?: TenantReviewPart;
  ownerPart?: OwnerReviewPart;
  timestamp: string;
  isRead: boolean;
  resolvedAt?: string;
  priority: string;
  adminRemarks?: string;
  adminImage?: string;
  archiveHistory?: { action: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
}

export interface SiteSettings {
  quote: string;
  quoteAuthor?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  announcementText?: string;
  isAnnouncementActive?: boolean;
  bannerImages?: string[];
}
