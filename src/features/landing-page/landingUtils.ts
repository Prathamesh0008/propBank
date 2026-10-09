import { Property } from "@/services/propertyService";

export const filterProperties = (
  allProperties: Property[],
  searchQuery: string,
  searchType: string,
  selectedListingTypes: string[],
  selectedCategories: string[],
  selectedProjectCondition: string,
  budgetRange: { min: number; max: number }
): Property[] => {
  let filtered = [...allProperties];

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (property) =>
        property.title?.toLowerCase().includes(query) ||
        property.address?.toLowerCase().includes(query) ||
        property.city?.toLowerCase().includes(query) ||
        property.propertyType?.toLowerCase().includes(query) ||
        property.description?.toLowerCase().includes(query)
    );
  }

  if (searchType && searchType !== "all") {
    filtered = filtered.filter((property) => {
      const backendType = (searchType === "buy" ? "sell" : searchType).toLowerCase();
      return property.listingType?.toLowerCase() === backendType;
    });
  }

  filtered = filtered.filter(
    (property) =>
      !property.status ||
      property.status === "" ||
      property.status.toLowerCase() === "active" ||
      property.isActive === true
  );

  filtered = filtered.filter((property) => {
    if (property.listingType === "rent") {
      return property.rentalStatus !== "rented" && !property.isRented;
    }
    if (property.listingType === "sell") {
      return !property.isSold;
    }
    return true;
  });

  if (selectedListingTypes && selectedListingTypes.length > 0) {
    filtered = filtered.filter((property) => {
      const propType = property.listingType?.toLowerCase();
      const displayType = propType === "sell" ? "buy" : propType;
      return selectedListingTypes.some((t) => t.toLowerCase() === displayType);
    });
  }

  if (selectedCategories.length > 0) {
    filtered = filtered.filter((property) =>
      selectedCategories.some((category) =>
        property.propertyType?.toLowerCase().includes(category.toLowerCase())
      )
    );
  }

  if (selectedProjectCondition) {
    filtered = filtered.filter((property) => property.projectCondition === selectedProjectCondition);
  }

  if (budgetRange.min > 0 || budgetRange.max > 0) {
    filtered = filtered.filter((property) => {
      const price = property.price || 0;
      if (budgetRange.min > 0 && budgetRange.max > 0) {
        return price >= budgetRange.min && price <= budgetRange.max;
      } else if (budgetRange.min > 0) {
        return price >= budgetRange.min;
      } else if (budgetRange.max > 0) {
        return price <= budgetRange.max;
      }
      return true;
    });
  }

  return filtered;
};
