"use client";

import React from "react";
import { Link } from "@/lib/navigation";
import { Loader2, Home, MapPin } from "lucide-react";
import { Button } from "@/ui/button";
import PropertyDetailsDialog from "@/features/properties/PropertyDetailsDialog";
import { Property } from "@/services/propertyService";
import styles from "./PropertiesSection.module.css";

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
  const filtered = isSearching || selectedCategories.length > 0 || Boolean(selectedProjectCondition) || budgetRange.min > 0 || budgetRange.max > 0;
  return (
    <section id="featured-properties" aria-labelledby="featured-properties-heading" className={styles.section}>
      <div className={styles.shell}>
        <div className={styles.heading}>
          <div><p className={styles.kicker}>Selected spaces</p><h2 id="featured-properties-heading">{filtered ? "Your search, refined." : "Discover what's available."}</h2></div>
          <div className={styles.headingSide}><p>{filtered ? `${filteredCount} matching properties${searchQuery ? ` for “${searchQuery}”` : ""}` : "Explore current listings and find the space that meets your plans."}</p><Link to="/search" className={styles.viewAll}>Explore all listings <span aria-hidden="true">↗</span></Link></div>
        </div>
        {loading ? <div className={styles.state} role="status"><Loader2 className={styles.spin} aria-hidden="true"/><p>Finding available properties…</p></div> : properties.length === 0 ?
          <div className={styles.state}><Home size={28} aria-hidden="true"/><h3>No properties to show just yet.</h3><p>Try another search or return to the full listings.</p><Link className={styles.viewAll} to="/search">Browse all properties ↗</Link></div>
          : <>
            <div className={styles.grid}>
              {properties.map(property => {
                const price = Number(property.price) > 0 ? Number(property.price) : Number(property.listingType === "rent" ? property.monthlyRent : property.sellingPrice) || 0;
                const fallback = getPlaceholderImage(property.propertyType);
                return <article key={property.id} className={styles.listing}>
                  <div className={styles.photo}>
                    <img src={property.images?.[0] || fallback} alt={property.title || "Available property"} loading="lazy" onError={(event) => { const image = event.currentTarget; if(image.src !== fallback) image.src = fallback; else image.style.opacity = "0"; }}/>
                    <span className={styles.listingTag}>{property.listingType === "rent" ? "For rent" : "For sale"}</span>
                  </div>
                  <div className={styles.listingBody}>
                    <div className={styles.listingMeta}><span>{property.propertyType || "Property"}</span>{property.configuration && <span>{property.configuration}</span>}</div>
                    <h3>{property.title || "Available property"}</h3>
                    {(property.address || property.city) && <p className={styles.location}><MapPin size={15} aria-hidden="true"/>{property.address || property.city}</p>}
                    <div className={styles.listingBottom}>
                      <div className={styles.price}>{price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Price on request"}{price > 0 && property.listingType === "rent" && <span> / month</span>}</div>
                      <div className={styles.actions}><PropertyDetailsDialog property={property} /><Button size="sm" disabled={sendingEnquiry === property.id} onClick={()=>handleEnquireProperty(property)}>{sendingEnquiry === property.id ? "Sending…" : "Enquire"}</Button></div>
                    </div>
                  </div>
                </article>;
              })}
            </div>
            <div ref={observerTargetRef} className={styles.pagination} aria-live="polite">
              {loadingMore ? <span><Loader2 size={18} className={styles.spin} aria-hidden="true"/> Loading more properties…</span> : hasMore ? <button onClick={loadMoreProperties} type="button">Load more properties <span aria-hidden="true">↓</span></button> : <span>You've reached the end of the available listings.</span>}
            </div>
          </>}
      </div>
    </section>
  );
};
