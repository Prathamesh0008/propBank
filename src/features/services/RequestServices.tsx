"use client";

import { apiFetch } from '@/lib/api-client';

import { useParams, useNavigate } from "@/lib/navigation";
import { ArrowLeft, Upload, X, Wrench, Loader2, FileText } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../utils/config";
import { uploadBase64Image } from "@/services/uploadService";

const SERVICE_TYPES = [
  "Plumbing Issue",
  "Leakage/ Seepage Issue",
  "Fixtures issue",
  "Painting work",
  "Electrical Issue",
  "Any other Issue"
];

const RequestServices = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<User | null>(null);
  const [userPhone, setUserPhone] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [serviceType, setServiceType] = useState<string>("");
  const [image, setImage] = useState<string | null>(null);
  const [comment, setComment] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user phone number from backend
        try {
          const response = await apiFetch(`${API_BASE_URL}/users/${currentUser.uid}`);
          if (response.ok) {
            const data = await response.json();
            if (data.user && data.user.phoneNumber) {
              setUserPhone(data.user.phoneNumber);
            }
          }
        } catch (error) { /* Preserve existing best-effort behavior. */ }
      } else {
        setUserPhone("");
      }
    });
    return () => unsubscribe();
  }, []);

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

  const removeImage = () => {
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to raise a request",
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
        description: "Please provide a comment describing the issue",
        variant: "destructive"
      });
      return;
    }

    try {
      setSubmitting(true);

      // Fetch property details to get owner information
      let property = null;
      let ownerPhoneNumber = '';
      let ownerEmail = '';
      let ownerName = '';
      let propertyTitle = '';
      let propertyAddress = '';

      if (propertyId) {
        try {
          const propertyResponse = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`);
          if (propertyResponse.ok) {
            const propertyData = await propertyResponse.json();
            if (propertyData.success && propertyData.property) {
              property = propertyData.property;
              propertyTitle = property.title || '';
              propertyAddress = property.address || property.city || property.location || 'Not specified';
              ownerName = property.ownerName || 'Unknown Owner';
              ownerEmail = property.ownerEmail || '';

              // Fetch owner's phone number
              if (property.ownerUID) {
                try {
                  const ownerResponse = await apiFetch(`${API_BASE_URL}/users/${property.ownerUID}`);
                  if (ownerResponse.ok) {
                    const ownerData = await ownerResponse.json();
                    if (ownerData.user && ownerData.user.phoneNumber) {
                      ownerPhoneNumber = ownerData.user.phoneNumber;
                    }
                    if (ownerData.user && ownerData.user.email && !ownerEmail) {
                      ownerEmail = ownerData.user.email;
                    }
                  }
                } catch (error) { /* Preserve existing best-effort behavior. */ }
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
            'service-requests',
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
        type: 'service_request',
        title: `Service Request: ${serviceType}`,
        message: `User ${user.displayName || user.email || 'Unknown User'} has raised a ${serviceType} request${propertyId ? ` for property: ${propertyTitle || propertyId}` : ''}. ${comment}`,
        propertyId: propertyId || '',
        ownerId: property?.ownerUID || '',
        ownerName: ownerName,
        ownerPhone: ownerPhoneNumber || property?.primaryNo || '',
        ownerEmail: ownerEmail,
        // User details (person who raised the request)
        userId: user.uid || '',
        userName: user.displayName || user.email || 'Unknown User',
        userEmail: user.email || '',
        userPhone: userPhone || user.phoneNumber || '',
        // Property details
        propertyTitle: propertyTitle,
        propertyAddress: propertyAddress,
        propertyListingType: property?.listingType || 'rent',
        // Service request specific fields
        serviceType: serviceType,
        serviceComment: comment,
        serviceImage: serviceImageUrl, // Use uploaded URL instead of base64
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
          description: `Your ${serviceType} request has been sent to the admin. They will contact you soon.`,
        });

        // Reset form after successful submission
        setServiceType("");
        setImage(null);
        setComment("");
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
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

  return (
    <main className="container mx-auto py-8 px-4">
      <>
        <title>Raise a Request — Property Management</title>
        <meta name="description" content="Raise maintenance and service requests for your property" />
      </>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/manage-property")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Manage Properties
          </Button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary shadow-glow">
              <Wrench className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">RAISE A REQUEST</h1>
              <p className="text-lg text-muted-foreground">
                {propertyId ? `Property ID: ${propertyId}` : "Submit maintenance and service requests"}
              </p>
            </div>
          </div>
        </div>

        {/* Service Request Forms */}
        <Card>
          <CardHeader>
            <CardTitle>Service Request Forms</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitRequest} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="serviceType">Select Service Type *</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger id="serviceType">
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Optional Attachment</Label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center min-h-[200px] relative bg-slate-50">
                  {image ? (
                    <div className="w-full relative flex flex-col items-center justify-center">
                      {image.startsWith('data:application/pdf') || image.startsWith('data:application/') ? (
                        <div className="flex flex-col items-center justify-center w-full max-w-[200px] h-40 bg-white border border-slate-200 rounded-md shadow-sm">
                          <FileText className="w-12 h-12 text-blue-500 mb-2" />
                          <span className="text-sm font-medium text-slate-700">Document Attached</span>
                        </div>
                      ) : (
                        <img
                          src={image}
                          alt="Service issue"
                          className="w-full max-h-[300px] object-contain rounded-md bg-white border shadow-sm"
                        />
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 rounded-full h-8 w-8"
                        onClick={removeImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <FileText className="h-10 w-10 text-slate-400 mb-4" />
                      <p className="text-sm text-slate-500 mb-4 text-center max-w-sm">
                        Upload an image or document to help us better understand the issue
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Select File
                      </Button>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf,.doc,.docx"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Additional Details *</Label>
                <Textarea
                  id="comment"
                  placeholder="Please describe the issue in detail..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || !serviceType || !comment.trim()}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default RequestServices;
