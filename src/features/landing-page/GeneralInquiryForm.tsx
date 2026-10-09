"use client";

import { apiFetch } from '@/lib/api-client';

import { useState } from "react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import { Label } from "@/ui/label";
import { Checkbox } from "@/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/firebase";
import { API_BASE_URL } from "@/utils/config";
import { Loader2, Send } from "lucide-react";

interface GeneralInquiryFormProps {
  onSuccess?: () => void;
  hideHeader?: boolean;
}

const GeneralInquiryForm = ({ onSuccess, hideHeader }: GeneralInquiryFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    listingType: "", // buy, rent, or sell
    propertyType: "", // residential, commercial, industrial
    name: "",
    email: "",
    mobile: "",
    requestVisit: false,
    visitDate: "",
    visitTime: "",
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.listingType) {
      toast({ title: "Error", description: "Please select Buy, Rent or Sell", variant: "destructive" });
      return;
    }
    if (!formData.propertyType) {
      toast({ title: "Error", description: "Please select property type", variant: "destructive" });
      return;
    }
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!formData.email.trim()) {
      toast({ title: "Error", description: "Please enter your email", variant: "destructive" });
      return;
    }
    if (!formData.mobile.trim()) {
      toast({ title: "Error", description: "Please enter your mobile number", variant: "destructive" });
      return;
    }
    if (formData.requestVisit && (!formData.visitDate || !formData.visitTime)) {
      toast({ title: "Error", description: "Please select date and time for visit", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const currentUser = auth.currentUser;

      // Prepare notification payload for admin
      const notificationPayload = {
        type: "general_inquiry",
        title: "New General Inquiry",
        message: `${formData.name} is interested in ${formData.listingType === 'buy' ? 'buying' : formData.listingType === 'sell' ? 'selling' : 'renting'} a ${formData.propertyType} property.${formData.requestVisit ? ` Requested visit on ${formData.visitDate} at ${formData.visitTime}.` : ''}`,
        // Inquiry details
        inquiryType: formData.listingType,
        propertyType: formData.propertyType,
        requestVisit: formData.requestVisit,
        visitDate: formData.visitDate || "",
        visitTime: formData.visitTime || "",
        // User details from form
        userName: formData.name,
        userEmail: formData.email,
        userPhone: formData.mobile,
        // Logged in user details (if available)
        userId: currentUser?.uid || "",
        loggedInUserEmail: currentUser?.email || "",
        loggedInUserName: currentUser?.displayName || "",
        // Metadata
        timestamp: new Date().toISOString(),
        isRead: false,
        priority: "medium",
      };

      //

      const response = await apiFetch(`${API_BASE_URL}/admin/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notificationPayload),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Inquiry Submitted!",
          description: "We will contact you soon regarding your inquiry.",
        });

        // Reset form
        setFormData({
          listingType: "",
          propertyType: "",
          name: "",
          email: "",
          mobile: "",
          requestVisit: false,
          visitDate: "",
          visitTime: "",
        });

        onSuccess?.();
      } else {
        throw new Error(data.message || "Failed to submit inquiry");
      }
    } catch (error) {

      toast({
        title: "Error",
        description: "Failed to submit inquiry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-none border-0 bg-transparent">
      <CardContent className="p-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Buy / Rent Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">I want to</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.listingType === "buy" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleInputChange("listingType", "buy")}
              >
                Buy
              </Button>
              <Button
                type="button"
                variant={formData.listingType === "rent" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleInputChange("listingType", "rent")}
              >
                Rent
              </Button>
              <Button
                type="button"
                variant={formData.listingType === "sell" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleInputChange("listingType", "sell")}
              >
                Sell
              </Button>
            </div>
          </div>

          {/* Property Type Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Property Type</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant={formData.propertyType === "residential" ? "default" : "outline"}
                size="sm"
                className="flex-1 min-w-[80px]"
                onClick={() => handleInputChange("propertyType", "residential")}
              >
                Residential
              </Button>
              <Button
                type="button"
                variant={formData.propertyType === "commercial" ? "default" : "outline"}
                size="sm"
                className="flex-1 min-w-[80px]"
                onClick={() => handleInputChange("propertyType", "commercial")}
              >
                Commercial
              </Button>
              <Button
                type="button"
                variant={formData.propertyType === "industrial" ? "default" : "outline"}
                size="sm"
                className="flex-1 min-w-[80px]"
                onClick={() => handleInputChange("propertyType", "industrial")}
              >
                Industrial
              </Button>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email ID</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Mobile */}
          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-sm font-medium">Mobile No.</Label>
            <Input
              id="mobile"
              type="tel"
              placeholder="Enter your mobile number"
              value={formData.mobile}
              onChange={(e) => handleInputChange("mobile", e.target.value)}
              className="h-9"
            />
          </div>

          {/* Request Visit Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requestVisit"
              checked={formData.requestVisit}
              onCheckedChange={(checked) => handleInputChange("requestVisit", checked as boolean)}
            />
            <Label htmlFor="requestVisit" className="text-sm font-medium cursor-pointer">
              Request a Visit (Optional)
            </Label>
          </div>

          {/* Date & Time - Show only if request visit is checked */}
          {formData.requestVisit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="visitDate" className="text-sm font-medium">Date</Label>
                <DatePicker
                  value={formData.visitDate}
                  onChange={(value) => handleInputChange("visitDate", value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visitTime" className="text-sm font-medium">Time</Label>
                <Select value={formData.visitTime} onValueChange={(value) => handleInputChange("visitTime", value)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="09:00 AM">09:00 AM</SelectItem>
                    <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                    <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                    <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                    <SelectItem value="01:00 PM">01:00 PM</SelectItem>
                    <SelectItem value="02:00 PM">02:00 PM</SelectItem>
                    <SelectItem value="03:00 PM">03:00 PM</SelectItem>
                    <SelectItem value="04:00 PM">04:00 PM</SelectItem>
                    <SelectItem value="05:00 PM">05:00 PM</SelectItem>
                    <SelectItem value="06:00 PM">06:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Inquiry
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default GeneralInquiryForm;
