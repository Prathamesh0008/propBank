"use client";
import { useMemo, useState } from "react";
import { adminPropertyDirectory, propertyReviewStatus, visibleAdminProperties, type PropertyDirectoryTab } from "@/lib/admin-property-directory";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/ui/tabs";
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

export const AdminPropertiesTab = ({loading,properties,handleViewPropertyDetails,loadingProperty,selectedProperty}:AdminPropertiesTabProps) => {
  const [filter,setFilter]=useState("all");
  const [tab,setTab]=useState<PropertyDirectoryTab>('all');
  const directory=useMemo(()=>adminPropertyDirectory(properties),[properties]);
  const status=propertyReviewStatus;
  const states=Array.from(new Set(["pending_review","approved","rejected","changes_requested",...directory.all.map(status)]));
  const labels:Record<string,string>={pending_review:'Pending Review',approved:'Approved',rejected:'Rejected',changes_requested:'Changes Requested',unreviewed:'Unreviewed'};
  const label=(value:string)=>labels[value]||value.replaceAll('_',' ');
  const submitted=(property:Property)=>{
    const date=new Date(property.createdAt);
    return Number.isNaN(date.getTime())?'Not recorded':date.toLocaleString();
  };
  const presentation=(property:Property)=>{
    const extended=property as Property&{buildingName?:string};
    const reportedOwner=property.reportedOwner?.personName||property.reportedOwner?.companyName||'';
    const awaitingOwnerVerification=property.createdAs==='tenant'&&property.ownershipVerification!=='approved';
    const ownerName=awaitingOwnerVerification?reportedOwner:property.ownerName;
    const ownerLabel=awaitingOwnerVerification&&ownerName?`Reported owner: ${ownerName}`:ownerName;
    return {
      heading:[extended.buildingName||property.title,property.unitNumber,ownerLabel].filter(Boolean).join(' – '),
      ownerName,
      ownerPrefix:awaitingOwnerVerification?'Reported owner':'Owner',
      ownerEmail:awaitingOwnerVerification?property.reportedOwner?.email:property.ownerEmail,
    };
  };
  const visible=visibleAdminProperties(directory,tab,filter);
  return (
  <section className={styles.directory} aria-label="All properties">
    <header className={styles.header}><div><span className={styles.kicker}>PROPERTY DIRECTORY</span><h2>All properties</h2><p>Review listing information, ownership and approval status.</p></div><span className={styles.count}>{directory.all.length} listings</span></header>
    <Tabs value={tab} onValueChange={value=>setTab(value as PropertyDirectoryTab)}>
    <TabsList aria-label="Property submissions" className={styles.tabs}>
      <TabsTrigger value="all">All Properties ({directory.all.length})</TabsTrigger>
      <TabsTrigger value="pending">Pending Approval ({directory.pending.length})</TabsTrigger>
    </TabsList>
    <TabsContent value={tab}>
    {tab==='all'&&<label className="block mb-4">Review status <select aria-label="Review status" value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded p-2 ml-2">
      <option value="all">All Properties ({directory.all.length})</option>{states.map(state=><option key={state} value={state}>{label(state)} ({directory.all.filter(property=>status(property)===state).length})</option>)}
    </select></label>}
    {loading ? <div className={styles.skeletons}>{[1,2,3].map(i=><Skeleton key={i} className="h-24 w-full"/>)}</div> : visible.length===0 ? <div className={styles.empty}><Building2 size={28}/><p>{tab==='pending'?'No properties awaiting approval.':'No properties found.'}</p></div> :
    <div className={styles.list}>{visible.map(property=>{const display=presentation(property);return <article className={styles.record} key={property.id}>
      <div className={styles.details}>{display.heading&&<h3>{display.heading}</h3>}<div className={styles.meta}><p>Property ID: {property.id}</p><p>Submitted: {submitted(property)}</p></div><p className={styles.address}>{property.address||property.location}</p><div className={styles.attributes}><span>{property.propertyType}</span><span>{property.listingType}</span><span data-status={property.status}>{property.status}</span><span>{label(status(property))}</span></div><p className={styles.owner}>{display.ownerPrefix}: {display.ownerName||'Not supplied'} | Email: {display.ownerEmail||'Not supplied'}{property.ownerPhone&&` | ${property.ownerPhone}`}</p>{property.createdAs==='tenant'&&<p className={styles.owner}>Tenant supplied | Owner verification: {property.ownershipVerification||'pending'} | Submitted by: {property.submittedByUID||'Not recorded'}</p>}</div>
      <Button className={styles.action} variant="outline" size="sm" onClick={()=>handleViewPropertyDetails(property.id)} disabled={loadingProperty}>{loadingProperty&&selectedProperty?.id===property.id?<Loader2 className="h-4 w-4 animate-spin"/>:<ArrowUpRight size={16}/>}<span>View details</span></Button>
    </article>})}</div>}
    </TabsContent>
    </Tabs>
  </section>
);
};
