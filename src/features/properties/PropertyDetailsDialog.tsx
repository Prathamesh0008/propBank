"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Property } from "@/services/propertyService";
import { Building2, MapPin, Home, Ruler, Calendar, Banknote, Image as ImageIcon } from "lucide-react";

interface PropertyDetailsDialogProps {
    property: Property;
}

const PropertyDetailsDialog = ({ property }: PropertyDetailsDialogProps) => {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                    View Property
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border-gray-100 shadow-2xl">
                <DialogHeader className="space-y-1">
                    <DialogTitle className="text-xl font-extrabold text-slate-900 uppercase tracking-tight">
                        {property.title}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-1.5 text-sm text-slate-500 font-semibold uppercase tracking-wider">
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                        {property.address || property.city || "Location not specified"}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 py-4">
                    {/* Main Info Grid */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100/80">
                        {/* Configuration */}
                        {property.configuration && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                    <Home className="h-3.5 w-3.5" />
                                    <span>Configuration</span>
                                </div>
                                <p className="font-bold text-slate-800 text-sm">{property.configuration}</p>
                            </div>
                        )}

                        {/* Condition */}
                        {property.unitCondition && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                    <Building2 className="h-3.5 w-3.5" />
                                    <span>Condition</span>
                                </div>
                                <p className="font-bold text-slate-800 text-sm capitalize">{property.unitCondition}</p>
                            </div>
                        )}

                        {/* Carpet Area */}
                        {property.carpetArea && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                    <Ruler className="h-3.5 w-3.5" />
                                    <span>Carpet Area</span>
                                </div>
                                <p className="font-bold text-slate-800 text-sm">{property.carpetArea}</p>
                            </div>
                        )}

                        {/* Constructed/Built-up Area */}
                        {property.constructedArea && (
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                    <Ruler className="h-3.5 w-3.5" />
                                    <span>Buildup Area</span>
                                </div>
                                <p className="font-bold text-slate-800 text-sm">{property.constructedArea}</p>
                            </div>
                        )}

                        {/* Possession */}
                        {(property.projectCondition || (property.possessionDate && !(property.listingType === 'rent' && property.rentalStatus === 'rented'))) && (
                            <div className="col-span-2 space-y-1 pt-1.5 border-t border-slate-100">
                                <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Possession Date</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {property.projectCondition && (
                                        <Badge variant="outline" className="font-bold text-xs capitalize text-slate-700 bg-slate-100 border-slate-200">
                                            {property.projectCondition}
                                        </Badge>
                                    )}
                                    {property.possessionDate && !(property.listingType === 'rent' && property.rentalStatus === 'rented') && (
                                        <span className="text-sm font-bold text-slate-800">
                                            {new Date(property.possessionDate).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Internal Images */}
                    {property.internalImages && property.internalImages.length > 0 && (
                        <div className="border-t border-slate-100 pt-4">
                            <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider mb-2">
                                <ImageIcon className="h-3.5 w-3.5" />
                                <span>Internal Images</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {property.internalImages.map((img, idx) => (
                                    <div key={idx} className="aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200/50">
                                        <img src={img} alt={`Internal ${idx}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pre-leased Info */}
                    {property.isPreLeased && (
                        <div className="border-t border-slate-100 pt-4">
                            <div className="flex items-center gap-1.5 text-blue-600 font-bold uppercase text-[10px] tracking-wider mb-3">
                                <Building2 className="h-3.5 w-3.5" />
                                <span>Pre-leased Property Details</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-blue-50/40 p-4 rounded-xl border border-blue-100/50">
                                {property.preLeasedType && (
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Asset Type</span>
                                        <p className="text-sm font-bold text-slate-800 capitalize">{property.preLeasedType}</p>
                                    </div>
                                )}
                                {property.rentalIncome && (
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Monthly Income</span>
                                        <p className="text-sm font-bold text-slate-800">₹{property.rentalIncome}</p>
                                    </div>
                                )}
                                {property.agreementTerm && (
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Agreement Term</span>
                                        <p className="text-sm font-bold text-slate-800">{property.agreementTerm}</p>
                                    </div>
                                )}
                                {property.lockInPeriodPreLeased && (
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Lock-in Period</span>
                                        <p className="text-sm font-bold text-slate-800">{property.lockInPeriodPreLeased}</p>
                                    </div>
                                )}
                                {property.escalation && (
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Escalation</span>
                                        <p className="text-sm font-bold text-slate-800">{property.escalation}</p>
                                    </div>
                                )}
                                {property.purpose && (
                                    <div className="space-y-0.5">
                                        <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Sale Purpose</span>
                                        <p className="text-sm font-bold text-slate-800 capitalize">{property.purpose}</p>
                                    </div>
                                )}
                                {property.tenantDetails && (
                                    <div className="col-span-2 space-y-0.5 mt-1 pt-1.5 border-t border-blue-100/50">
                                        <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Tenant Details</span>
                                        <p className="text-sm font-semibold text-slate-800">{property.tenantDetails}</p>
                                    </div>
                                )}
                                {property.specificRequirement && (
                                    <div className="col-span-2 space-y-0.5 mt-1 pt-1.5 border-t border-blue-100/50">
                                        <span className="text-[9px] text-blue-500 uppercase font-bold tracking-wider">Specific Requirements</span>
                                        <p className="text-sm font-semibold text-slate-700 italic">{property.specificRequirement}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pricing Block */}
                    {!(property.listingType === 'rent' && property.rentalStatus === 'rented') && (
                        <div className="border-t border-slate-100 pt-4">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-1.5 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                                    <Banknote className="h-3.5 w-3.5" />
                                    <span>Pricing</span>
                                </div>
                                {property.listingType === 'rent' && (
                                    <Badge variant="secondary" className="font-bold text-xs uppercase text-blue-700 bg-blue-50 border-blue-100">
                                        For Rent
                                    </Badge>
                                )}
                                {property.listingType === 'sell' && (
                                    <Badge variant="secondary" className="font-bold text-xs uppercase text-emerald-700 bg-emerald-50 border-emerald-100">
                                        For Sale
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                    ₹{
                                        property.price > 0
                                            ? property.price.toLocaleString('en-IN')
                                            : property.listingType === 'rent' && property.monthlyRent
                                                ? parseInt(property.monthlyRent).toLocaleString('en-IN')
                                                : property.listingType === 'sell' && property.sellingPrice
                                                    ? parseInt(property.sellingPrice).toLocaleString('en-IN')
                                                    : "0"
                                    }
                                </span>
                                {property.listingType === 'rent' && (
                                    <span className="text-sm font-semibold text-slate-400 lowercase">/month</span>
                                )}
                            </div>

                            {/* Availability Status */}
                            {property.rentalStatus && (
                                <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-slate-100/60">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Availability:</span>
                                    <span className={`text-sm font-bold uppercase ${
                                        property.rentalStatus === 'available' ? 'text-emerald-600' : 'text-amber-600'
                                    }`}>
                                        {property.rentalStatus}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PropertyDetailsDialog;
