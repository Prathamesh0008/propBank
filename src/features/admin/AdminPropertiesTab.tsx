"use client";
import { Button } from "@/ui/button";
import { Building2, Loader2, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/ui/skeleton";
import { Property } from "@/services/propertyService";
import styles from "./AdminPropertiesTab.module.css";

interface AdminPropertiesTabProps {
  loading: boolean;
  properties: Property[];
  handleViewPropertyDetails: (propertyId: string) => void;
  loadingProperty: boolean;
  selectedProperty: Property | null;
}

export const AdminPropertiesTab = ({loading,properties,handleViewPropertyDetails,loadingProperty,selectedProperty}:AdminPropertiesTabProps) => (
  <section className={styles.directory} aria-label="All properties">
    <header className={styles.header}><div><span className={styles.kicker}>PROPERTY DIRECTORY</span><h2>All properties</h2><p>Review listing information, ownership and approval status.</p></div><span className={styles.count}>{properties.length} listings</span></header>
    {loading ? <div className={styles.skeletons}>{[1,2,3].map(i=><Skeleton key={i} className="h-24 w-full"/>)}</div> : properties.length===0 ? <div className={styles.empty}><Building2 size={28}/><p>No properties found.</p></div> :
    <div className={styles.list}>{properties.map(property=><article className={styles.record} key={property.id}>
      <div className={styles.details}><h3>{property.title}</h3><p className={styles.address}>{property.address}</p><div className={styles.attributes}><span>{property.propertyType}</span><span>{property.listingType}</span><span data-status={property.status}>{property.status}</span>{property.createdAs!=='tenant'&&['rent','sell'].includes(property.listingType)&&<span>{(property.moderationStatus||'legacy_published').replaceAll('_',' ')}</span>}</div><p className={styles.owner}>{property.createdAs==='tenant'?`Tenant supplied · Owner verification pending · ${property.reportedOwner?.personName||property.reportedOwner?.companyName||''}`:<>{property.ownerRole==='agent'?'Agent':'Owner'}: {property.ownerName} · {property.ownerEmail} {property.ownerPhone&&`· ${property.ownerPhone}`}</>}</p></div>
      <Button className={styles.action} variant="outline" size="sm" onClick={()=>handleViewPropertyDetails(property.id)} disabled={loadingProperty}>{loadingProperty&&selectedProperty?.id===property.id?<Loader2 className="h-4 w-4 animate-spin"/>:<ArrowUpRight size={16}/>}<span>View details</span></Button>
    </article>)}</div>}
  </section>
);
