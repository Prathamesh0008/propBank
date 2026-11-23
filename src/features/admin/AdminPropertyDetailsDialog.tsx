"use client";
import {propertyPricing, propertyOccupancy} from '@/lib/property-presentation';

import {formatPropertyAddress,propertyAddressRows} from "@/lib/property-address";
import {leaseTenureLabel} from '@/lib/lease-tenure';
import {formatDisplayDate} from '@/lib/date-format';


import PropertyPurposeSummary from "@/features/properties/PropertyPurposeSummary";
import {purposeLabel} from "@/lib/property-purpose";
import styles from "./AdminPropertyDetailsDialog.module.css";

import {Link} from '@/lib/navigation';
import { apiFetch } from '@/lib/api-client';

import React from "react";
import {useAuth} from '@/contexts/AuthContext';
import {useQuery} from '@tanstack/react-query';
import {adminAvailability,confirmedAdminTenants} from '@/lib/admin-property-views';
import {resolveRent,localRentDate} from '@/lib/rent-resolution';
import SessionMediaImage from '@/components/SessionMediaImage';
import ListingModeration from '@/features/properties/ListingModeration';
import OwnerVerification from './OwnerVerification';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/ui/dialog";
import { Badge } from "@/ui/badge";
import { ScrollArea } from "@/ui/scroll-area";
import {
    MapPin,
    Home,
    User,
    Phone,
    Mail,
    Calendar,
    Clock,
    FileText,
    Shield,
    IndianRupee,
    Maximize,
    Briefcase,
    Info,
    CheckCircle2,
    Users,
    X,
    Eye,
    Image as ImageIcon
} from "lucide-react";
import { Property } from "@/services/propertyService";
import { API_BASE_URL } from "../../utils/config";
import { useState, useEffect, useRef } from "react";
interface TenantInfo {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    paymentDueDate: string;
    monthlyRent: string;
    leaseStartDate: string;
    leaseEndDate: string;
    noticePeriod: string;
    emergencyContact: string;
    previousAddress: string;
    employmentStatus: string;
    employer: string;
    monthlyIncome: string;
    isMarried: boolean;
    spouse?: any;
    rentSchedule?: any[];
    isActive: boolean;
    userUID?:string;
    linkConfirmationRequired?:boolean;
    securityDeposit?:string;
    lockInPeriod?:string;
}

interface AdminPropertyDetailsDialogProps {
    property: Property | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onVerificationChange?:()=>void|Promise<void>;
}

const AdminPropertyDetailsDialog: React.FC<AdminPropertyDetailsDialogProps> = ({
    property,
    isOpen,
    onOpenChange,
    onVerificationChange,
}) => {
    const [activeSection,setActiveSection]=useState('overview');
    const bodyRef=useRef<HTMLDivElement|null>(null);
    const selectSection=(section:string)=>{setActiveSection(section);if(bodyRef.current)bodyRef.current.scrollTop=0;};
    const {user,fileAccess,retryFileAccess}=useAuth();
    useEffect(()=>{setActiveSection('overview');},[property?.id,isOpen]);
    const relatedKind=activeSection==='services'?'services':'documents';
    const related=useQuery({queryKey:['adminPropertyRelated',user?.uid,property?.id,relatedKind],enabled:isOpen&&!!property?.id&&['documents','services','ownership'].includes(activeSection),staleTime:60000,refetchOnWindowFocus:false,retry:false,queryFn:async({signal})=>{
        const path=activeSection==='services'?`inspection-reports/property/${property?.id}`:`documents/property/${property?.id}`;
        const response=await apiFetch(`${API_BASE_URL}/${path}`,{signal});const data=await response.json();
        if(!response.ok||!data.success)throw Error(activeSection==='services'?'Inspection reports could not be loaded.':'Documents could not be loaded.');
        return activeSection==='services'?{reports:data.reports||[],documents:[]}:{documents:data.documents||[],reports:[]};
    }});
    const documents=related.data?.documents||[],inspectionReports=related.data?.reports||[];
    const loadingDocs=related.isLoading&&activeSection==='documents',loadingReports=related.isLoading&&activeSection==='services';
    const documentsError=related.error&&activeSection!=='services'?related.error.message:'',reportsError=related.error&&activeSection==='services'?related.error.message:'';

    if (!property) return null;

    const formatDate = (dateString?: string) => formatDisplayDate(dateString, {}, 'Not recorded');

    const SectionTitle=({title,icon:Icon}:{title:string;icon:any})=><div className={styles.sectionTitle}><Icon size={17} aria-hidden="true"/><h3>{title}</h3></div>;
    const humanLabel=(value:string)=>value.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());
    const DataRow=({label,value}:{label:string;value:string|number|undefined|null;icon?:any;className?:string})=><div className={styles.dataRow}><span>{label}</span><span>{value===undefined||value===null||value===''?'Not recorded':typeof value==='string'&&/status|category|structure|layout|condition|purpose|origin|verification|maintenance paid by/i.test(label)?humanLabel(value):value}</span></div>;

    const hasImages = (property.images && property.images.length > 0) || (property.internalImages && property.internalImages.length > 0);
    const propertyName=property.title?.trim()||property.buildingName?.trim()||`Property ${property.id}`;
    const propertyLocation=formatPropertyAddress(property)||'Location not provided';
    const listingLabel=(property.listingType||'manage').replace('_',' and ');
    const area=(value?:string,unit?:string)=>value?[Number.isFinite(Number(value))?Number(value).toLocaleString('en-IN'):value,unit?({sqft:'sq ft',sq_ft:'sq ft',sqm:'sq m',sq_m:'sq m'}[unit]||unit.replaceAll('_',' ')):undefined].filter(Boolean).join(' '):undefined;
    const money=(value?:string|number|null)=>value!==undefined&&value!==null&&value!==''&&Number.isFinite(Number(value))?`₹${Number(value).toLocaleString('en-IN',{maximumFractionDigits:2})}`:undefined;
    const rentalPurpose=['rent','sell_rent'].includes(property.listingType||'');
    const salePurpose=['sell','sell_rent','pre_leased'].includes(property.listingType||'');

    const sections=[['overview','Overview'],['ownership','Ownership'],...((property.tenants?.length||property.buyers?.length||property.listingType==='pre_leased')?[['tenancy','Tenancy']]:[]),...(property.listingType!=='manage'?[['financials','Financials']]:[]),...(rentalPurpose||property.listingType==='pre_leased'?[['agreement','Agreement']]:[]),...(property.furnishedChecklist?.length?[['inventory','Inventory']]:[]),['documents','Documents'],['services','Services & Inspections'],['moderation','Moderation'],['activity','Activity History']];
    return <Dialog open={isOpen} onOpenChange={onOpenChange}><DialogContent className={styles.detailsDialog}>
    <DialogHeader className={styles.dialogHeading}><button type="button" className={styles.back} onClick={()=>onOpenChange(false)}>Back to properties</button><div className={styles.identity}>{property.images?.[0]&&<SessionMediaImage src={property.images[0]} alt="" className={styles.thumbnail}/>}<div><DialogTitle>{propertyName}</DialogTitle><DialogDescription>{propertyLocation}</DialogDescription><p className={styles.reference}>{property.id} / {[property.propertyCategory||property.propertyType,property.configuration,property.unitNumber].filter(Boolean).map(value=>humanLabel(String(value))).join(' / ')}</p></div></div><div className={styles.headerStatus}><span>{purposeLabel(property.listingType)}</span><span>{propertyOccupancy(property)}</span><button type="button" onClick={()=>selectSection('moderation')}>{humanLabel(property.moderationStatus||'unreviewed')}</button></div></DialogHeader>
    <div className={styles.summary} aria-label="Property highlights">
    {rentalPurpose&&<><DataRow label={propertyPricing(property).label} value={money(propertyPricing(property).amount)}/><DataRow label="Security deposit" value={money(property.securityDeposit)}/><DataRow label="Carpet area" value={area(property.carpetArea,property.carpetAreaUnit||property.areaUnit)}/></>}
    {salePurpose&&!rentalPurpose&&<><DataRow label="Selling price" value={money(property.sellingPrice)}/>{property.listingType==='pre_leased'?<><DataRow label="Reported monthly income" value={money(property.investment?.monthlyRentalIncome??property.preLeased?.monthlyRentalIncome)}/><DataRow label="Lease expiry" value={formatDate(property.investment?.leaseEndDate||property.preLeased?.leaseEndDate)}/></>:<DataRow label="Carpet area" value={area(property.carpetArea,property.carpetAreaUnit||property.areaUnit)}/>}</>}
    {property.listingType==='manage'&&<><DataRow label="Management" value="Private registration"/><DataRow label="Property status" value={property.status}/><DataRow label="Carpet area" value={area(property.carpetArea,property.carpetAreaUnit||property.areaUnit)}/></>}
    <DataRow label="Occupancy" value={confirmedAdminTenants(property).length?'Confirmed tenancy':'Unknown'}/></div>

    <nav className={styles.sectionNav} aria-label="Property detail sections">{sections.map(([id,label])=><button key={id} type="button" aria-current={activeSection===id?'page':undefined} onClick={()=>selectSection(id)}>{label}</button>)}</nav><div ref={bodyRef} className={styles.workspace}><div className={styles.sectionBody}>
    <section hidden={activeSection!=='overview'}>{/* Basic Info */}
                        <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <SectionTitle title="Core Details" icon={Info} />
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <DataRow label="Property Name" value={propertyName} icon={Home} />
                                {property.listingType!=='pre_leased'&&<PropertyPurposeSummary property={property}/>}
<DataRow label="Property Category" value={property.propertyCategory||property.propertyType} />
                                <DataRow label="Property Type / Structure" value={property.structure} />
                                <DataRow label="Residential Layout" value={property.configuration} />
                                <DataRow label="Unit Status" value={property.unitCondition} icon={CheckCircle2} />
                                <DataRow label="Project Condition" value={property.projectCondition} />
                                <DataRow label="Floor" value={property.floor} />
                                <DataRow label="Property ID" value={property.id} />
                                <DataRow label="Record Origin" value={property.createdAs||'owner'} />
                                <DataRow label="Moderation Status" value={property.moderationStatus||'not submitted'} />
                                <DataRow label="Owner Verification" value={property.ownershipVerification||'not required'} />
                                {property.possessionDate && (
                                    <DataRow label="Possession Date" value={formatDate(property.possessionDate)} icon={Calendar} />
                                )}
                            </div>
                        </div>
                        <div className={styles.addressSection}>
                          <SectionTitle title="Property Address" icon={MapPin}/>
                          <p className={styles.fullAddress}>{propertyLocation}</p>
                          <div className="grid grid-cols-2 gap-4">{propertyAddressRows(property).map(row=><DataRow key={row.label} label={row.label} value={row.value}/>)}</div>
                        </div>{/* Property Photos Section */}
                        {hasImages && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="Property Photos" icon={ImageIcon} />
                                <div className="space-y-6">
                                    {property.images && property.images.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Main Images</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                {property.images.map((img, index) => (
                                                    <div 
                                                        key={`main-${index}`} 
                                                        className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 relative h-40 flex items-center justify-center group cursor-pointer shadow-sm hover:shadow-md transition-all" 
                                                        onClick={() => window.open(img, '_blank')}
                                                    >
                                                        <SessionMediaImage
                                                            src={img}
                                                            alt={`Main ${index + 1}`}
                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {property.internalImages && property.internalImages.length > 0 && (
                                        <div className={property.images && property.images.length > 0 ? "pt-6 border-t border-gray-100" : ""}>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Internal Images</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                {property.internalImages.map((img, index) => (
                                                    <div 
                                                        key={`internal-${index}`} 
                                                        className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 relative h-40 flex items-center justify-center group cursor-pointer shadow-sm hover:shadow-md transition-all" 
                                                        onClick={() => window.open(img, '_blank')}
                                                    >
                                                        <SessionMediaImage
                                                            src={img}
                                                            alt={`Internal ${index + 1}`}
                                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}{/* Comments */}
                        <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <SectionTitle title="Specific Comments" icon={FileText} />
                            <div className="p-5 bg-gray-50/80 rounded-xl text-base text-slate-700 whitespace-pre-wrap border border-gray-100 min-h-[100px]">
                                {property.specificComments || "No specific comments provided."}
                            </div>
                        </div></section>
    <section hidden={activeSection!=='ownership'}>{/* Tenant/Owner Info */}
                        <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <SectionTitle title={property.ownerRole === "agent" ? "Agent Details" : "Owner Details"} icon={User} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <DataRow label="Name" value={property.ownerName} className="bg-amber-50/50 border-amber-100" />
                                <DataRow label="Email" value={property.ownerEmail} icon={Mail} className="bg-amber-50/50 border-amber-100" />
                                <DataRow label="Phone" value={property.ownerPhone || property.primaryNo} icon={Phone} className="bg-amber-50/50 border-amber-100" />
                                <DataRow label={property.ownerRole === "agent" ? "Agent ID" : "Owner ID"} value={property.ownerUID} className="bg-amber-50/50 border-amber-100" />
                                <DataRow label="Identity Status" value={property.ownerUID?property.ownershipVerification==='pending'?'Account assigned; verification pending':'Linked account':'Reported owner only — not linked'} className="bg-amber-50/50 border-amber-100" />
                                <DataRow label="Submitted By UID" value={property.submittedByUID} className="bg-amber-50/50 border-amber-100" />
                            </div>
                        </div>{property.createdAs==='tenant'&&activeSection==='ownership'&&<><p>Tenant-submitted property / Owner verification: {property.ownershipVerification||'pending'}</p><div>{Object.entries(property.reportedOwner||{}).map(([key,value])=><DataRow key={key} label={key} value={String(value||'')}/>)}</div>{related.isLoading&&<p role="status">Loading ownership evidence...</p>}{documentsError&&<p role="alert">{documentsError}</p>}<OwnerVerification key={property.id} propertyId={property.id} status={property.ownershipVerification} version={property.ownershipVerificationVersion} reason={property.ownershipVerificationReason} history={property.ownershipVerificationHistory} evidenceDocuments={documents} onDecision={onVerificationChange}/></>}</section>
    <section hidden={activeSection!=='tenancy'}>{property.listingType==='pre_leased'&&<PropertyPurposeSummary property={property}/>}<Link to={`/add-tenant/${property.id}?admin=1`}>Manage tenancy and agreement inventory</Link>{/* Tenants List */}
                        {property.tenants && property.tenants.length > 0 && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="All Registered Tenants" icon={Users} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {property.tenants.map((tenant, idx) => (
                                        <div key={idx} className="border border-blue-100 rounded-xl p-5 bg-blue-50/30 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4 border-b border-blue-100 pb-3">
                                                <div>
                                                    <h4 className="font-bold text-lg text-slate-800">{tenant.firstName} {tenant.lastName}</h4>
                                                </div>
                                                <Badge variant={tenant.isActive ? "default" : "secondary"} className="shadow-sm">
                                                    {tenant.isActive ? "Active" : "Past"}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <DataRow label="Email" value={tenant.email} icon={Mail} className="bg-white border-blue-50" />
                                                <DataRow label="Phone" value={tenant.phone} icon={Phone} className="bg-white border-blue-50" />
                                                <DataRow label="Current contractual rent" value={money(resolveRent(property,localRentDate(property),tenant).amount)} className="bg-white border-blue-50" />
                                                <DataRow label="Due Date" value={tenant.paymentDueDate} className="bg-white border-blue-50" />
                                                <DataRow label="Start Date" value={formatDate(tenant.leaseStartDate)} className="bg-white border-blue-50" />
                                                <DataRow label="End Date" value={formatDate(tenant.leaseEndDate)} className="bg-white border-blue-50" />
                                                <DataRow label="Account UID" value={tenant.userUID} className="bg-white border-blue-50" />
                                                <DataRow label="Relationship Status" value={tenant.userUID?'Linked':tenant.linkConfirmationRequired?'Pending confirmation':'Reported contact'} className="bg-white border-blue-50" />
                                                <DataRow label="Security Deposit" value={money(tenant.securityDeposit)} className="bg-white border-blue-50" />
                                                <DataRow label="Notice / Lock-in" value={[tenant.noticePeriod,tenant.lockInPeriod].filter(Boolean).join(' / ')} className="bg-white border-blue-50" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}{/* Pre-leased Info */}
                        {(property.isPreLeased||property.listingType==='pre_leased') && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="Pre-leased Details" icon={Briefcase} />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <DataRow label="Asset Type" value={property.preLeasedType} className="bg-blue-50/50 border-blue-100 capitalize" />
                                    <DataRow label="Agreement Term" value={property.agreementTerm} className="bg-blue-50/50 border-blue-100" />
                                    <DataRow label="Lock-in Period" value={property.lockInPeriodPreLeased} className="bg-blue-50/50 border-blue-100" />
                                    <DataRow label="Monthly Income" value={property.rentalIncome ? `₹${property.rentalIncome}` : "N/A"} className="bg-blue-50/50 border-blue-100" />
                                    <DataRow label="Escalation" value={property.escalation} className="bg-blue-50/50 border-blue-100" />
                                    <DataRow label="Agreement Start" value={formatDate(property.agreementStartDate)} className="bg-blue-50/50 border-blue-100" />
                                    <DataRow label="Purpose" value={property.purpose} className="bg-blue-50/50 border-blue-100 capitalize" />
                                    <div className="col-span-2 md:col-span-4 lg:col-span-2">
                                        <DataRow label="Tenant Details" value={property.tenantDetails} className="bg-blue-50/50 border-blue-100" />
                                    </div>
                                    <div className="col-span-2 md:col-span-4 lg:col-span-2">
                                        <DataRow label="Specific Requirements" value={property.specificRequirement} className="bg-blue-50/50 border-blue-100" />
                                    </div>
                                </div>
                            </div>
                        )}{/* Buyers List */}
                        {property.buyers && property.buyers.length > 0 && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="Interested Buyers" icon={Users} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {property.buyers.map((buyer, idx) => (
                                        <div key={idx} className="border border-green-100 rounded-xl p-5 bg-green-50/30 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-4 border-b border-green-100 pb-3">
                                                <div>
                                                    <h4 className="font-bold text-lg text-slate-800">{buyer.firstName} {buyer.lastName}</h4>
                                                </div>
                                                <Badge variant={buyer.isActive ? "default" : "secondary"} className="shadow-sm">
                                                    {buyer.isActive ? "Active" : "Closed"}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <DataRow label="Email" value={buyer.email} icon={Mail} className="bg-white border-green-50" />
                                                <DataRow label="Phone" value={buyer.phone} icon={Phone} className="bg-white border-green-50" />
                                                <DataRow label="Offer" value={buyer.offerAmount ? `₹${buyer.offerAmount}` : "N/A"} className="bg-white border-green-50" />
                                                <DataRow label="Closing" value={formatDate(buyer.closingDate)} className="bg-white border-green-50" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}</section>
    <section hidden={activeSection!=='financials'}>{rentalPurpose&&<><DataRow label="Security deposit" value={money(property.securityDeposit)}/><DataRow label="Rent due day" value={property.paymentDueDate}/></>}{/* Area Details */}
                        <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <SectionTitle title="Area & Pricing" icon={Maximize} />
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <DataRow label="Carpet Area" value={area(property.carpetArea,property.carpetAreaUnit||property.areaUnit)} className="bg-blue-50/50 border-blue-100" />
                                <DataRow label="Built-up / Constructed Area" value={area(property.constructedArea,property.constructedAreaUnit||property.areaUnit)} className="bg-blue-50/50 border-blue-100" />
                                {property.plotArea && (
                                    <DataRow label="Plot Area" value={area(property.plotArea,property.plotAreaUnit||property.areaUnit)} className="bg-blue-50/50 border-blue-100" />
                                )}
                                <DataRow label="Listing Purpose" value={property.listingType?.replace('_',' and ')} className="bg-blue-50/50 border-blue-100 capitalize" />
                                {salePurpose&&<DataRow label="Expected Selling Price" value={money(property.sellingPrice)} icon={IndianRupee} className="bg-green-50/50 border-green-100" />}
                                {rentalPurpose&&<DataRow label="Expected Monthly Rent" value={money(property.expectedRent)} icon={IndianRupee} className="bg-green-50/50 border-green-100" />}
                                {rentalPurpose&&<DataRow label="Applicable contractual monthly rent" value={money(propertyPricing(property).label==='Current contractual monthly rent'?propertyPricing(property).amount:null)} icon={IndianRupee} className="bg-green-50/50 border-green-100" />}
                                <DataRow label="Maintenance Charges" value={money(property.maintenanceCharges)} icon={IndianRupee} className="bg-green-50/50 border-green-100" />
                            </div>
                        </div><p>Payment history, payment status and outstanding balances are not included in this property response. Use the authorized payment ledger.</p><Link to={`/manage-property/${property.id}`}>Open Property Hub</Link></section>
    <section hidden={activeSection!=='agreement'}>{/* Agreement Details */}
                        {rentalPurpose && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="Agreement & Security" icon={Shield} />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <DataRow label="Security Deposit" value={money(property.securityDeposit)} className="bg-orange-50/50 border-orange-100" />
                                    <DataRow label="Agreement Period" value={property.agreementPeriod} className="bg-orange-50/50 border-orange-100" />
                                    <DataRow label="Start Date" value={formatDate(property.agreementStartDate)} icon={Calendar} className="bg-orange-50/50 border-orange-100" />
                                    <DataRow label="End Date" value={formatDate(property.agreementEndDate)} icon={Calendar} className="bg-orange-50/50 border-orange-100" />
                                    <DataRow label="Notice Period" value={property.noticePeriod} icon={Clock} className="bg-orange-50/50 border-orange-100" />
                                    <DataRow label="Lock-in Period" value={property.lockInPeriod} className="bg-orange-50/50 border-orange-100" />
                                    <DataRow label="Rent Due Date" value={property.paymentDueDate} className="bg-orange-50/50 border-orange-100" />
                                    <DataRow label="Escalation" value={property.escalationPercentage ? `${property.escalationPercentage}%` : property.escalationAmount} className="bg-orange-50/50 border-orange-100" />
                                    {property.maintenanceToBePaidBy && (
                                        <DataRow label="Maintenance Paid By" value={property.maintenanceToBePaidBy} className="bg-orange-50/50 border-orange-100 capitalize" />
                                    )}
                                    <DataRow label="Agreement Status" value={property.agreementStatus||'Current terms recorded'} className="bg-orange-50/50 border-orange-100" />
                                </div>

                                {property.nextAgreementDraft&&<div className="mt-6 border-t pt-4"><h4 className="font-bold text-slate-800">Future Agreement Draft <Badge variant="outline">Draft — not active</Badge></h4><div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4"><DataRow label="Duration" value={property.nextAgreementDraft.durationMonths?`${property.nextAgreementDraft.durationMonths} months`:undefined}/><DataRow label="Draft Start" value={formatDate(property.nextAgreementDraft.startDate)}/><DataRow label="Draft End" value={formatDate(property.nextAgreementDraft.endDate)}/><DataRow label="Draft Monthly Rent" value={money(property.nextAgreementDraft.monthlyRent)}/><DataRow label="Draft Security Deposit" value={money(property.nextAgreementDraft.securityDeposit)}/><DataRow label="Draft Notice Period" value={property.nextAgreementDraft.noticePeriod}/><DataRow label="Draft Lock-in Period" value={property.nextAgreementDraft.lockInPeriod}/></div></div>}

                                {property.rentSchedule && property.rentSchedule.length > 0 && (
                                    <div className="mt-6 border-t pt-4">
                                        <label className="text-sm font-bold text-slate-700 mb-3 block">Monthly Rent Schedule</label>
                                        <div className="border rounded-md overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-left border-b border-slate-200">
                                                            <th className="px-4 py-2 font-semibold text-slate-600">Year</th>
                                                            <th className="px-4 py-2 font-semibold text-slate-600">Months</th>
                                                            <th className="px-4 py-2 font-semibold text-slate-600">Amount</th>
                                                            <th className="px-4 py-2 font-semibold text-slate-600">From</th>
                                                            <th className="px-4 py-2 font-semibold text-slate-600">To</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {property.rentSchedule.map((item: any, idx: number) => (
                                                            <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                                                <td className="px-4 py-2 text-slate-700 font-medium">{item.year}</td>
                                                                <td className="px-4 py-2 text-slate-600">{item.months || 'Not recorded'}</td>
                                                                <td className="px-4 py-2 text-slate-700 font-medium">₹{Number(item.amount).toLocaleString()}</td>
                                                                <td className="px-4 py-2 text-slate-500">{formatDate(item.fromDate)}</td>
                                                                <td className="px-4 py-2 text-slate-500">{formatDate(item.toDate)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}{property.listingType==='pre_leased'&&<><SectionTitle title="Investment lease" icon={Calendar}/><DataRow label="Lease tenure" value={leaseTenureLabel(property.preLeased)}/><DataRow label="Lease start" value={formatDate(property.preLeased?.leaseStartDate)}/><DataRow label="Lease end" value={formatDate(property.preLeased?.leaseEndDate)}/><p>Investment tenancy evidence is separate from internal tenancy agreements.</p></>}</section>
    <section hidden={activeSection!=='inventory'}>{/* Furnished Checklist */}
                        {property.furnishedChecklist && property.furnishedChecklist.length > 0 && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="Furnished Checklist" icon={CheckCircle2} />
                                <div className={styles.tableScroll}><table><thead><tr><th>Item</th><th>Quantity</th><th>Condition</th></tr></thead><tbody>{property.furnishedChecklist.map((item:any,index:number)=><tr key={index}><td>{typeof item==='string'?item:item.name||'Not recorded'}</td><td>{typeof item==='string'?'Not recorded':item.quantity??'Not recorded'}</td><td>{typeof item==='string'?'Not recorded':item.condition||'Not recorded'}</td></tr>)}</tbody></table></div>
                            </div>
                        )}<p>Original property inventory. Agreement-specific snapshots remain in the tenancy agreement workflow.</p></section>
    <section hidden={activeSection!=='documents'}><SectionTitle title="Property documents" icon={FileText}/>{loadingDocs&&<p role="status">Loading property documents...</p>}{documentsError&&<div role="alert"><p>{documentsError}</p><button type="button" onClick={()=>void related.refetch()}>Retry documents</button></div>}{!loadingDocs&&!documentsError&&!documents.length&&<p>No property documents have been submitted.</p>}{!!documents.length&&<div className={styles.tableScroll}><table><thead><tr><th>Document</th><th>Type</th><th>Status</th><th>Uploaded</th><th>Action</th></tr></thead><tbody>{documents.map((doc:any)=><tr key={doc.id}><td><strong>{doc.documentName||'Unnamed document'}</strong>{doc.description&&<p>{doc.description}</p>}<small>{doc.id}</small></td><td>{doc.documentType||'Not recorded'}</td><td>{doc.status||'submitted'}</td><td>{formatDate(doc.createdAt)}</td><td>{doc.fileUrl?.startsWith('/api/media/')&&fileAccess.phase!=='ready'?<div role="status"><p>{fileAccess.message||'Secure file access is not ready.'}</p>{!['preparing','retrying'].includes(fileAccess.phase)&&<button type="button" onClick={()=>void retryFileAccess()}>Retry secure file access</button>}</div>:doc.fileUrl?<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">View document</a>:'File unavailable'}</td></tr>)}</tbody></table></div>}</section>
    <section hidden={activeSection!=='services'}><SectionTitle title="Services & Inspections" icon={Briefcase}/>{loadingReports&&<p role="status">Loading inspection reports...</p>}{reportsError&&<p role="alert">{reportsError}</p>}{!loadingReports&&!reportsError&&!inspectionReports.length&&<p>No inspection reports recorded.</p>}<ul className={styles.timeline}>{inspectionReports.map((report:any,index:number)=><li key={report.id||index}><strong>{report.title||report.reportType||'Inspection report'}</strong><span>{report.status||'Status not recorded'} / {formatDate(report.createdAt)}</span></li>)}</ul><p>Service request history is available through the existing operations workspace.</p><Link to={`/inspection-report/${property.id}`}>Inspection history</Link></section>
    <section hidden={activeSection!=='moderation'}><SectionTitle title="Listing review" icon={Shield}/><DataRow label="Status" value={property.moderationStatus||'unreviewed'}/><DataRow label="Submitted" value={formatDate(property.createdAt)}/><DataRow label="Revision" value={property.moderationRevision}/><p>Use the listing review panel for decisions and recorded review history.</p></section>
    <section hidden={activeSection!=='activity'}><SectionTitle title="Recorded activity" icon={Clock}/><p>Available history includes property timestamps and recorded moderation decisions.</p><ol className={styles.timeline}>{[{at:property.createdAt,action:'Property created'},...(property.moderationHistory||[]).map(entry=>({at:entry.at,action:entry.action,reason:entry.reason})),{at:property.updatedAt,action:'Property updated'}].filter(entry=>entry.at).sort((a,b)=>String(a.at).localeCompare(String(b.at))).map((entry,index)=><li key={index}><strong>{entry.action.replaceAll('_',' ')}</strong><span>{formatDate(entry.at)}</span>{'reason' in entry&&<p>{entry.reason}</p>}</li>)}</ol></section>
    <footer className={styles.actions}><Link to={`/add-tenant/${property.id}?admin=1`}>Manage tenancy</Link><Link to={`/attach-documents/${property.id}`}>Documents & verification</Link><Link to={`/inspection-report/${property.id}`}>Inspections</Link><Link to={`/review/${property.id}`}>Review history</Link></footer>
    </div><aside className={styles.reviewColumn} aria-label="Property administration">
    <section><h3>Ownership</h3><strong className={styles.personName}>{property.ownerName||property.reportedOwner?.personName||property.reportedOwner?.companyName||'Not recorded'}</strong><p>{property.ownerEmail||property.reportedOwner?.email||'Email not recorded'}</p><p>{property.ownerPhone||property.reportedOwner?.phone||'Phone not recorded'}</p><DataRow label="Verification" value={property.ownershipVerification||'Not recorded'}/><button type="button" onClick={()=>selectSection('ownership')}>Ownership details</button></section>
    {!!property.tenants?.length&&<section><h3>Tenancy</h3>{property.tenants.map((tenant,index)=><div className={styles.tenantSummary} key={tenant.userUID||index}><strong>{[tenant.firstName,tenant.lastName].filter(Boolean).join(' ')||'Name not recorded'}</strong><p>{tenant.isActive?tenant.userUID&&!tenant.linkConfirmationRequired?'Active linked record':'Awaiting confirmation':'Past tenancy'}</p><p>{money(resolveRent(property,localRentDate(property),tenant).amount)||'Rent not recorded'} / month</p><p>{formatDate(tenant.leaseStartDate)} to {formatDate(tenant.leaseEndDate)}</p></div>)}<Link to={`/add-tenant/${property.id}?admin=1`}>Manage tenancy & inventory</Link></section>}
    <section className={styles.reviewPanel}><h3>Listing review</h3><ListingModeration key={`${property.id}:${property.moderationRevision||0}`} property={property} admin/></section>
    <div className={styles.quickActions}><Link to={`/add-tenant/${property.id}?admin=1`}>Manage tenancy</Link><Link to={`/attach-documents/${property.id}`}>Documents & verification</Link><button type="button" onClick={()=>selectSection('services')}>Services & inspections</button></div>
    </aside></div></DialogContent></Dialog>;
};
export default AdminPropertyDetailsDialog;
