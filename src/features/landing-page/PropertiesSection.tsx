"use client";

import React from "react";
import { Link } from "@/lib/navigation";
import { Loader2, Home, MapPin } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Badge } from "@/ui/badge";
import PropertyDetailsDialog from "@/features/properties/PropertyDetailsDialog";
import { Property } from "@/services/propertyService";

interface PropertiesSectionProps {
  properties: Property[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMoreProperties: () => void;
  isSearching: boolean;
  selectedCategories: string[];
  searchQuery: string;
  searchType: string;
  selectedProjectCondition: string;
  budgetRange: { min: number; max: number };
  filteredCount: number;
  sendingEnquiry: string | null;
  handleEnquireProperty: (property: Property) => Promise<void>;
  observerTargetRef: React.RefObject<HTMLDivElement>;
}

const getPlaceholderImage = (propertyType?: string): string => {
  const type = propertyType?.toLowerCase() || 'property';

  if (type.includes('commercial')) {
    return 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
  } else if (type.includes('residential')) {
    return 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
  } else if (type.includes('industrial')) {
    return 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
  } else {
    return 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80';
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
  return null;
};

export const PropertiesSection: React.FC<PropertiesSectionProps> = ({
  properties,
  loading,
  loadingMore,
  hasMore,
  loadMoreProperties,
  isSearching,
  selectedCategories,
  searchQuery,
  searchType,
  selectedProjectCondition,
  budgetRange,
  filteredCount,
  sendingEnquiry,
  handleEnquireProperty,
  observerTargetRef,
}) => {
  return (
    <section aria-label="Properties" className="py-16 px-4 bg-background">
      <div className="container mx-auto space-y-8 px-4">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold">
            {isSearching || selectedCategories.length > 0 ? 'Filtered Results' : 'Featured Properties'}
          </h2>
          <p className="text-muted-foreground">
            {isSearching || selectedCategories.length > 0 || selectedProjectCondition || budgetRange.min > 0 || budgetRange.max > 0
              ? `Found ${filteredCount} properties${searchQuery ? ` matching "${searchQuery}"` : ''}${
                  selectedCategories.length > 0 ? ` in ${selectedCategories.join(', ')} categories` : ''
                }${selectedProjectCondition ? ` with ${selectedProjectCondition} condition` : ''}${
                  budgetRange.min > 0 || budgetRange.max > 0
                    ? ` in budget range ₹${
                        searchType === 'rent'
                          ? `${budgetRange.min > 0 ? `${(budgetRange.min / 1000).toFixed(0)}K` : '0'} - ${
                              budgetRange.max > 0 ? `${(budgetRange.max / 1000).toFixed(0)}K` : '∞'
                            }/month`
                          : `${budgetRange.min > 0 ? `${(budgetRange.min / 100000).toFixed(0)}L` : '0'} - ${
                              budgetRange.max > 0 ? `${(budgetRange.max / 100000).toFixed(0)}L` : '∞'
                            }`
                      }`
                    : ''
                }`
              : 'Discover some of our best properties available now'}
          </p>
        </div>

        {/* Properties Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-16 w-16 mx-auto text-muted-foreground mb-4 animate-spin" />
            <h3 className="text-lg font-semibold mb-2">Loading Properties...</h3>
            <p className="text-muted-foreground">Please wait while we fetch the latest properties</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-12">
            <Home className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Properties Available</h3>
            <p className="text-muted-foreground mb-4">Check back later for new property listings</p>
            <Button asChild variant="outline">
              <Link to="/search">Browse All Properties</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 px-2">
              {properties.map((property) => (
                <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow group flex flex-col h-full p-2">
                  {/* Property Image */}
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={
                        property.images && property.images.length > 0 && property.images[0]
                          ? property.images[0]
                          : getPlaceholderImage(property.propertyType)
                      }
                      alt={property.title || 'Property'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== getPlaceholderImage(property.propertyType)) {
                          target.src = getPlaceholderImage(property.propertyType);
                        } else {
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) {
                            fallback.style.display = 'flex';
                          }
                        }
                      }}
                    />
                    <div
                      className="w-full h-full hidden items-center justify-center"
                      style={{
                        background: property.propertyType?.toLowerCase().includes('commercial')
                          ? 'linear-gradient(135deg, #f0f9ff, #e0e7ff)'
                          : property.propertyType?.toLowerCase().includes('residential')
                          ? 'linear-gradient(135deg, #fef7cd, #fef3c7)'
                          : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                      }}
                    >
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground/80 font-medium mt-2 capitalize">
                          {property.propertyType || 'Property'}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">No Image Available</p>
                      </div>
                    </div>

                    {/* Listing Type Badge */}
                    {property.listingType && (
                      <div className="absolute top-3 left-3">{getListingTypeBadge(property.listingType)}</div>
                    )}
                  </div>

                  <CardContent className="pt-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Title and Category Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col">
                          <h3 className="font-bold text-base sm:text-lg line-clamp-2 text-slate-800 uppercase">
                            {property.title || 'Property'}
                          </h3>
                          {property.configuration && (
                            <span className="text-xs sm:text-sm font-semibold text-slate-500 uppercase mt-0.5">
                              {property.configuration}
                            </span>
                          )}
                          {(property.address || property.city) && (
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1 uppercase font-semibold">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{property.address || property.city}</span>
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="capitalize shrink-0 text-xs py-0.5 px-2 bg-slate-100 border-slate-200 text-slate-600">
                          {property.propertyType || 'Property'}
                        </Badge>
                      </div>


                      {/* Pricing Sentence */}
                      <div className="text-sm font-bold text-primary">
                        {property.listingType === 'rent' ? (
                          <span>
                            Rent this property at ₹
                            {(property.price > 0
                              ? property.price
                              : property.monthlyRent
                              ? parseInt(property.monthlyRent)
                              : 0
                            ).toLocaleString('en-IN')}
                            /month
                          </span>
                        ) : (
                          <span>
                            Buy at ₹
                            {(property.price > 0
                              ? property.price
                              : property.sellingPrice
                              ? parseInt(property.sellingPrice)
                              : 0
                            ).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Buttons Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
                      <PropertyDetailsDialog property={property} />

                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleEnquireProperty(property)}
                        disabled={sendingEnquiry === property.id}
                      >
                        {sendingEnquiry === property.id ? "Sending..." : "Enquire Now"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Infinite Scroll Trigger */}
            <div ref={observerTargetRef} className="flex justify-center py-8">
              {loadingMore ? (
                <div className="text-center">
                  <Loader2 className="h-8 w-8 mx-auto text-muted-foreground mb-2 animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading more properties...</p>
                </div>
              ) : hasMore ? (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Scroll down for more properties</p>
                  <Button onClick={loadMoreProperties} variant="outline" size="sm">
                    Load More
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {properties.length > 0 ? "You've reached the end of the results" : "No more properties to show"}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
