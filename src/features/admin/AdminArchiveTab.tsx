"use client";

import { TabsContent } from "@/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import {
  Archive,
  CheckCircle2,
  User as UserIcon,
  Mail,
  Phone,
  Building2,
  AlertCircle,
  MessageSquare,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { AdminNotification } from "./AdminTypes";

interface AdminArchiveTabProps {
  loading: boolean;
  notifications: AdminNotification[];
  updating: string | null;
  handleMarkComplete: (id: string, completed: boolean) => Promise<void>;
  handleViewPropertyDetails: (propertyId: string) => void;
  loadingProperty: boolean;
  selectedProperty: any;
}

export default function AdminArchiveTab({
  loading,
  notifications,
  updating,
  handleMarkComplete,
  handleViewPropertyDetails,
  loadingProperty,
  selectedProperty,
}: AdminArchiveTabProps) {
  return (
    <TabsContent value="archive" className="mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Archive</CardTitle>
          <CardDescription>Completed service requests and archived items</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No archived items</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <Card key={notification.id} className="border-l-4 border-l-gray-300 opacity-90">
                  <CardContent className="pt-6">
                    {/* Title */}
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <h3 className="font-semibold text-base">{notification.title}</h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">Completed</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{notification.message}</p>

                    {/* Owner Details */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Owner Details</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {notification.ownerName && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm">{notification.ownerName}</span>
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
                            <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm">{notification.ownerEmail}</span>
                          </div>
                        )}
                        {notification.ownerPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm">{notification.ownerPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Property Added Details */}
                    {notification.type === "property_added" && (
                      <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-3 mb-3 space-y-3">
                        <h4 className="text-xs font-semibold text-purple-800 uppercase tracking-wide flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />
                          Property Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          {notification.propertyTitle && (
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Property Title</span>
                              <p className="font-medium">{notification.propertyTitle}</p>
                            </div>
                          )}
                          {notification.propertyAddress && (
                            <div className="md:col-span-2">
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Address</span>
                              <p className="font-medium">{notification.propertyAddress}</p>
                            </div>
                          )}
                          {notification.propertyListingType && (
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Listing Type</span>
                              <p className="font-medium capitalize">{notification.propertyListingType}</p>
                            </div>
                          )}
                        </div>

                        {/* Show buyer details if sold */}
                        {notification.propertyListingType === "sell" && notification.buyers && (() => {
                          try {
                            const buyersList = JSON.parse(notification.buyers);
                            if (Array.isArray(buyersList) && buyersList.length > 0) {
                              const buyer = buyersList[buyersList.length - 1];
                              return (
                                <div className="mt-3 pt-3 border-t border-purple-100 bg-green-50/50 rounded-lg p-3">
                                  <h5 className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <UserIcon className="h-3.5 w-3.5" />
                                    Buyer Details (Sold Out Already)
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Buyer Name</span>
                                      <p className="font-medium">{buyer.firstName} {buyer.lastName}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Phone Number</span>
                                      <p className="font-medium">{buyer.phone}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          } catch (e) {
                            console.error("Error parsing buyers JSON", e);
                          }
                          return null;
                        })()}
                      </div>
                    )}

                    {/* Service Request Details (Original Request) */}
                    {notification.type === "service_request" && (notification.serviceType || notification.serviceComment || notification.serviceImage) && (
                      <div className="bg-yellow-50/50 border border-yellow-100 rounded-lg p-3 mb-3">
                        <h4 className="text-xs font-semibold text-yellow-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Original Request Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {notification.serviceType && (
                            <div>
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Service Type</span>
                              <p className="text-sm font-medium">{notification.serviceType}</p>
                            </div>
                          )}
                          {notification.serviceComment && (
                            <div className="md:col-span-2">
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Tenant Comment</span>
                              <p className="text-sm italic text-gray-700">"{notification.serviceComment}"</p>
                            </div>
                          )}
                          {notification.serviceImage && (
                            <div className="md:col-span-2">
                              <span className="text-[10px] text-muted-foreground uppercase font-semibold mb-2 block">Tenant Attachment</span>
                              <img
                                src={notification.serviceImage}
                                alt="Tenant attachment"
                                className="max-w-xs h-auto max-h-40 rounded border border-yellow-100 shadow-sm cursor-pointer hover:opacity-90"
                                onClick={() => window.open(notification.serviceImage, '_blank')}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Agreement / Termination Specific Details */}
                    {(notification.type === "agreement_renewal" || notification.type === "agreement_termination") && (notification.userName || notification.userPhone || notification.userEmail) && (
                      <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-3 mb-3">
                        <h4 className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <UserIcon className="h-3.5 w-3.5" />
                          Tenant Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                          {notification.userName && <span className="font-medium">{notification.userName}</span>}
                          {notification.userPhone && <span className="text-muted-foreground">{notification.userPhone}</span>}
                          {notification.userEmail && <span className="text-blue-600 truncate">{notification.userEmail}</span>}
                        </div>
                      </div>
                    )}

                    {/* Timestamps row */}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3 text-xs text-muted-foreground">
                      <span>
                        <span className="font-medium text-gray-600">Received: </span>
                        {new Date(notification.timestamp).toLocaleString()}
                      </span>
                      {notification.resolvedAt && (
                        <span>
                          <span className="font-medium text-green-700">✓ Marked Complete: </span>
                          {new Date(notification.resolvedAt).toLocaleString()}
                        </span>
                      )}
                      {notification.updatedAt && (
                        <span>
                          <span className="font-medium text-gray-600">Last Modified: </span>
                          {new Date(notification.updatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Resolving History - Remarks and Attachments */}
                    {notification.type === "service_request" && (notification.adminRemarks || notification.adminImage) && (
                      <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-4">
                        <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Resolution History
                        </h4>
                        
                        {notification.adminRemarks && (
                          <div className="text-sm text-gray-700 bg-white p-2.5 rounded border border-blue-50 mb-3 whitespace-pre-wrap">
                            {notification.adminRemarks}
                          </div>
                        )}

                        {notification.adminImage && (
                          <div className="space-y-2">
                            <div className="relative group w-fit">
                              <img
                                src={notification.adminImage}
                                alt="Resolution attachment"
                                className="max-w-xs h-auto max-h-48 rounded-lg border border-blue-100 shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(notification.adminImage, '_blank')}
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg pointer-events-none">
                                <ImageIcon className="h-6 w-6 text-white drop-shadow-md" />
                              </div>
                            </div>
                            <a 
                              href={notification.adminImage} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-medium bg-white px-2 py-1 rounded border border-blue-50 w-fit"
                            >
                              <ImageIcon className="h-3 w-3" />
                              View Full Attachment
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions row */}
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                        onClick={() => handleMarkComplete(notification.id, false)}
                        disabled={updating === notification.id}
                      >
                        {updating === notification.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Archive className="h-3 w-3 mr-1" />
                        )}
                        Unarchive
                      </Button>
                      {notification.propertyId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleViewPropertyDetails(notification.propertyId)}
                          disabled={loadingProperty}
                        >
                          {loadingProperty && selectedProperty?.id === notification.propertyId ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          Property Details
                        </Button>
                      )}
                    </div>

                    {/* Archive History */}
                    {notification.archiveHistory && notification.archiveHistory.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Status History</p>
                        <div className="space-y-1">
                          {notification.archiveHistory.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.action === "archived" ? "bg-green-400" : "bg-orange-400"}`} />
                              <span className={entry.action === "archived" ? "text-green-700" : "text-orange-700"}>
                                {entry.action === "archived" ? "Archived" : "Unarchived"}
                              </span>
                              <span className="text-muted-foreground">
                                — {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
