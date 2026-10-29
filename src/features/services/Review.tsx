"use client";

import ReviewHistory from './ReviewHistory';
import { apiFetch } from '@/lib/api-client';

import { useParams, useNavigate } from "@/lib/navigation";
import { ArrowLeft, Star, Loader2 } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../utils/config";

const Review = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [reviewerType, setReviewerType] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Tenant part (reviewing owner)
  const [tenantPart, setTenantPart] = useState({
    ownerUnderstandable: "",
    softNature: "",
    ownerTransparent: "",
    problemSolver: "",
    easyOnRefundMoney: "",
    overallExperience: "",
  });

  // Owner part (reviewing tenant)
  const [ownerPart, setOwnerPart] = useState({
    tenantUnderstandable: "",
    softNature: "",
    tenantTransparent: "",
    problemSolver: "",
    punctualOnPayment: "",
    overallExperience: "",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        toast({
          title: "Login Required",
          description: "Please login to submit a review",
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
            setReviewerType(data.property.ownerUID === user?.uid
              ? "owner"
              : data.property.userRole === "tenant" ? "tenant" : "");
          }
        }
      } catch (error) { /* Preserve existing best-effort behavior. */ } finally {
        setLoading(false);
      }
    };

    if (propertyId && user) {
      fetchProperty();
    } else if (propertyId) {
      setLoading(false);
    }
  }, [propertyId, user]);

  const handleTenantPartChange = (field: string, value: string) => {
    setTenantPart(prev => ({ ...prev, [field]: value }));
  };

  const handleOwnerPartChange = (field: string, value: string) => {
    setOwnerPart(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to submit a review",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    if (!reviewerType) {
      toast({
        title: "Property Relationship Required",
        description: "Only the verified property owner or an active tenant can submit a review.",
        variant: "destructive"
      });
      return;
    }

    const answers=reviewerType==='tenant'?tenantPart:ownerPart;
    if(!Object.values(answers).some(value=>value.trim())) {
      toast({title:'Review Required',description:'Please provide at least one review response.',variant:'destructive'});
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.uid,
        },
        body: JSON.stringify({
          propertyId: propertyId || '',
          tenantPart: tenantPart,
          ownerPart: ownerPart,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Review Submitted",
          description: "Your review has been submitted successfully and the admin has been notified.",
        });
        // Navigate back
        navigate(`/manage-property`);
      } else {
        throw new Error(data.message || 'Failed to submit review');
      }
    } catch (error) {

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit review. Please try again later.",
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
        <title>Submit Review | PropBank</title>
      </>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
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
              <Star className="h-5 w-5" />
              Submit Review
            </CardTitle>
            <CardDescription>
              {property && `Property: ${property.title || property.id}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {reviewerType&&<p className="text-sm text-muted-foreground">
                {reviewerType==='owner'?'You are reviewing the active tenant as the property owner.':'You are reviewing the property owner as an active tenant.'}
              </p>}
              {!reviewerType&&<p role="alert" className="text-sm text-destructive">An active owner or tenant relationship is required to review this property.</p>}

              <div className="pt-4">
                {reviewerType === "tenant" && (
                  <div className="space-y-4 border rounded-lg p-6 bg-blue-50/30 border-blue-100">
                    <h3 className="font-semibold text-xl text-blue-900 flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm">A</div>
                      Reviewing Owner
                    </h3>
                    <p className="text-sm text-blue-700/70 mb-4">Please share your experience with the property owner.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-blue-900 font-medium">1. Owner Understandable</Label>
                        <Textarea
                          placeholder="How understanding was the owner during your stay?"
                          value={tenantPart.ownerUnderstandable}
                          onChange={(e) => handleTenantPartChange("ownerUnderstandable", e.target.value)}
                          rows={3}
                          className="bg-white border-blue-200 focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-900 font-medium">2. Soft Nature</Label>
                        <Textarea
                          placeholder="Comment on the owner's behavior and nature."
                          value={tenantPart.softNature}
                          onChange={(e) => handleTenantPartChange("softNature", e.target.value)}
                          rows={3}
                          className="bg-white border-blue-200 focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-900 font-medium">3. Owner Transparent</Label>
                        <Textarea
                          placeholder="How transparent was the owner about property issues/terms?"
                          value={tenantPart.ownerTransparent}
                          onChange={(e) => handleTenantPartChange("ownerTransparent", e.target.value)}
                          rows={3}
                          className="bg-white border-blue-200 focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-900 font-medium">4. Problem Solver</Label>
                        <Textarea
                          placeholder="Did the owner help resolve issues promptly?"
                          value={tenantPart.problemSolver}
                          onChange={(e) => handleTenantPartChange("problemSolver", e.target.value)}
                          rows={3}
                          className="bg-white border-blue-200 focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-900 font-medium">5. Easy on Refund Money</Label>
                        <Textarea
                          placeholder="How smooth was the security deposit/refund process?"
                          value={tenantPart.easyOnRefundMoney}
                          onChange={(e) => handleTenantPartChange("easyOnRefundMoney", e.target.value)}
                          rows={3}
                          className="bg-white border-blue-200 focus-visible:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-blue-900 font-medium">6. Overall Experience</Label>
                        <Textarea
                          placeholder="Your overall recommendation or feedback."
                          value={tenantPart.overallExperience}
                          onChange={(e) => handleTenantPartChange("overallExperience", e.target.value)}
                          rows={3}
                          className="bg-white border-blue-200 focus-visible:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {reviewerType === "owner" && (
                  <div className="space-y-4 border rounded-lg p-6 bg-orange-50/30 border-orange-100">
                    <h3 className="font-semibold text-xl text-orange-900 flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm">B</div>
                      Reviewing Tenant
                    </h3>
                    <p className="text-sm text-orange-700/70 mb-4">Please share your experience with the tenant.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-orange-900 font-medium">1. Tenant Understandable</Label>
                        <Textarea
                          placeholder="How understanding was the tenant regarding property rules?"
                          value={ownerPart.tenantUnderstandable}
                          onChange={(e) => handleOwnerPartChange("tenantUnderstandable", e.target.value)}
                          rows={3}
                          className="bg-white border-orange-200 focus-visible:ring-orange-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-orange-900 font-medium">2. Soft Nature</Label>
                        <Textarea
                          placeholder="Comment on the tenant's behavior and nature."
                          value={ownerPart.softNature}
                          onChange={(e) => handleOwnerPartChange("softNature", e.target.value)}
                          rows={3}
                          className="bg-white border-orange-200 focus-visible:ring-orange-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-orange-900 font-medium">3. Tenant Transparent</Label>
                        <Textarea
                          placeholder="How transparent was the tenant about any damages or issues?"
                          value={ownerPart.tenantTransparent}
                          onChange={(e) => handleOwnerPartChange("tenantTransparent", e.target.value)}
                          rows={3}
                          className="bg-white border-orange-200 focus-visible:ring-orange-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-orange-900 font-medium">4. Problem Solver</Label>
                        <Textarea
                          placeholder="Did the tenant cooperate in resolving maintenance needs?"
                          value={ownerPart.problemSolver}
                          onChange={(e) => handleOwnerPartChange("problemSolver", e.target.value)}
                          rows={3}
                          className="bg-white border-orange-200 focus-visible:ring-orange-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-orange-900 font-medium">5. Punctual on Payment</Label>
                        <Textarea
                          placeholder="How punctual was the tenant with rent and utility payments?"
                          value={ownerPart.punctualOnPayment}
                          onChange={(e) => handleOwnerPartChange("punctualOnPayment", e.target.value)}
                          rows={3}
                          className="bg-white border-orange-200 focus-visible:ring-orange-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-orange-900 font-medium">6. Overall Experience</Label>
                        <Textarea
                          placeholder="Your overall recommendation for future landlords."
                          value={ownerPart.overallExperience}
                          onChange={(e) => handleOwnerPartChange("overallExperience", e.target.value)}
                          rows={3}
                          className="bg-white border-orange-200 focus-visible:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={submitting || !reviewerType}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4 mr-2" />
                      Submit Review
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
        {user && propertyId && <ReviewHistory propertyId={String(propertyId)}/> }
      </div>
    </>
  );
};

export default Review;
