"use client";

import { apiFetch } from '@/lib/api-client';

import { useParams, useNavigate } from "@/lib/navigation";
import { ArrowLeft, Scale, Loader2 } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../utils/config";

const LEGAL_SERVICE_TYPES = [
  "Registration of Rent Agreement",
  "Sale Agreement Procedure",
  "Any Other Legal work",
  "CIDCO/ MNNC work"
];

const LegalServices = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [serviceType, setServiceType] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [userPhone, setUserPhone] = useState<string>("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        toast({
          title: "Login Required",
          description: "Please login to request legal services",
          variant: "destructive"
        });
        navigate("/auth");
        return;
      }
      // Fetch user phone number
      try {
        const response = await apiFetch(`${API_BASE_URL}/users/${currentUser.uid}`);
        if (response.ok) {
          const data = await response.json();
          if (data.user && data.user.phoneNumber) {
            setUserPhone(data.user.phoneNumber);
          }
        }
      } catch (error) { /* Preserve existing best-effort behavior. */ }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to request legal services",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    if (!serviceType) {
      toast({
        title: "Service Type Required",
        description: "Please select a legal service type",
        variant: "destructive"
      });
      return;
    }

    if (!comment.trim()) {
      toast({
        title: "Comment Required",
        description: "Please provide details about your legal service request",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // Fetch owner details
      let ownerPhoneNumber = property?.primaryNo || '';
      let ownerEmail = property?.ownerEmail || '';
      if (property?.ownerUID) {
        try {
          const ownerResponse = await apiFetch(`${API_BASE_URL}/users/${property.ownerUID}`);
          if (ownerResponse.ok) {
            const ownerData = await ownerResponse.json();
            if (ownerData.user) {
              if (ownerData.user.phoneNumber) {
                ownerPhoneNumber = ownerData.user.phoneNumber;
              }
              if (ownerData.user.email && !ownerEmail) {
                ownerEmail = ownerData.user.email;
              }
            }
          }
        } catch (error) { /* Preserve existing best-effort behavior. */ }
      }

      // Prepare notification payload
      const notificationPayload = {
        type: 'legal_service_request',
        title: `Legal Service Request: ${serviceType}`,
        message: `User ${user.displayName || user.email || 'Unknown User'} has requested legal service: ${serviceType} for property: ${property?.title || propertyId}. Details: ${comment}`,
        propertyId: propertyId || '',
        ownerId: property?.ownerUID || '',
        ownerName: property?.ownerName || 'Unknown Owner',
        ownerPhone: ownerPhoneNumber,
        ownerEmail: ownerEmail,
        userId: user.uid || '',
        userName: user.displayName || user.email || 'Unknown User',
        userEmail: user.email || '',
        userPhone: userPhone || user.phoneNumber || '',
        propertyTitle: property?.title || '',
        propertyAddress: property?.address || property?.city || property?.location || 'Not specified',
        propertyListingType: property?.listingType || 'rent',
        serviceType: serviceType,
        serviceComment: comment,
        timestamp: new Date().toISOString(),
        isRead: false,
        priority: 'high'
      };

      const notificationResponse = await apiFetch(`${API_BASE_URL}/admin/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationPayload),
      });

      const notificationData = await notificationResponse.json();

      if (notificationData.success) {
        toast({
          title: "Request Submitted",
          description: `Your ${serviceType} request has been sent to the admin. Consultation is free!`,
        });
        // Reset form
        setServiceType("");
        setComment("");
        navigate(`/manage-property`);
      } else {
        throw new Error(notificationData.message || 'Failed to submit request');
      }
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again later.",
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

  return (
    <>
      <>
        <title>Legal Services | PropBank</title>
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
              <Scale className="h-5 w-5" />
              Legal Services - Consultation Free
            </CardTitle>
            <CardDescription>
              {property && `Property: ${property.title || property.id}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Select Legal Service *</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger id="serviceType">
                    <SelectValue placeholder="Select a legal service" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEGAL_SERVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Details / Comments *</Label>
                <Textarea
                  id="comment"
                  placeholder="Please provide details about your legal service request..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Consultation is free. Please provide as much detail as possible.
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={submitting || !serviceType || !comment.trim()}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Scale className="h-4 w-4 mr-2" />
                      Submit Request
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
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default LegalServices;
