"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Building, Building2, Factory } from "lucide-react";

interface PropertyTypeSelectorProps {
  onSelect: (type: string) => void;
  title: string;
  description: string;
}

const PropertyTypeSelector = ({ onSelect, title, description }: PropertyTypeSelectorProps) => {
  
  const propertyTypes = [
    {
      id: "residential",
      title: "Residential",
      description: "Houses, apartments, condos, and other residential properties",
      icon: Building,
    },
    {
      id: "commercial",
      title: "Commercial", 
      description: "Office buildings, retail spaces, restaurants, and other commercial properties",
      icon: Building2,
    },
    {
      id: "industrial",
      title: "Industrial",
      description: "Warehouses, factories, manufacturing facilities, and industrial properties",
      icon: Factory,
    },
  ];

  return (
    <div className="container mx-auto py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto px-4">
        {propertyTypes.map((type) => {
          const IconComponent = type.icon;
          return (
            <Card 
              key={type.id} 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary h-full flex flex-col hover:scale-105"
              onClick={() => onSelect(type.id)}
            >
              <CardHeader className="text-center flex-1 flex flex-col justify-between min-h-[200px] p-8">
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow">
                    <IconComponent className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold mb-3">{type.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed min-h-[3rem] flex items-center justify-center">
                      {type.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-center pb-8">
                <div className="px-4 py-2 bg-primary/10 rounded-full inline-block hover:border-primary">
                  <p className="text-sm font-medium text-primary">{`Click to continue ->`}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PropertyTypeSelector;
