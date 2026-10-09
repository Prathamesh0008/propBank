"use client";

import { apiFetch } from '@/lib/api-client';

import { useParams, useNavigate } from "@/lib/navigation";
import { ArrowLeft, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Alert, AlertDescription } from "@/ui/alert";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../utils/config";

const TerminateAgreement = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOwner, setIsOwner] = useState<boolean>(false);

  const getLocalTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [noticePeriod, setNoticePeriod] = useState<string>("");
  const [noticeStartDate, setNoticeStartDate] = useState<string>(getLocalTodayString());
  const [terminationDate, setTerminationDate] = useState<Date | null>(null);

  const calculateTerminationDate = (period: string, startDateStr: string) => {
    if (!period || period.toLowerCase().includes("immediate")) {
      return null;
    }

    const parts = period.split(" ");
    const num = parseInt(parts[0]);
    if (isNaN(num)) {
      return null;
    }

    const startDate = new Date(startDateStr);
    const calculatedDate = new Date(startDate);
    
    if (period.toLowerCase().includes("month")) {
      calculatedDate.setMonth(startDate.getMonth() + num);
    } else if (period.toLowerCase().includes("day")) {
      calculatedDate.setDate(startDate.getDate() + num);
    } else {
      calculatedDate.setMonth(startDate.getMonth() + num);
    }
    return calculatedDate;
  };

  const handleNoticeChange = (period: string) => {
    setNoticePeriod(period);
    const calculated = calculateTerminationDate(period, noticeStartDate);
    setTerminationDate(calculated);
  };

  const handleStartDateChange = (startDateStr: string) => {
    setNoticeStartDate(startDateStr);
    const calculated = calculateTerminationDate(noticePeriod, startDateStr);
    setTerminationDate(calculated);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        toast({
          title: "Login Required",
          description: "Please login to terminate agreement",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }
    });
    return () => unsubscribe();
  }, [navigate, toast]);

  useEffect(() => {
    const fetchProperty = async () => {
      if (!propertyId) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.property) {
            setProperty(data.property);
          }
        }
      } catch (error) { /* Preserve existing best-effort behavior. */ } finally {
        setLoading(false);
      }
    };

    if (propertyId) {
      fetchProperty();
    } else {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (user && property) {
      if (user.uid === property.ownerUID) {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }
    }
  }, [user, property]);

  useEffect(() => {
    if (property) {
      const initialNotice = property.noticePeriod && property.noticePeriod !== "Immediate"
        ? property.noticePeriod
        : "1 Month";
      setNoticePeriod(initialNotice);
      const calculated = calculateTerminationDate(initialNotice, noticeStartDate);
      setTerminationDate(calculated);
    }
  }, [property]);

  const handleTerminate = async () => {
    if (!user) {
      return;
    }

    // Determine mode: Owner terminating or Tenant requesting
    const isTenantRequest = !isOwner;

    let confirmationMessage = "";
    if (isTenantRequest) {
      if (!noticePeriod || noticePeriod === "Immediate") {
        confirmationMessage = "Are you sure you want to request IMMEDIATE termination? The owner will be notified.";
      } else {
        confirmationMessage = `Are you sure you want to request termination with a ${noticePeriod}? The owner will be notified.`;
      }
    } else {
      // Owner Mode
      if (!noticePeriod || noticePeriod === "Immediate") {
        confirmationMessage = "Are you sure you want to terminate this agreement IMMEDIATELY? This will:\n\n• Remove all tenant information\n• Mark property as Available\n• This action cannot be undone.";
      } else {
        confirmationMessage = `Are you sure you want to serve a ${noticePeriod}? This will:\n\n• Set anticipated termination date\n• Notify the tenant via email\n• Keep property occupied until final termination.\n\nProceed?`;
      }
    }

    if (!confirm(confirmationMessage)) {
      return;
    }

    setSubmitting(true);
    try {
      const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

      // Select endpoint based on role
      const endpoint = isTenantRequest ? '/agreements/request-termination' : '/agreements/terminate';
      const url = `${baseUrl}${endpoint}`;

      const formattedStartDate = new Date(noticeStartDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
      const formattedEndDate = terminationDate ? terminationDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : "";

      const body = {
        propertyId: propertyId || '',
        noticePeriod: noticePeriod,
        noticeStartDate: formattedStartDate,
        terminationDate: formattedEndDate,
      };

      const response = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.uid,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
      }

      if (data.message === "ShoPROP Backend API is running!") {
        throw new Error("Request was redirected to root endpoint. Please check the API URL and server configuration.");
      }

      if (data.success) {
        toast({
          title: isTenantRequest ? "Request Sent" : (!noticePeriod || noticePeriod === "Immediate" ? "Agreement Terminated" : "Notice Served"),
          description: data.message || "Action completed successfully.",
        });
        // Navigate back
        navigate(-1);
      } else {
        throw new Error(data.message || 'Failed to process request');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process request. Please try again later.';
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Property not found or you do not have access.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <>
      <>
        <title>PropBank</title>
      </>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              {isOwner ? "Terminate Agreement" : "Request Termination"}
            </CardTitle>
            <CardDescription>
              {property && `Property: ${property.title || property.id}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Notice Period</label>
                <Select
                  value={noticePeriod || ""}
                  onValueChange={(value) => handleNoticeChange(value)}
                  disabled={!isOwner}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Notice Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1 Month">1 Month</SelectItem>
                    <SelectItem value="2 Months">2 Months</SelectItem>
                    <SelectItem value="3 Months">3 Months</SelectItem>
                    <SelectItem value="4 Months">4 Months</SelectItem>
                    <SelectItem value="5 Months">5 Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notice Period Starts From</label>
                <DatePicker
                  value={noticeStartDate}
                  min={getLocalTodayString()}
                  onChange={handleStartDateChange}
                />
              </div>

              {noticePeriod && noticePeriod !== "Immediate" && terminationDate && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 font-medium">
                    Calculated Termination Date: {terminationDate.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    {isOwner
                      ? "Serving notice will notify the tenant via email. It will NOT remove tenant data yet."
                      : "Sending this request will notify the owner of your intended termination date."
                    }
                  </p>
                </div>
              )}

              {/* Warnings */}
              {isOwner ? (
                // Owner Warnings (Existing)
                !noticePeriod || noticePeriod === "Immediate" ? (
                  <Alert variant="destructive" className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <AlertDescription className="flex-1">
                      <strong>Warning:</strong> Terminating this agreement immediately will:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Remove all tenant information from this property</li>
                        <li>Clear agreement dates and lease details</li>
                        <li>Mark the property as "Available for Rent"</li>
                        <li>Notify the admin with full owner, tenant and property details</li>
                        <li>This action cannot be undone</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-yellow-50 border-yellow-200 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                    <AlertDescription className="flex-1 text-yellow-800">
                      <strong>Notice Action:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Sends termination notice email to Tenant & User</li>
                        <li>Sets "Anticipated Termination Date" on property</li>
                        <li>Property status changes to "Notice Served"</li>
                        <li>Tenant data remains visible until final termination</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )
              ) : (
                // Tenant Warnings (New)
                <Alert className="bg-blue-50 border-blue-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600" />
                  <AlertDescription className="flex-1 text-blue-800">
                    <strong>Request Action:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Sends a termination request to the Property Owner</li>
                      <li>Owner will be notified of your intended notice period: <strong>{noticePeriod}</strong></li>
                      <li>Owner must approve/acknowledge for the process to complete</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}


              {property && (
                <div className="space-y-4">
                  {/* Tenant Details Section */}
                  {(property.tenantName || property.mobileNumber || (property.tenants && property.tenants.length > 0)) && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <h3 className="font-semibold text-orange-800 mb-2">Tenant Information {isOwner && noticePeriod === "Immediate" ? "(Will be removed):" : ":"}</h3>
                      {property.tenantName && (
                        <p className="text-sm text-orange-700">
                          <span className="font-medium">Tenant Name:</span> {property.tenantName}
                        </p>
                      )}
                      {property.personName && (
                        <p className="text-sm text-orange-700">
                          <span className="font-medium">Contact Person:</span> {property.personName}
                        </p>
                      )}
                      {property.tenants && property.tenants.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium text-orange-700">Additional Tenants:</p>
                          {property.tenants.filter((t: any) => t.isActive).map((tenant: any, index: number) => (
                            <p key={index} className="text-sm text-orange-700 ml-2">
                              • {tenant.firstName} {tenant.lastName}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Agreement Details Section */}
                  <div className="p-4 bg-gray-50 border rounded-lg">
                    <h3 className="font-semibold mb-2">Agreement Details:</h3>
                    {property.agreementStartDate && (
                      <p className="text-sm">
                        <span className="font-medium">Start Date:</span> {property.agreementStartDate}
                      </p>
                    )}
                    {property.agreementEndDate && (
                      <p className="text-sm">
                        <span className="font-medium">End Date:</span> {property.agreementEndDate}
                      </p>
                    )}
                    {property.agreementPeriod && (
                      <p className="text-sm">
                        <span className="font-medium">Period:</span> {property.agreementPeriod} months
                      </p>
                    )}
                    {property.monthlyRent && (
                      <p className="text-sm">
                        <span className="font-medium">Monthly Rent:</span> ₹{property.monthlyRent}
                      </p>
                    )}
                    {property.securityDeposit && (
                      <p className="text-sm">
                        <span className="font-medium">Security Deposit:</span> ₹{property.securityDeposit}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={handleTerminate}
                  disabled={submitting}
                  variant={isOwner && (!noticePeriod || noticePeriod === "Immediate") ? "destructive" : "default"}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {isOwner
                        ? ((!noticePeriod || noticePeriod === "Immediate") ? <XCircle className="h-4 w-4 mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />)
                        : <AlertTriangle className="h-4 w-4 mr-2" />
                      }
                      {isOwner
                        ? ((!noticePeriod || noticePeriod === "Immediate") ? "Terminate Immediately" : "Serve Termination Notice")
                        : "Request Termination"
                      }
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
export default TerminateAgreement;
