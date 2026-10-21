"use client";

import { apiFetch } from '@/lib/api-client';

import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "@/lib/navigation";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Card, CardContent, CardHeader} from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Search, MapPin, BedDouble, Bath, Maximize, Loader2 } from "lucide-react";
import { propertyService, Property } from "@/services/propertyService";
import { useToast } from "@/hooks/use-toast";
import { auth } from "../../firebase";
import { API_BASE_URL } from "../../utils/config";

// Utility function to get placeholder image URL
const getPlaceholderImage = (propertyType?: string): string => {
  const type = propertyType?.toLowerCase() || 'property';
  
  if (type.includes('commercial')) {
    return 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=300&fit=crop&crop=building';
  } else if (type.includes('residential')) {
    return 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=300&fit=crop&crop=house';
  } else if (type.includes('industrial')) {
    return 'https://images.unsplash.com/photo-1565084888279-aca607ecce0c?w=400&h=300&fit=crop&crop=warehouse';
  } else {
    return 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop&crop=house';
  }
};

const getListingTypeBadge = (listingType?: string) => {
  if (listingType === 'rent') {
    return (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
        For Rent
      </Badge>
    );
  } else if (listingType === 'sell') {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
        For Sale
      </Badge>
    );
  }
  // Return null instead of "Unknown" badge when listingType is not set
  return null;
};

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchType, setSearchType] = useState<'buy' | 'rent'>(
    (searchParams.get('type') as 'buy' | 'rent') || 'buy'
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    searchParams.get('categories')?.split(',').filter(Boolean) || []
  );
  const [selectedListingTypes, setSelectedListingTypes] = useState<string[]>(
    searchParams.get('types')?.split(',').filter(Boolean) || []
  );
  const [selectedProjectCondition, setSelectedProjectCondition] = useState<string>(
    searchParams.get('projectCondition') || ''
  );
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sendingEnquiry, setSendingEnquiry] = useState<string | null>(null);

  // Load search results with filters
  const performSearch = async (overrides: {type?: 'buy' | 'rent'; condition?: string; query?: string} = {}) => {
    const type = overrides.type ?? searchType;
    const condition = overrides.condition ?? selectedProjectCondition;
    const query = overrides.query ?? searchQuery;
    try {
      setLoading(true);
      
      // Use the first selected listing type if available, otherwise use searchType
      let listingType: 'buy' | 'rent' | undefined = type;
      if (selectedListingTypes.length > 0) {
        listingType = selectedListingTypes[0] as 'buy' | 'rent';
      }
      
      let results = await propertyService.searchProperties(
        query,
        listingType,
        condition
      );
      
      // Client-side filtering by multiple listing types if needed
      if (selectedListingTypes.length > 1) {
        // If multiple listing types are selected, we need to search for each and combine
        const allResults = await Promise.all(
          selectedListingTypes.map(type => 
            propertyService.searchProperties(query, type as 'buy' | 'rent', condition)
          )
        );
        
        // Combine and deduplicate results
        const combinedResults = allResults.flat();
        const uniqueResults = combinedResults.filter((property, index, self) =>
          index === self.findIndex(p => p.id === property.id)
        );
        
        results = uniqueResults;
      }
      
      // Client-side filtering by categories if needed
      if (selectedCategories.length > 0) {
        results = results.filter(property =>
          selectedCategories.some(category =>
            property.propertyType?.toLowerCase().includes(category.toLowerCase())
          )
        );
      }

      setProperties(results);
      
      // Update URL params
      const newParams = new URLSearchParams();
      if (query.trim()) newParams.append('q', query.trim());
      if (type) newParams.append('type', type);
      if (selectedCategories.length > 0) newParams.append('categories', selectedCategories.join(','));
      if (selectedListingTypes.length > 0) newParams.append('types', selectedListingTypes.join(','));
      if (condition) newParams.append('projectCondition', condition);
      setSearchParams(newParams);
      
    } catch (error) {
      
      toast({
        title: "Search Error",
        description: "Failed to search properties. Please try again.",
        variant: "destructive",
      });
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial search on component mount
  useEffect(() => {
    performSearch();
  }, []); // Only run on mount

  // Handle search form submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const handleTypeChange = (newType: 'buy' | 'rent') => {
    setSearchType(newType);
    // Auto-search when type changes
    void performSearch({type: newType});
  };

  const handleEnquireProperty = async (property: Property) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "Please login to enquire about properties.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setSendingEnquiry(property.id);
    try {
      // Prepare notification payload with all required fields
      const notificationPayload = {
        type: 'property_enquiry',
        title: 'Property Enquiry Request',
        message: `User ${currentUser.displayName || currentUser.email || 'Unknown User'} is interested in property: ${property.title || property.id}`,
        propertyId: property.id || '',
        ownerId: property.ownerUID || '',
        ownerName: property.ownerName || 'Unknown Owner',
        ownerPhone: property.ownerPhone || property.primaryNo || '',
        ownerEmail: property.ownerEmail || '',
        // User details (person who enquired) - currently logged in user
        userId: currentUser.uid || '',
        userName: currentUser.displayName || currentUser.email || 'Unknown User',
        userEmail: currentUser.email || '',
        userPhone: currentUser.phoneNumber || '',
        // Property details
        propertyTitle: property.title || '',
        propertyAddress: property.address || property.city || 'Not specified',
        propertyListingType: property.listingType || 'rent',
        // Tenant info if available
        tenantName: property.tenants && property.tenants.length > 0 ? `${property.tenants[0].firstName} ${property.tenants[0].lastName}` : '',
        tenantEmail: property.tenants && property.tenants.length > 0 ? property.tenants[0].email : '',
        tenantPhone: property.tenants && property.tenants.length > 0 ? property.tenants[0].phone : '',
        // Buyers info if available
        buyers: property.buyers && property.buyers.length > 0 ? JSON.stringify(property.buyers) : '',
        timestamp: new Date().toISOString(),
        isRead: false,
        priority: 'high'
      };

      const notificationResponse = await apiFetch(`${API_BASE_URL}/admin/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
      });

      const notificationData = await notificationResponse.json();

      if (notificationData.success) {
        toast({
          title: "Enquiry Sent",
          description: "Your enquiry has been sent to the admin. They will contact you soon.",
        });
      } else {
        throw new Error(notificationData.message || 'Failed to send enquiry');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send enquiry. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSendingEnquiry(null);
    }
  };

  const formatPrice = (property: Property): string => {
    const isRent = property.listingType === 'rent' || searchType === 'rent';
    const priceVal = property.price > 0
      ? property.price
      : isRent && property.monthlyRent
      ? parseInt(property.monthlyRent)
      : !isRent && property.sellingPrice
      ? parseInt(property.sellingPrice)
      : 0;

    if (priceVal === 0) return 'Price on request';

    if (isRent) {
      return `Rent this property at ₹${priceVal.toLocaleString('en-IN')}/month`;
    } else {
      return `Buy at ₹${priceVal.toLocaleString('en-IN')}`;
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <>
        <title>Search Properties — ShoPROP</title>
        <meta name="description" content="Search and find properties for rent or purchase on ShoPROP." />
        <link rel="canonical" href="/search" />
      </>

      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
              <Search className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">Property Search</h1>
          </div>
          <p className="text-muted-foreground">
            Find your perfect property by location, features, or property type
          </p>
        </div>

        {/* Search Form */}
        <Card className="w-full max-w-4xl mx-auto">
          <CardContent className="p-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search Type Selection */}
                <div className="md:w-48">
                  <Select value={searchType} onValueChange={handleTypeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy Properties</SelectItem>
                      <SelectItem value="rent">Rent Properties</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Search Input */}
                <div className="flex-1">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by location, property type, or features (e.g., 2BHK, 3BHK, Mumbai, Apartment)..."
                    className="w-full"
                  />
                </div>

                {/* Project Condition Filter */}
                <div className="md:w-52">
                  <Select 
                    value={selectedProjectCondition || 'all'}
                    onValueChange={(value) => {
                      const condition=value==='all'?'':value;
                      setSelectedProjectCondition(condition);
                      void performSearch({condition});
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Project Condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Conditions</SelectItem>
                      <SelectItem value="New Project">New Project</SelectItem>
                      <SelectItem value="Ready Project">Ready Project</SelectItem>
                      <SelectItem value="Preleased">Preleased</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Search Button */}
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="md:w-auto w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results Section */}
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Search Results</h2>
              <p className="text-muted-foreground">
                {loading ? 'Searching...' : `Found ${properties.length} properties`}
                {searchQuery && ` for "${searchQuery}"`}
                {selectedCategories.length > 0 && ` in ${selectedCategories.join(', ')} categories`}
                {selectedListingTypes.length > 0 && ` for ${selectedListingTypes.join(' and ')} listings`}
                {selectedProjectCondition && ` with ${selectedProjectCondition} condition`}
              </p>
            </div>
          </div>

          {/* Active Filters Display */}
          {(selectedCategories.length > 0 || selectedListingTypes.length > 0 || selectedProjectCondition) && (
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {selectedCategories.map(category => (
                  <Badge key={category} variant="secondary" className="capitalize">
                    {category}
                  </Badge>
                ))}
                {selectedListingTypes.map(type => (
                  <Badge key={type} variant="outline" className="capitalize">
                    For {type}
                  </Badge>
                ))}
                {selectedProjectCondition && (
                  <Badge variant="default" className="bg-blue-600 text-white hover:bg-blue-700">
                    {selectedProjectCondition}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Results Grid */}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-16 w-16 mx-auto text-muted-foreground mb-4 animate-spin" />
              <h3 className="text-lg font-semibold mb-2">Searching Properties...</h3>
              <p className="text-muted-foreground">Please wait while we find the best matches</p>
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Properties Found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or browse all properties
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="outline" onClick={() => { setSearchQuery(''); void performSearch({query: ''}); }}>
                  Show All Properties
                </Button>
                <Button variant="outline" asChild>
                  <Link to={searchType === 'buy' ? '/buy' : '/rent'}>
                    Browse {searchType === 'buy' ? 'Sale' : 'Rental'} Properties
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <Card key={property.id} className="group hover:shadow-lg transition-all duration-200 flex flex-col h-full">
                  <CardHeader className="p-0">
                    {/* Property Image */}
                    <div className="relative h-48 bg-muted rounded-t-lg overflow-hidden">
                      <img
                        src={
                          property.images && property.images.length > 0 && property.images[0] 
                            ? property.images[0] 
                            : getPlaceholderImage(property.propertyType)
                        }
                        alt={property.title || 'Property Image'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          // If the original image fails, try the placeholder
                          if (target.src !== getPlaceholderImage(property.propertyType)) {
                            target.src = getPlaceholderImage(property.propertyType);
                          } else {
                            // If placeholder also fails, show the animated house fallback
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) {
                              fallback.style.display = 'flex';
                            }
                          }
                        }}
                      />
                      <div 
                        className="w-full h-full hidden items-center justify-center bg-gradient-to-br from-muted/50 to-muted"
                        style={{ 
                          background: property.propertyType?.toLowerCase().includes('commercial') 
                            ? 'linear-gradient(135deg, #f0f9ff, #e0e7ff)' 
                            : property.propertyType?.toLowerCase().includes('residential')
                            ? 'linear-gradient(135deg, #fef7cd, #fef3c7)'
                            : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)'
                        }}
                      >
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground/80 font-medium mt-2 capitalize">
                            {property.propertyType || 'Property'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Listing Type Badge */}
                      {property.listingType && (
                        <div className="absolute top-3 right-3">
                          {getListingTypeBadge(property.listingType)}
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 flex-1 flex flex-col space-y-4">
                    {/* Title and Price */}
                     <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-col">
                          <h3 className="font-bold text-base sm:text-lg line-clamp-2 text-slate-800 uppercase">
                            {property.title || 'Property'}
                          </h3>
                          {property.configuration && (
                            <span className="text-xs sm:text-sm font-semibold text-slate-500 uppercase mt-0.5">
                              Configuration: {property.configuration}
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="capitalize shrink-0 text-xs py-0.5 px-2 bg-slate-100 border-slate-200 text-slate-600">
                          {property.propertyType || 'Property'}
                        </Badge>
                      </div>
                      <p className="text-sm font-bold text-primary">
                        {formatPrice(property)}
                      </p>
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-muted-foreground text-sm line-clamp-2">
                        {property.address || property.city || 'Location not specified'}
                      </p>
                    </div>

                    {/* Property Details */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {property.bedrooms > 0 && (
                        <div className="flex items-center gap-1">
                          <BedDouble className="h-4 w-4" />
                          <span>{property.bedrooms} Beds</span>
                        </div>
                      )}
                      {property.bathrooms > 0 && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-4 w-4" />
                          <span>{property.bathrooms} Baths</span>
                        </div>
                      )}
                      {property.squareFeet > 0 && (
                        <div className="flex items-center gap-1">
                          <Maximize className="h-4 w-4" />
                          <span>{property.squareFeet} sq ft</span>
                        </div>
                      )}
                    </div>

                    {/* Spacer to push content to bottom */}
                    <div className="flex-1"></div>

                    {/* Property Enquiry */}
                    <div className="pt-4 border-t mt-auto">
                      <p className="text-sm font-medium mb-2">Property Enquiry</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {property.ownerRole === "agent" ? "Agent" : "Owner"}: {property.ownerName}
                        </span>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => handleEnquireProperty(property)}
                            disabled={sendingEnquiry === property.id}
                          >
                            {sendingEnquiry === property.id ? "Sending..." : "Enquire Now"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* View Details Button */}
                    <Button asChild className="w-full">
                      <Link to={`/property/${property.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default SearchResults;
