"use client";
import styles from "./AdminUserDetailsDialog.module.css";

import { apiFetch } from '@/lib/api-client';

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/ui/dialog";
import { Badge } from "@/ui/badge";
import { ScrollArea } from "@/ui/scroll-area";
import { API_BASE_URL } from "../../utils/config";
import { FileText, User as UserIcon, Phone, Mail } from "lucide-react";

interface AdminUserDetailsDialogProps {
    user: any | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

const AdminUserDetailsDialog: React.FC<AdminUserDetailsDialogProps> = ({
    user,
    isOpen,
    onOpenChange,
}) => {
    const [inspectionReports, setInspectionReports] = useState<any[]>([]);
    const [loadingReports, setLoadingReports] = useState(false);

    useEffect(() => {
        if (isOpen && user?.uid) {
            fetchInspectionReports();
        }
    }, [isOpen, user?.uid]);

    const fetchInspectionReports = async () => {
        setLoadingReports(true);
        try {
            const response = await apiFetch(`${API_BASE_URL}/inspection-reports/user/${user.uid}`);
            const data = await response.json();
            if (data.success) {
                setInspectionReports(data.reports || []);
            }
        } catch (error) {
            console.error("Failed to fetch inspection reports:", error);
        } finally {
            setLoadingReports(false);
        }
    };

    if (!user) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={`${styles.userDialog} max-w-3xl max-h-[90vh]`}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <UserIcon className="w-6 h-6 text-primary" />
                        User Details
                    </DialogTitle>
                    <DialogDescription>
                        Detailed information for {user.name}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-full max-h-[calc(90vh-8rem)] pr-4">
                    <div className="space-y-6 pb-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Name</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{user.name}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Role</span>
                                <div>
                                    <Badge variant="outline" className="capitalize">{user.role || 'Individual'}</Badge>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Email</span>
                                <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    <span>{user.email}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Phone</span>
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    <span>{user.phoneNumber || 'N/A'}</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</span>
                                <div>
                                    <Badge variant={user.isActive ? "default" : "secondary"}>
                                        {user.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Inspection Reports Section */}
                        <div className="mt-8 space-y-4">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-500" />
                                Submitted Inspection Reports
                            </h3>
                            {loadingReports ? (
                                <p className="text-sm text-muted-foreground">Loading reports...</p>
                            ) : inspectionReports.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No inspection reports submitted by this user.</p>
                            ) : (
                                <div className="grid gap-4">
                                    {inspectionReports.map((report) => (
                                        <div key={report.id} className="border rounded-lg p-4 bg-indigo-50/30">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-semibold text-sm">
                                                        {report.reportType === "on_possession" ? "On Possession" : "On Handover"}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        Property ID: {report.propertyId}
                                                    </p>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(report.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-sm mt-2 whitespace-pre-line">{report.report}</p>

                                            {/* Keys Details */}
                                            {report.keysDetails && (
                                                <div className="mt-3">
                                                    <span className="text-xs font-semibold">Keys Details:</span>
                                                    <p className="text-sm">{report.keysDetails}</p>
                                                </div>
                                            )}

                                            {/* Files */}
                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {report.possessionLetterFile && (
                                                    <a href={report.possessionLetterFile} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        📄 Possession Letter
                                                    </a>
                                                )}
                                                {report.handoverLetterFile && (
                                                    <a href={report.handoverLetterFile} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        📄 Handover Letter
                                                    </a>
                                                )}
                                                {report.electricityBillMeterImage && (
                                                    <a href={report.electricityBillMeterImage} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        🖼️ Electricity Meter
                                                    </a>
                                                )}
                                                {report.electricityBillReceipt && (
                                                    <a href={report.electricityBillReceipt} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        📄 Electricity Receipt
                                                    </a>
                                                )}
                                                {report.apartmentConditionImage && (
                                                    <a href={report.apartmentConditionImage} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        🖼️ Apartment Condition
                                                    </a>
                                                )}
                                                {report.apartmentConditionImages && report.apartmentConditionImages.length > 0 && report.apartmentConditionImages.map((img: string, idx: number) => (
                                                    <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        🖼️ Apartment Condition {idx + 1}
                                                    </a>
                                                ))}
                                                {report.mglBillMeterImage && (
                                                    <a href={report.mglBillMeterImage} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        🖼️ MGL Meter
                                                    </a>
                                                )}
                                                {report.mglBillReceipt && (
                                                    <a href={report.mglBillReceipt} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        📄 MGL Receipt
                                                    </a>
                                                )}
                                                {report.internetImage && (
                                                    <a href={report.internetImage} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        🖼️ Internet Meter/Router
                                                    </a>
                                                )}
                                                {report.internetReceipt && (
                                                    <a href={report.internetReceipt} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                                        📄 Internet Receipt
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default AdminUserDetailsDialog;
