"use client";
import { useMemo, useState } from "react";
import { adminPropertyDirectory, propertyReviewStatus, visibleAdminProperties } from "@/lib/admin-property-directory";
import {matchesAdminPropertySection,adminAvailability,confirmedAdminTenants,type AdminPropertySection} from "@/lib/admin-property-views";
import {purposeLabel} from '@/lib/property-purpose';
import {resolveRent,localRentDate} from '@/lib/rent-resolution';
import { Button } from "@/ui/button";
import { Building2, Loader2, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/ui/skeleton";
import { Property } from "@/services/propertyService";
import styles from "./AdminPropertiesTab.module.css";

interface AdminPropertiesTabProps {
  section?:AdminPropertySection;
  overview?:boolean;
  loading: boolean;
  properties: Property[];
  handleViewPropertyDetails: (propertyId: string) => void;
  loadingProperty: boolean;
  selectedProperty: Property | null;
}

export const AdminPropertiesTab = ({section='all',overview=false,loading,properties,handleViewPropertyDetails,loadingProperty,selectedProperty}:AdminPropertiesTabProps) => {
  const [filter,setFilter]=useState("all");
  const tab=section==='pending'?'pending':'all';
  const [search,setSearch]=useState('');
  const title={all:'All Properties',pending:'Pending Approvals',rented:'Rented Properties',available:'Available Properties',archived:'Archived Properties'}[section];
  const directory=useMemo(()=>adminPropertyDirectory(properties.filter(property=>matchesAdminPropertySection(property,section))),[properties,section]);
  const status=propertyReviewStatus;
  const states=Array.from(new Set(["pending_review","approved","rejected","changes_requested",...directory.all.map(status)]));
  const labels:Record<string,string>={pending_review:'Pending Review',approved:'Approved',rejected:'Rejected',changes_requested:'Changes Requested',unreviewed:'Unreviewed'};
  const label=(value:string)=>labels[value]||value.replaceAll('_',' ');
  const money=(value:unknown)=>Number.isFinite(Number(value))&&Number(value)>0?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)):'Not recorded';
  const financial=(p:Property)=>{
    if(p.listingType==='manage')return 'Not applicable';
    if(['sell','pre_leased'].includes(p.listingType))return `${money(p.sellingPrice||p.price)} / Selling price`;
    const tenants=confirmedAdminTenants(p);
    return tenants.length?tenants.map(tenant=>`${money(resolveRent(p,localRentDate(p),tenant).amount)} / month`).join(' / '):`${money(p.expectedRent||p.price)} / Asking rent`;
  };
  const visible=visibleAdminProperties(directory,tab,filter).filter(p=>[p.title,p.buildingName,p.address,p.ownerName,p.id].some(value=>String(value||'').toLowerCase().includes(search.trim().toLowerCase())));
  return (
  <section className={styles.directory} aria-label={title}>
    <header className={styles.header}><div><span className={styles.kicker}>{overview?'LOADED PORTFOLIO':'PROPERTY DIRECTORY'}</span><h2>{overview?'Portfolio overview':title}</h2></div><span className={styles.count}>{directory.all.length} loaded properties</span></header>
    {!overview&&<div className={styles.toolbar}><label>Search properties<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Name, address, owner or ID"/></label>
    {tab==='all'&&<label>Review status<select aria-label="Review status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{states.map(state=><option key={state} value={state}>{label(state)} ({directory.all.filter(property=>status(property)===state).length})</option>)}</select></label>}</div>}
    {loading ? <div className={styles.skeletons}>{[1,2,3].map(i=><Skeleton key={i} className="h-24 w-full"/>)}</div> : visible.length===0 ? <div className={styles.empty}><Building2 size={28}/><p>{tab==='pending'?'No properties awaiting approval.':'No properties found.'}</p></div> :
    <div className={styles.tableScroll} role="region" aria-label={overview?'Portfolio overview':title} tabIndex={0}><table className={styles.table}><thead><tr><th scope="col">Property / Unit</th><th scope="col">Owner</th><th scope="col">Category / Purpose</th><th scope="col">Moderation</th><th scope="col">Occupancy</th><th scope="col">Price / Rent</th><th scope="col">Agreement</th><th scope="col">Action</th></tr></thead><tbody>{visible.map(property=>{
      const reported=property.createdAs==='tenant'&&property.ownershipVerification!=='approved';
      return <tr key={property.id}><td><strong>{property.buildingName||property.title||'Unnamed property'}</strong><small>{[property.unitNumber,property.propertyType].filter(Boolean).join(' / ')||'Unit not recorded'}</small></td>
      <td>{reported?(property.reportedOwner?.personName||property.reportedOwner?.companyName||'Not recorded'):(property.ownerName||'Not recorded')}{reported&&<small>Reported owner / Verification pending</small>}</td>
      <td>{property.propertyType||'Not recorded'}<small>{purposeLabel(property.listingType)}</small></td><td><span className={styles.status} data-status={status(property)}>{label(status(property))}</span></td>
      <td>{confirmedAdminTenants(property).length?'Confirmed tenancy':adminAvailability(property)==='available'?'Available':'Unknown'}</td><td>{financial(property)}</td><td>{property.agreementEndDate?<><small>Until {property.agreementEndDate}</small>{property.agreementStatus?.replaceAll('_',' ')||'Status not recorded'}</>:'Not recorded'}</td>
      <td><Button className={styles.action} variant="ghost" size="sm" onClick={()=>handleViewPropertyDetails(property.id)} disabled={loadingProperty} aria-label={`View details for ${property.title||property.id}`}>{loadingProperty&&selectedProperty?.id===property.id?<Loader2 className="h-4 w-4 animate-spin"/>:<ArrowUpRight size={16}/>}<span>Details</span></Button></td></tr>;
    })}</tbody></table></div>}


  </section>
);
};
