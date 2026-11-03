"use client";

import { apiFetch } from '@/lib/api-client';

import { Building2, Archive, ArrowLeft, Eye, Edit, MoreVertical } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
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
import styles from "./ArchivedProperties.module.css";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "../../utils/config";
import { useArchivedProperties } from "../../hooks/useProperties";
import {useQueryClient} from '@tanstack/react-query';

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
  const queryClient=useQueryClient();
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
    const key=['archivedProperties',user.uid] as const,previous=queryClient.getQueryData(key);
    queryClient.setQueryData(key,(current:Property[]|undefined)=>current?.filter(property=>property.id!==propertyId));
    const rollback=()=>queryClient.setQueryData(key,previous);
    
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
        rollback();
        toast({
          title: "Error",
          description: data.message || "Failed to unarchive property",
          variant: "destructive"
        });
      }
    } catch (error) {
      rollback();
      
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
    <main className={styles.page}>
      <>
        <title>Archived Properties — PropBank</title>
        <meta name="description" content="View your archived property listings" />
      </>

      <div className={styles.inner}>
        <header className={styles.header}>
          <button type="button" onClick={() => navigate("/manage-property")} className={styles.back}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to properties
          </button>
          <p className={styles.kicker}>Your property workspace</p>
          <h1>Archived properties</h1>
          <p>Review properties you've taken off your active list. Restore them when you're ready.</p>
        </header>

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
          <div className={styles.list}>
            {properties.map((property) => (
              <article key={property.id} className={styles.record}>
                <div className={styles.recordBody}>
                  <div className={styles.recordGrid}>
                    {/* Property Image - Always show with fallback */}
                    <div className={styles.image}>
                      {property.images && property.images.length > 0 ? (
                        <img
                          src={property.images[0]}
                          alt={property.title}
                          className={styles.photo}
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
                    <div className={styles.details}>
                      <div className={styles.recordTop}>
                        <div>
                          <h2 className={styles.propertyTitle}>
                            {property.title}
                            {property.unitNumber ? ` (${property.unitNumber})` : ""}
                          </h2>
                          <p className={styles.address}>
                            {property.address}, {property.city}, {property.state}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label={`More actions for ${property.title}`}>
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

                      <div className={styles.facts}>
                        <span className="flex items-center gap-1">
                          🏠 {property.propertyType.toUpperCase()}
                        </span>
                        {property.squareFeet > 0 && (
                          <span className="flex items-center gap-1">
                            📐 {property.squareFeet} sqft
                          </span>
                        )}
                        <Badge variant="secondary" className={styles.archivedBadge}>
                          Archived
                        </Badge>
                        {property.rentalStatus && (
                          <Badge variant="outline" className="capitalize">
                            {property.rentalStatus}
                          </Badge>
                        )}
                      </div>

                      <div className={styles.price}>
                        {formatPrice(property)}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
              <Archive className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Archived Properties</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any archived properties yet.
              </p>
              <Button onClick={() => navigate("/manage-property")}>
                View Active Properties
              </Button>
          </div>
        )}
      </div>
    </main>
  );
};

export default ArchivedProperties;
