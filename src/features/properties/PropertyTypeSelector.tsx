"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import { Building, Building2, Factory } from "lucide-react";

type PropertyType = "residential" | "commercial" | "industrial";

interface PropertyTypeSelectorProps {
  onSelect: (type: PropertyType) => void;
  title: string;
  description: string;
}

const PropertyTypeSelector = ({
  onSelect,
  title,
  description,
}: PropertyTypeSelectorProps) => {
  const propertyTypes: {
    id: PropertyType;
    title: string;
    description: string;
    icon: typeof Building;
  }[] = [
    {
      id: "residential",
      title: "Residential",
      description:
        "Houses, apartments, flats, bungalows, and other residential properties",
      icon: Building,
    },
    {
      id: "commercial",
      title: "Commercial",
      description:
        "Office spaces, shops, showrooms, and other commercial properties",
      icon: Building2,
    },
    {
      id: "industrial",
      title: "Industrial",
      description:
        "Warehouses, factories, sheds, plots, and other industrial properties",
      icon: Factory,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 sm:py-10">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
        {propertyTypes.map((type) => {
          const IconComponent = type.icon;

          return (
            <Card
              key={type.id}
              role="button"
              tabIndex={0}
              aria-label={`Select ${type.title} property`}
              className="flex h-full cursor-pointer flex-col border-2 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={() => onSelect(type.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(type.id);
                }
              }}
            >
              <CardHeader className="flex min-h-[200px] flex-1 flex-col justify-between p-6 text-center sm:p-8">
                <div className="space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
                    <IconComponent className="h-8 w-8 text-primary-foreground" />
                  </div>

                  <div>
                    <CardTitle className="mb-3 text-xl font-bold sm:text-2xl">
                      {type.title}
                    </CardTitle>

                    <CardDescription className="flex min-h-[3rem] items-center justify-center text-sm leading-relaxed sm:text-base">
                      {type.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-6 text-center sm:pb-8">
                <div className="inline-block rounded-full bg-primary/10 px-4 py-2">
                  <p className="text-sm font-medium text-primary">
                    Click to continue →
                  </p>
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
