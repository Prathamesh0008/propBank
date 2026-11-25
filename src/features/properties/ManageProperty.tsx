"use client";
import {propertyPricing} from '@/lib/property-presentation';
import {hasEligibleAgreement} from "@/lib/agreement-eligibility";

import {formatPropertyAddress} from "@/lib/property-address";
import {leaseTenureLabel} from '@/lib/lease-tenure';
import {formatDisplayDate, formatDisplayTime} from '@/lib/date-format';

import {purposeLabel} from "@/lib/property-purpose";

import workspaceStyles from './ManageProperty.module.css';
import {OwnerVerificationStatus} from '@/features/admin/OwnerVerification';
import {BrokerEnquiries} from '@/features/enquiries/EnquiryInbox';
import ListingModeration from './ListingModeration';
import {ProductDashboard} from './PropertyHub';
import { propertyCategoryMatches } from '@/lib/client-workflows';
import { apiFetch } from '@/lib/api-client';
import SessionMediaImage from '@/components/SessionMediaImage';

import { Building2, Plus, MoreVertical, Users, UserPlus, Eye, Edit, Archive, Wrench, Filter, Home, FileText, Star, Scale, Paperclip, RefreshCw, XCircle, Key, Search } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { useUserProperties } from "../../hooks/useProperties";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Badge } from "@/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Switch } from "@/ui/switch";
import { Label } from "@/ui/label";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "../../utils/config";

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
  previousAddress: string;
  employmentStatus: string;
  employer: string;
  monthlyIncome: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rentSchedule?: {
    year: string;
    amount: string;
    fromDate: string;
    toDate: string;
  }[];
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
  preLeased?: any;managementServices?:string[];managementDescription?:string;investment?:{monthlyRentalIncome:number;annualRentalIncome:number;grossYield:number;leaseEndDate:string;leaseReviewRequired:boolean;verificationStatus:string};
  moderationStatus?: string;
  moderationRevision?: number;
  moderationReason?: string;
  createdAs?:string;
  ownershipVerification?:string;
  ownershipVerificationReason?:string;
  id: string;
  title: string;
  description: string;
  price: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: string;
  listingType: string; // 'rent' or 'sell'
  monthlyRent: string;
  sellingPrice: string;
  squareFeet: number;
  images: string[];
  tenants?: TenantInfo[];
  buyers?: BuyerInfo[];
  isSold?: boolean;
  rentalStatus?: string; // 'available' or 'rented'
  furnishedChecklist?: string[]; // Array of furnished items
  ownerUID: string;
  ownerName: string;
  ownerEmail: string;
  ownerRole?: string;
  wantToSell?: boolean; // Toggle for "Want to Sell?" - can be toggled ON/OFF
  status: string; // 'active' or 'inactive' (default: 'active')
  isActive: boolean; // Legacy field, kept for backward compatibility
  createdAt: string;
  updatedAt: string;
  unitNumber?: string;
  buildingName?: string;
  propertyCategory?: string;
  agreementStatus?: string;
  agreementRequest?: {kind:string;status:string};
  userRole?: string; // 'owner' or 'tenant' - indicates the current user's relationship to the property
}

// Helper component to display tenant name from property details only
const TenantNameDisplay = ({ tenant }: { tenant: TenantInfo }) => {
  const [fetchedName, setFetchedName] = useState<string>("");

  const displayName = `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim();

  // We rely on tenant.firstName/lastName being populated.
  // We avoid fetching via API to ensure offline capability and speed.
  // If name is missing, fallback to phone or legacy handling if needed.

  if (displayName) {
    return <span>{displayName}</span>;
  }

  // Fallback to phone if name is missing
  if (tenant.phone) {
    return <span>{tenant.phone}</span>;
  }

  if (fetchedName) {
    return <span>{fetchedName} ({tenant.phone})</span>;
  }

  if (tenant.phone) {
    return <span>{tenant.phone}</span>;
  }

  return <span>{tenant.email || "Unknown Tenant"}</span>;
};

const ManageProperty = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<User | null>(null);
  const [authReady,setAuthReady]=useState(false);
  const { data: propertiesData, isLoading: loading, error: propertyError,refetch,isRefetchError ,hasNextPage,fetchNextPage,isFetchingNextPage } = useUserProperties(user);

  const ownedProperties = useMemo(() => propertiesData?.owned || [], [propertiesData?.owned]);
  const tenantProperties = useMemo(() => propertiesData?.tenant || [], [propertiesData?.tenant]);

  const [filteredOwnedProperties, setFilteredOwnedProperties] = useState<Property[]>([]);
  const [filteredTenantProperties, setFilteredTenantProperties] = useState<Property[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>("");
  const [selectedListingType, setSelectedListingType] = useState<string>("");

  // View toggle state - 'owned' or 'tenant'
  const [params,setParams]=useSearchParams();
  const [activeView, setActiveView] = useState<'owned' | 'tenant'>(params.get('tab')==='tenant'?'tenant':'owned');

  useEffect(()=>{setActiveView(params.get('tab')==='tenant'?'tenant':'owned');},[params.get('tab')]);

  // Toggle states for "Want to Sell" - default false for all properties
  const [wantToSellToggles, setWantToSellToggles] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const sellToggleBaseline = useRef<{uid:string|undefined;values:Record<string,boolean>}>({uid:undefined,values:{}});
  useEffect(() => {
    if (propertiesData === undefined) return;
    const sameUser=sellToggleBaseline.current.uid===user?.uid;
    const previousServer=sameUser?sellToggleBaseline.current.values:{};
    const serverValues=Object.fromEntries(ownedProperties.map((p:Property)=>[p.id,!!p.wantToSell]));
    setWantToSellToggles(current=>{
      const next=Object.fromEntries(Object.entries(serverValues).map(([id,value])=>[id,sameUser&&Object.prototype.hasOwnProperty.call(current,id)&&Object.prototype.hasOwnProperty.call(previousServer,id)&&previousServer[id]===value?current[id]:value]));
      return Object.keys(current).length===Object.keys(next).length&&Object.keys(next).every(id=>current[id]===next[id])?current:next;
    });
    sellToggleBaseline.current={uid:user?.uid,values:serverValues};
  }, [ownedProperties, user?.uid, propertiesData === undefined]);

  // Filter properties based on current filter criteria
  const applyFilters = () => {
    const filterList = (properties: Property[]) => {
      let filtered = [...properties];

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(property =>
          property.id?.toLowerCase().includes(query) ||
          property.title?.toLowerCase().includes(query) ||
          property.buildingName?.toLowerCase().includes(query) ||
          property.address?.toLowerCase().includes(query) ||
          property.city?.toLowerCase().includes(query) ||
          property.description?.toLowerCase().includes(query)
        );
      }

      // Filter by property type
      if (selectedPropertyType && selectedPropertyType !== "all") {
        filtered = filtered.filter(property =>
          (property.propertyCategory || property.propertyType)?.toLowerCase() === selectedPropertyType.toLowerCase()
        );
      }

      // Filter by listing type
      if (selectedListingType && selectedListingType !== "all") {
        filtered = filtered.filter(property =>
          propertyCategoryMatches(property,selectedListingType)
        );
      }

      return filtered;
    };

    setFilteredOwnedProperties(filterList(ownedProperties));
    setFilteredTenantProperties(filterList(tenantProperties));
  };

  // Apply filters whenever filter criteria change
  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedPropertyType, selectedListingType, ownedProperties, tenantProperties]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedPropertyType("");
    setSelectedListingType("");
    setFilteredOwnedProperties(ownedProperties);
    setFilteredTenantProperties(tenantProperties);
  };

  const hasActiveFilters = searchQuery.trim() || selectedPropertyType || selectedListingType;

  // Sort properties by latest timestamp
  const sortedOwnedProperties = useMemo(() => {
    return [...filteredOwnedProperties].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA; // Descending order
    });
  }, [filteredOwnedProperties]);

  const sortedTenantProperties = useMemo(() => {
    return [...filteredTenantProperties].sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA; // Descending order
    });
  }, [filteredTenantProperties]);

  const formatPrice=(property:Property)=>{const price=propertyPricing(property);return price.amount===null?price.label+': Not recorded':new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(price.amount)+(price.monthly?' / month':'')+' - '+price.label;};

  const getListingTypeBadge = (listingType: string) => {
    if(listingType==='sell_rent')return <Badge variant="outline">For Sale / Rent</Badge>;
    if(listingType==='manage')return <Badge variant="outline">To Manage / Private</Badge>;
    if(listingType==='pre_leased')return <Badge variant="outline">Pre-Leased</Badge>;
    if (listingType === 'rent') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">For Rent</Badge>;
    } else if (listingType === 'sell') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">For Sale</Badge>;
    }
    return <Badge variant="outline">Unknown</Badge>;
  };

  const handleEdit = (propertyId: string) => {
    // Navigate to edit property page
    navigate(`/edit-property/${propertyId}`);
  };

  const handleView = (propertyId: string) => {
    // Navigate to property details page
    navigate(`/property/${propertyId}`);
  };

  const mutationLocks=useRef(new Set<string>());
  const [busyProperties,setBusyProperties]=useState<Record<string,boolean>>({});
  async function updateManagedProperty(propertyId:string,updates:Record<string,unknown>,message:string){
    if(!user||mutationLocks.current.has(propertyId))return;
    mutationLocks.current.add(propertyId);setBusyProperties(previous=>({...previous,[propertyId]:true}));
    try{
      const response=await apiFetch(`${API_BASE_URL}/properties/${propertyId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerUID:user.uid,...updates})});
      const data=await response.json();
      if(!response.ok||!data.success){if(response.status===409){void queryClient.invalidateQueries({queryKey:['userProperties']});throw Error(data.message||'This property changed. Refresh and review its latest details before retrying.');}throw Error(data.message||'Could not update property. Please try again.');}
      if(typeof updates.wantToSell==='boolean')setWantToSellToggles(previous=>({...previous,[propertyId]:updates.wantToSell as boolean}));
      toast({title:'Property updated',description:message});
      await Promise.allSettled(['userProperties','property','productHub','publicProperties','allProperties'].map(key=>queryClient.invalidateQueries({queryKey:[key]})));
    }catch(error){toast({title:'Update not completed',description:error instanceof Error?error.message:'Could not update property. Please try again.',variant:'destructive'});}
    finally{mutationLocks.current.delete(propertyId);setBusyProperties(previous=>({...previous,[propertyId]:false}));}
  }
  const handleToggleStatus=(propertyId:string,isInactive:boolean)=>{
    if(isInactive&&!window.confirm('Archive this property? It will move to Archived Properties.'))return;
    return updateManagedProperty(propertyId,{status:isInactive?'inactive':'active',isActive:!isInactive},isInactive?'Property archived. Existing records are preserved.':'Property restored.');
  };
  const handleArchive=(propertyId:string)=>handleToggleStatus(propertyId,true);

  const handleAddTenant = (propertyId: string, readOnly = false) => {
    // Navigate to add tenant page, passing view mode if readOnly is true
    if (readOnly) {
      navigate(`/add-tenant/${propertyId}?mode=view`);
    } else {
      navigate(`/add-tenant/${propertyId}`);
    }
  };

  const handleAddBuyer = (propertyId: string) => {
    // Navigate to add buyer page
    navigate(`/add-buyer/${propertyId}`);
  };

  const handleRequestServices = (propertyId: string) => {
    // Navigate to request services page
    navigate(`/request-services/${propertyId}`);
  };

  const handleToggleWantToSell=(propertyId:string,_propertyTitle:string,newValue:boolean)=>updateManagedProperty(propertyId,{wantToSell:newValue},newValue?'Your sale request was saved. Notification delivery is processed separately.':'Your sale request was cancelled. Notification delivery is processed separately.');

  const handleToggleToSell = async (propertyId: string, propertyTitle: string) => {
    try {
      // Update the property listing type to 'sell'
      const updateResponse = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listingType: 'sell'
        }),
      });

      const updateData = await updateResponse.json();

      if (updateData.success) {
        // Create admin notification
        const notificationResponse = await apiFetch(`${API_BASE_URL}/admin/notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'property_listing_change',
            title: 'Property Listing Type Changed',
            message: `Property "${propertyTitle}" has been switched from rent to sell by the owner.`,
            propertyId: propertyId,
            ownerId: user?.uid,
            ownerName: user?.displayName || user?.email || 'Unknown Owner',
            ownerEmail: user?.email || '',
            ownerPhone: user?.phoneNumber || '',
            timestamp: new Date().toISOString(),
            isRead: false,
            priority: 'medium'
          }),
        });

        const notificationData = await notificationResponse.json();

        if (notificationData.success) {
          // Notification accepted; continue updating the local property list.
        } else {
          // Preserve the existing best-effort notification behavior.
        }

        // Update local state to reflect the change
        setFilteredOwnedProperties(prevFiltered =>
          prevFiltered.map(prop =>
            prop.id === propertyId
              ? { ...prop, listingType: 'sell' }
              : prop
          )
        );

        // Show success message
        toast({
          title: "Success",
          description: `Property "${propertyTitle}" has been switched to sell mode. Admin has been notified.`,
        });

      } else {

        toast({
          title: "Error",
          description: "Failed to update property listing type. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {

      toast({
        title: "Error",
        description: "An error occurred while updating the property. Please try again.",
        variant: "destructive",
      });
    }
  };



  return (
    <div className={workspaceStyles.workspace}>
      <>
        <title>Manage Properties | PropBank</title>
        <meta name="description" content="Manage your property listings, update property details, unit numbers, and building information." />
        <link rel="canonical" href="/manage-property" />
      </>

      <div className={workspaceStyles.content}>
        {/* Header */}
        <header className={workspaceStyles.pageHeading}>
          <div className={workspaceStyles.headerRow}>
            <div><p className={workspaceStyles.eyebrow}>YOUR PORTFOLIO</p><h1>Manage Properties</h1><p className={workspaceStyles.subtitle}>Manage your property portfolio, listings and tenancy activity in one place.</p></div>

            <div className={workspaceStyles.headerActions}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className={workspaceStyles.primaryAction}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                    <span aria-hidden="true" className="ml-2 text-xs">&#9662;</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={workspaceStyles.propertyMenu}>
                  <DropdownMenuItem onSelect={() => navigate("/select-property-type?as=owner")}>
                    <Home className="mr-2 h-4 w-4" />As an Owner
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate("/select-property-type?as=tenant")}>
                    <Key className="mr-2 h-4 w-4" />As a Tenant
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                className={workspaceStyles.secondaryAction}
                variant="outline"
                onClick={() => navigate("/archived-properties")}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archived
              </Button>
            </div>
          </div>
        </header>

        <div className={workspaceStyles.activity}><ProductDashboard/></div>
        <section className={workspaceStyles.portfolioSection} aria-labelledby="your-properties-heading">
          <h2 id="your-properties-heading" className="sr-only">Your Properties</h2>
        <Card className={workspaceStyles.filters}>
          <CardContent className={workspaceStyles.filterContent}>
            <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">

              {/* View Toggle */}
              <div className={workspaceStyles.tabs} role="group" aria-label="Property relationship">
                <button
                  className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeView === 'owned'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-pressed={activeView==='owned'} onClick={() => {setActiveView('owned');const next=new URLSearchParams(params.toString());next.set('tab','owned');setParams(next);}}
                >
                  <Building2 className="h-4 w-4 mr-2 hidden sm:block" />
                  Owned
                  <Badge variant="secondary" className={`ml-2 border-none ${activeView === 'owned' ? 'bg-primary/10 text-primary' : ''}`}>
                    {ownedProperties.length}
                  </Badge>
                </button>
                <button
                  className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeView === 'tenant'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  aria-pressed={activeView==='tenant'} onClick={() => {setActiveView('tenant');const next=new URLSearchParams(params.toString());next.set('tab','tenant');setParams(next);}}
                >
                  <Key className="h-4 w-4 mr-2 hidden sm:block" />
                  Tenant
                  <Badge variant="secondary" className={`ml-2 border-none ${activeView === 'tenant' ? 'bg-primary/10 text-primary' : ''}`}>
                    {tenantProperties.length}
                  </Badge>
                </button>
              </div>

              <div className={workspaceStyles.filterTools}>
                 <label className={workspaceStyles.searchBox}>
                   <Search size={17} aria-hidden="true" />
                   <span className="sr-only">Search properties</span>
                   <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, ID or location" />
                 </label>
                 <div className="flex items-center gap-3 w-full sm:w-auto">
                   <span className="text-sm font-medium text-muted-foreground whitespace-nowrap hidden sm:block">Property Type</span>
                   <Select value={selectedPropertyType || "all"} onValueChange={(v) => setSelectedPropertyType(v === "all" ? "" : v)}>
                     <SelectTrigger aria-label="Property type" className="w-full sm:w-[150px] bg-background">
                       <SelectValue placeholder="All Types" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Types</SelectItem>
                       <SelectItem value="residential">Residential</SelectItem>
                       <SelectItem value="commercial">Commercial</SelectItem>
                       <SelectItem value="industrial">Industrial</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>

                 <div className="flex items-center gap-3 w-full sm:w-auto">
                   <span className="text-sm font-medium text-muted-foreground whitespace-nowrap hidden sm:block">Listing</span>
                   <Select value={selectedListingType || "all"} onValueChange={(v) => setSelectedListingType(v === "all" ? "" : v)}>
                     <SelectTrigger aria-label="Listing filter" className="w-full sm:w-[150px] bg-background">
                       <SelectValue placeholder="All Listings" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Listings</SelectItem>
                       <SelectItem value="rent">For Rent / All</SelectItem>
                       <SelectItem value="available">Available For Rent</SelectItem>
                       <SelectItem value="rented">Already Rented Out</SelectItem>
                       <SelectItem value="manage">To Manage</SelectItem>
                       <SelectItem value="sell">For Sale</SelectItem><SelectItem value="pre_leased">Pre-Leased Sale</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Property List Section */}
        <div className="space-y-6">

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Active filters:</span>
                  <div className="flex gap-1 flex-wrap">
                    {searchQuery && (
                      <Badge variant="secondary" className="text-xs">
                        "{searchQuery.length > 12 ? `${searchQuery.substring(0, 12)}...` : searchQuery}"
                      </Badge>
                    )}
                    {selectedPropertyType && selectedPropertyType !== "all" && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {selectedPropertyType}
                      </Badge>
                    )}
                    {selectedListingType && selectedListingType !== "all" && (
                      <Badge variant="secondary" className="text-xs capitalize">
                        {purposeLabel(selectedListingType)}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs sm:text-sm">
                  Clear All
                </Button>
              </div>
              <div className="mt-2">
                <p className="text-xs sm:text-sm text-muted-foreground">

                  Showing {activeView === 'owned' ? filteredOwnedProperties.length : filteredTenantProperties.length} of {activeView === 'owned' ? ownedProperties.length : tenantProperties.length} properties
                </p>
              </div>
            </div>
          )}

          <p className={workspaceStyles.coverage}>Counts and filters cover loaded properties.</p>
          {propertyError&&<div role="alert" className={workspaceStyles.error}><p>{isRefetchError?'The latest update could not be loaded. Showing previously loaded properties.':'Properties could not be loaded.'} {propertyError.message}</p><Button variant="outline" onClick={()=>void refetch()}>Retry</Button></div>}
          {/* Properties List */}
          <div className="space-y-3">
            {!authReady ? <p role="status">Loading your portfolio...</p> : !user ? (
              <div className="text-center py-12">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Please Sign In</h3>
                <p className="text-muted-foreground mb-4">
                  You need to be signed in to view and manage your properties.
                </p>
                <Button onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
              </div>
            )
              :
              loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Loading properties...</p>
                </div>
              )
                : propertyError && propertiesData===undefined ? null : (
                  <>
                     {/* Show section based on active view */}
                    {activeView === 'owned' ? (
                      /* Owned Properties Section */
                      <div className={workspaceStyles.portfolioGrid}>

                        {sortedOwnedProperties.length > 0 ? (
                          sortedOwnedProperties.map((property, index) => (
                            <Card key={property.id} className={`${workspaceStyles.propertyRow} transition-shadow overflow-hidden`}>
                              <div className={workspaceStyles.cardLayout}>
                                {/* Property Image Thumbnail - Always show with fallback */}
                                <div className={workspaceStyles.cover}>
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
                                  <Building2 className="h-12 w-12 text-gray-400" />
                                </div>
                                <CardContent className={workspaceStyles.cardBody}><div className={workspaceStyles.rowInformation}>
                                  <div className="flex flex-col space-y-3 sm:space-y-4">
                                    {/* Header with number and action menu */}
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-sm sm:text-lg leading-tight text-gray-900 break-words">
                                              {property.title}
                                              {property.unitNumber ? ` (${property.unitNumber})` : ""}
                                              {property.buildingName && property.buildingName.trim()!==property.title?.trim() && <span className="block text-sm font-normal">{property.buildingName}</span>}
                                              <span className="block text-xs font-normal">Property ID: {property.id}{property.createdAs==="tenant" ? ` - Owner verification ${property.ownershipVerification||"pending"}` : ""}{property.agreementStatus ? ` · ${property.agreementStatus.replaceAll("_"," ")}` : ""}{property.agreementRequest?.status==="pending" ? ` · Pending ${property.agreementRequest.kind}` : ""}</span>
                                              <span className={workspaceStyles.address}>{formatPropertyAddress(property)}</span><span className={workspaceStyles.stateLabel}>{property.status==='inactive'||property.isActive===false?'Inactive':property.status==='active'||property.isActive===true?'Active':'Status not recorded'}</span>
                                            </h3>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              Owner
                                            </Badge>
                                          </div>

                                          <p className={workspaceStyles.price}>{formatPrice(property)}</p>
                                          {property.listingType==='pre_leased'&&<p className="text-sm text-muted-foreground">Lease tenure: {leaseTenureLabel(property.preLeased)}</p>}
                                          <ListingModeration key={`${property.id}:${property.moderationRevision||0}`} property={property}/>
                                          {/* Show active tenants on a separate line if property is rented out */}
                                          {property.tenants && property.tenants.some((t: any) => t.isActive && (t.firstName || t.lastName || t.phone || t.email)) && (
                                            <p className="text-sm text-purple-600 font-medium mt-1">
                                              Active Tenants: {property.tenants
                                                .filter((t: any) => t.isActive && (t.firstName || t.lastName || t.phone || t.email))
                                                .map((t: any, i: number) => (
                                                <span key={t.id || i}>
                                                  {i > 0 && ", "}
                                                  <TenantNameDisplay tenant={t} />
                                                </span>
                                              ))}
                                            </p>
                                          )}
                                          {/* Show buyer on a separate line if property is sold */}
                                          {property.isSold && property.buyers && property.buyers.length > 0 && (
                                            <p className="text-sm text-green-600 font-medium mt-1">
                                              Buyer: {property.buyers[property.buyers.length - 1].firstName} {property.buyers[property.buyers.length - 1].lastName} ({property.buyers[property.buyers.length - 1].phone})
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {/* Action Menu for Owners */}

                                    </div>

                                    {/* Property Details */}
                                    <div className="ml-5 sm:ml-8 space-y-2">
                                      <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground items-center">
                                        <span className="flex items-center gap-1 whitespace-nowrap">
                                           {property.propertyType?.toUpperCase() || 'CATEGORY NOT RECORDED'}
                                        </span>
                                        {property.squareFeet > 0 && (
                                          <span className="flex items-center gap-1 whitespace-nowrap">
                                             {property.squareFeet} sqft
                                          </span>
                                        )}
                                        {property.updatedAt && (
                                          <span className="hidden sm:flex items-center gap-1 whitespace-nowrap">
                                             Last modified: {formatDisplayDate(property.updatedAt)} at {formatDisplayTime(property.updatedAt)}
                                          </span>
                                        )}
                                        {property.listingType === 'rent' && (
                                          <div className="flex items-center gap-2">

                                            {property.status && property.status !== 'inactive' && (() => {
                                              const validTenants = property.tenants ? property.tenants.filter((t: any) => t.isActive && (t.firstName || t.lastName || t.phone || t.email)) : [];
                                              const hasValidTenants = validTenants.length > 0 || property.rentalStatus==='rented';
                                              return (
                                              <Badge variant="outline" className={
                                                hasValidTenants
                                                  ? 'bg-orange-50 text-orange-700 border-orange-200 text-xs whitespace-nowrap'
                                                  : 'bg-green-50 text-green-700 border-green-200 text-xs whitespace-nowrap'
                                              }>
                                                {hasValidTenants
                                                  ? 'Currently Rented'
                                                  : property.rentalStatus==='available'?'Available for Rent':'Occupancy not recorded'}
                                              </Badge>
                                              );
                                            })()}
                                            {property.status === 'inactive' && (
                                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs whitespace-nowrap">
                                                Inactive (Archived)
                                              </Badge>
                                            )}
                                          </div>
                                        )}
                                        {property.listingType === 'sell' && (
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className={
                                              property.isSold
                                                ? 'bg-red-50 text-red-700 border-red-200 text-xs whitespace-nowrap'
                                                : 'bg-green-50 text-green-700 border-green-200 text-xs whitespace-nowrap'
                                            }>
                                              {property.isSold ? 'Sold' : 'Available for Sale'}
                                            </Badge>
                                          </div>
                                        )}
                                        {property.listingType && (
                                          <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-xs whitespace-nowrap">
                                            {purposeLabel(property.listingType)}
                                          </Badge>
                                        )}
                                      </div>
                                      {property.updatedAt && (
                                        <div className="sm:hidden text-xs text-muted-foreground">
                                           Last modified: {formatDisplayDate(property.updatedAt)}
                                        </div>
                                      )}
                                    </div>

                                    {/* Want to Sell Toggle - Only for rent properties owned by user */}

                                  </div>
                                </div><aside className={workspaceStyles.rowActions} aria-label={`Actions for property ${property.title}`}><div className={workspaceStyles.actionTop}><button type="button" className={workspaceStyles.viewLink} onClick={() => handleView(property.id)}>View details <span aria-hidden="true">&rarr;</span></button><DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" aria-label={`Actions for ${property.title}`} disabled={!!busyProperties[property.id]} className="h-9 w-9 p-0 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className={workspaceStyles.propertyMenu}>
<DropdownMenuItem onClick={()=>navigate(`/manage-property/${property.id}`)}>Property 360</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleView(property.id)}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            View Details
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleEdit(property.id)}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit Property
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          {property.listingType === 'rent' && (() => {
                                            const validTenants = property.tenants ? property.tenants.filter((t: any) => t.isActive && (t.firstName || t.lastName || t.phone || t.email)) : [];
                                            const hasValidTenants = validTenants.length > 0 || property.rentalStatus==='rented';
                                            return (
                                            <DropdownMenuItem onClick={() => handleAddTenant(property.id, hasValidTenants)}>
                                              {hasValidTenants ? (
                                                <>
                                                  <Eye className="h-4 w-4 mr-2" />
                                                  View Tenant Details ({validTenants.length})
                                                </>
                                              ) : (
                                                <>
                                                  <UserPlus className="h-4 w-4 mr-2" />
                                                  Add Tenant Info
                                                </>
                                              )}
                                            </DropdownMenuItem>
                                            );
                                          })()}
                                          <DropdownMenuItem onClick={() => handleRequestServices(property.id)}>
                                            <Wrench className="h-4 w-4 mr-2" />
                                            Request Services
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => navigate(`/inspection-report/${property.id}`)}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            Inspection Report
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => navigate(`/attach-documents/${property.id}?type=tds_report`)}>
                                            <FileText className="h-4 w-4 mr-2" />TDS Updation Report
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled={!property.tenants?.some((tenant:any)=>tenant.isActive===true)} onClick={() => navigate(`/review/${property.id}`)}>
                                            <Star className="h-4 w-4 mr-2" />
                                            Review
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => navigate(`/legal-services/${property.id}`)}>
                                            <Scale className="h-4 w-4 mr-2" />
                                            Legal Services
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => navigate(`/other-services/${property.id}`)}>
                                            <Wrench className="h-4 w-4 mr-2" />
                                            Other Related Services
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={() => navigate(`/attach-documents/${property.id}`)}>
                                            <Paperclip className="h-4 w-4 mr-2" />
                                            Attach Documents
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled={!hasEligibleAgreement(property)} onClick={() => navigate(`/renew-agreement/${property.id}`)}>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Go for Renewal
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            disabled={!hasEligibleAgreement(property)} onClick={() => navigate(`/terminate-agreement/${property.id}`)}
                                            className="text-red-600"
                                          >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Terminate Agreement
                                          </DropdownMenuItem>
                                          {property.status !== 'inactive' && property.isActive !== false && (
                                            <>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem
                                                className="text-orange-600"
                                                onClick={() => handleArchive(property.id)}
                                              >
                                                <Archive className="h-4 w-4 mr-2" />
                                                Archive Property
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu></div>{property.listingType==='rent'&&<div className={workspaceStyles.activeControl}><div className="flex items-center gap-2">
                                              <Switch
                                                id={`status-${property.id}`}
                                                checked={property.status !== 'inactive' && property.isActive!==false}
                                                disabled={!!busyProperties[property.id]}
                                                onCheckedChange={(checked) => handleToggleStatus(property.id, !checked)}
                                              />
                                              <Label
                                                htmlFor={`status-${property.id}`}
                                                className="text-xs text-muted-foreground cursor-pointer"
                                              >
                                                {property.status === 'inactive' ? 'Inactive' : 'Active'}
                                              </Label>
                                            </div></div>}{property.listingType === 'rent' && (
                                      <div className="ml-5 sm:ml-8 pt-2 border-t border-gray-100">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium">Want to Sell?<small className={workspaceStyles.toggleHelp}>Request a sale review; your listing purpose stays unchanged.</small></span>
                                          <button
                                            type="button" role="switch" aria-label={`Want to sell ${property.title}`} aria-checked={!!wantToSellToggles[property.id]} disabled={!!busyProperties[property.id]} className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${wantToSellToggles[property.id] ? 'bg-slate-800' : 'bg-gray-300'
                                              }`}
                                            onClick={() => {
                                              if(mutationLocks.current.has(property.id))return;
                                              const currentState = wantToSellToggles[property.id] || false;
                                              const newValue = !currentState;

                                              if (newValue) {
                                                const confirmed = window.confirm(
                                                  `Are you sure you want to mark "${property.title}" as "Want to Sell"?\n\nThis will notify the admin with your property and contact details.`
                                                );
                                                if (confirmed) {

                                                  handleToggleWantToSell(property.id, property.title, true);
                                                }
                                              } else {
                                                const confirmed = window.confirm(
                                                  `Are you sure you want to cancel the sell request for "${property.title}"?\n\nThe admin will be notified of this cancellation.`
                                                );
                                                if (confirmed) {

                                                  handleToggleWantToSell(property.id, property.title, false);
                                                }
                                              }
                                            }}
                                          >
                                            <span
                                              className={`inline-block h-3 w-3 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform ${wantToSellToggles[property.id] ? 'translate-x-5 sm:translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                          </button>
                                        </div>
                                      </div>
                                    )}</aside></CardContent>
                              </div>
                            </Card>
                          ))
                        ) : (
                          <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
                            {hasActiveFilters ? (
                              <p className="text-sm">No owned properties match your filters</p>
                            ) : (
                              <div>
                                <Building2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm">No properties owned yet. Click "Add Property" to get started.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                    ) : (
                      /* Tenant Properties Section */
                      <div className={workspaceStyles.portfolioGrid}>

                        {sortedTenantProperties.length > 0 ? (
                          sortedTenantProperties.map((property, index) => (
                            <Card key={property.id} className={`${workspaceStyles.propertyRow} transition-shadow overflow-hidden`}>
                              <div className={workspaceStyles.cardLayout}>
                                {/* Property Image Thumbnail - Always show with fallback */}
                                <div className={workspaceStyles.cover}>
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
                                  <Building2 className="h-12 w-12 text-gray-400" />
                                </div>
                                <CardContent className={workspaceStyles.cardBody}><div className={workspaceStyles.rowInformation}>
                                  <div className="flex flex-col space-y-3 sm:space-y-4">
                                    {/* Header with number and action menu */}
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-sm sm:text-lg leading-tight text-gray-900 break-words">
                                              {property.title}
                                              {property.unitNumber ? ` (${property.unitNumber})` : ""}
                                              {property.buildingName && property.buildingName.trim()!==property.title?.trim() && <span className="block text-sm font-normal">{property.buildingName}</span>}
                                              <span className="block text-xs font-normal">Property ID: {property.id}{property.agreementStatus ? ` ? ${property.agreementStatus.replaceAll("_"," ")}` : ""}{property.agreementRequest?.status==="pending" ? ` ? Pending ${property.agreementRequest.kind}` : ""}</span>
                                              <span className={workspaceStyles.address}>{formatPropertyAddress(property)}</span><span className={workspaceStyles.stateLabel}>{property.status==='inactive'||property.isActive===false?'Inactive':property.status==='active'||property.isActive===true?'Active':'Status not recorded'}</span>
                                            </h3>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              Tenant
                                            </Badge>
                                          </div>
                                          {property.moderationStatus&&<Badge variant="outline">Listing: {property.moderationStatus.replaceAll('_',' ')}</Badge>}
                                          {property.createdAs==='tenant'&&<OwnerVerificationStatus status={property.ownershipVerification} reason={property.ownershipVerificationReason}/>}
                                          {/* Show owner info */}
                                          {property.ownerName && (
                                            <p className="text-sm text-gray-600 mt-1">
                                              {property.ownerRole === "agent" ? "Agent" : "Owner"}: {property.ownerName}
                                            </p>
                                          )}

                                          <p className={workspaceStyles.price}>{formatPrice(property)}</p>
                                        </div>
                                      </div>
                                      {/* Action Menu for Tenants - Limited options */}

                                    </div>

                                    {/* Property Details */}
                                    <div className="ml-5 sm:ml-8 space-y-2">
                                      <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground items-center">
                                        <span className="flex items-center gap-1 whitespace-nowrap">
                                           {property.propertyType?.toUpperCase() || 'CATEGORY NOT RECORDED'}
                                        </span>
                                        {property.squareFeet > 0 && (
                                          <span className="flex items-center gap-1 whitespace-nowrap">
                                             {property.squareFeet} sqft
                                          </span>
                                        )}
                                        {property.listingType && (
                                          <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-xs whitespace-nowrap">
                                            {purposeLabel(property.listingType)}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                {property.updatedAt&&<p className={workspaceStyles.rowDate}>Last modified: {formatDisplayDate(property.updatedAt)} at {formatDisplayTime(property.updatedAt)}</p>}</div><aside className={workspaceStyles.rowActions} aria-label={`Actions for property ${property.title}`}><div className={workspaceStyles.actionTop}><button type="button" className={workspaceStyles.viewLink} onClick={() => handleView(property.id)}>View details <span aria-hidden="true">&rarr;</span></button><DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" aria-label={`Actions for ${property.title}`} disabled={!!busyProperties[property.id]} className="h-9 w-9 p-0 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className={workspaceStyles.propertyMenu}>
<DropdownMenuItem onClick={()=>navigate(`/manage-property/${property.id}`)}>Property 360</DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => handleView(property.id)}>
                                            <Eye className="h-4 w-4 mr-2" />
                                            View Details
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={() => handleRequestServices(property.id)}>
                                            <Wrench className="h-4 w-4 mr-2" />
                                            Request Services
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => navigate(`/inspection-report/${property.id}`)}>
                                            <FileText className="h-4 w-4 mr-2" />
                                            Inspection Report
                                          </DropdownMenuItem>
                                          {property.createdAs==='tenant'&&(!property.ownershipVerification||property.ownershipVerification==='pending')&&(
                                            <DropdownMenuItem onClick={()=>navigate(`/attach-documents/${property.id}?supporting=1`)}>
                                              <Paperclip className="h-4 w-4 mr-2" />
                                              Upload Supporting Documents
                                            </DropdownMenuItem>
                                          )}
                                          <DropdownMenuItem onClick={() => navigate(`/attach-documents/${property.id}?type=tds_report`)}>
                                            <FileText className="h-4 w-4 mr-2" />TDS Updation Report
                                          </DropdownMenuItem>
                                          <DropdownMenuItem disabled={!property.tenants?.some((tenant:any)=>tenant.isActive===true)} onClick={() => navigate(`/review/${property.id}`)}>
                                            <Star className="h-4 w-4 mr-2" />
                                            Review
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => navigate(`/other-services/${property.id}`)}>
                                            <Wrench className="h-4 w-4 mr-2" />
                                            Other Related Services
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem disabled={!hasEligibleAgreement(property)} onClick={() => navigate(`/renew-agreement/${property.id}`)}>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Request Renewal
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            disabled={!hasEligibleAgreement(property)} onClick={() => navigate(`/terminate-agreement/${property.id}`)}
                                            className="text-red-600"
                                          >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Request Termination
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu></div></aside></CardContent>
                              </div>
                            </Card>
                          ))
                        ) : (
                          <div className="text-center py-6 text-muted-foreground bg-purple-50/50 rounded-lg">
                            {hasActiveFilters ? (
                              <p className="text-sm">No tenant properties match your filters</p>
                            ) : (
                              <div>
                                <Users className="h-10 w-10 mx-auto mb-2 text-purple-300" />
                                <p className="text-sm">You are not listed as a tenant on any property.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Empty state when no properties in current view */}
                    {activeView === 'owned' && filteredOwnedProperties.length === 0 && hasActiveFilters && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="mb-2">No owned properties match your current filters</p>
                        <Button variant="outline" onClick={clearAllFilters}>
                          Clear Filters
                        </Button>
                      </div>
                    )}
                    {activeView === 'tenant' && filteredTenantProperties.length === 0 && hasActiveFilters && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="mb-2">No tenant properties match your current filters</p>
                        <Button variant="outline" onClick={clearAllFilters}>
                          Clear Filters
                        </Button>
                      </div>
                    )}
                  </>
                )}
          </div>

        </div>
        </section>
        {hasNextPage&&<p className={workspaceStyles.pagination} role="status">Showing loaded properties. Load more to view older records. <Button variant="outline" disabled={isFetchingNextPage} onClick={()=>void fetchNextPage()}>Load more properties</Button></p>}
        <BrokerEnquiries/>
      </div>
    </div>
  );
};

export default ManageProperty;
