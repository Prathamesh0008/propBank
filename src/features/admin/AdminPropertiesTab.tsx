"use client";
import { useMemo, useState } from "react";
import { adminPropertyDirectory, propertyReviewStatus, visibleAdminProperties } from "@/lib/admin-property-directory";
import {matchesAdminPropertySection,adminAvailability,confirmedAdminTenants,type AdminPropertySection} from "@/lib/admin-property-views";
import { Button } from "@/ui/button";
import { Building2, Loader2, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/ui/skeleton";
import { Property } from "@/services/propertyService";
import styles from "./AdminPropertiesTab.module.css";

interface AdminPropertiesTabProps {
  section?:AdminPropertySection;
  loading: boolean;
  properties: Property[];
  handleViewPropertyDetails: (propertyId: string) => void;
  loadingProperty: boolean;
  selectedProperty: Property | null;
}

export const AdminPropertiesTab = ({section='all',loading,properties,handleViewPropertyDetails,loadingProperty,selectedProperty}:AdminPropertiesTabProps) => {
  const [filter,setFilter]=useState("all");
  const tab=section==='pending'?'pending':'all';
  const [search,setSearch]=useState('');
  const title={all:'All Properties',pending:'Pending Approvals',rented:'Rented Properties',available:'Available Properties',archived:'Archived Properties'}[section];
  const directory=useMemo(()=>adminPropertyDirectory(properties.filter(property=>matchesAdminPropertySection(property,section))),[properties,section]);
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
  const visible=visibleAdminProperties(directory,tab,filter).filter(p=>[p.title,p.buildingName,p.address,p.ownerName,p.id].some(value=>String(value||'').toLowerCase().includes(search.trim().toLowerCase())));
  return (
  <section className={styles.directory} aria-label={title}>
    <header className={styles.header}><div><span className={styles.kicker}>PROPERTY DIRECTORY</span><h2>{title}</h2><p>Review listing information, ownership and approval status.</p></div><span className={styles.count}>{directory.all.length} listings</span></header>
    <label className="block mb-4">Search properties <input className="border rounded p-2 ml-2" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Name, address, owner or ID"/></label>
    {tab==='all'&&<label className="block mb-4">Review status <select aria-label="Review status" value={filter} onChange={e=>setFilter(e.target.value)} className="border rounded p-2 ml-2">
      <option value="all">All Properties ({directory.all.length})</option>{states.map(state=><option key={state} value={state}>{label(state)} ({directory.all.filter(property=>status(property)===state).length})</option>)}
    </select></label>}
    {loading ? <div className={styles.skeletons}>{[1,2,3].map(i=><Skeleton key={i} className="h-24 w-full"/>)}</div> : visible.length===0 ? <div className={styles.empty}><Building2 size={28}/><p>{tab==='pending'?'No properties awaiting approval.':'No properties found.'}</p></div> :
    <div className={styles.list}>{visible.map(property=>{const display=presentation(property);return <article className={styles.record} key={property.id}>
      <div className={styles.details}>{display.heading&&<h3>{display.heading}</h3>}<div className={styles.meta}><p>Property ID: {property.id}</p><p>Submitted: {submitted(property)}</p></div><p className={styles.address}>{property.address||property.location}</p><div className={styles.attributes}><span>{property.propertyType}</span><span>{property.listingType}</span><span data-status={property.status}>{property.status}</span><span>{label(status(property))}</span></div><p className={styles.owner}>{display.ownerPrefix}: {display.ownerName||'Not supplied'} | Email: {display.ownerEmail||'Not supplied'}{property.ownerPhone&&` | ${property.ownerPhone}`}</p>{property.createdAs==='tenant'&&<p className={styles.owner}>Tenant supplied | Owner verification: {property.ownershipVerification||'pending'} | Submitted by: {property.submittedByUID||'Not recorded'}</p>}</div>
      {section==='rented'&&<div className={styles.owner}>{confirmedAdminTenants(property).map((tenant,index)=><p key={String(tenant.id||tenant.userUID||index)}>Tenant: {[tenant.firstName,tenant.lastName].filter(Boolean).join(' ')||'Name not recorded'} | Rent: {String(tenant.monthlyRent||property.monthlyRent||'Not recorded')} | Agreement: {String(tenant.leaseStartDate||property.agreementStartDate||'Start not recorded')} to {String(tenant.leaseEndDate||property.agreementEndDate||'End not recorded')} | Confirmed active tenancy</p>)}</div>}
      {section==='available'&&<p className={styles.owner}>Availability: {adminAvailability(property)==='available'?'Available':'Unknown - review occupancy/status before listing'}</p>}
      <Button className={styles.action} variant="outline" size="sm" onClick={()=>handleViewPropertyDetails(property.id)} disabled={loadingProperty}>{loadingProperty&&selectedProperty?.id===property.id?<Loader2 className="h-4 w-4 animate-spin"/>:<ArrowUpRight size={16}/>}<span>View details</span></Button>
    </article>})}</div>}

  </section>
);
};
