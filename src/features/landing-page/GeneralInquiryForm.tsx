"use client";

import { apiFetch } from '@/lib/api-client';

import { useEffect, useState } from "react";
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
import { EMAIL_PATTERN, indiaCalendarDate, validateIndianContact } from '@/lib/form-validation';

interface GeneralInquiryFormProps {
  onSuccess?: () => void;
  hideHeader?: boolean;
}

const GeneralInquiryForm = ({ onSuccess, hideHeader }: GeneralInquiryFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors,setErrors]=useState<Record<string,string>>({});

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

  useEffect(()=>{
    const current=auth.currentUser;
    if(!current)return;
    setFormData(previous=>({...previous,name:previous.name||current.displayName||'',email:previous.email||current.email||''}));
  },[]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(previous=>({...previous,[field]:''}));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors:Record<string,string>={};
    if(!formData.listingType)nextErrors.listingType='Choose whether you want to buy, rent or sell.';
    if(!formData.propertyType)nextErrors.propertyType='Choose a property type.';
    if(!formData.name.trim())nextErrors.name='Enter your name.';
    else if(formData.name.trim().length>100)nextErrors.name='Name must be 100 characters or fewer.';
    if(!EMAIL_PATTERN.test(formData.email.trim()))nextErrors.email='Enter a valid email address.';
    const mobileError=validateIndianContact(formData.mobile);if(mobileError)nextErrors.mobile=mobileError;
    if(formData.requestVisit&&(!formData.visitDate||formData.visitDate<indiaCalendarDate()))nextErrors.visitDate='Choose today or a future date in India.';
    if(formData.requestVisit&&!formData.visitTime)nextErrors.visitTime='Choose a preferred time.';
    setErrors(nextErrors);if(Object.keys(nextErrors).length)return;

    setIsSubmitting(true);

    try {
      const currentUser = auth.currentUser;

      // Prepare notification payload for admin
      const notificationPayload = {
        type: "general_inquiry",
        title: "New General Inquiry",
        message: `${formData.name} is interested in ${formData.listingType === 'buy' ? 'buying' : formData.listingType === 'sell' ? 'selling' : 'renting'} a ${formData.propertyType} property.${formData.requestVisit ? ` Preferred visit or callback time: ${formData.visitDate} at ${formData.visitTime}.` : ''}`,
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
        if(response.status===429) {
          toast({title:'Please wait',description:data.message||'Too many enquiries. Please wait one minute before retrying.',variant:'destructive'});
          return;
        }
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
            {errors.listingType&&<p role="alert" className="text-sm text-destructive">{errors.listingType}</p>}
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
            {errors.propertyType&&<p role="alert" className="text-sm text-destructive">{errors.propertyType}</p>}
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
              maxLength={100}
            />
            {errors.name&&<p role="alert" className="text-sm text-destructive">{errors.name}</p>}
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
            {errors.email&&<p role="alert" className="text-sm text-destructive">{errors.email}</p>}
          </div>

          {/* Mobile */}
          <div className="space-y-2">
            <Label htmlFor="mobile" className="text-sm font-medium">Mobile No.</Label>
            <Input
              id="mobile"
              type="tel"
              placeholder="10-digit mobile number"
              value={formData.mobile}
              inputMode="numeric" autoComplete="tel-national" maxLength={10}
              onChange={(e) => handleInputChange("mobile", e.target.value.replace(/\D/g,'').slice(0,10))}
              className="h-9"
            />
            {errors.mobile&&<p role="alert" className="text-sm text-destructive">{errors.mobile}</p>}
          </div>

          {/* Request Visit Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requestVisit"
              checked={formData.requestVisit}
              onCheckedChange={(checked) => handleInputChange("requestVisit", checked as boolean)}
            />
            <Label htmlFor="requestVisit" className="text-sm font-medium cursor-pointer">
              Preferred Visit / Callback Time (Optional)
            </Label>
          </div>
          {formData.requestVisit&&<p className="text-xs text-muted-foreground">This is a preference for our team to discuss with you; it does not schedule a confirmed visit.</p>}

          {/* Date & Time - Show only if request visit is checked */}
          {formData.requestVisit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="visitDate" className="text-sm font-medium">Date</Label>
                <DatePicker
                  value={formData.visitDate}
                  onChange={(value) => handleInputChange("visitDate", value)}
                  min={indiaCalendarDate()}
                  className="h-9"
                />
                {errors.visitDate&&<p role="alert" className="text-sm text-destructive">{errors.visitDate}</p>}
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
                {errors.visitTime&&<p role="alert" className="text-sm text-destructive">{errors.visitTime}</p>}
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
