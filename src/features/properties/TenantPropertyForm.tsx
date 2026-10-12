"use client";

import { apiFetch } from "@/lib/api-client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Key, Loader2 } from "lucide-react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { useToast } from "@/hooks/use-toast";
import { auth } from "../../firebase";
import { API_BASE_URL } from "../../utils/config";

const TenantPropertyForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyType = searchParams.get("type") || "";
  const propertyTypeLabel = useMemo(
    () => propertyType ? propertyType.charAt(0).toUpperCase() + propertyType.slice(1) : "Property",
    [propertyType]
  );
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    propertyName: "",
    location: "",
    unitNumber: "",
    ownerName: "",
    ownerPhone: "",
    monthlyRent: "",
    agreementStartDate: "",
    notes: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsubscribe();
  }, []);

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please sign in before submitting the tenant form.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.propertyName.trim() || !formData.location.trim()) {
      toast({
        title: "Missing Property Details",
        description: "Please enter the property name and location.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "tenant_property_registration",
          title: "Tenant Property Form Submitted",
          message: `${currentUser.displayName || currentUser.email || "A tenant"} submitted a ${propertyTypeLabel} tenant property form for ${formData.propertyName}.`,
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || "Tenant",
          userEmail: currentUser.email || "",
          userPhone: currentUser.phoneNumber || "",
          propertyTitle: formData.propertyName,
          propertyAddress: formData.location,
          propertyListingType: "rent",
          tenantName: currentUser.displayName || currentUser.email || "Tenant",
          propertyType: propertyTypeLabel,
          ownerName: formData.ownerName,
          ownerPhone: formData.ownerPhone,
          monthlyRent: formData.monthlyRent,
          unitNumber: formData.unitNumber,
          agreementStartDate: formData.agreementStartDate,
          notes: formData.notes,
          timestamp: new Date().toISOString(),
          isRead: false,
          priority: "medium",
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to submit tenant form");
      }

      setIsSuccess(true);
      toast({
        title: "Tenant form submitted",
        description: "Your tenant property details have been sent to admin.",
      });

      setTimeout(() => {
        navigate("/manage-property");
      }, 1200);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit tenant form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="container mx-auto py-8 px-4">
      <>
        <title>Tenant Form — ShoPROP</title>
        <meta name="description" content="Submit tenant property details for admin review." />
        <link rel="canonical" href="/tenant-property" />
      </>

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate("/select-property-type?role=tenant")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Property Type Selection
          </Button>

          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Key className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Tenant Form</h1>
              <p className="text-lg text-muted-foreground">
                Add tenant property details
                <span className="ml-2 px-2 py-1 text-sm bg-primary/10 text-primary rounded-md">
                  {propertyTypeLabel}
                </span>
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Tenant Property Details
            </CardTitle>
            <CardDescription>
              Fill out the details for the property where you are staying or planning to stay as a tenant.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="propertyName">Property Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="propertyName"
                    value={formData.propertyName}
                    onChange={(event) => updateField("propertyName", event.target.value)}
                    placeholder="Enter property name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unitNumber">Unit / Flat / Shop No.</Label>
                  <Input
                    id="unitNumber"
                    value={formData.unitNumber}
                    onChange={(event) => updateField("unitNumber", event.target.value)}
                    placeholder="Enter unit number"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="location">Location <span className="text-red-500">*</span></Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(event) => updateField("location", event.target.value)}
                    placeholder="Enter property address or location"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerName">Owner Name</Label>
                  <Input
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(event) => updateField("ownerName", event.target.value)}
                    placeholder="Enter owner name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerPhone">Owner Phone</Label>
                  <Input
                    id="ownerPhone"
                    value={formData.ownerPhone}
                    onChange={(event) => updateField("ownerPhone", event.target.value)}
                    placeholder="Enter owner phone"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyRent">Monthly Rent</Label>
                  <Input
                    id="monthlyRent"
                    value={formData.monthlyRent}
                    onChange={(event) => updateField("monthlyRent", event.target.value)}
                    placeholder="Enter monthly rent"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agreementStartDate">Agreement Start Date</Label>
                  <Input
                    id="agreementStartDate"
                    type="date"
                    value={formData.agreementStartDate}
                    onChange={(event) => updateField("agreementStartDate", event.target.value)}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(event) => updateField("notes", event.target.value)}
                    placeholder="Add agreement, rent, or contact details"
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate("/manage-property")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isSuccess}>
                  {isSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Submitted
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Tenant Form"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default TenantPropertyForm;
