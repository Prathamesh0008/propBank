"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";

export interface Property {
  id: string;
  title: string;
  price: string;
  location: string;
  image?: string;
  type: "sale" | "rent";
  furnishedCount?: number; // Number of furnished items
}

interface PropertyCardProps {
  property: Property;
  ctaLabel?: string;
  onAction?: (id: string) => void;
}

const PropertyCard = ({ property, ctaLabel = "View", onAction }: PropertyCardProps) => {
  return (
    <Card className="overflow-hidden hover:shadow-elegant transition-shadow">
      <div className="aspect-[16/10] w-full bg-secondary" aria-hidden>
        {property.image ? (
          <img
            src={property.image}
            alt={`${property.title} in ${property.location}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <CardHeader>
        <CardTitle className="text-lg">{property.title}</CardTitle>
        <p className="text-muted-foreground">{property.location}</p>
        {/* Furnished Badge */}
        {property.furnishedCount && property.furnishedCount > 0 && (
          <div className="mt-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              🛋️ Furnished ({property.furnishedCount} items)
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="font-semibold">{property.price}</div>
        <Button variant="secondary" onClick={() => onAction?.(property.id)}>{ctaLabel}</Button>
      </CardContent>
    </Card>
  );
};

export default PropertyCard;
