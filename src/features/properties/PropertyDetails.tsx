"use client";

import styles from "./PropertyDetails.module.css";

import NegotiationPanel from '@/features/negotiations/NegotiationPanel';
import {ServiceRequestHistory} from '@/features/services/ServiceRequestWorkflow';
import ReviewHistory from '@/features/services/ReviewHistory';
import { apiFetch } from '@/lib/api-client';
import SessionMediaImage from '@/components/SessionMediaImage';

import { useParams, useNavigate } from "@/lib/navigation";
import { ArrowLeft, Eye, MapPin, Home, Calendar, CheckCircle, ClipboardList, FileText, Scale, Wrench, RefreshCw, FileX, Image as ImageIcon, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import InspectionReportList from "@/features/services/InspectionReportList";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../utils/config";
import { usePropertyDetails } from "../../hooks/useProperties";

// Raised Request interface for service requests, inspection reports, etc.
interface RaisedRequest {
  ownerEmail: string;
  userRole?: string;
  isSold?: boolean;
  tenantEmail: string;
  id: string;
  type: string;
  title: string;
  message: string;
  propertyId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  serviceType?: string;
  serviceComment?: string;
  serviceImage?: string;
  timestamp: string;
  isRead: boolean;
  resolvedAt?: string; // Timestamp when marked as resolved
  priority?: string;
  adminRemarks?: string;
  adminImage?: string;
  createdAt: string;
  updatedAt: string;
}

interface SpouseInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employmentStatus: string;
  employer: string;
  notes: string;
}

interface TenantInfo {
  noticePeriod: any;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContact: string;
  isMarried: boolean;
  spouse: SpouseInfo | null;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: string;
  securityDeposit: string;
  paymentDueDate: string;
  escalationPercentage: string;
  escalationAmount: string;
  previousAddress: string;
  employmentStatus: string;
  employer: string;
  monthlyIncome: string;
  notes: string;
  isActive: boolean;
  rentSchedule?: Array<{
    months: string;
    year: string;
    amount: string;
    fromDate: string;
    toDate: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface BuyerInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContact: string;
  offerAmount: string;
  financingType: string;
  preApprovalAmount: string;
  closingDate: string;
  currentAddress: string;
  employmentStatus: string;
  employer: string;
  annualIncome: string;
  agentName: string;
  agentPhone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface Property {
  userRole?:string;
  isSold?:boolean;
  id: string;
  title: string;
  propertyType: string;
  configuration: string;
  listingType: string;

  // Unit Details
  unitNumber: string;
  floor: string;
  buildingName: string;
  location: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;

  // Area Details
  carpetArea: string;
  plotArea: string;
  constructedArea: string;
  squareFeet: number;

  // Tenant Information
  personName: string;
  mobileNumber: string;
  primaryNo: string;
  ultNo: string;
  emergencyContact: string;

  // Tenant Employment Details
  employmentStatus: string;
  employer: string;

  // Tenant Spouse Information
  isMarried: boolean;
  spouseFirstName: string;
  spouseLastName: string;
  spouseEmail: string;
  spousePhone: string;
  spouseEmploymentStatus: string;
  spouseEmployer: string;
  spouseNotes: string;

  // Pricing Details
  monthlyRent: string;
  sellingPrice: string;

  // Monthly Rent Details
  monthlyRent1stYear: string;
  monthlyRent2ndYear: string;
  monthlyRent3rdYear: string;
  monthlyRent4thYear: string;
  rentFromDate1: string;
  rentToDate1: string;
  rentFromDate2: string;
  rentToDate2: string;
  rentSchedule?: Array<{
    year: string;
    amount: string;
    fromDate: string;
    toDate: string;
  }>;

  // Payment Details
  paymentDueDate: string;
  escalationPercentage: string;
  escalationAmount: string;

  // Security & Agreement
  securityDeposit: string;
  agreementPeriod: string;
  agreementStartDate: string;
  agreementEndDate: string;
  possessionDate: string;

  // Notice & Lock-in
  noticePeriod: string;
  lockInPeriod: string;

  // Unit Condition & Maintenance
  unitCondition: string;
  maintenanceToBePaidBy: string;
  projectCondition: string;
  rentalStatus: string;
  furnishedChecklist: Array<{
    id: string;
    name: string;
    checked: boolean;
    quantity: number;
    category: string;
  }>;

  // Legacy fields
  description: string;
  price: number;
  bedrooms: number;
  bathrooms: number;

  // Images & Comments
  images: string[];
  internalImages: string[];
  specificComments: string;

  // Tenants
  tenantName?: string;
  tenantEmail?: string;
  tenants: TenantInfo[];

  // Buyers
  buyers: BuyerInfo[];

  // System Info
  ownerUID: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ownerRole?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DetailItemProps {
  label: string;
  value: React.ReactNode;
  isCurrency?: boolean;
  capitalize?: boolean;
  className?: string;
}

const DetailItem = ({ label, value, isCurrency = false, capitalize = false, className = "" }: DetailItemProps) => {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className={className}>
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <p className={`text-sm ${isCurrency ? 'font-semibold' : ''} ${capitalize ? 'capitalize' : ''}`}>
        {isCurrency ? `₹${Number(value).toLocaleString()}` : value}
      </p>
    </div>
  );
};

const PropertyDetails = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: propertyData, isLoading: loading } = usePropertyDetails(propertyId);
  const property = propertyData as Property | null;
  
  const [raisedRequests, setRaisedRequests] = useState<RaisedRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isTerminationDialogOpen, setIsTerminationDialogOpen] = useState(false);
  const [selectedNoticePeriod, setSelectedNoticePeriod] = useState("");
  const [noticeStartDate, setNoticeStartDate] = useState<string>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [submittingTermination, setSubmittingTermination] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (property) {
      const initialNotice = property.noticePeriod && property.noticePeriod !== "Immediate"
        ? property.noticePeriod
        : "1 Month";
      setSelectedNoticePeriod(initialNotice);
    }
  }, [property]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const res = await apiFetch(`${API_BASE_URL}/users/${currentUser.uid}`);
          if (res.ok) {
            const userData = await res.json();
            // Handle both {success: true, user: {...}} and direct {...} formats
            const role = userData.user?.role || userData.role || 'individual';
            setCurrentUserRole(role);
          }
        } catch (e) {
          console.error("Error fetching user role", e);
        }
      } else {
        setCurrentUserRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (propertyId) {
      if(user && ["owner","tenant","admin"].includes(property?.userRole||""))fetchRaisedRequests(propertyId);
      else setRaisedRequests([]);
    }
  }, [propertyId,user,property?.userRole]);

  const fetchRaisedRequests = async (id: string) => {
    setLoadingRequests(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/notifications?propertyId=${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filter for request types: service_request, inspection_report, legal_service_request, 
        // other_service_request, agreement_renewal, agreement_termination
        const requestTypes = [
          'service_request',
          'inspection_report',
          'legal_service_request',
          'other_service_request',
          'agreement_renewal',
          'agreement_termination',
          'document_upload'
        ];
        const filteredRequests = Array.isArray(data)
          ? data.filter((req: RaisedRequest) => requestTypes.includes(req.type))
          : [];
        setRaisedRequests(filteredRequests);
      }
    } catch (error) { /* Preserve existing best-effort behavior. */ } finally {
      setLoadingRequests(false);
    }
  };

  const formatPrice = (property: Property) => {
    if (property.listingType === 'rent') {
      return property.monthlyRent ? `₹${Number(property.monthlyRent).toLocaleString()}/month` : 'Price not set';
    } else if (property.listingType === 'sell') {
      return property.sellingPrice ? `₹${Number(property.sellingPrice).toLocaleString()}` : 'Price not set';
    }
    return 'Price not set';
  };

  const getListingTypeBadge = (listingType: string) => {
    if (listingType === 'rent') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">For Rent</Badge>;
    } else if (listingType === 'sell') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">For Sale</Badge>;
    }
    return <Badge variant="outline">Unknown</Badge>;
  };

  const handleRequestTermination = () => {
    setIsTerminationDialogOpen(true);
  };

  const submitTerminationRequest = async () => {
    setSubmittingTermination(true);
    try {
      const formattedStartDate = new Date(noticeStartDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
      // Calculate anticipated termination date
      let terminationDate = "";
      if (selectedNoticePeriod && !selectedNoticePeriod.toLowerCase().includes("immediate")) {
        const parts = selectedNoticePeriod.split(" ");
        const num = parseInt(parts[0]);
        if (!isNaN(num)) {
          const startDate = new Date(noticeStartDate);
          const calculatedDate = new Date(startDate);
          if (selectedNoticePeriod.toLowerCase().includes("month")) {
            calculatedDate.setMonth(startDate.getMonth() + num);
          } else if (selectedNoticePeriod.toLowerCase().includes("day")) {
            calculatedDate.setDate(startDate.getDate() + num);
          } else {
            calculatedDate.setMonth(startDate.getMonth() + num);
          }
          terminationDate = calculatedDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        }
      }

      const response = await apiFetch(`${API_BASE_URL}/agreements/request-termination`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user?.uid || '',
        },
        body: JSON.stringify({
          propertyId: propertyId,
          noticePeriod: selectedNoticePeriod,
          noticeStartDate: formattedStartDate,
          terminationDate: terminationDate,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Request Sent",
          description: `Termination request with ${selectedNoticePeriod} notice sent to owner.`,
        });
        setIsTerminationDialogOpen(false);
      } else {
        throw new Error(data.message || "Failed to send request");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send termination request",
        variant: "destructive",
      });
      setSubmittingTermination(false);
    }
  };

  // Check if current user is a tenant
  const isTenant = !!user && property?.userRole === "tenant";

  const isOwner = user && property && user.uid === property.ownerUID;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Property not found</p>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="mt-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <>
        <title>{property.title} | PropBank</title>
      </>

      {/* Hero Section */}
      <div className={styles.hero}>
        {property.images && property.images.length > 0 ? (
          <SessionMediaImage
            src={property.images[0]}
            alt={property.title}
            className={styles.heroImage}
          />
        ) : (
          <div className={styles.heroFallback} />
        )}
        <div className={styles.heroOverlay} />

        <div className={styles.heroContent}>
          <div className="max-w-4xl space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1 text-sm font-medium capitalize">
                {property.propertyType}
              </Badge>
              <Badge variant="outline" className="text-white border-white/30 bg-white/10 backdrop-blur-sm px-3 py-1">
                {property.listingType === 'rent' ? 'For Rent' : 'For Sale'}
              </Badge>
              <Badge variant="outline" className={`border-white/30 bg-white/10 backdrop-blur-sm px-3 py-1 ${property.rentalStatus === 'rented' ? 'text-amber-300 border-amber-300/50' : 'text-green-300 border-green-300/50'
                }`}>
                {property.rentalStatus === 'rented' ? 'Rented' : 'Available'}
              </Badge>
            </div>

            <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
              {property.title}
            </h1>

            <div className="flex items-center text-gray-300 text-lg">
              <MapPin className="h-5 w-5 mr-2 text-blue-400" />
              {property.location}
            </div>

            <div className="pt-4 flex flex-wrap gap-4">
              {isTenant && (
                <Button
                  variant="destructive"
                  onClick={handleRequestTermination}
                  className="shadow-lg hover:shadow-xl transition-all"
                >
                  <FileX className="h-4 w-4 mr-2" />
                  Request Termination
                </Button>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="absolute top-4 left-4 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white transition-all backdrop-blur-md"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className={styles.content}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Property Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <span>{property.address || property.location}, {property.city}, {property.state} {property.zipCode}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-muted-foreground" />
                  <span className="capitalize">{property.propertyType} - {property.configuration}</span>
                </div>

                {/* Unit Condition */}
                {
                  property.unitCondition && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-muted-foreground" />
                      <span className="capitalize">{property.unitCondition}</span>
                    </div>
                  )
                }

                {/* Last Modified */}
                {
                  property.updatedAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Last modified: {new Date(property.updatedAt).toLocaleDateString('en-GB')} at {new Date(property.updatedAt).toLocaleTimeString()}</span>
                    </div>
                  )
                }
              </CardContent >
            </Card >

            <Card>
              <CardHeader>
                <CardTitle>Property Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden border bg-gradient-to-br from-gray-100 to-gray-200 relative h-64 flex items-center justify-center">
                  {property.images && property.images.length > 0 && property.images[0] ? (
                    <SessionMediaImage
                      src={property.images[0]}
                      alt={property.title}
                      className="w-full h-full object-cover absolute inset-0"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div className="flex items-center justify-center text-gray-400 flex-col gap-2">
                    <Home className="h-16 w-16" />
                    <span className="text-sm">No image available</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Internal Images */}
            {
              property.internalImages && property.internalImages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Internal Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {property.internalImages.map((img, index) => (
                        <div key={index} className="rounded-lg overflow-hidden border bg-gray-100 relative h-32 flex items-center justify-center group">
                          <SessionMediaImage
                            src={img}
                            alt={`Internal ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            }

            {/* Unit Details */}
            <Card>
              <CardHeader>
                <CardTitle>Unit Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Unit Number', value: property.unitNumber || 'N/A' },
                    { label: 'Floor', value: property.floor || 'N/A' },
                    { label: 'Building Name', value: property.buildingName },
                    { label: 'Location', value: property.location || property.address || 'N/A', className: 'md:col-span-2' },
                  ].map((item, idx) => (
                    <DetailItem key={idx} {...item} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Area Details */}
            <Card>
              <CardHeader>
                <CardTitle>Area Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-semibold">{property.carpetArea || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">Carpet Area</div>
                  </div>
                  {property.plotArea && (
                    <div className="text-center">
                      <div className="text-xl font-semibold">{property.plotArea}</div>
                      <div className="text-sm text-muted-foreground">Plot Area</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-xl font-semibold">{property.constructedArea || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">Constructed Area</div>
                  </div>
                </div>
              </CardContent>
            </Card>



            {/* Agreement & Security Details */}
            {
              (property.securityDeposit || property.agreementPeriod || property.agreementStartDate || property.agreementEndDate || property.noticePeriod) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Agreement & Security</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { label: 'Security Deposit', value: property.securityDeposit, isCurrency: true },
                        { label: 'Agreement Period', value: property.agreementPeriod },
                        { label: 'Agreement Start Date', value: property.agreementStartDate ? new Date(property.agreementStartDate).toLocaleDateString() : null },
                        { label: 'Agreement End Date', value: property.agreementEndDate ? new Date(property.agreementEndDate).toLocaleDateString() : null },
                        { label: 'Notice Period', value: property.noticePeriod },
                        { label: 'Lock-in Period', value: property.lockInPeriod },
                        { label: 'Payment Due Date', value: property.paymentDueDate ? `${property.paymentDueDate} of each month` : null },
                        { label: 'Annual Escalation', value: property.escalationPercentage ? `${property.escalationPercentage}%` : null },
                        { label: 'Escalation Amount', value: property.escalationAmount, isCurrency: true },
                      ].map((item, idx) => (
                        <DetailItem key={idx} {...item} />
                      ))}
                    </div>

                    {property.rentSchedule && property.rentSchedule.length > 0 && (
                      <div className="mt-6 border-t pt-4">
                        <label className="text-sm font-medium mb-3 block">Monthly Rent Schedule</label>
                        <div className="border rounded-md overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/50 text-left">
                                  <th className="px-4 py-2 font-medium bg-muted/30">Year</th>
                                  <th className="px-4 py-2 font-medium bg-muted/30">Months</th>
                                  <th className="px-4 py-2 font-medium bg-muted/30">Amount</th>
                                  <th className="px-4 py-2 font-medium bg-muted/30">From</th>
                                  <th className="px-4 py-2 font-medium bg-muted/30">To</th>
                                </tr>
                              </thead>
                              <tbody>
                                {property.rentSchedule.map((item: any, idx: number) => (
                                  <tr key={idx} className="border-t">
                                    <td className="px-4 py-2">{item.year}</td>
                                    <td className="px-4 py-2">{item.months || '11'}</td>
                                    <td className="px-4 py-2">₹{Number(item.amount).toLocaleString()}</td>
                                    <td className="px-4 py-2">{item.fromDate ? new Date(item.fromDate).toLocaleDateString() : 'N/A'}</td>
                                    <td className="px-4 py-2">{item.toDate ? new Date(item.toDate).toLocaleDateString() : 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            }

            {/* Unit Condition & Maintenance */}
            {
              (property.unitCondition || property.maintenanceToBePaidBy || property.rentalStatus || property.projectCondition || (property.possessionDate && !(property.listingType === 'rent' && property.rentalStatus === 'rented'))) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Unit Condition & Maintenance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { label: 'Unit Condition', value: property.unitCondition, capitalize: true },
                        { label: 'Maintenance To Be Paid By', value: property.maintenanceToBePaidBy, capitalize: true },
                        { label: 'Rental Status', value: property.rentalStatus, capitalize: true },
                        { label: 'Project Condition', value: property.projectCondition },
                        { label: 'Possession Date', value: property.possessionDate && !(property.listingType === 'rent' && property.rentalStatus === 'rented') ? new Date(property.possessionDate).toLocaleDateString() : null },
                      ].map((item, idx) => (
                        <DetailItem key={idx} {...item} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            }

            {/* Furnished Checklist */}
            {
              property.furnishedChecklist && property.furnishedChecklist.filter((item: any) => item.checked).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Furnished Items ({property.furnishedChecklist.filter((item: any) => item.checked).length})
                    </CardTitle>
                    <CardDescription>
                      Items included with this property
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Group items by category */}
                    {(() => {
                      const checkedItems = property.furnishedChecklist.filter((item: any) => item.checked);
                      const groupedByCategory = checkedItems.reduce((acc: any, item: any) => {
                        const category = item.category || 'other';
                        if (!acc[category]) {
                          acc[category] = [];
                        }
                        acc[category].push(item);
                        return acc;
                      }, {});

                      const categoryLabels: Record<string, string> = {
                        basic: 'Basic Furnishing',
                        kitchen: 'Kitchen Items',
                        bedroom: 'Bedroom Items',
                        living: 'Living Room Items',
                        appliances: 'Appliances',
                        semifurnished: 'Semi Furnished Items',
                        office: 'Office Furniture & Setup',
                        infrastructure: 'Infrastructure & IT',
                        safety: 'Safety & Security',
                        machinery: 'Machinery & Equipment',
                        storage: 'Storage & Warehouse',
                        utilities: 'Utilities & Amenities',
                        other: 'Custom Items'
                      };

                      return (
                        <div className="space-y-4">
                          {Object.entries(groupedByCategory).map(([category, items]: [string, any]) => (
                            <div key={category} className="space-y-2">
                              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                {categoryLabels[category] || category}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {items.map((item: any, index: number) => (
                                  <div
                                    key={item.id || index}
                                    className="flex items-center justify-between space-x-3 bg-green-50 border border-green-200 rounded-lg p-3 hover:bg-green-100 transition-colors"
                                  >
                                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-gray-800 block truncate">
                                          {item.name}
                                        </span>
                                        {item.category === 'other' && (
                                          <span className="text-xs text-muted-foreground italic">Custom Item</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-xs font-semibold text-green-700 bg-green-200 px-2 py-1 rounded whitespace-nowrap">
                                        Qty: {item.quantity || 1}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="mt-4 pt-3 border-t bg-blue-50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                          <p className="text-sm font-medium text-blue-800">
                            Total: {property.furnishedChecklist.filter((item: any) => item.checked).length} item{property.furnishedChecklist.filter((item: any) => item.checked).length !== 1 ? 's' : ''}
                            ({property.furnishedChecklist.filter((item: any) => item.checked).reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)} total quantity)
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            {/* Comments */}
            {
              property.specificComments && (
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Comments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{property.specificComments}</p>
                  </CardContent>
                </Card>
              )
            }

            {/* Tenants Information - Moved below Additional Comments */}
            {
              property.tenants && property.tenants.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Home className="h-5 w-5" />
                      Current Tenants ({property.tenants.length})
                    </CardTitle>
                    <CardDescription>
                      Active tenants for this property
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {property.tenants.filter(tenant => tenant.isActive).map((tenant, index) => (
                        <div key={tenant.id}>
                          {index > 0 && <div className="border-t pt-6 mt-6"></div>}
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-base">
                                {tenant.firstName} {tenant.lastName}
                              </h4>
                              <p className="text-sm text-muted-foreground">{tenant.email}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Tenant {index + 1}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              { label: 'Phone', value: tenant.phone },
                              { label: 'Monthly Rent', value: tenant.monthlyRent, isCurrency: true },
                              { label: 'Lease Start', value: tenant.leaseStartDate ? new Date(tenant.leaseStartDate).toLocaleDateString() : null },
                              { label: 'Lease End', value: tenant.leaseEndDate ? new Date(tenant.leaseEndDate).toLocaleDateString() : null },
                              { label: 'Employer', value: tenant.employer },
                              { label: 'Payment Due', value: tenant.paymentDueDate ? `${tenant.paymentDueDate}th of each month` : null },
                              { label: 'Notice Period', value: tenant.noticePeriod },
                              { label: 'Annual Escalation', value: tenant.escalationPercentage },
                              { label: 'Emergency Contact', value: tenant.emergencyContact },
                              { label: 'Last Modified', value: tenant.updatedAt ? `${new Date(tenant.updatedAt).toLocaleDateString('en-GB')} at ${new Date(tenant.updatedAt).toLocaleTimeString()}` : null },
                            ].map((item, idx) => (
                              <DetailItem key={idx} {...item} />
                            ))}
                          </div>

                          {/* Rent Schedule Display */}
                          {tenant.rentSchedule && tenant.rentSchedule.length > 0 && (
                            <div className="mt-4 border rounded-md overflow-hidden">
                              <div className="bg-muted px-4 py-2 text-sm font-medium border-b">
                                Monthly Rent Schedule
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-muted/50 text-left">
                                      <th className="px-4 py-2 font-medium bg-muted/30">Year</th>
                                      <th className="px-4 py-2 font-medium bg-muted/30">Months</th>
                                      <th className="px-4 py-2 font-medium bg-muted/30">Amount</th>
                                      <th className="px-4 py-2 font-medium bg-muted/30">From</th>
                                      <th className="px-4 py-2 font-medium bg-muted/30">To</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tenant.rentSchedule.map((item, idx) => (
                                      <tr key={idx} className="border-t">
                                        <td className="px-4 py-2">{item.year}</td>
                                        <td className="px-4 py-2">{item.months || '11'}</td>
                                        <td className="px-4 py-2">₹{Number(item.amount).toLocaleString()}</td>
                                        <td className="px-4 py-2">{item.fromDate ? new Date(item.fromDate).toLocaleDateString() : 'N/A'}</td>
                                        <td className="px-4 py-2">{item.toDate ? new Date(item.toDate).toLocaleDateString() : 'N/A'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}

                          {tenant.notes && (
                            <div className="mt-4">
                              <label className="text-sm font-medium text-muted-foreground">Notes</label>
                              <p className="text-sm">{tenant.notes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            }

            {/* Service Request History Section */}
            <Card id="service-history" className="scroll-mt-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Service Request History ({raisedRequests.length})
                </CardTitle>
                <CardDescription>
                  All service requests for this property
                </CardDescription>
              </CardHeader>
              <CardContent>
                {raisedRequests.filter(req => currentUserRole === 'admin' || isOwner || req.userId === user?.uid || req.tenantEmail === user?.email || req.ownerEmail === user?.email).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                    <ClipboardList className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                    <p>No service requests found for this property.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {raisedRequests.filter(req => currentUserRole === 'admin' || isOwner || req.userId === user?.uid || req.tenantEmail === user?.email || req.ownerEmail === user?.email).map((request, index) => {
                      const getRequestTypeLabel = (type: string) => {
                        switch (type) {
                          case 'service_request': return 'Service Request';
                          case 'inspection_report': return 'Inspection Report';
                          case 'legal_service_request': return 'Legal Service';
                          case 'other_service_request': return 'Other Service';
                          case 'document_upload': return 'Document Upload';
                          case 'agreement_renewal': return 'Agreement Renewal';
                          case 'agreement_termination': return 'Agreement Termination';
                          default: return 'Request';
                        }
                      };

                      const getRequestIcon = (type: string) => {
                        switch (type) {
                          case 'service_request': return <Wrench className="h-4 w-4" />;
                          case 'inspection_report': return <ClipboardList className="h-4 w-4" />;
                          case 'legal_service_request': return <Scale className="h-4 w-4" />;
                          case 'other_service_request': return <FileText className="h-4 w-4" />;
                          case 'document_upload': return <FileText className="h-4 w-4" />;
                          case 'agreement_renewal': return <RefreshCw className="h-4 w-4" />;
                          case 'agreement_termination': return <FileX className="h-4 w-4" />;
                          default: return <FileText className="h-4 w-4" />;
                        }
                      };

                      const getStatusBadge = (request: RaisedRequest) => {
                        if (request.isRead) {
                          return (
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </Badge>
                              {request.resolvedAt && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(request.resolvedAt).toLocaleDateString()} at {new Date(request.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">Pending</Badge>;
                      };

                      return (
                        <div key={request.id} className="p-4 border rounded-lg bg-muted/20">
                          {index > 0 && <div className="border-t -mt-4 mb-4"></div>}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                {getRequestIcon(request.type)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm">{getRequestTypeLabel(request.type)}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(request.timestamp || request.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(request)}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {request.serviceType && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Service Type</label>
                                <p className="text-sm capitalize">{request.serviceType.replace(/_/g, ' ')}</p>
                              </div>
                            )}
                            {request.title && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Title</label>
                                <p className="text-sm">{request.title}</p>
                              </div>
                            )}
                            {request.userName && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Requested By</label>
                                <p className="text-sm">{request.userName}</p>
                              </div>
                            )}
                            {request.userPhone && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground">Contact</label>
                                <p className="text-sm">{request.userPhone}</p>
                              </div>
                            )}
                          </div>

                          {request.serviceImage && (
                            <div className="mt-3 pt-3 border-t">
                              <label className="text-xs font-medium text-muted-foreground mb-2 block">Attachment</label>
                              <SessionMediaImage
                                src={request.serviceImage}
                                alt="Service Attachment"
                                className="max-w-full h-auto max-h-48 rounded border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(request.serviceImage, '_blank')}
                              />
                            </div>
                          )}

                          {request.serviceComment && (
                            <div className="mt-3 pt-3 border-t">
                              <label className="text-xs font-medium text-muted-foreground">Comment</label>
                              <p className="text-sm">{request.serviceComment}</p>
                            </div>
                          )}

                          {request.message && !request.serviceComment && (
                            <div className="mt-3 pt-3 border-t">
                              <label className="text-xs font-medium text-muted-foreground">Message</label>
                              <p className="text-sm">{request.message}</p>
                            </div>
                          )}

                          {(request.adminRemarks || request.adminImage) && (
                            <div className="mt-3 pt-3 border-t bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                              <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="h-3.5 w-3.5 text-blue-700" />
                                <label className="text-xs font-bold text-blue-800 uppercase tracking-wider">Admin Response</label>
                              </div>
                              {request.adminRemarks && (
                                <p className="text-sm text-blue-900 font-medium italic mb-2">"{request.adminRemarks}"</p>
                              )}
                              {request.adminImage && (
                                <div className="mt-2">
                                  <SessionMediaImage
                                    src={request.adminImage}
                                    alt="Admin attachment"
                                    className="max-w-full h-auto max-h-48 rounded border border-blue-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => window.open(request.adminImage, '_blank')}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {isOwner && !request.resolvedAt && (request.type === 'agreement_termination' || request.type === 'agreement_renewal') && (
                            <div className="mt-3 pt-3 border-t flex justify-end">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  if (request.type === 'agreement_termination') navigate(`/terminate-agreement/${propertyId}`);
                                  if (request.type === 'agreement_renewal') navigate(`/renew-agreement/${propertyId}`);
                                }}
                              >
                                Review & {request.type === 'agreement_termination' ? 'Terminate' : 'Renew'}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            {(isOwner || isTenant || currentUserRole === "admin") && <><ReviewHistory propertyId={property.id}/><ServiceRequestHistory propertyId={property.id}/><InspectionReportList propertyId={property.id} /></>}
            {user && <NegotiationPanel propertyId={property.id} canOffer={!isOwner && !isTenant && property.rentalStatus !== "rented" && !property.isSold}/>}
      </div >

          <div className="space-y-6">
            {/* Pricing */}
            {!(property.listingType === 'rent' && property.rentalStatus === 'rented') && (
              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary mb-2">
                    {formatPrice(property)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Calendar className="h-4 w-4" />
                    Listed on {new Date(property.createdAt).toLocaleDateString()}
                  </div>

                  {/* Detailed Rent Information for Rentals */}
                  {property.listingType === 'rent' && (
                    <div className="space-y-3">
                      {property.monthlyRent1stYear && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">1st Year Rent</label>
                          <p className="text-sm font-semibold">₹{Number(property.monthlyRent1stYear).toLocaleString()}/month</p>
                        </div>
                      )}
                      {property.monthlyRent2ndYear && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">2nd Year Rent</label>
                          <p className="text-sm font-semibold">₹{Number(property.monthlyRent2ndYear).toLocaleString()}/month</p>
                        </div>
                      )}
                      {property.monthlyRent3rdYear && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">3rd Year Rent</label>
                          <p className="text-sm font-semibold">₹{Number(property.monthlyRent3rdYear).toLocaleString()}/month</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Owner Information */}
            <Card>
              <CardHeader>
                <CardTitle>{property.ownerRole === "agent" ? "Agent Information" : "Owner Information"}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{property.ownerRole === "agent" ? "Agent Name" : "Owner Name"}</label>
                    <p className="text-sm font-medium">{property.ownerName}</p>
                  </div>
                  {(currentUserRole === 'admin' || isOwner || isTenant) ? (
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">{property.ownerRole === "agent" ? "Agent Email" : "Owner Email"}</label>
                        <p className="text-sm">{property.ownerEmail}</p>
                      </div>
                      {property.ownerPhone && (
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">{property.ownerRole === "agent" ? "Agent Phone" : "Owner Phone"}</label>
                          <p className="text-sm">{property.ownerPhone}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pt-2">
                      <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                        Contact details are hidden for privacy. Please use the "Enquire Now" button to contact the admin.
                      </p>
                    </div>
                  )}
                  <div className="pt-2">
                    <label className="text-xs font-medium text-muted-foreground">Property Status</label>
                    <div className="text-sm mt-1">
                      <Badge variant={property.isActive ? "default" : "secondary"}>
                        {property.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Buyers Information */}
            {property.buyers && property.buyers.length > 0 && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Interested Buyers ({property.buyers.length})
                  </CardTitle>
                  <CardDescription>
                    Buyers interested in purchasing this property
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {property.buyers.map((buyer, index) => (
                      <div key={buyer.id} className="p-4 border rounded-lg bg-muted/20">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-semibold">
                            {buyer.firstName} {buyer.lastName}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            Buyer {index + 1}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {[
                            { label: 'Email', value: buyer.email },
                            { label: 'Phone', value: buyer.phone },
                            { label: 'Offer Amount', value: buyer.offerAmount, isCurrency: true },
                            { label: 'Financing', value: buyer.financingType, capitalize: true },
                            { label: 'Pre-approval', value: buyer.preApprovalAmount, isCurrency: true },
                            { label: 'Expected Closing', value: buyer.closingDate ? new Date(buyer.closingDate).toLocaleDateString() : null },
                            { label: 'Employment', value: buyer.employmentStatus, capitalize: true },
                            { label: 'Employer', value: buyer.employer },
                            { label: 'Annual Income', value: buyer.annualIncome, isCurrency: true },
                          ].map((item, idx) => (
                            <DetailItem key={idx} {...item} />
                          ))}
                        </div>

                        {buyer.agentName && (
                          <div className="mt-3 pt-3 border-t">
                            <label className="text-xs font-medium text-muted-foreground">Real Estate Agent</label>
                            <p className="text-sm">{buyer.agentName} {buyer.agentPhone && `- ${buyer.agentPhone}`}</p>
                          </div>
                        )}

                        {buyer.currentAddress && (
                          <div className="mt-3 pt-3 border-t">
                            <label className="text-xs font-medium text-muted-foreground">Current Address</label>
                            <p className="text-sm">{buyer.currentAddress}</p>
                          </div>
                        )}

                        {buyer.notes && (
                          <div className="mt-3 pt-3 border-t">
                            <label className="text-xs font-medium text-muted-foreground">Notes</label>
                            <p className="text-sm">{buyer.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div >

        <Dialog open={isTerminationDialogOpen} onOpenChange={setIsTerminationDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Request Termination</DialogTitle>
              <DialogDescription>
                Notify the {property.ownerRole === "agent" ? "agent" : "owner"} that you wish to terminate the lease agreement.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="space-y-4">
                <div>
                  <label htmlFor="notice-period" className="text-xs font-medium text-muted-foreground">Notice Period</label>
                  <Select
                    value={selectedNoticePeriod || ""}
                    onValueChange={(value) => setSelectedNoticePeriod(value)}
                  >
                    <SelectTrigger id="notice-period" className="mt-1">
                      <SelectValue placeholder="Select Notice Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 Month">1 Month</SelectItem>
                      <SelectItem value="2 Months">2 Months</SelectItem>
                      <SelectItem value="3 Months">3 Months</SelectItem>
                      <SelectItem value="4 Months">4 Months</SelectItem>
                      <SelectItem value="5 Months">5 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="notice-start-date" className="text-xs font-medium text-muted-foreground">Notice Period Starts From</label>
                  <DatePicker
                    value={noticeStartDate}
                    min={(() => {
                      const today = new Date();
                      const year = today.getFullYear();
                      const month = String(today.getMonth() + 1).padStart(2, '0');
                      const day = String(today.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    })()}
                    onChange={(val) => setNoticeStartDate(val)}
                    className="mt-1"
                  />
                </div>

                <div className="bg-blue-50 p-3 rounded-md border border-blue-100 text-sm text-blue-800">
                  <p>
                    <strong>Note:</strong> Sending this request will notify the {property.ownerRole === "agent" ? "agent" : "owner"}.
                    {!selectedNoticePeriod || selectedNoticePeriod === "Immediate"
                      ? " Since you selected an immediate/blank notice period, you are requesting to vacate as soon as possible."
                      : ` You are engaging to serve a notice period of ${selectedNoticePeriod}.`
                    }
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={() => setIsTerminationDialogOpen(false)}>Cancel</Button>
              <Button onClick={submitTerminationRequest} disabled={submittingTermination}>
                {submittingTermination ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : "Send Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div >
    </div>
  );
};

export default PropertyDetails;
