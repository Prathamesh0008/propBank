"use client";
import styles from "./AdminServiceRequestsTab.module.css";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { TabsContent } from "@/ui/tabs";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Badge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";
import { 
  AlertCircle, User as UserIcon, Mail, Phone, CheckCircle2, 
  Loader2, Upload, MessageSquare, Save, ImageIcon, FileText 
} from "lucide-react";
import InspectionReportList from "@/features/services/InspectionReportList";
import { AdminNotification } from "./AdminTypes";
import { Property } from "@/services/propertyService";

const AttachmentPreview = ({ url }: { url: string }) => {
  const [error, setError] = useState(false);
  const isPdf = url.toLowerCase().includes('.pdf') || url.includes('application/pdf');

  if (isPdf || error) {
    return (
      <div 
        className="flex flex-col items-center justify-center w-48 h-48 bg-slate-50 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => window.open(url, '_blank')}
      >
        <FileText className="w-12 h-12 text-blue-500 mb-2" />
        <span className="text-sm font-medium text-slate-700">View Document</span>
      </div>
    );
  }

  return (
    <div className="relative inline-block group cursor-pointer" onClick={() => window.open(url, '_blank')}>
      <img 
        src={url} 
        alt="Attachment" 
        className="h-48 object-contain rounded-md border bg-white"
        onError={() => setError(true)}
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md pointer-events-none">
        <span className="text-white text-sm font-medium">Click to view</span>
      </div>
    </div>
  );
};

export interface AdminServiceRequestsTabProps {
  loading: boolean;
  notifications: AdminNotification[];
  handleMarkComplete: (notificationId: string, completed: boolean) => Promise<void>;
  handleViewPropertyDetails: (propertyId: string) => void;
  loadingProperty: boolean;
  selectedProperty: Property | null;
  updating: string | null;
  uploadingRemarkImage: string | null;
  remarkImages: Record<string, string>;
  handleRemarkImageUpload: (notificationId: string, file: File) => Promise<void>;
  handleSaveRemarks: (notificationId: string, remarks: string, imageUrl?: string) => Promise<void>;
}

export const AdminServiceRequestsTab: React.FC<AdminServiceRequestsTabProps> = ({
  loading,
  notifications,
  handleMarkComplete,
  handleViewPropertyDetails,
  loadingProperty,
  selectedProperty,
  updating,
  uploadingRemarkImage,
  remarkImages,
  handleRemarkImageUpload,
  handleSaveRemarks
}) => {
  return (
        <TabsContent value="service-requests" className={`${styles.requests} mt-6`}>
          <Card className={styles.surface}>
            <CardHeader>
              <CardTitle>Active Service Requests</CardTitle>
              <CardDescription>
                Property sale requests and property enquiries - Owner/User details with Name, Email, Phone Number
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className={styles.emptyStatus}>
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <p><strong>Service requests</strong><span>No active requests</span></p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notification) => (
                    <Card key={notification.id} className={`${styles.entry} ${notification.type === "want_to_sell_cancelled" ? styles.urgent : ""}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">{notification.title}</h3>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">Active</span>
                              </div>
                              {/* Only show message for notifications that don't have custom display */}
                              {notification.type !== "property_enquiry" && notification.type !== "service_request" && notification.type !== "review" && notification.type !== "legal_service_request" && notification.type !== "other_service_request" && notification.type !== "inspection_report" && notification.type !== "general_inquiry" && notification.type !== "agreement_termination" && notification.type !== "agreement_renewal" && (
                                <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                              )}
                              {(notification.type === "agreement_termination" || notification.type === "agreement_renewal") && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {notification.type === "agreement_termination"
                                    ? "An agreement has been terminated. See details below."
                                    : "An agreement renewal request has been submitted. See details below."}
                                </p>
                              )}
                              {notification.type === "property_enquiry" && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  A user is interested in this property. See details below.
                                </p>
                              )}
                              {notification.type === "service_request" && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  A user has raised a service request. See details below.
                                </p>
                              )}
                              {notification.type === "review" && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  A review has been submitted for this property. See details below.
                                </p>
                              )}
                              {notification.type === "legal_service_request" && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  A legal service request has been submitted. See details below.
                                </p>
                              )}
                              {notification.type === "other_service_request" && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  An other service request has been submitted. See details below.
                                </p>
                              )}
                              {notification.type === "inspection_report" && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  An inspection report has been submitted. See details below.
                                </p>
                              )}
                              {notification.type === "general_inquiry" && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  A general inquiry has been submitted. See details below.
                                </p>
                              )}
                              {notification.type === "document_upload" && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  A new document has been uploaded for this property. See details below.
                                </p>
                              )}
                            </div>

                            {/* For Property Enquiry: Show User, Owner, and Property details in separate sections */}
                            {notification.type === "property_enquiry" ? (() => {
                              // Parse user details from message for backwards compatibility with old notifications
                              let parsedUserName = notification.userName;
                              let parsedUserEmail = notification.userEmail;
                              let parsedUserPhone = notification.userPhone;

                              // If structured fields are missing or empty, try to parse from message for backwards compatibility
                              const message = notification.message || '';

                              // Parse user name
                              if (!parsedUserName || parsedUserName.trim() === '') {
                                // Try format 1: "User {name} is interested"
                                let nameMatch = message.match(/User\s+([^\s]+(?:\s+[^\s]+)*?)\s+is interested/i);
                                if (nameMatch) {
                                  parsedUserName = nameMatch[1]?.trim();
                                }

                                // Try format 2: "- Name: {name}"
                                if (!parsedUserName || parsedUserName.trim() === '') {
                                  nameMatch = message.match(/Name:\s*([^\n-]+)/i);
                                  if (nameMatch) parsedUserName = nameMatch[1]?.trim();
                                }
                              }

                              // Parse user email
                              if (!parsedUserEmail || parsedUserEmail.trim() === '') {
                                // Extract email from message - handle both formats: "Email: {email}" or "- Email: {email}"
                                const emailMatch = message.match(/Email:\s*([^\n-]+)/i);
                                if (emailMatch) parsedUserEmail = emailMatch[1]?.trim();
                              }

                              // Parse user phone
                              if (!parsedUserPhone || parsedUserPhone.trim() === '') {
                                // Extract phone from message - handle both formats: "Phone: {phone}" or "- Phone: {phone}"
                                const phoneMatch = message.match(/Phone:\s*([^\n-]+)/i);
                                if (phoneMatch) parsedUserPhone = phoneMatch[1]?.trim();
                              }

                              return (
                                <div className="space-y-4 mt-4">
                                  {/* User Details Section (Person who enquired) */}
                                  <div className="border rounded-lg p-4 bg-blue-50/50">
                                    <h4 className="font-semibold text-sm mb-3 text-blue-900">User Details (Person Who Enquired)</h4>
                                    {(parsedUserName || parsedUserEmail || parsedUserPhone) ? (
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {parsedUserName && (
                                          <div className="flex items-center gap-2">
                                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">{parsedUserName}</span>
                                          </div>
                                        )}
                                        {parsedUserEmail && (
                                          <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <a
                                              href={`mailto:${parsedUserEmail}`}
                                              className="text-sm text-blue-600 hover:underline"
                                            >
                                              {parsedUserEmail}
                                            </a>
                                          </div>
                                        )}
                                        {parsedUserPhone && (
                                          <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            <a
                                              href={`tel:${parsedUserPhone}`}
                                              className="text-sm text-blue-600 hover:underline"
                                            >
                                              {parsedUserPhone}
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">
                                        User details not available.
                                      </div>
                                    )}
                                  </div>

                                  {/* Owner Details Section */}
                                  <div className="border rounded-lg p-4 bg-green-50/50">
                                    <h4 className="font-semibold text-sm mb-3 text-green-900">Owner Details</h4>
                                    {(notification.ownerName || notification.ownerEmail || notification.ownerPhone) ? (
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {notification.ownerName && (
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">{notification.ownerName}</span>
                                            {notification.ownerRole && (
                                              <Badge variant="outline" className={`text-[10px] h-5 px-2 py-0 capitalize ${
                                                notification.ownerRole === "agent"
                                                  ? "bg-purple-100 text-purple-800 border-purple-300"
                                                  : "bg-green-100 text-green-800 border-green-300"
                                              }`}>
                                                {notification.ownerRole === "agent" ? "Agent" : "Owner"}
                                              </Badge>
                                            )}
                                          </div>
                                        )}
                                        {notification.ownerEmail && (
                                          <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            <a
                                              href={`mailto:${notification.ownerEmail}`}
                                              className="text-sm text-blue-600 hover:underline"
                                            >
                                              {notification.ownerEmail}
                                            </a>
                                          </div>
                                        )}
                                        {notification.ownerPhone && (
                                          <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            <a
                                              href={`tel:${notification.ownerPhone}`}
                                              className="text-sm text-blue-600 hover:underline"
                                            >
                                              {notification.ownerPhone}
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">
                                        Owner details not available.
                                      </div>
                                    )}
                                  </div>

                                  {/* Property Details Section - Always show if propertyId exists */}
                                  {notification.propertyId && (
                                    <div className="border rounded-lg p-4 bg-purple-50/50">
                                      <h4 className="font-semibold text-sm mb-3 text-purple-900">Property Details</h4>
                                      <div className="space-y-2">
                                        <div className="flex items-start gap-2">
                                          <span className="text-sm font-medium text-muted-foreground">Property ID:</span>
                                          <span className="text-sm font-mono">{notification.propertyId}</span>
                                        </div>
                                        {notification.propertyTitle ? (
                                          <div className="flex items-start gap-2">
                                            <span className="text-sm font-medium text-muted-foreground">Property Name:</span>
                                            <span className="text-sm">{notification.propertyTitle}</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-start gap-2">
                                            <span className="text-sm font-medium text-muted-foreground">Property Name:</span>
                                            <span className="text-sm text-muted-foreground italic">Not available</span>
                                          </div>
                                        )}
                                        {notification.propertyAddress ? (
                                          <div className="flex items-start gap-2">
                                            <span className="text-sm font-medium text-muted-foreground">Address:</span>
                                            <span className="text-sm">{notification.propertyAddress}</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-start gap-2">
                                            <span className="text-sm font-medium text-muted-foreground">Address:</span>
                                            <span className="text-sm text-muted-foreground italic">Not available</span>
                                          </div>
                                        )}
                                        {notification.propertyListingType ? (
                                          <div className="flex items-start gap-2">
                                            <span className="text-sm font-medium text-muted-foreground">Listing Type:</span>
                                            <span className="text-sm capitalize">{notification.propertyListingType}</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-start gap-2">
                                            <span className="text-sm font-medium text-muted-foreground">Listing Type:</span>
                                            <span className="text-sm capitalize">{notification.propertyListingType || 'Rent'}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })() : notification.type === "review" ? (
                              /* For Review: Show structured reviewer, property, and review details */
                              <div className="mt-4 space-y-4">
                                {/* Reviewer Details */}
                                <div className="border rounded-lg p-4 bg-blue-50/50">
                                  <h4 className="font-semibold text-sm mb-3 text-blue-900">
                                    Reviewer Details
                                    {notification.reviewerType && (
                                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                        notification.reviewerType === "tenant"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-orange-100 text-orange-800"
                                      }`}>
                                        {notification.reviewerType === "tenant" ? "Tenant" : "Owner"}
                                      </span>
                                    )}
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {notification.userName && (
                                      <div className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{notification.userName}</span>
                                      </div>
                                    )}
                                    {notification.userEmail && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <a href={`mailto:${notification.userEmail}`} className="text-sm text-blue-600 hover:underline">
                                          {notification.userEmail}
                                        </a>
                                      </div>
                                    )}
                                    {notification.userPhone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <a href={`tel:${notification.userPhone}`} className="text-sm text-blue-600 hover:underline">
                                          {notification.userPhone}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Property Details */}
                                {(notification.propertyTitle || notification.propertyAddress) && (
                                  <div className="border rounded-lg p-4 bg-purple-50/50">
                                    <h4 className="font-semibold text-sm mb-3 text-purple-900">Property Details</h4>
                                    <div className="space-y-1">
                                      {notification.propertyTitle && (
                                        <div className="flex items-start gap-2">
                                          <span className="text-sm font-medium text-muted-foreground min-w-[100px]">Property:</span>
                                          <span className="text-sm">{notification.propertyTitle}</span>
                                        </div>
                                      )}
                                      {notification.propertyAddress && (
                                        <div className="flex items-start gap-2">
                                          <span className="text-sm font-medium text-muted-foreground min-w-[100px]">Address:</span>
                                          <span className="text-sm text-muted-foreground">{notification.propertyAddress}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Tenant reviewing Owner — Section A */}
                                {notification.reviewerType === "tenant" && notification.tenantPart && (
                                  <div className="border rounded-lg p-4 bg-blue-50/30 border-blue-100">
                                    <h4 className="font-semibold text-sm mb-3 text-blue-900 flex items-center gap-2">
                                      <span className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">A</span>
                                      Reviewing Owner
                                    </h4>
                                    <div className="space-y-3">
                                      {notification.tenantPart.ownerUnderstandable && (
                                        <div className="border-b border-blue-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">1. Owner Understandable</p>
                                          <p className="text-sm text-gray-700">{notification.tenantPart.ownerUnderstandable}</p>
                                        </div>
                                      )}
                                      {notification.tenantPart.softNature && (
                                        <div className="border-b border-blue-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">2. Soft Nature</p>
                                          <p className="text-sm text-gray-700">{notification.tenantPart.softNature}</p>
                                        </div>
                                      )}
                                      {notification.tenantPart.ownerTransparent && (
                                        <div className="border-b border-blue-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">3. Owner Transparent</p>
                                          <p className="text-sm text-gray-700">{notification.tenantPart.ownerTransparent}</p>
                                        </div>
                                      )}
                                      {notification.tenantPart.problemSolver && (
                                        <div className="border-b border-blue-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">4. Problem Solver</p>
                                          <p className="text-sm text-gray-700">{notification.tenantPart.problemSolver}</p>
                                        </div>
                                      )}
                                      {notification.tenantPart.easyOnRefundMoney && (
                                        <div className="border-b border-blue-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">5. Easy on Refund Money</p>
                                          <p className="text-sm text-gray-700">{notification.tenantPart.easyOnRefundMoney}</p>
                                        </div>
                                      )}
                                      {notification.tenantPart.overallExperience && (
                                        <div className="border-b border-blue-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">6. Overall Experience</p>
                                          <p className="text-sm text-gray-700">{notification.tenantPart.overallExperience}</p>
                                        </div>
                                      )}
                                      {!notification.tenantPart.ownerUnderstandable &&
                                       !notification.tenantPart.softNature &&
                                       !notification.tenantPart.ownerTransparent &&
                                       !notification.tenantPart.problemSolver &&
                                       !notification.tenantPart.easyOnRefundMoney &&
                                       !notification.tenantPart.overallExperience && (
                                        <p className="text-sm text-muted-foreground italic">No review details provided.</p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Owner reviewing Tenant — Section B */}
                                {notification.reviewerType === "owner" && notification.ownerPart && (
                                  <div className="border rounded-lg p-4 bg-orange-50/30 border-orange-100">
                                    <h4 className="font-semibold text-sm mb-3 text-orange-900 flex items-center gap-2">
                                      <span className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs font-bold">B</span>
                                      Reviewing Tenant
                                    </h4>
                                    <div className="space-y-3">
                                      {notification.ownerPart.tenantUnderstandable && (
                                        <div className="border-b border-orange-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">1. Tenant Understandable</p>
                                          <p className="text-sm text-gray-700">{notification.ownerPart.tenantUnderstandable}</p>
                                        </div>
                                      )}
                                      {notification.ownerPart.softNature && (
                                        <div className="border-b border-orange-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">2. Soft Nature</p>
                                          <p className="text-sm text-gray-700">{notification.ownerPart.softNature}</p>
                                        </div>
                                      )}
                                      {notification.ownerPart.tenantTransparent && (
                                        <div className="border-b border-orange-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">3. Tenant Transparent</p>
                                          <p className="text-sm text-gray-700">{notification.ownerPart.tenantTransparent}</p>
                                        </div>
                                      )}
                                      {notification.ownerPart.problemSolver && (
                                        <div className="border-b border-orange-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">4. Problem Solver</p>
                                          <p className="text-sm text-gray-700">{notification.ownerPart.problemSolver}</p>
                                        </div>
                                      )}
                                      {notification.ownerPart.punctualOnPayment && (
                                        <div className="border-b border-orange-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">5. Punctual on Payment</p>
                                          <p className="text-sm text-gray-700">{notification.ownerPart.punctualOnPayment}</p>
                                        </div>
                                      )}
                                      {notification.ownerPart.overallExperience && (
                                        <div className="border-b border-orange-100 pb-2 last:border-0 last:pb-0">
                                          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">6. Overall Experience</p>
                                          <p className="text-sm text-gray-700">{notification.ownerPart.overallExperience}</p>
                                        </div>
                                      )}
                                      {!notification.ownerPart.tenantUnderstandable &&
                                       !notification.ownerPart.softNature &&
                                       !notification.ownerPart.tenantTransparent &&
                                       !notification.ownerPart.problemSolver &&
                                       !notification.ownerPart.punctualOnPayment &&
                                       !notification.ownerPart.overallExperience && (
                                        <p className="text-sm text-muted-foreground italic">No review details provided.</p>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Fallback: show raw message for old notifications that don't have structured fields */}
                                {!notification.reviewerType && (
                                  <div className="border rounded-lg p-4 bg-gray-50">
                                    <p className="text-sm font-medium mb-2">Review Details:</p>
                                    <p className="text-sm whitespace-pre-line text-muted-foreground">{notification.message}</p>
                                  </div>
                                )}
                              </div>
                            ) : notification.type === "document_upload" ? (
                              <div className="mt-4">
                                <h4 className="text-sm font-semibold mb-3">Document Upload Details:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  {notification.userName && (
                                    <div className="flex items-center gap-2">
                                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">{notification.userName}</span>
                                    </div>
                                  )}
                                  {notification.userEmail && (
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-4 w-4 text-muted-foreground" />
                                      <a
                                        href={`mailto:${notification.userEmail}`}
                                        className="text-sm text-blue-600 hover:underline"
                                      >
                                        {notification.userEmail}
                                      </a>
                                    </div>
                                  )}
                                </div>
                                {notification.serviceImage && (
                                  <div className="mt-4">
                                    <p className="text-sm font-medium mb-2">Uploaded Document:</p>
                                    <AttachmentPreview url={notification.serviceImage} />
                                  </div>
                                )}
                              </div>
                            ) : notification.type === "legal_service_request" || notification.type === "other_service_request" ? (
                              /* For Legal/Other Service Request: Show user details and service info */
                              <div className="mt-4">
                                <h4 className="text-sm font-semibold mb-3">User Details (Who Raised the Request):</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                  {notification.userName ? (
                                    <div className="flex items-center gap-2">
                                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">{notification.userName}</span>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">Name: Not available</div>
                                  )}
                                  {notification.userEmail ? (
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-4 w-4 text-muted-foreground" />
                                      <a
                                        href={`mailto:${notification.userEmail}`}
                                        className="text-sm text-blue-600 hover:underline"
                                      >
                                        {notification.userEmail}
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">Email: Not available</div>
                                  )}
                                  {notification.userPhone ? (
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-4 w-4 text-muted-foreground" />
                                      <a
                                        href={`tel:${notification.userPhone}`}
                                        className="text-sm text-blue-600 hover:underline"
                                      >
                                        {notification.userPhone}
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">Phone: Not available</div>
                                  )}
                                </div>
                                {notification.serviceType && (
                                  <div className="mt-4 p-3 bg-blue-50 rounded">
                                    <p className="text-sm font-medium">Service Type:</p>
                                    <p className="text-sm mt-1">{notification.serviceType}</p>
                                  </div>
                                )}
                                {notification.serviceComment && (
                                  <div className="mt-4 p-3 bg-gray-50 rounded">
                                    <p className="text-sm font-medium">Service Details:</p>
                                    <p className="text-sm mt-1 whitespace-pre-line">{notification.serviceComment}</p>
                                  </div>
                                )}
                                {notification.serviceImage && (
                                  <div className="mt-4">
                                    <p className="text-sm font-medium mb-2">Attachment:</p>
                                    <AttachmentPreview url={notification.serviceImage} />
                                  </div>
                                )}
                              </div>
                            ) : notification.type === "inspection_report" ? (
                              /* For Inspection Report: Show user and property details */
                              <div className="mt-4">
                                <h4 className="text-sm font-semibold mb-3">Inspection Report Details:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                  {notification.userName && (
                                    <div className="flex items-center gap-2">
                                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">{notification.userName}</span>
                                    </div>
                                  )}
                                  {notification.userEmail && (
                                    <div className="flex items-center gap-2">
                                      <Mail className="h-4 w-4 text-muted-foreground" />
                                      <a
                                        href={`mailto:${notification.userEmail}`}
                                        className="text-sm text-blue-600 hover:underline"
                                      >
                                        {notification.userEmail}
                                      </a>
                                    </div>
                                  )}
                                  {notification.userPhone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-4 w-4 text-muted-foreground" />
                                      <a
                                        href={`tel:${notification.userPhone}`}
                                        className="text-sm text-blue-600 hover:underline"
                                      >
                                        {notification.userPhone}
                                      </a>
                                    </div>
                                  )}
                                </div>
                                {notification.propertyTitle && (
                                  <div className="mt-4 p-3 bg-gray-50 rounded">
                                    <p className="text-sm"><strong>Property:</strong> {notification.propertyTitle}</p>
                                    {notification.propertyAddress && (
                                      <p className="text-sm text-muted-foreground">{notification.propertyAddress}</p>
                                    )}
                                  </div>
                                )}
                                <div className="mt-4 p-3 bg-blue-50 rounded">
                                  <p className="text-sm font-medium">Report Message:</p>
                                  <p className="text-sm mt-1 whitespace-pre-line">
                                    {notification.message
                                      .replace("on_possession", "On Possession")
                                      .replace("on_handover", "On Handover")}
                                  </p>
                                </div>
                                <InspectionReportList propertyId={notification.propertyId} />
                              </div>
                            ) : notification.type === "service_request" ? (
                              /* For Service Request: Show property details and who raised the request */
                              <div className="mt-4 space-y-4">
                                {/* Property Details */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3">Property Details:</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <div>
                                      <span className="text-xs text-muted-foreground">Property Name:</span>
                                      <p className="text-sm font-medium">{notification.propertyTitle || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Address:</span>
                                      <p className="text-sm font-medium">{notification.propertyAddress || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Listing Type:</span>
                                      <p className="text-sm font-medium capitalize">{notification.propertyListingType || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Property ID:</span>
                                      <p className="text-sm font-medium text-gray-500">{notification.propertyId || 'N/A'}</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Owner Details */}
                                {notification.ownerName && (
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                      <span>👤</span> Owner Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-green-50/50 rounded-lg border border-green-100">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <UserIcon className="h-4 w-4 text-green-600" />
                                        <span className="text-sm font-medium">{notification.ownerName}</span>
                                        {notification.ownerRole && (
                                          <Badge variant="outline" className={`text-[10px] h-5 px-2 py-0 capitalize ${
                                            notification.ownerRole === "agent"
                                              ? "bg-purple-100 text-purple-800 border-purple-300"
                                              : "bg-green-100 text-green-800 border-green-300"
                                          }`}>
                                            {notification.ownerRole === "agent" ? "Agent" : "Owner"}
                                          </Badge>
                                        )}
                                      </div>
                                      {notification.ownerEmail && (
                                        <div className="flex items-center gap-2">
                                          <Mail className="h-4 w-4 text-green-600" />
                                          <a href={`mailto:${notification.ownerEmail}`} className="text-sm text-blue-600 hover:underline">
                                            {notification.ownerEmail}
                                          </a>
                                        </div>
                                      )}
                                      {notification.ownerPhone && (
                                        <div className="flex items-center gap-2">
                                          <Phone className="h-4 w-4 text-green-600" />
                                          <a href={`tel:${notification.ownerPhone}`} className="text-sm text-blue-600 hover:underline">
                                            {notification.ownerPhone}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Tenant Details */}
                                {notification.tenantName && (
                                  <div className="mt-4">
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                      <span>🔑</span> Tenant Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                      <div className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm font-medium">{notification.tenantName}</span>
                                      </div>
                                      {notification.tenantEmail && (
                                        <div className="flex items-center gap-2">
                                          <Mail className="h-4 w-4 text-blue-600" />
                                          <a href={`mailto:${notification.tenantEmail}`} className="text-sm text-blue-600 hover:underline">
                                            {notification.tenantEmail}
                                          </a>
                                        </div>
                                      )}
                                      {notification.tenantPhone && (
                                        <div className="flex items-center gap-2">
                                          <Phone className="h-4 w-4 text-blue-600" />
                                          <a href={`tel:${notification.tenantPhone}`} className="text-sm text-blue-600 hover:underline">
                                            {notification.tenantPhone}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Buyer Details */}
                                {notification.buyers && (
                                  <div className="mt-4">
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                      <span>🤝</span> Buyer Details
                                    </h4>
                                    <div className="space-y-3">
                                      {(() => {
                                        try {
                                          const buyers = JSON.parse(notification.buyers);
                                          return Array.isArray(buyers) ? buyers.map((buyer: any, idx: number) => (
                                            <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                                              <div className="flex items-center gap-2">
                                                <UserIcon className="h-4 w-4 text-amber-600" />
                                                <span className="text-sm font-medium">{buyer.firstName} {buyer.lastName}</span>
                                              </div>
                                              {buyer.email && (
                                                <div className="flex items-center gap-2">
                                                  <Mail className="h-4 w-4 text-amber-600" />
                                                  <a href={`mailto:${buyer.email}`} className="text-sm text-blue-600 hover:underline">
                                                    {buyer.email}
                                                  </a>
                                                </div>
                                              )}
                                              {buyer.phone && (
                                                <div className="flex items-center gap-2">
                                                  <Phone className="h-4 w-4 text-amber-600" />
                                                  <a href={`tel:${buyer.phone}`} className="text-sm text-blue-600 hover:underline">
                                                    {buyer.phone}
                                                  </a>
                                                </div>
                                              )}
                                            </div>
                                          )) : null;
                                        } catch (e) {
                                          return null;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {/* User Details */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3">User Details (Who Raised the Request):</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {notification.userName ? (
                                      <div className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{notification.userName}</span>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Name: Not available</div>
                                    )}
                                    {notification.userEmail ? (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <a
                                          href={`mailto:${notification.userEmail}`}
                                          className="text-sm text-blue-600 hover:underline"
                                        >
                                          {notification.userEmail}
                                        </a>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Email: Not available</div>
                                    )}
                                    {notification.userPhone ? (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <a
                                          href={`tel:${notification.userPhone}`}
                                          className="text-sm text-blue-600 hover:underline"
                                        >
                                          {notification.userPhone}
                                        </a>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Phone: Not available</div>
                                    )}
                                  </div>
                                </div>

                                {/* Service Request Details */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3">Service Request Details:</h4>
                                  <div className="space-y-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                    {notification.serviceType && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Service Type:</span>
                                        <p className="text-sm font-medium">{notification.serviceType}</p>
                                      </div>
                                    )}
                                    {notification.serviceComment && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Comment:</span>
                                        <p className="text-sm mt-1 whitespace-pre-line">{notification.serviceComment}</p>
                                      </div>
                                    )}
                                    {notification.serviceImage && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Attached Image:</span>
                                        <div className="mt-2">
                                          <img
                                            src={notification.serviceImage}
                                            alt="Service request image"
                                            className="max-w-full h-auto max-h-64 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(notification.serviceImage, '_blank')}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : notification.type === "general_inquiry" ? (
                              /* For General Inquiry: Show inquiry details and user info */
                              <div className="mt-4 space-y-4">
                                {/* Inquiry Message */}
                                {notification.message && (
                                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                                    <p className="text-sm font-medium text-yellow-800">📝 {notification.message}</p>
                                  </div>
                                )}

                                {/* Inquiry Details */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3">Inquiry Details:</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-blue-50 rounded">
                                    <div>
                                      <span className="text-xs text-muted-foreground">Looking to:</span>
                                      <p className="text-sm font-medium capitalize">{notification.inquiryType || 'Not specified'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Property Type:</span>
                                      <p className="text-sm font-medium capitalize">{notification.propertyType || 'Not specified'}</p>
                                    </div>
                                    {notification.requestVisit && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Visit Requested:</span>
                                        <p className="text-sm font-medium">{notification.visitDate} at {notification.visitTime}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* User Details */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3">Contact Details:</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {notification.userName ? (
                                      <div className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{notification.userName}</span>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Name: Not available</div>
                                    )}
                                    {notification.userEmail ? (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <a
                                          href={`mailto:${notification.userEmail}`}
                                          className="text-sm text-blue-600 hover:underline"
                                        >
                                          {notification.userEmail}
                                        </a>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Email: Not available</div>
                                    )}
                                    {notification.userPhone ? (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <a
                                          href={`tel:${notification.userPhone}`}
                                          className="text-sm text-blue-600 hover:underline"
                                        >
                                          {notification.userPhone}
                                        </a>
                                      </div>
                                    ) : (
                                      <div className="text-sm text-muted-foreground">Phone: Not available</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (notification.type === "agreement_termination" || notification.type === "agreement_renewal") ? (
                              /* For Agreement Termination/Renewal: Show structured owner, tenant, and property details */
                              <div className="mt-4 space-y-4">
                                {/* Status Banner */}
                                <div className={`p-3 rounded-lg border ${notification.type === "agreement_termination" ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                                  <p className={`text-sm font-semibold ${notification.type === "agreement_termination" ? "text-red-700" : "text-green-700"}`}>
                                    {notification.title || (notification.type === "agreement_termination" ? "Agreement termination update" : "Agreement renewal update")}
                                  </p>
                                </div>

                                {/* Property Details */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <span>📋</span> Property Details
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <div>
                                      <span className="text-xs text-muted-foreground">Property Name:</span>
                                      <p className="text-sm font-medium">{notification.propertyTitle || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Property ID:</span>
                                      <p className="text-sm font-medium text-gray-500">{notification.propertyId || 'N/A'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                      <span className="text-xs text-muted-foreground">Address:</span>
                                      <p className="text-sm font-medium">{notification.propertyAddress || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-muted-foreground">Listing Type:</span>
                                      <p className="text-sm font-medium capitalize">{notification.propertyListingType || 'Rent'}</p>
                                    </div>
                                  </div>
                                  </div>
                                {/* Owner Details */}
                                <div>
                                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <span>👤</span> Owner Details
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <UserIcon className="h-4 w-4 text-purple-600" />
                                      <span className="text-sm font-medium">{notification.ownerName || 'N/A'}</span>
                                      {notification.ownerRole && (
                                        <Badge variant="outline" className={`text-[10px] h-5 px-2 py-0 capitalize ${
                                          notification.ownerRole === "agent"
                                            ? "bg-purple-100 text-purple-800 border-purple-300"
                                            : "bg-green-100 text-green-800 border-green-300"
                                        }`}>
                                          {notification.ownerRole === "agent" ? "Agent" : "Owner"}
                                        </Badge>
                                      )}
                                    </div>
                                    {notification.ownerEmail && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-purple-600" />
                                        <a href={`mailto:${notification.ownerEmail}`} className="text-sm text-blue-600 hover:underline">
                                          {notification.ownerEmail}
                                        </a>
                                      </div>
                                    )}
                                    {notification.ownerPhone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-purple-600" />
                                        <a href={`tel:${notification.ownerPhone}`} className="text-sm text-blue-600 hover:underline">
                                          {notification.ownerPhone}
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Tenant Details (for both termination and renewal) */}
                                {(notification.type === "agreement_termination" || notification.type === "agreement_renewal") && (notification.tenantName || notification.userName || notification.userEmail || notification.userPhone) && (
                                  <div>
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                      <span>🏠</span> Tenant Details {notification.type === "agreement_termination" ? "(Agreement party)" : "(Renewal Requested)"}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                      {(notification.tenantName || notification.userName) && (
                                        <div className="flex items-center gap-2">
                                          <UserIcon className="h-4 w-4 text-orange-600" />
                                          <span className="text-sm font-medium">{notification.tenantName || notification.userName}</span>
                                        </div>
                                      )}
                                      {(notification.tenantEmail || notification.userEmail) && (
                                        <div className="flex items-center gap-2">
                                          <Mail className="h-4 w-4 text-orange-600" />
                                          <a href={`mailto:${notification.tenantEmail || notification.userEmail}`} className="text-sm text-blue-600 hover:underline">
                                            {notification.tenantEmail || notification.userEmail}
                                          </a>
                                        </div>
                                      )}
                                      {(notification.tenantPhone || notification.userPhone) && (
                                        <div className="flex items-center gap-2">
                                          <Phone className="h-4 w-4 text-orange-600" />
                                          <a href={`tel:${notification.tenantPhone || notification.userPhone}`} className="text-sm text-blue-600 hover:underline">
                                            {notification.tenantPhone || notification.userPhone}
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* For Want to Sell: Show only Owner details */
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <div className="flex items-center gap-2">
                                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{notification.ownerName}</span>
                                </div>

                                {notification.ownerEmail && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <a
                                      href={`mailto:${notification.ownerEmail}`}
                                      className="text-sm text-blue-600 hover:underline"
                                    >
                                      {notification.ownerEmail}
                                    </a>
                                  </div>
                                )}

                                {notification.ownerPhone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <a
                                      href={`tel:${notification.ownerPhone}`}
                                      className="text-sm text-blue-600 hover:underline"
                                    >
                                      {notification.ownerPhone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Admin Remarks - Only for Service Requests */}
                            {notification.type === "service_request" && (
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4 text-blue-600" />
                                  Admin Remarks (Visible to Client)
                                </h4>
                                <div className="space-y-3">
                                  <textarea
                                    className="w-full min-h-[100px] p-3 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-y"
                                    placeholder="Add your remarks or solution here..."
                                    defaultValue={notification.adminRemarks || ""}
                                    id={`remarks-${notification.id}`}
                                  />

                                  {/* Admin Image Attachment - Only for Service Requests */}
                                  <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="relative"
                                      disabled={uploadingRemarkImage === notification.id}
                                    >
                                      {uploadingRemarkImage === notification.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      ) : (
                                        <Upload className="h-4 w-4 mr-2" />
                                      )}
                                      {notification.adminImage || remarkImages[notification.id] ? "Change Attachment" : "Attach Image"}
                                      <input
                                        type="file"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) handleRemarkImageUpload(notification.id, file);
                                        }}
                                      />
                                    </Button>
                                    {(notification.adminImage || remarkImages[notification.id]) && (
                                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100">
                                        Image Attached
                                      </Badge>
                                    )}
                                  </div>

                                  {(notification.adminImage || remarkImages[notification.id]) && (
                                    <div className="mt-2 space-y-2">
                                      <div className="relative">
                                        <img
                                          src={remarkImages[notification.id] || notification.adminImage}
                                          alt="Admin attachment"
                                          title={remarkImages[`url-${notification.id}`] || notification.adminImage}
                                          className="max-w-xs h-auto max-h-60 rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => {
                                            const url = remarkImages[`url-${notification.id}`] || notification.adminImage;
                                            window.open(url, '_blank');
                                          }}
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            if (!target.src.includes('placehold.co')) {
                                              target.src = "https://placehold.co/400x300?text=Image+Load+Error";
                                            }
                                          }}
                                        />
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <a 
                                          href={remarkImages[`url-${notification.id}`] || notification.adminImage} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded w-fit"
                                          onClick={() => console.log("Direct link clicked for:", remarkImages[`url-${notification.id}`] || notification.adminImage)}
                                        >
                                          <ImageIcon className="h-3.5 w-3.5" />
                                          View Full Image
                                        </a>
                                        <p className="text-[10px] text-gray-400 break-all bg-gray-50 p-1 rounded border border-gray-100">
                                          URL: {remarkImages[`url-${notification.id}`] || notification.adminImage}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  </div>

                                  <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      disabled={updating === notification.id || uploadingRemarkImage === notification.id}
                                      onClick={() => {
                                        const el = document.getElementById(`remarks-${notification.id}`) as HTMLTextAreaElement;
                                        handleSaveRemarks(notification.id, el.value, remarkImages[`url-${notification.id}`] || notification.adminImage);
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                      {updating === notification.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                      )}
                                      Save Remarks
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 mt-4">
                              <Badge variant={notification.priority === "high" ? "destructive" : "secondary"}>
                                {notification.priority}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(notification.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`complete-${notification.id}`}
                                checked={notification.isRead}
                                disabled={updating === notification.id}
                                onCheckedChange={(checked) => handleMarkComplete(notification.id, checked as boolean)}
                              />
                              <label
                                htmlFor={`complete-${notification.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {notification.isRead ? "Completed" : "Mark as Complete"}
                              </label>
                            </div>
                            {notification.isRead && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Completed
                              </Badge>
                            )}
                            {notification.propertyId && !notification.isRead && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={() => handleViewPropertyDetails(notification.propertyId)}
                                disabled={loadingProperty}
                              >
                                {loadingProperty && selectedProperty?.id === notification.propertyId ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                View Property Details
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
  );
};
