"use client";

import { apiFetch } from '@/lib/api-client';

import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../../utils/config";
import { FileText } from "lucide-react";

interface InspectionReportListProps {
    propertyId: string;
}

const InspectionReportList: React.FC<InspectionReportListProps> = ({ propertyId }) => {
    const [inspectionReports, setInspectionReports] = useState<any[]>([]);
    const [failure,setFailure]=useState("");
    const [loadingReports, setLoadingReports] = useState(false);

    useEffect(() => {
        if (propertyId) {
            fetchInspectionReports();
        }
    }, [propertyId]);

    const fetchInspectionReports = async () => {
        setLoadingReports(true);setFailure("");
        try {
            const response = await apiFetch(`${API_BASE_URL}/inspection-reports/property/${propertyId}`);
            if (!response.ok) {
                setFailure("Could not load inspection history. Check your access and try again.");
                return;
            }
            const data = await response.json();
            if (data.success) {
                setInspectionReports(data.reports || []);
            }
        } catch (error) {
            setFailure("Could not load inspection history. Please try again.");
        } finally {
            setLoadingReports(false);
        }
    };

    if (loadingReports) {
        return <p className="text-sm text-muted-foreground">Loading reports...</p>;
    }

    if(failure)return <p role="alert" className="text-destructive">{failure}</p>;
    if (inspectionReports.length === 0) {
        return <p className="mt-4 text-sm text-muted-foreground">No inspection reports yet.</p>;
    }

    return (
        <div className="mt-4 space-y-4 w-full">
            <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Inspection Reports & Documents
            </h3>
            <div className="grid gap-4">
                {inspectionReports.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4 bg-indigo-50/30">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-semibold text-sm">
                                    {report.reportType === "on_possession" ? "On Possession" : "On Handover"}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    Submitted by: {report.userName}
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
        </div>
    );
};

export default InspectionReportList;
