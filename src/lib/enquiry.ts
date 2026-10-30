export const enquiryStatuses = {
  new: 'New', contacted: 'Contacted', visit_scheduled: 'Visit Scheduled',
  negotiating: 'Negotiating', closed_won: 'Closed Won', closed_lost: 'Closed Lost',
} as const;
export type EnquiryStatus = keyof typeof enquiryStatuses;
export interface EnquiryEvent {
  action: 'assigned' | 'reassigned' | 'unassigned' | 'status_updated';
  actorUID: string; at: string; notes: string;
  previousBrokerUID: string; brokerUID: string;
  previousStatus: EnquiryStatus; status: EnquiryStatus;
}
export interface ManagedEnquiry {
  id:string; title:string; message:string; propertyId:string; propertyTitle:string;
  propertyAddress:string; userName:string; userEmail:string; userPhone:string;
  timestamp:string; isRead:boolean; brokerUID:string; brokerName:string;
  emailDeliveryStatus:string; emailDeliveryFailure:string;
  status:EnquiryStatus; version:number; history:EnquiryEvent[];
}
