"use client";

import { useNavigate, useSearchParams } from "@/lib/navigation";
import PropertyTypeSelector from "./PropertyTypeSelector";

type PropertyRole = "owner" | "tenant";
type PropertyType = "residential" | "commercial" | "industrial";

const SelectPropertyType = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const role: PropertyRole =
    searchParams.get("role") === "tenant" ? "tenant" : "owner";

  const handlePropertyTypeSelect = (propertyType: PropertyType) => {
    navigate(`/add-property?type=${propertyType}&role=${role}`);
  };

  return (
    <main>
      <>
        <title>
          {role === "tenant"
            ? "Select Tenant Property Type"
            : "Select Owner Property Type"}
        </title>

        <meta
          name="description"
          content={
            role === "tenant"
              ? "Choose between residential, commercial, or industrial property types for your tenant property form."
              : "Choose between residential, commercial, or industrial property types for your owner property form."
          }
        />

        <link
          rel="canonical"
          href={`/select-property-type?role=${role}`}
        />
      </>

      <PropertyTypeSelector
        onSelect={handlePropertyTypeSelect}
        title={
          role === "tenant"
            ? "Select Tenant Property Type"
            : "Select Owner Property Type"
        }
        description={
          role === "tenant"
            ? "Choose the type of property you are occupying as a tenant."
            : "Choose the type of property you want to add as an owner."
        }
      />
    </main>
  );
};

export default SelectPropertyType;
