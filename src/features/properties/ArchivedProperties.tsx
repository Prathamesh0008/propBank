"use client";

import { apiFetch } from '@/lib/api-client';

import { Building2, Archive, ArrowLeft, Eye, Edit, MoreVertical } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { useNavigate } from "@/lib/navigation";
import { useEffect, useState } from "react";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Badge } from "@/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "../../utils/config";
import { useArchivedProperties } from "../../hooks/useProperties";

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
  listingType: string;
  monthlyRent: string;
  sellingPrice: string;
  squareFeet: number;
  images: string[];
  rentalStatus?: string;
  ownerUID: string;
  ownerName: string;
  ownerEmail: string;
  status: string; // 'active' or 'inactive' (default: 'active')
  isActive: boolean; // Legacy field, kept for backward compatibility
  createdAt: string;
  updatedAt: string;
  unitNumber?: string;
}

const ArchivedProperties = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  
  const { data: propertiesData, isLoading: loading, refetch } = useArchivedProperties(user?.uid);
  const properties = propertiesData || [];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);



  const handleView = (propertyId: string) => {
    navigate(`/property/${propertyId}`);
  };

  const handleEdit = (propertyId: string) => {
    navigate(`/edit-property/${propertyId}`);
  };

  const handleUnarchive = async (propertyId: string) => {
    if (!user) return;
    
    try {
      const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ownerUID: user.uid,
          status: 'active', // Set status to 'active'
          // isActive remains unchanged - keep independent from status
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Property unarchived successfully"
        });
        // Refresh properties list
        await refetch();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to unarchive property",
          variant: "destructive"
        });
      }
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to unarchive property. Please try again.",
        variant: "destructive"
      });
    }
  };

  const formatPrice = (property: Property) => {
    if (property.listingType === 'rent') {
      const monthlyRent = Number(property.monthlyRent) || 0;
      if (monthlyRent > 0) {
        return `₹${monthlyRent.toLocaleString()}/month`;
      }
    } else if (property.listingType === 'sell') {
      const sellingPrice = Number(property.sellingPrice) || 0;
      if (sellingPrice > 0) {
        return `₹${sellingPrice.toLocaleString()}`;
      }
    }
    return 'Price not set';
  };

  return (
    <main className="container mx-auto py-4 sm:py-8 px-4">
      <>
        <title>Archived Properties — ShoPROP</title>
        <meta name="description" content="View your archived property listings" />
      </>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" onClick={() => navigate("/manage-property")} className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Properties
            </Button>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-orange-100 shadow-glow flex-shrink-0">
              <Archive className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Archived Properties</h1>
              <p className="text-sm sm:text-lg text-muted-foreground">Inactive and archived property listings</p>
            </div>
          </div>
        </div>

        {/* Properties List */}
        {!user ? (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Please Sign In</h3>
            <p className="text-muted-foreground mb-4">
              You need to be signed in to view archived properties.
            </p>
            <Button onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        ) : loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Loading archived properties...</p>
          </div>
        ) : properties.length > 0 ? (
          <div className="space-y-4">
            {properties.map((property, index) => (
              <Card key={property.id} className="border-2 border-orange-200 bg-orange-50/30">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Property Image - Always show with fallback */}
                    <div className="w-full sm:w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                      {property.images && property.images.length > 0 ? (
                        <img
                          src={property.images[0]}
                          alt={property.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full ${property.images && property.images.length > 0 ? 'hidden' : 'flex'} items-center justify-center text-gray-400`}>
                        <Building2 className="h-10 w-10" />
                      </div>
                    </div>

                    {/* Property Details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {property.title}
                            {property.unitNumber ? ` (${property.unitNumber})` : ""}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {property.address}, {property.city}, {property.state}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(property.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(property.id)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Property
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUnarchive(property.id)}>
                              <Archive className="h-4 w-4 mr-2" />
                              Unarchive Property
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          🏠 {property.propertyType.toUpperCase()}
                        </span>
                        {property.squareFeet > 0 && (
                          <span className="flex items-center gap-1">
                            📐 {property.squareFeet} sqft
                          </span>
                        )}
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          Archived
                        </Badge>
                        {property.rentalStatus && (
                          <Badge variant="outline" className="capitalize">
                            {property.rentalStatus}
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-primary">
                        {formatPrice(property)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Archive className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Archived Properties</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any archived properties yet.
              </p>
              <Button onClick={() => navigate("/manage-property")}>
                View Active Properties
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

export default ArchivedProperties;
