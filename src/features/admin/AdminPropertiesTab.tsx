"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { Skeleton } from "@/ui/skeleton";
import { Property } from "@/services/propertyService";

interface AdminPropertiesTabProps {
  loading: boolean;
  properties: Property[];
  handleViewPropertyDetails: (propertyId: string) => void;
  loadingProperty: boolean;
  selectedProperty: Property | null;
}

export const AdminPropertiesTab = ({
  loading,
  properties,
  handleViewPropertyDetails,
  loadingProperty,
  selectedProperty
}: AdminPropertiesTabProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Properties</CardTitle>
        <CardDescription>View all properties in the system</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No properties found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {properties.map((property) => (
              <Card key={property.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{property.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{property.address}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{property.propertyType}</Badge>
                        <Badge variant="outline">{property.listingType}</Badge>
                        {property.createdAs!=='tenant'&&['rent','sell'].includes(property.listingType)&&<Badge variant="outline">{(property.moderationStatus||'legacy_published').replaceAll('_',' ')}</Badge>}
                        <Badge variant={property.status === "active" ? "default" : "secondary"}>
                          {property.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {property.createdAs==='tenant'?`Tenant supplied · Owner verification pending · ${property.reportedOwner?.personName||property.reportedOwner?.companyName||''}`:<>{property.ownerRole === "agent" ? "Agent" : "Owner"}: {property.ownerName} • {property.ownerEmail} {property.ownerPhone && `• ${property.ownerPhone}`}</>}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPropertyDetails(property.id)}
                      disabled={loadingProperty}
                    >
                      {loadingProperty && selectedProperty?.id === property.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      View Full Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
