"use client";

import React, { useState } from "react";
import { Link } from "@/lib/navigation";
import { Loader2, Home, MapPin, ArrowUpRight, BedDouble, Maximize, ImageOff } from "lucide-react";
import { Button } from "@/ui/button";
import PropertyDetailsDialog from "@/features/properties/PropertyDetailsDialog";
import {formatPropertyAddress} from "@/lib/property-address";
import { propertyPricing, propertyAreaText } from "@/lib/property-presentation";
import { purposeLabel } from "@/lib/property-purpose";
import type { Property } from "@/services/propertyService";
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

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

function PropertyCard({ property, sendingEnquiry, handleEnquireProperty }: {
  property: Property;
  sendingEnquiry: string | null;
  handleEnquireProperty: (property: Property) => Promise<void>;
}) {
  const [failedImage, setFailedImage] = useState("");
  const image = Array.isArray(property.images) ? property.images.find(src => typeof src === "string" && src.trim()) : undefined;
  const title = property.title?.trim() || property.buildingName?.trim() || "Property details";
  const location = formatPropertyAddress(property);
  const pricing = propertyPricing(property);
  const bedroomText = property.configuration?.trim() || (property.bedrooms > 0 ? `${property.bedrooms} ${property.bedrooms === 1 ? "bedroom" : "bedrooms"}` : "");
  const area = Number.isFinite(Number(property.squareFeet)) && Number(property.squareFeet) > 0
    ? `${Number(property.squareFeet).toLocaleString("en-IN")} sq ft`
    : ["carpetArea", "constructedArea", "plotArea"].map(key => propertyAreaText(property, key as "carpetArea" | "constructedArea" | "plotArea")).find(value => value !== "Not recorded");
  return (
    <article className={styles.listing}>
      <Link to={`/property/${encodeURIComponent(property.id)}`} prefetch={false} className={styles.cardLink} aria-label={`View ${title} details`}>
        <div className={styles.photo}>
          {image && image !== failedImage ? <img src={image} alt={title} loading="lazy" decoding="async" onError={() => setFailedImage(image)} />
            : <div className={styles.noPhoto}><ImageOff size={26} strokeWidth={1.3} aria-hidden="true" /><span>Photograph not available</span></div>}
          {property.listingType && <span className={styles.listingTag}>{purposeLabel(property.listingType)}</span>}
        </div>
        <div className={styles.listingBody}>
          <h3 title={title}>{title}</h3>
          {location && <p className={styles.location} title={location}><MapPin size={14} aria-hidden="true" /><span>{location}</span></p>}
          <div className={styles.price}>{pricing.amount !== null ? <>{currency.format(pricing.amount)}{pricing.monthly && <span> / month</span>}</> : "Price on request"}</div>
          <p className={styles.priceLabel}>{pricing.label}</p>
          {(bedroomText || area) && <div className={styles.features}>
            {bedroomText && <span><BedDouble size={15} strokeWidth={1.5} aria-hidden="true" />{bedroomText}</span>}
            {area && <span><Maximize size={15} strokeWidth={1.5} aria-hidden="true" />{area}</span>}
          </div>}
        </div>
      </Link>
      <div className={styles.actions}>
        <PropertyDetailsDialog property={property} />
        <Button size="sm" disabled={sendingEnquiry === property.id} onClick={() => void handleEnquireProperty(property)}>{sendingEnquiry === property.id ? "Sending..." : "Enquire"}</Button>
      </div>
    </article>
  );
}

export const PropertiesSection: React.FC<PropertiesSectionProps> = ({
  properties, loading, loadingMore, hasMore, loadMoreProperties, isSearching,
  selectedCategories, searchQuery, searchType, selectedProjectCondition,
  budgetRange, filteredCount, sendingEnquiry, handleEnquireProperty, observerTargetRef,
}) => {
  const filtered = isSearching || selectedCategories.length > 0 || Boolean(searchQuery.trim()) || searchType !== "all" || Boolean(selectedProjectCondition) || budgetRange.min > 0 || budgetRange.max > 0;
  return (
    <section id="featured-properties" aria-labelledby="featured-properties-heading" className={styles.section}>
      <div className={styles.shell}>
        <div className={styles.heading}>
          <div><p className={styles.kicker}>EXPLORE PROPERTIES</p><h2 id="featured-properties-heading">Featured Properties</h2>
            {filtered && <p className={styles.searchSummary}>{filteredCount} matching {filteredCount === 1 ? "property" : "properties"} in loaded records{searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ""}</p>}
          </div>
          <Link to="/properties" className={styles.viewAll}>View All Properties <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
        {loading ? <div className={styles.state} role="status"><Loader2 className={styles.spin} aria-hidden="true" /><p>Finding available properties...</p></div>
          : properties.length === 0 ? <div className={styles.state}><Home size={28} strokeWidth={1.3} aria-hidden="true" /><h3>{filtered ? "No matches in the loaded properties" : "New properties will appear here"}</h3><p>{filtered ? "Try another location or adjust your filters." : "Explore the directory for available listings."}</p><Link className={styles.viewAll} to="/properties">View All Properties <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
          : <>
            <div className={styles.grid}>
              {properties.map(property => <PropertyCard key={property.id} property={property} sendingEnquiry={sendingEnquiry} handleEnquireProperty={handleEnquireProperty} />)}
            </div>
            <div ref={observerTargetRef} className={loadingMore || hasMore ? styles.pagination : styles.endMarker} aria-live="polite">
              {loadingMore ? <span role="status"><Loader2 size={18} className={styles.spin} aria-hidden="true" /> Loading more properties...</span>
                : hasMore ? <button onClick={loadMoreProperties} type="button">Load more properties <span aria-hidden="true">{"\u2193"}</span></button> : <span className={styles.srOnly}>End of loaded listings.</span>}
            </div>
          </>}
      </div>
    </section>
  );
};
