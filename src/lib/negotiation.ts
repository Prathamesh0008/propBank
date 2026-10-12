export type NegotiationStatus = 'offered' | 'proposed' | 'countered' | 'owner_approved' | 'accepted' | 'rejected' | 'withdrawn' | 'completed';
export type NegotiationAction = 'propose' | 'accept' | 'reject' | 'counter' | 'customer_accept' | 'withdraw' | 'complete' | 'assign_broker';
export interface NegotiationEvent {
  action: string;
  actorUID: string;
  amount: number | null;
  at: string;
}
export interface Negotiation {
  id: string;
  propertyId: string;
  propertyTitle: string;
  ownerUID: string;
  customerUID: string;
  brokerUID: string;
  originalAskingPrice: number;
  customerOffer: number;
  brokerProposedAmount: number | null;
  ownerCounterAmount: number | null;
  ownerApprovedAmount: number | null;
  finalAgreedAmount: number | null;
  status: NegotiationStatus;
  version: number;
  history: NegotiationEvent[];
  createdAt: string;
  updatedAt: string;
}
