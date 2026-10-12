"use client";

import InspectionReportList from './InspectionReportList';
import { apiFetch } from '@/lib/api-client';

import { useParams, useNavigate } from "@/lib/navigation";
import { ArrowLeft, FileText, Loader2, Upload, X, Download } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/card";
import { Textarea } from "@/ui/textarea";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { auth } from "../../firebase";
import { User, onAuthStateChanged } from "firebase/auth";
import { API_BASE_URL } from "../../utils/config";

const InspectionReport = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<User | null>(null);
  const [property, setProperty] = useState<any>(null);
  const [reportType, setReportType] = useState<string>("");
  const [report, setReport] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Document fields
  const [possessionLetterFile, setPossessionLetterFile] = useState<string>("");
  const [handoverLetterFile, setHandoverLetterFile] = useState<string>("");
  const [keysDetails, setKeysDetails] = useState<string>("");
  const [electricityBillMeterImage, setElectricityBillMeterImage] = useState<string>("");
  const [electricityBillReceipt, setElectricityBillReceipt] = useState<string>("");
  const [apartmentConditionImages, setApartmentConditionImages] = useState<string[]>([]);
  const [mglBillMeterImage, setMglBillMeterImage] = useState<string>("");
  const [mglBillReceipt, setMglBillReceipt] = useState<string>("");
  const [internetImage, setInternetImage] = useState<string>("");
  const [internetReceipt, setInternetReceipt] = useState<string>("");
  const [otherDetails, setOtherDetails] = useState<string>("");

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        toast({
          title: "Login Required",
          description: "Please login to submit an inspection report",
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

  const handleFileUpload = (field: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.includes('pdf')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image or PDF file",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      switch (field) {
        case 'possessionLetterFile':
          setPossessionLetterFile(result);
          break;
        case 'handoverLetterFile':
          setHandoverLetterFile(result);
          break;
        case 'electricityBillMeterImage':
          setElectricityBillMeterImage(result);
          break;
        case 'electricityBillReceipt':
          setElectricityBillReceipt(result);
          break;
        case 'mglBillMeterImage':
          setMglBillMeterImage(result);
          break;
        case 'mglBillReceipt':
          setMglBillReceipt(result);
          break;
        case 'internetImage':
          setInternetImage(result);
          break;
        case 'internetReceipt':
          setInternetReceipt(result);
          break;
      }
    };
    reader.readAsDataURL(file);
  };

  const removeFile = (field: string) => {
    switch (field) {
      case 'possessionLetterFile':
        setPossessionLetterFile("");
        break;
      case 'handoverLetterFile':
        setHandoverLetterFile("");
        break;
      case 'electricityBillMeterImage':
        setElectricityBillMeterImage("");
        break;
      case 'electricityBillReceipt':
        setElectricityBillReceipt("");
        break;
      case 'mglBillMeterImage':
        setMglBillMeterImage("");
        break;
      case 'mglBillReceipt':
        setMglBillReceipt("");
        break;
      case 'internetImage':
        setInternetImage("");
        break;
      case 'internetReceipt':
        setInternetReceipt("");
        break;
    }
    if (fileInputRefs.current[field]) {
      fileInputRefs.current[field]!.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to submit an inspection report",
        variant: "destructive"
      });
      navigate("/auth");
      return;
    }

    if (!reportType) {
      toast({
        title: "Report Type Required",
        description: "Please select a report type",
        variant: "destructive"
      });
      return;
    }

    if (!report.trim()) {
      toast({
        title: "Report Required",
        description: "Please provide the inspection report details",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/inspection-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.uid,
        },
        body: JSON.stringify({
          propertyId: propertyId || '',
          reportType: reportType,
          report: report.trim(),
          possessionLetterFile: possessionLetterFile,
          handoverLetterFile: handoverLetterFile,
          keysDetails: keysDetails,
          electricityBillMeterImage: electricityBillMeterImage,
          electricityBillReceipt: electricityBillReceipt,
          apartmentConditionImages: apartmentConditionImages,
          mglBillMeterImage: mglBillMeterImage,
          mglBillReceipt: mglBillReceipt,
          internetImage: internetImage,
          internetReceipt: internetReceipt,
          otherDetails: otherDetails,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Report Submitted",
          description: "Your inspection report has been submitted successfully and the admin has been notified.",
        });
        // Reset form
        setReportType("");
        setReport("");
        setPossessionLetterFile("");
        setHandoverLetterFile("");
        setKeysDetails("");
        setElectricityBillMeterImage("");
        setElectricityBillReceipt("");
        setApartmentConditionImages([]);
        setMglBillMeterImage("");
        setMglBillReceipt("");
        setInternetImage("");
        setInternetReceipt("");
        setOtherDetails("");
        // Navigate back
        navigate(`/property/${propertyId}`);
      } else {
        throw new Error(data.message || 'Failed to submit report');
      }
    } catch (error) {
      
      toast({
        title: "Error",
        description: "Failed to submit inspection report. Please try again later.",
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

  const handleMultiFileUpload = (field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (field === 'apartmentConditionImages') {
          setApartmentConditionImages(prev => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeMultiFile = (field: string, index: number) => {
    if (field === 'apartmentConditionImages') {
      setApartmentConditionImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  const renderMultiFileUpload = (field: string, label: string, placeholder: string, values: string[]) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {values.length > 0 && (
        <div className="space-y-2 mb-2">
          {values.map((value, index) => (
            <div key={index} className="flex items-center gap-2 p-2 border rounded">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1">Image {index + 1} uploaded</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeMultiFile(field, index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleMultiFileUpload(field, e)}
          ref={(el) => { fileInputRefs.current[field] = el; }}
          className="hidden"
          id={field}
        />
        <Label
          htmlFor={field}
          className="flex items-center gap-2 cursor-pointer border rounded p-2 hover:bg-gray-50"
        >
          <Upload className="h-4 w-4" />
          <span className="text-sm">{placeholder}</span>
        </Label>
      </div>
    </div>
  );

  const renderFileUpload = (field: string, label: string, placeholder: string, value: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-2 p-2 border rounded">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm flex-1">File uploaded</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeFile(field)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => handleFileUpload(field, e)}
            ref={(el) => { fileInputRefs.current[field] = el; }}
            className="hidden flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            id={field}
          />
          <Label
            htmlFor={field}
            className="flex items-center gap-2 cursor-pointer border rounded p-2 hover:bg-gray-50"
          >
            <Upload className="h-4 w-4" />
            <span className="text-sm">{placeholder}</span>
          </Label>
        </div>
      )}
    </div>
  );

  return (
    <>
      <>
        <title>Submit Inspection Report | PropBank</title>
      </>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
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
              <FileText className="h-5 w-5" />
              Submit Inspection Report
            </CardTitle>
            <CardDescription>
              {property && `Property: ${property.title || property.id}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type *</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger id="reportType">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_possession">1. On Possession</SelectItem>
                    <SelectItem value="on_handover">2. On Handover</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* On Possession Section */}
              {reportType === "on_possession" && (
                <div className="space-y-6 border rounded-lg p-4">
                  <h3 className="font-semibold text-lg">1. On Possession</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Download File (Possession Letter with fixture list)</Label>
                      <Button type="button" variant="outline" className="w-full mt-2">
                        <Download className="h-4 w-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                    {renderFileUpload('possessionLetterFile', 'Upload File / Attach Possession Letter', 'Upload Possession Letter', possessionLetterFile)}
                    <div className="space-y-2">
                      <Label htmlFor="keysDetails">Keys Details</Label>
                      <Textarea
                        id="keysDetails"
                        placeholder="Enter keys details..."
                        value={keysDetails}
                        onChange={(e) => setKeysDetails(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderFileUpload('electricityBillMeterImage', 'Electricity Bill - Upload Image of Meter', 'Upload Meter Image', electricityBillMeterImage)}
                      {renderFileUpload('electricityBillReceipt', 'Electricity Bill - Attach Payment Receipt', 'Attach Receipt', electricityBillReceipt)}
                    </div>

                    {renderMultiFileUpload('apartmentConditionImages', 'Apartment Condition - Upload Image of Premise', 'Upload Premise Image', apartmentConditionImages)}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderFileUpload('mglBillMeterImage', 'MGL Bill - Upload Image of Meter', 'Upload Meter Image', mglBillMeterImage)}
                      {renderFileUpload('mglBillReceipt', 'MGL Bill - Attach Payment Receipt', 'Attach Receipt', mglBillReceipt)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderFileUpload('internetImage', 'Internet, any landline (if have) - Upload Image', 'Upload Image', internetImage)}
                      {renderFileUpload('internetReceipt', 'Internet, any landline (if have) - Attach Payment Receipt', 'Attach Receipt', internetReceipt)}
                    </div>


                  </div>
                </div>
              )}

              {/* On Handover Section */}
              {reportType === "on_handover" && (
                <div className="space-y-6 border rounded-lg p-4">
                  <h3 className="font-semibold text-lg">2. On Handover</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Download File (Handover Letter with fixture list)</Label>
                      <Button type="button" variant="outline" className="w-full mt-2">
                        <Download className="h-4 w-4 mr-2" />
                        Download Template
                      </Button>
                    </div>
                    {renderFileUpload('handoverLetterFile', 'Upload File / Attach Handover Letter', 'Upload Handover Letter', handoverLetterFile)}
                    <div className="space-y-2">
                      <Label htmlFor="keysDetails">Keys Details</Label>
                      <Textarea
                        id="keysDetails"
                        placeholder="Enter keys details..."
                        value={keysDetails}
                        onChange={(e) => setKeysDetails(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderFileUpload('electricityBillMeterImage', 'Electricity Bill - Upload Image of Meter', 'Upload Meter Image', electricityBillMeterImage)}
                      {renderFileUpload('electricityBillReceipt', 'Electricity Bill - Attach Payment Receipt', 'Attach Receipt', electricityBillReceipt)}
                    </div>

                    {renderMultiFileUpload('apartmentConditionImages', 'Apartment Condition - Upload Image of Premise', 'Upload Premise Image', apartmentConditionImages)}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderFileUpload('mglBillMeterImage', 'MGL Bill - Upload Image of Meter', 'Upload Meter Image', mglBillMeterImage)}
                      {renderFileUpload('mglBillReceipt', 'MGL Bill - Attach Payment Receipt', 'Attach Receipt', mglBillReceipt)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {renderFileUpload('internetImage', 'Internet, any landline (if have) - Upload Image', 'Upload Image', internetImage)}
                      {renderFileUpload('internetReceipt', 'Internet, any landline (if have) - Attach Payment Receipt', 'Attach Receipt', internetReceipt)}
                    </div>


                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="report">Inspection Report *</Label>
                <Textarea
                  id="report"
                  placeholder="Enter the inspection report details as per the table format..."
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  disabled={submitting || !reportType || !report.trim()}
                  className="flex-1"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Submit Report
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
        {propertyId && user && <InspectionReportList propertyId={String(propertyId)}/> }
      </div>
    </>
  );
};

export default InspectionReport;
