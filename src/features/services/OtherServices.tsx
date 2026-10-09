"use client";

import { apiFetch } from '@/lib/api-client';

import { useParams, useNavigate } from "@/lib/navigation";
import { ArrowLeft, Wrench, Loader2, Upload, X, FileText, CheckCircle2 } from "lucide-react";
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
import { uploadBase64Image } from "@/services/uploadService";

const OTHER_SERVICE_TYPES = [
  "Keys Management",
  "Police verification",
  "Society procedure",
  "All maintenance work To shift (exp. Borne By owner)",
  "Pre-Rental Service - Painting, plumbing, carpenter, electrical",
  "Flat verification Before handover (In Case of Purchase) cost Rs 25000/-",
  "Client Owner Meeting arrangement with LOI",
  "Other Service"
];

const OtherServices = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [serviceType, setServiceType] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [userPhone, setUserPhone] = useState<string>("");

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImage(result);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        toast({
          title: "Login Required",
          description: "Please login to request services",
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
        description: "Please login to request services",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    if (!serviceType) {
      toast({
        title: "Service Type Required",
        description: "Please select a service type",
        variant: "destructive"
      });
      return;
    }

    if (!comment.trim()) {
      toast({
        title: "Comment Required",
        description: "Please provide details about your service request",
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

      // Upload image to Cloudflare R2 if provided
      let serviceImageUrl = '';
      if (image) {
        try {
          serviceImageUrl = await uploadBase64Image(
            image,
            'other-services',
            `${user.uid}-${Date.now()}`
          );
        } catch (uploadError) {
          toast({
            title: "Image Upload Failed",
            description: "Failed to upload image. Submitting request without image.",
            variant: "destructive"
          });
        }
      }

      // Prepare notification payload
      const notificationPayload = {
        type: 'other_service_request',
        title: `Other Service Request: ${serviceType}`,
        message: `User ${user.displayName || user.email || 'Unknown User'} has requested service: ${serviceType} for property: ${property?.title || propertyId}. Details: ${comment}`,
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
        serviceImage: serviceImageUrl, // Included the uploaded image URL
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
          description: `Your ${serviceType} request has been sent to the admin.${serviceType === "Keys Management" ? " Owner will be notified." : ""}`,
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
        <title>Other Related Services | PropBank</title>
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
              <Wrench className="h-5 w-5" />
              Other Related Services
            </CardTitle>
            <CardDescription>
              {property && `Property: ${property.title || property.id}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Select Service *</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger id="serviceType">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {OTHER_SERVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {serviceType === "Keys Management" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Note: Visit Update - Owner will be notified
                  </p>
                )}
                {serviceType === "Flat verification Before handover (In Case of Purchase) cost Rs 25000/-" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Cost: Rs 25,000/-
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Details / Comments *</Label>
                <Textarea
                  id="comment"
                  placeholder="Please provide details about your service request..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-4 pt-2 border p-4 rounded-md bg-gray-50/50">
                <Label className="block mb-2 text-sm text-muted-foreground">Optional Attachment</Label>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,application/pdf,.doc,.docx"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="image-upload"
                    />
                    <Button type="button" variant="outline" className="w-full sm:w-auto bg-white hover:bg-gray-100">
                      <Upload className="h-4 w-4 mr-2" />
                      Attach File
                    </Button>
                  </div>
                  {image && (
                    <span className="text-sm text-green-600 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      File attached
                    </span>
                  )}
                </div>
                
                {image && (
                  <div className="relative inline-block mt-3 bg-white p-2 rounded-md border shadow-sm">
                    {image.startsWith('data:application/pdf') || image.startsWith('data:application/') ? (
                      <div className="flex flex-col items-center justify-center w-32 h-32 bg-slate-50 border border-slate-200 rounded-md">
                        <FileText className="w-10 h-10 text-blue-500 mb-2" />
                        <span className="text-xs font-medium text-slate-700">Document</span>
                      </div>
                    ) : (
                      <img 
                        src={image} 
                        alt="Attachment preview" 
                        className="h-32 object-contain rounded-sm"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-2">
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
                      <Wrench className="h-4 w-4 mr-2" />
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

export default OtherServices;
