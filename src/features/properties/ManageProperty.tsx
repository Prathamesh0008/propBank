"use client";

import { apiFetch } from '@/lib/api-client';

import { Building2, Plus, Edit3, MessageSquare, MoreVertical, Users, UserPlus, Eye, Edit, Archive, Wrench, Filter, Home, X, FileText, Star, Scale, Paperclip, RefreshCw, XCircle, Key } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { useNavigate } from "@/lib/navigation";
import { useEffect, useState, useMemo } from "react";
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
  internalImages?: string[];
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
  const { data: propertiesData, isLoading: loading } = useUserProperties(user);

  const ownedProperties = useMemo(() => propertiesData?.owned || [], [propertiesData?.owned]);
  const tenantProperties = useMemo(() => propertiesData?.tenant || [], [propertiesData?.tenant]);

  const [filteredOwnedProperties, setFilteredOwnedProperties] = useState<Property[]>([]);
  const [filteredTenantProperties, setFilteredTenantProperties] = useState<Property[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>("");
  const [selectedListingType, setSelectedListingType] = useState<string>("");

  // View toggle state - 'owned' or 'tenant'
  const [activeView, setActiveView] = useState<'owned' | 'tenant'>('owned');
  const [showAddPropertyOptions, setShowAddPropertyOptions] = useState(false);

  // Toggle states for "Want to Sell" - default false for all properties
  const [wantToSellToggles, setWantToSellToggles] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (ownedProperties.length > 0) {
      const initialToggles: { [key: string]: boolean } = {};
      ownedProperties.forEach((p: Property) => {
        initialToggles[p.id] = p.wantToSell || false;
      });
      setWantToSellToggles(initialToggles);
    }
  }, [ownedProperties]);

  // Filter properties based on current filter criteria
  const applyFilters = () => {
    const filterList = (properties: Property[]) => {
      let filtered = [...properties];

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(property =>
          property.title?.toLowerCase().includes(query) ||
          property.address?.toLowerCase().includes(query) ||
          property.city?.toLowerCase().includes(query) ||
          property.description?.toLowerCase().includes(query)
        );
      }

      // Filter by property type
      if (selectedPropertyType && selectedPropertyType !== "all") {
        filtered = filtered.filter(property =>
          property.propertyType?.toLowerCase() === selectedPropertyType.toLowerCase()
        );
      }

      // Filter by listing type
      if (selectedListingType && selectedListingType !== "all") {
        filtered = filtered.filter(property =>
          property.listingType?.toLowerCase() === selectedListingType.toLowerCase()
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

  const totalProperties = ownedProperties.length + tenantProperties.length;
  const totalFilteredProperties = filteredOwnedProperties.length + filteredTenantProperties.length;

  const formatPrice = (property: any) => {
    // Helper function to get a valid price value
    const getValidPrice = (value: any): number => {


      if (!value) return 0;
      if (value === "") return 0;

      let numValue: number;
      if (typeof value === 'string') {
        // Remove any currency symbols, commas, or spaces
        const cleanValue = value.replace(/[₹,$\s]/g, '');
        numValue = parseFloat(cleanValue);
      } else {
        numValue = Number(value);
      }

      const result = isNaN(numValue) ? 0 : numValue;

      return result;
    };

    if (property.listingType === 'rent') {
      // Try multiple possible field names for monthly rent
      const monthlyRent = getValidPrice(property.monthlyRent) ||
        getValidPrice(property.monthly_rent) ||
        getValidPrice(property.price);

      if (monthlyRent > 0) {
        return `₹${monthlyRent.toLocaleString()}/month`;
      }
    } else if (property.listingType === 'sell') {
      // Try multiple possible field names for selling price
      const sellingPrice = getValidPrice(property.sellingPrice) ||
        getValidPrice(property.selling_price) ||
        getValidPrice(property.price);



      if (sellingPrice > 0) {
        return `₹${sellingPrice.toLocaleString()}`;
      }
    }

    // Final fallback to price field
    const genericPrice = getValidPrice(property.price);
    if (genericPrice > 0) {
      return `₹${genericPrice.toLocaleString()}`;
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

  const getPropertyThumbnail = (property: Property) => {
    return property.images?.find(Boolean) || property.internalImages?.find(Boolean) || "";
  };

  const handleEdit = (propertyId: string) => {
    // Navigate to edit property page
    navigate(`/edit-property/${propertyId}`);
  };

  const handleView = (propertyId: string) => {
    // Navigate to property details page
    navigate(`/property/${propertyId}`);
  };

  const handleToggleStatus = async (propertyId: string, isInactive: boolean) => {
    if (!user) return;

    try {

      const updateData = {
        ownerUID: user.uid,
        status: isInactive ? 'inactive' : 'active', // Set status to 'inactive' or 'active'
        // isActive remains unchanged - keep independent from status
        rentalStatus: isInactive ? 'inactive' : 'available'
      };


      const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();


      if (data.success) {
        toast({
          title: "Success",
          description: isInactive
            ? "Property set to inactive and archived"
            : "Property set to active and unarchived"
        });
        // Refresh properties list (this will filter out inactive properties)
        queryClient.invalidateQueries({ queryKey: ['userProperties'] });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update property status",
          variant: "destructive"
        });
      }
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to update property status. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleArchive = async (propertyId: string) => {
    if (!user) return;

    try {
      const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerUID: user.uid,
          status: 'inactive', // Set status to 'inactive'
          // isActive remains unchanged - keep independent from status
          rentalStatus: 'inactive'
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Property archived successfully"
        });
        // Refresh properties list
        queryClient.invalidateQueries({ queryKey: ['userProperties'] });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to archive property",
          variant: "destructive"
        });
      }
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to archive property. Please try again.",
        variant: "destructive"
      });
    }
  };

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

  const handleToggleWantToSell = async (propertyId: string, propertyTitle: string, newValue: boolean) => {
    if (!user) return;

    try {
      const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerUID: user.uid,
          wantToSell: newValue
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: newValue
            ? "Admin has been notified that you want to sell this property"
            : "Admin has been notified that you cancelled the sell request"
        });

        // Update local toggle state
        setWantToSellToggles(prev => ({
          ...prev,
          [propertyId]: newValue
        }));

        // Refresh properties list
        queryClient.invalidateQueries({ queryKey: ['userProperties'] });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to update property",
          variant: "destructive"
        });
        // Revert toggle state on error
        setWantToSellToggles(prev => ({
          ...prev,
          [propertyId]: !newValue
        }));
      }
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to update property. Please try again.",
        variant: "destructive"
      });
      // Revert toggle state on error
      setWantToSellToggles(prev => ({
        ...prev,
        [propertyId]: !newValue
      }));
    }
  };

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
    <main className="container mx-auto py-4 sm:py-8 px-4">
      <>
        <title>Manage Property — ShoPROP</title>
        <meta name="description" content="Manage your property listings, update property details, unit numbers, and building information." />
        <link rel="canonical" href="/manage-property" />
      </>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-primary/10 text-primary flex-shrink-0">
                <Building2 className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Manage Your Properties</h1>
                <p className="text-sm sm:text-base text-muted-foreground mt-1">Property Management Hub</p>
              </div>
            </div>
            
            <div className="flex-shrink-0 w-full sm:w-auto flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
              <div className="relative w-full sm:w-auto">
                <Button
                  className="w-full sm:w-auto px-6 shadow-sm"
                  aria-expanded={showAddPropertyOptions}
                  onClick={() => setShowAddPropertyOptions((open) => !open)}
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                </Button>
                {showAddPropertyOptions && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-full min-w-[12rem] overflow-hidden rounded-md border bg-background p-1 text-foreground shadow-lg sm:w-48">
                    <button
                      type="button"
                      className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                      onClick={() => {
                        setShowAddPropertyOptions(false);
                        navigate("/select-property-type?role=owner");
                      }}
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      As a Owner
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                      onClick={() => {
                        setShowAddPropertyOptions(false);
                        navigate("/select-property-type?role=tenant");
                      }}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      As a Tenant
                    </button>
                  </div>
                )}
              </div>
              <Button
                className="w-full sm:w-auto px-6 shadow-sm"
                variant="outline"
                onClick={() => navigate("/archived-properties")}
              >
                <Archive className="h-4 w-4 mr-2" />
                Archived
              </Button>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="mb-8 border shadow-sm">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
              
              {/* View Toggle */}
              <div className="flex bg-muted/50 p-1 rounded-lg self-start sm:self-auto w-full sm:w-auto">
                <button
                  className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeView === 'owned' 
                      ? 'bg-background shadow-sm text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveView('owned')}
                >
                  <Building2 className="h-4 w-4 mr-2 hidden sm:block" />
                  Owned
                  <Badge variant="secondary" className={`ml-2 border-none ${activeView === 'owned' ? 'bg-primary/10 text-primary' : ''}`}>
                    {filteredOwnedProperties.length}
                  </Badge>
                </button>
                <button
                  className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeView === 'tenant' 
                      ? 'bg-background shadow-sm text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveView('tenant')}
                >
                  <Key className="h-4 w-4 mr-2 hidden sm:block" />
                  Tenant
                  <Badge variant="secondary" className={`ml-2 border-none ${activeView === 'tenant' ? 'bg-primary/10 text-primary' : ''}`}>
                    {filteredTenantProperties.length}
                  </Badge>
                </button>
              </div>

              {/* Type Filters */}
              <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto">
                 <div className="flex items-center gap-3 w-full sm:w-auto">
                   <span className="text-sm font-medium text-muted-foreground whitespace-nowrap hidden sm:block">Property Type</span>
                   <Select value={selectedPropertyType || "all"} onValueChange={(v) => setSelectedPropertyType(v === "all" ? "" : v)}>
                     <SelectTrigger className="w-full sm:w-[150px] bg-background">
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
                     <SelectTrigger className="w-full sm:w-[150px] bg-background">
                       <SelectValue placeholder="All Listings" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="all">All Listings</SelectItem>
                       <SelectItem value="rent">For Rent</SelectItem>
                       <SelectItem value="sell">For Sale</SelectItem>
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
                        {selectedListingType === "rent" ? "For Rent" : "For Sale"}
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

          {/* Properties List */}
          <div className="space-y-8 pb-20">
            {!user ? (
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
                : (
                  <>
                     {/* Show section based on active view */}
                    {activeView === 'owned' ? (
                      /* Owned Properties Section */
                      <div className="space-y-4">

                        {sortedOwnedProperties.length > 0 ? (
                          sortedOwnedProperties.map((property, index) => (
                            <Card key={property.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                              <div className="flex flex-col sm:flex-row">
                                {/* Property Image Thumbnail - Always show with fallback */}
                                <div className="w-full sm:w-40 h-32 sm:h-auto flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden flex items-center justify-center">
                                  {getPropertyThumbnail(property) ? (
                                    <img
                                      src={getPropertyThumbnail(property)}
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
                                <CardContent className="p-3 sm:p-6 flex-1">
                                  <div className="flex flex-col space-y-3 sm:space-y-4">
                                    {/* Header with number and action menu */}
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                        <span className="text-base sm:text-lg font-semibold text-muted-foreground flex-shrink-0 mt-0.5">{index + 1}.</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-sm sm:text-lg leading-tight text-gray-900 break-words">
                                              {property.title}
                                              {property.unitNumber ? ` (${property.unitNumber})` : ""}
                                              {property.address ? `, ${property.address}` : ""}
                                            </h3>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              Owner
                                            </Badge>
                                          </div>
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
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-gray-100 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
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
                                            const hasValidTenants = validTenants.length > 0;
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
                                          <DropdownMenuItem onClick={() => navigate(`/review/${property.id}`)}>
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
                                          <DropdownMenuItem onClick={() => navigate(`/edit-property/${property.id}?mode=renewal`)}>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Go for Renewal
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => navigate(`/terminate-agreement/${property.id}`)}
                                            className="text-red-600"
                                          >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Terminate Agreement
                                          </DropdownMenuItem>
                                          {property.rentalStatus === 'inactive' && (
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
                                      </DropdownMenu>
                                    </div>

                                    {/* Property Details */}
                                    <div className="ml-5 sm:ml-8 space-y-2">
                                      <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground items-center">
                                        <span className="flex items-center gap-1 whitespace-nowrap">
                                          🏠 {property.propertyType.toUpperCase()}
                                        </span>
                                        {property.squareFeet > 0 && (
                                          <span className="flex items-center gap-1 whitespace-nowrap">
                                            📐 {property.squareFeet} sqft
                                          </span>
                                        )}
                                        {property.updatedAt && (
                                          <span className="hidden sm:flex items-center gap-1 whitespace-nowrap">
                                            📅 Last modified: {new Date(property.updatedAt).toLocaleDateString()} at {new Date(property.updatedAt).toLocaleTimeString()}
                                          </span>
                                        )}
                                        {property.listingType === 'rent' && (
                                          <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-2">
                                              <Switch
                                                id={`status-${property.id}`}
                                                checked={property.status === 'inactive'}
                                                onCheckedChange={(checked) => handleToggleStatus(property.id, checked)}
                                              />
                                              <Label
                                                htmlFor={`status-${property.id}`}
                                                className="text-xs text-muted-foreground cursor-pointer"
                                              >
                                                {property.status === 'inactive' ? 'Inactive' : 'Active'}
                                              </Label>
                                            </div>
                                            {property.status && property.status !== 'inactive' && (() => {
                                              const validTenants = property.tenants ? property.tenants.filter((t: any) => t.isActive && (t.firstName || t.lastName || t.phone || t.email)) : [];
                                              const hasValidTenants = validTenants.length > 0;
                                              return (
                                              <Badge variant="outline" className={
                                                hasValidTenants
                                                  ? 'bg-orange-50 text-orange-700 border-orange-200 text-xs whitespace-nowrap'
                                                  : 'bg-green-50 text-green-700 border-green-200 text-xs whitespace-nowrap'
                                              }>
                                                {hasValidTenants
                                                  ? 'Currently Rented'
                                                  : 'Available for Rent'}
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
                                            {property.listingType === 'rent' ? 'Rent' : property.listingType === 'sell' ? 'Sell' : property.listingType}
                                          </Badge>
                                        )}
                                      </div>
                                      {property.updatedAt && (
                                        <div className="sm:hidden text-xs text-muted-foreground">
                                          📅 Last modified: {new Date(property.updatedAt).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>

                                    {/* Want to Sell Toggle - Only for rent properties owned by user */}
                                    {property.listingType === 'rent' && (
                                      <div className="ml-5 sm:ml-8 pt-2 border-t border-gray-100">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">Want to Sell?</span>
                                          <button
                                            className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${wantToSellToggles[property.id] ? 'bg-slate-800' : 'bg-gray-300'
                                              }`}
                                            onClick={() => {
                                              const currentState = wantToSellToggles[property.id] || false;
                                              const newValue = !currentState;

                                              if (newValue) {
                                                const confirmed = window.confirm(
                                                  `Are you sure you want to mark "${property.title}" as "Want to Sell"?\n\nThis will notify the admin with your property and contact details.`
                                                );
                                                if (confirmed) {
                                                  setWantToSellToggles(prev => ({ ...prev, [property.id]: true }));
                                                  handleToggleWantToSell(property.id, property.title, true);
                                                }
                                              } else {
                                                const confirmed = window.confirm(
                                                  `Are you sure you want to cancel the sell request for "${property.title}"?\n\nThe admin will be notified of this cancellation.`
                                                );
                                                if (confirmed) {
                                                  setWantToSellToggles(prev => ({ ...prev, [property.id]: false }));
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
                                    )}
                                  </div>
                                </CardContent>
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
                      <div className="space-y-4">

                        {sortedTenantProperties.length > 0 ? (
                          sortedTenantProperties.map((property, index) => (
                            <Card key={property.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                              <div className="flex flex-col sm:flex-row">
                                {/* Property Image Thumbnail - Always show with fallback */}
                                <div className="w-full sm:w-40 h-32 sm:h-auto flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden flex items-center justify-center">
                                  {getPropertyThumbnail(property) ? (
                                    <img
                                      src={getPropertyThumbnail(property)}
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
                                <CardContent className="p-3 sm:p-6 flex-1">
                                  <div className="flex flex-col space-y-3 sm:space-y-4">
                                    {/* Header with number and action menu */}
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                                        <span className="text-base sm:text-lg font-semibold text-muted-foreground flex-shrink-0 mt-0.5">{index + 1}.</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-sm sm:text-lg leading-tight text-gray-900 break-words">
                                              {property.title}
                                              {property.unitNumber ? ` (${property.unitNumber})` : ""}
                                              {property.address ? `, ${property.address}` : ""}
                                            </h3>
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              Tenant
                                            </Badge>
                                          </div>
                                          {/* Show owner info */}
                                          {property.ownerName && (
                                            <p className="text-sm text-gray-600 mt-1">
                                              {property.ownerRole === "agent" ? "Agent" : "Owner"}: {property.ownerName}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {/* Action Menu for Tenants - Limited options */}
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-9 sm:w-9 p-0 hover:bg-gray-100 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
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
                                          <DropdownMenuItem onClick={() => navigate(`/review/${property.id}`)}>
                                            <Star className="h-4 w-4 mr-2" />
                                            Review
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => navigate(`/other-services/${property.id}`)}>
                                            <Wrench className="h-4 w-4 mr-2" />
                                            Other Related Services
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem onClick={() => navigate(`/renew-agreement/${property.id}`)}>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Request Renewal
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => navigate(`/terminate-agreement/${property.id}`)}
                                            className="text-red-600"
                                          >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Request Termination
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>

                                    {/* Property Details */}
                                    <div className="ml-5 sm:ml-8 space-y-2">
                                      <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground items-center">
                                        <span className="flex items-center gap-1 whitespace-nowrap">
                                          🏠 {property.propertyType.toUpperCase()}
                                        </span>
                                        {property.squareFeet > 0 && (
                                          <span className="flex items-center gap-1 whitespace-nowrap">
                                            📐 {property.squareFeet} sqft
                                          </span>
                                        )}
                                        {property.listingType && (
                                          <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-xs whitespace-nowrap">
                                            {property.listingType === 'rent' ? 'Rent' : property.listingType === 'sell' ? 'Sell' : property.listingType}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
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
      </div>
    </main>
  );
};

export default ManageProperty;
