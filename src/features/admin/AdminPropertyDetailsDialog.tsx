"use client";
import styles from "./AdminPropertyDetailsDialog.module.css";

import {Link} from '@/lib/navigation';
import { apiFetch } from '@/lib/api-client';

import React from "react";
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
import { useState, useEffect } from "react";
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
    const [inspectionReports, setInspectionReports] = useState<any[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [documentsError,setDocumentsError]=useState('');
    const [reportsError,setReportsError]=useState('');

    useEffect(() => {
        if (isOpen && property?.id) {
            fetchInspectionReports();
            fetchDocuments();
        }
    }, [isOpen, property?.id]);

    const fetchInspectionReports = async () => {
        setLoadingReports(true);
        setReportsError('');
        try {
            const response = await apiFetch(`${API_BASE_URL}/inspection-reports/property/${property?.id}`);
            const data = await response.json();
            if (data.success) {
                setInspectionReports(data.reports || []);
            }
        } catch (error) {
            setReportsError('Inspection reports could not be loaded.');
            console.error("Failed to fetch inspection reports:", error);
        } finally {
            setLoadingReports(false);
        }
    };

    const fetchDocuments = async () => {
        setLoadingDocs(true);
        setDocumentsError('');
        try {
            const response = await apiFetch(`${API_BASE_URL}/documents/property/${property?.id}`);
            const data = await response.json();
            if (data.success) {
                setDocuments(data.documents || []);
            }
        } catch (error) {
            setDocumentsError('Documents could not be loaded.');
            console.error("Failed to fetch documents:", error);
        } finally {
            setLoadingDocs(false);
        }
    };

    if (!property) return null;

    const formatDate = (dateString?: string) => {
        if (!dateString) return "N/A";
        const dateOnly=/^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
        if(dateOnly)return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
        try {
            return new Date(dateString).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    };

    const SectionTitle = ({ title, icon: Icon }: { title: string, icon: any }) => (
        <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-100 text-slate-800">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-xl tracking-tight">{title}</h3>
        </div>
    );

    const DataRow = ({ label, value, icon: Icon, className }: { label: string, value: string | number | undefined | null, icon?: any, className?: string }) => (
        <div className={`flex flex-col p-4 bg-gray-50/50 rounded-xl border border-gray-100 min-w-0 overflow-hidden ${className || ''}`}>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1.5 font-medium">
                {Icon && <Icon className="w-4 h-4 flex-shrink-0 text-slate-400" />}
                <span className="truncate">{label}</span>
            </div>
            <div className="text-base font-semibold text-slate-900 break-words whitespace-pre-wrap capitalize">{value===undefined||value===null||value==='' ? "Not provided" : value}</div>
        </div>
    );

    const hasImages = (property.images && property.images.length > 0) || (property.internalImages && property.internalImages.length > 0);
    const propertyName=property.title?.trim()||property.buildingName?.trim()||`Property ${property.id}`;
    const propertyLocation=[property.location||property.address,property.city,property.zipCode].filter(value=>String(value||'').trim()).join(', ')||'Location not provided';
    const listingLabel=(property.listingType||'manage').replace('_',' and ');
    const area=(value?:string,unit?:string)=>value?[value,unit].filter(Boolean).join(' '):undefined;
    const money=(value?:string)=>value!==undefined&&value!==''?`₹${Number(value).toLocaleString('en-IN',{maximumFractionDigits:2})}`:undefined;
    const rentalPurpose=['rent','sell_rent'].includes(property.listingType||'');
    const salePurpose=['sell','sell_rent'].includes(property.listingType||'');

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={`${styles.detailsDialog} max-w-[100vw] w-screen h-[100dvh] max-h-[100dvh] sm:max-w-[100vw] sm:rounded-none border-0 p-0 flex flex-col gap-0 overflow-hidden`}>
                <DialogHeader className={`${styles.dialogHeading} p-6 pb-6 border-b shrink-0 z-10 relative`}>
                    {property.createdAs==='tenant'&&<section className="max-w-6xl mx-auto mb-4 p-3 border rounded bg-amber-50"><p className="font-semibold">Tenant-submitted property · Owner verification {property.ownershipVerification}</p><p>Submitted by: {property.submittedByUID}</p><dl className="grid sm:grid-cols-2 gap-2 text-sm">{Object.entries(property.reportedOwner||{}).map(([key,value])=><div key={key} className="break-words"><dt className="font-medium">{({companyName:'Owner company',personName:'Owner person',phone:'Owner contact',alternatePhone:'Alternate contact',email:'Owner email',workingProfile:'Working profile'} as Record<string,string>)[key]||key}</dt><dd>{value||'Not supplied'}</dd></div>)}</dl></section>}
                    <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-6">
                        <div>
                            <DialogTitle className="text-3xl font-bold mb-2 text-slate-800 tracking-tight">{propertyName}</DialogTitle>
                            <DialogDescription className="flex items-center gap-1.5 text-base text-slate-500 font-medium">
                                <MapPin className="w-4 h-4 text-blue-600" />
                                {propertyLocation}
                            </DialogDescription>
                        </div>
                        <div className="flex flex-wrap gap-2 md:mr-12">
                            <Badge variant={property.listingType === 'sell' ? 'default' : 'secondary'} className="capitalize pointer-events-none px-3 py-1 text-sm font-medium">
                                For {listingLabel}
                            </Badge>
                            {rentalPurpose && (
                                <Badge variant={property.rentalStatus === 'rented' || property.isRented ? 'destructive' : 'outline'} className="capitalize pointer-events-none px-3 py-1 text-sm font-medium">
                                    {property.rentalStatus === 'rented' || property.isRented ? 'Rented' : 'Available'}
                                </Badge>
                            )}
                            {salePurpose && (
                                <Badge variant={property.isSold ? 'destructive' : 'outline'} className="capitalize pointer-events-none px-3 py-1 text-sm font-medium">
                                    {property.isSold ? 'Sold' : 'Available'}
                                </Badge>
                            )}
                            <Badge variant={property.status === 'active' ? 'default' : 'secondary'} className="bg-green-100 text-green-800 border-green-200 capitalize pointer-events-none px-3 py-1 text-sm font-medium">
                                {property.status}
                            </Badge>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => onOpenChange(false)}
                        className="absolute right-4 top-4 md:right-8 md:top-8 rounded-full p-2 bg-white border border-gray-200 shadow-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors z-20"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </DialogHeader>

                <ScrollArea className="flex-1 p-6 md:p-10 overflow-y-auto">
                    <ListingModeration key={`${property.id}:${property.moderationRevision||0}`} property={property} admin/>
                    {property.createdAs==='tenant'&&<OwnerVerification key={property.id} propertyId={property.id} status={property.ownershipVerification} version={property.ownershipVerificationVersion} reason={property.ownershipVerificationReason} history={property.ownershipVerificationHistory} evidenceDocuments={documents} onDecision={onVerificationChange}/>}
                    <div className="max-w-6xl mx-auto w-full flex flex-col gap-8 pb-16">

                        {/* Basic Info */}
                        <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <SectionTitle title="Core Details" icon={Info} />
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <DataRow label="Property Name" value={propertyName} icon={Home} />
                                <DataRow label="Property Category" value={property.propertyCategory||property.propertyType} />
                                <DataRow label="Property Type / Structure" value={property.structure} />
                                <DataRow label="Residential Layout" value={property.configuration} />
                                <DataRow label="Unit Status" value={property.unitCondition} icon={CheckCircle2} />
                                <DataRow label="Project Condition" value={property.projectCondition} />
                                <DataRow label="Unit Number" value={property.unitNumber} />
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

                        {/* Property Photos Section */}
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
                        )}

                        {/* Area Details */}
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
                                {rentalPurpose&&<DataRow label="Finalized Monthly Rent" value={money(property.monthlyRent)} icon={IndianRupee} className="bg-green-50/50 border-green-100" />}
                                <DataRow label="Maintenance Charges" value={money(property.maintenanceCharges)} icon={IndianRupee} className="bg-green-50/50 border-green-100" />
                            </div>
                        </div>

                        {/* Tenant/Owner Info */}
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
                        </div>



                        {/* Tenants List */}
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
                                                <DataRow label="Rent" value={tenant.monthlyRent ? `₹${tenant.monthlyRent}` : "N/A"} className="bg-white border-blue-50" />
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
                        )}

                        {/* Pre-leased Info */}
                        {property.isPreLeased && (
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
                        )}

                        {/* Buyers List */}
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
                        )}

                        {/* Agreement Details */}
                        {rentalPurpose && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="Agreement & Security" icon={Shield} />
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <DataRow label="Security Deposit" value={property.securityDeposit ? `₹${property.securityDeposit}` : "N/A"} className="bg-orange-50/50 border-orange-100" />
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
                                                                <td className="px-4 py-2 text-slate-600">{item.months || '11'}</td>
                                                                <td className="px-4 py-2 text-slate-700 font-medium">₹{Number(item.amount).toLocaleString()}</td>
                                                                <td className="px-4 py-2 text-slate-500">{item.fromDate ? new Date(item.fromDate).toLocaleDateString() : 'N/A'}</td>
                                                                <td className="px-4 py-2 text-slate-500">{item.toDate ? new Date(item.toDate).toLocaleDateString() : 'N/A'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Furnished Checklist */}
                        {property.furnishedChecklist && property.furnishedChecklist.length > 0 && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="Furnished Checklist" icon={CheckCircle2} />
                                <div className="flex flex-wrap gap-3">
                                    {property.furnishedChecklist.map((item: any, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 px-4 py-1.5 text-sm font-medium">
                                            {typeof item === 'string' ? item : item.name || JSON.stringify(item)}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Comments */}
                        <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                            <SectionTitle title="Specific Comments" icon={FileText} />
                            <div className="p-5 bg-gray-50/80 rounded-xl text-base text-slate-700 whitespace-pre-wrap border border-gray-100 min-h-[100px]">
                                {property.specificComments || "No specific comments provided."}
                            </div>
                        </div>

                        {/* Attached Documents */}
                        <div aria-live="polite">{loadingDocs&&<p>Loading property documents…</p>}{documentsError&&<p role="alert">{documentsError}</p>}{!loadingDocs&&!documentsError&&!documents.length&&<p>No property documents have been submitted.</p>}{loadingReports&&<p>Loading inspection reports…</p>}{reportsError&&<p role="alert">{reportsError}</p>}{!loadingReports&&!reportsError&&<p>{inspectionReports.length?`${inspectionReports.length} inspection report${inspectionReports.length===1?'':'s'} available.`:'No inspection reports have been submitted.'}</p>}</div>
                        {documents && documents.length > 0 && (
                            <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                                <SectionTitle title="Attached Documents" icon={FileText} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {documents.map((doc, idx) => (
                                        <div key={idx} className="flex flex-col p-5 bg-blue-50/30 rounded-xl border border-blue-100 shadow-sm transition-all hover:shadow-md">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                                    <FileText className="w-5 h-5 text-blue-600" />
                                                    <span className="truncate max-w-[200px]" title={doc.documentName}>{doc.documentName}</span>
                                                </div>
                                                <Badge variant="outline" className="text-xs bg-white border-blue-200 text-blue-700 capitalize">
                                                    {doc.documentType}
                                                </Badge>
                                            </div>
                                            {doc.description && (
                                                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{doc.description}</p>
                                            )}
                                            <p className="mb-2 text-xs text-slate-500">Status: {doc.status||'submitted'}</p>
                                            <p className="mb-2 text-xs text-slate-500">Evidence reference: {doc.id}</p>
                                            <div className="mt-auto flex justify-between items-center pt-3 border-t border-blue-100">
                                                <span className="text-xs font-medium text-slate-500">{formatDate(doc.createdAt)}</span>
                                                <a 
                                                    href={doc.fileUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    View
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-4 mt-6"><Link to={`/add-tenant/${property.id}?admin=1`}>Assign, replace or remove tenant</Link><Link to={`/attach-documents/${property.id}`}>Documents, receipts and report verification</Link><Link to={`/inspection-report/${property.id}`}>Inspection history</Link><Link to={`/review/${property.id}`}>Review history</Link></div>
                        {/* Timestamps */}
                        <div className="mt-8 pt-6 border-t border-gray-300 flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <span>Created: {formatDate(property.createdAt)}</span>
                            <span>Last Updated: {formatDate(property.updatedAt)}</span>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default AdminPropertyDetailsDialog;
