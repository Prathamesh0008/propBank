"use client";

import styles from "./PropertyForm.module.css";

import ClientPropertyFields, {clientPropertySchema} from './ClientPropertyFields';
import { apiFetch } from '@/lib/api-client';

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/ui/form";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import { Textarea } from "@/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Checkbox } from "@/ui/checkbox";
import { ArrowLeft, Building2, Upload, X, Image as ImageIcon, CheckSquare, User, Plus, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { auth } from "../../firebase";
import { User as FirebaseUser } from "firebase/auth";
import { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from "../../utils/config";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { FurnishedChecklistModal } from "./FurnishedChecklistModal";
import { uploadBase64Image } from "../../services/uploadService";
import { addMonths, format, subDays, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  ...clientPropertySchema,
  // Property Basic Details
  propertyTitle: z.string().min(1, "Property title is required"),
  propertyType: z.string().min(1, "Property type is required"),
  configuration: z.string().min(1, "Configuration is required"),
  listingType: z.string().min(1, "Listing type is required"),

  // Unit Details (conditional based on property type)
  unitNumber: z.string().optional(),
  floor: z.string().optional(),
  location: z.string().min(1, "Location is required"),

  // Area Details
  carpetArea: z.string().optional(),
  plotArea: z.string().optional(),
  constructedArea: z.string().optional(),

  // Tenant Information (conditional - required when property is rented)
  tenantFirstName: z.string().optional(),
  tenantLastName: z.string().optional(),
  tenantEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  mobileNumber: z.string().optional(),
  primaryNo: z.string().optional(),
  ultNo: z.string().optional(),
  tenantEmergencyContact: z.string().optional(),

  // Tenant Employment Details
  tenantEmploymentStatus: z.string().optional(),
  tenantEmployer: z.string().optional(),
  tenantMonthlyIncome: z.string().optional(),

  // Tenant Spouse Information
  tenantIsMarried: z.boolean().optional(),
  tenantSpouse: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    employmentStatus: z.string().optional(),
    employer: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),

  // Pricing Details (conditional based on listing type)
  monthlyRent: z.string().optional(), // For rent
  sellingPrice: z.string().optional(), // For sell

  // Monthly Rent Details (for rent only) - Dynamic Schedule
  rentSchedule: z.array(z.object({
    year: z.string().optional(),
    months: z.string().optional(),
    amount: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  })).optional(),

  // Legacy fields - kept for compatibility but will be populated from schedule if needed
  monthlyRent1stYear: z.string().optional(),
  monthlyRent2ndYear: z.string().optional(),
  monthlyRent3rdYear: z.string().optional(),
  monthlyRent4thYear: z.string().optional(),
  rentFromDate1: z.string().optional(),
  rentToDate1: z.string().optional(),
  rentFromDate2: z.string().optional(),
  rentToDate2: z.string().optional(),

  // Payment Details
  paymentDueDate: z.string().optional(),
  escalationPercentage: z.string().optional(),
  escalationAmount: z.string().optional(),

  // Security & Agreement
  securityDeposit: z.string().optional(),
  agreementPeriod: z.string().optional(),
  agreementStartDate: z.string().optional(),
  agreementEndDate: z.string().optional(),

  // Notice & Lock-in
  noticePeriod: z.string().optional(),
  lockInPeriod: z.string().optional(),

  // Unit Condition & Maintenance
  unitCondition: z.string().optional(),
  maintenanceToBePaidBy: z.string().optional(),
  projectCondition: z.string().optional(),
  rentalStatus: z.string().optional(), // New field to track if property is rented
  possessionDate: z.string().optional(), // Possession date for available for rent
  saleStatus: z.string().optional(),
  buyerFirstName: z.string().optional(),
  buyerLastName: z.string().optional(),
  buyerPhone: z.string().optional(),

  // Furnished Checklist
  furnishedChecklist: z.array(z.object({
    id: z.string(),
    name: z.string(),
    checked: z.boolean(),
    quantity: z.number().min(1).default(1),
    category: z.enum(['basic', 'kitchen', 'bedroom', 'living', 'appliances', 'semifurnished', 'office', 'infrastructure', 'safety', 'machinery', 'storage', 'utilities', 'other'])
  })).optional(),

  // Images & Comments
  images: z.array(z.string()).optional(),
  internalImages: z.array(z.string()).optional(),
  specificComments: z.string().optional(),

  // Pre-leased Details
  isPreLeased: z.boolean().default(false),
  preLeasedType: z.string().optional(),
  agreementTerm: z.string().optional(),
  lockInPeriodPreLeased: z.string().optional(),
  rentalIncome: z.string().optional(),
  escalation: z.string().optional(),
  tenantDetails: z.string().optional(),
  purpose: z.string().optional(),
  specificRequirement: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface UserInfo {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  phoneNumber: string;
}

const getOrdinalSuffix = (i: number) => {
  const j = i % 10,
    k = i % 100;
  if (j === 1 && k !== 11) {
    return "st";
  }
  if (j === 2 && k !== 12) {
    return "nd";
  }
  if (j === 3 && k !== 13) {
    return "rd";
  }
  return "th";
};

const AddPropertyForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPropertyType = searchParams.get('type') || '';
  const selectedRole = searchParams.get('role') || 'owner';
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedInternalImages, setUploadedInternalImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const [showFurnishedModal, setShowFurnishedModal] = useState(false);
  const [furnishedChecklist, setFurnishedChecklist] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isInternalUploading, setIsInternalUploading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [searchError, setSearchError] = useState<string | undefined>(undefined);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchUserByPhone = async (phoneNumber: string) => {
    if (!phoneNumber || phoneNumber.trim().length < 10) {
      setUserInfo(null);
      setSearchError(undefined);
      setSearchingUser(false);
      return;
    }

    setSearchingUser(true);
    setSearchError(undefined);

    try {
      const response = await apiFetch(`${API_BASE_URL}/users/search?phone=${encodeURIComponent(phoneNumber)}`);
      const data = await response.json();

      if (data.success && data.user) {
        const user = data.user;
        setUserInfo({
          uid: user.uid,
          name: user.name,
          email: user.email,
          photoURL: user.photoURL || '',
          phoneNumber: user.phoneNumber
        });

        // Auto-fill form
        const nameParts = user.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        form.setValue('tenantFirstName', firstName);
        form.setValue('tenantLastName', lastName);
        if (user.email) form.setValue('tenantEmail', user.email);

        toast({
          title: "User Found",
          description: `Found user: ${user.name}`,
        });
      } else {
        setUserInfo(null);
        setSearchError(data.message || "User is not found. Please ask to sign up with our platform to continue.");
        toast({
          title: "User Not Found",
          description: data.message || "User is not found. Please ask to sign up with our platform to continue.",
          variant: "destructive"
        });
      }
    } catch (error) {
      setUserInfo(null);
      setSearchError("Failed to search user. Please try again.");
    } finally {
      setSearchingUser(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const value = e.target.value;
    field.onChange(e); // Update form state

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUserByPhone(value);
    }, 1000);
  };

  // Image handling functions
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Only allow 1 building image
    if (uploadedImages.length >= 1) {
      toast({
        title: "Image already uploaded",
        description: "Only one building image is allowed. Remove the existing image first.",
        variant: "destructive",
      });
      return;
    }

    const file = files[0];
    if (file && file.type.startsWith('image/')) {
      setIsUploading(true);

      try {
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Image = e.target?.result as string;

          try {
            // Upload to Cloudflare R2
            const uploadedUrl = await uploadBase64Image(base64Image, 'properties', 'building');



            setUploadedImages([uploadedUrl]);
            form.setValue('images', [uploadedUrl]);

            toast({
              title: "Image uploaded",
              description: "Building image uploaded successfully to cloud storage.",
            });
          } catch (uploadError) {

            // Fallback to base64 if R2 upload fails

            setUploadedImages([base64Image]);
            form.setValue('images', [base64Image]);

            toast({
              title: "Image saved locally",
              description: "Cloud upload failed, image will be uploaded when saving property.",
              variant: "destructive",
            });
          } finally {
            setIsUploading(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {

        setIsUploading(false);
        toast({
          title: "Upload failed",
          description: "Failed to read the image file.",
          variant: "destructive",
        });
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      form.setValue('images', newImages);
      return newImages;
    });
  };

  const handleInternalImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    if (uploadedInternalImages.length + files.length > 6) {
      toast({
        title: "Limit exceeded",
        description: "You can only upload up to 6 internal images.",
        variant: "destructive",
      });
      return;
    }

    setIsInternalUploading(true);
    const newImages: string[] = [];let pendingUploads=0,failedReads=0;

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file && file.type.startsWith('image/')) {
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const base64Image = await base64Promise;

          try {
            const uploadedUrl = await uploadBase64Image(base64Image, 'properties', 'internal');
            newImages.push(uploadedUrl);
          } catch (e) {
            pendingUploads++;
            newImages.push(base64Image);
          }
        } catch (error) {
          failedReads++;
        }
      }
    }

    setUploadedInternalImages(prev => {
      const update = [...prev, ...newImages];
      form.setValue('internalImages', update);
      return update;
    });
    setIsInternalUploading(false);
    if(pendingUploads||failedReads)toast({title:'Some images are not uploaded',description:`${pendingUploads} retained locally for retry on save; ${failedReads} could not be read. Property saving will fail if any selected image cannot be uploaded.`,variant:'destructive'});

    // Reset input
    if (internalFileInputRef.current) {
      internalFileInputRef.current.value = '';
    }
  };

  const removeInternalImage = (index: number) => {
    setUploadedInternalImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      form.setValue('internalImages', newImages);
      return newImages;
    });
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyTitle: "",
      propertyType: selectedPropertyType,
      propertyCategory:selectedPropertyType,
      configuration: "",
      listingType: "",
      unitNumber: "",
      floor: "",
      location: "",
      carpetArea: "",
      plotArea: "",
      constructedArea: "",
      // Tenant Information
      // Tenant Information
      tenantFirstName: "",
      tenantLastName: "",
      tenantEmail: "",
      mobileNumber: "",
      primaryNo: "",
      ultNo: "",
      tenantEmergencyContact: "",

      // Employment
      tenantEmploymentStatus: "",
      tenantEmployer: "",
      tenantMonthlyIncome: "",

      // Spouse
      tenantIsMarried: false,
      tenantSpouse: {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        employmentStatus: "",
        employer: "",
        notes: "",
      },
      // Pricing
      monthlyRent: "",
      sellingPrice: "",
      monthlyRent1stYear: "",
      monthlyRent2ndYear: "",
      monthlyRent3rdYear: "",
      monthlyRent4thYear: "",
      rentFromDate1: "",
      rentToDate1: "",
      rentFromDate2: "",
      rentToDate2: "",
      rentSchedule: [{ year: "1st Year", months: "11", amount: "", fromDate: "", toDate: "" }], // Start with one row
      paymentDueDate: "",
      escalationPercentage: "",
      escalationAmount: "",
      securityDeposit: "",
      agreementPeriod: "",
      agreementStartDate: "",
      agreementEndDate: "",
      noticePeriod: "",
      lockInPeriod: "",
      unitCondition: "",
      maintenanceToBePaidBy: "",
      projectCondition: "",
      rentalStatus: "",
      possessionDate: '',
      saleStatus: "available",
      buyerFirstName: "",
      buyerLastName: "",
      buyerPhone: "",
      furnishedChecklist: [],
      images: [],
      internalImages: [],
      specificComments: "",
      isPreLeased: false,
      preLeasedType: "",
      agreementTerm: "",
      lockInPeriodPreLeased: "",
      rentalIncome: "",
      escalation: "",
      tenantDetails: "",
      purpose: "",
      specificRequirement: "",
    },
  });

  const { fields: rentScheduleFields, append: appendRentSchedule, remove: removeRentSchedule } = useFieldArray({
    control: form.control,
    name: "rentSchedule",
  });

  const agreementStartDate = form.watch('agreementStartDate');
  const agreementPeriod = form.watch('agreementPeriod');

  useEffect(() => {
    if (agreementStartDate && agreementPeriod) {
      const periodInMonths = parseInt(agreementPeriod, 10);
      if (!isNaN(periodInMonths) && periodInMonths > 0) {
        const parts = agreementStartDate.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts.map(Number);
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            date.setMonth(date.getMonth() + periodInMonths);
            date.setDate(date.getDate() - 1); // standard agreement end is minus one day
            const newYear = date.getFullYear();
            const newMonth = String(date.getMonth() + 1).padStart(2, '0');
            const newDay = String(date.getDate()).padStart(2, '0');
            form.setValue('agreementEndDate', `${newYear}-${newMonth}-${newDay}`);
          }
        }
      }
    }
  }, [agreementStartDate, agreementPeriod, form]);

  const onSubmit = async (data: FormData) => {
    try {
      // Validate pricing based on listing type
      if (data.listingType === "rent" && (!data.monthlyRent || data.monthlyRent.trim() === "")) {
        toast({
          title: "Missing Monthly Rent",
          description: "Please enter the monthly rent amount for rental properties.",
          variant: "destructive",
        });
        return;
      }

      if (data.listingType === "sell" && (!data.sellingPrice || data.sellingPrice.trim() === "")) {
        toast({
          title: "Missing Selling Price",
          description: "Please enter the selling price for sale properties.",
          variant: "destructive",
        });
        return;
      }

      // Sync and validate pre-leased properties
      if (data.listingType === "sell" && data.isPreLeased) {
        data.projectCondition = "Preleased";

        if (!data.preLeasedType) {
          toast({
            title: "Missing Pre-leased Type",
            description: "Please select the property type (Residential/Commercial/Industrial).",
            variant: "destructive",
          });
          return;
        }

        if (!data.rentalIncome) {
          toast({
            title: "Missing Rental Income",
            description: "Please enter the rental income for the pre-leased property.",
            variant: "destructive",
          });
          return;
        }
      }

      // Validate buyer details for sold properties
      if (data.listingType === "sell" && data.saleStatus === "sold") {
        if (!data.buyerFirstName || data.buyerFirstName.trim() === "") {
          toast({
            title: "Missing Buyer Information",
            description: "Please enter the buyer's first name for sold properties.",
            variant: "destructive",
          });
          return;
        }

        if (!data.buyerLastName || data.buyerLastName.trim() === "") {
          toast({
            title: "Missing Buyer Information",
            description: "Please enter the buyer's last name for sold properties.",
            variant: "destructive",
          });
          return;
        }

        if (!data.buyerPhone || data.buyerPhone.trim() === "") {
          toast({
            title: "Missing Buyer Contact",
            description: "Please enter the buyer's phone number for sold properties.",
            variant: "destructive",
          });
          return;
        }
      }

      // Validate tenant details for rented properties
      if (data.listingType === "rent" && data.rentalStatus === "rented") {
        if (!data.tenantFirstName || data.tenantFirstName.trim() === "") {
          toast({
            title: "Missing Tenant Information",
            description: "Please enter the tenant's first name for rented properties.",
            variant: "destructive",
          });
          return;
        }

        if (!data.tenantLastName || data.tenantLastName.trim() === "") {
          toast({
            title: "Missing Tenant Information",
            description: "Please enter the tenant's last name for rented properties.",
            variant: "destructive",
          });
          return;
        }

        if (!data.mobileNumber || data.mobileNumber.trim() === "") {
          toast({
            title: "Missing Tenant Contact",
            description: "Please enter the tenant's mobile number for rented properties.",
            variant: "destructive",
          });
          return;
        }

        // Validate agreement details for rented properties
        if (!data.agreementPeriod || data.agreementPeriod.trim() === "") {
          toast({
            title: "Missing Agreement Information",
            description: "Please enter the agreement period for rented properties.",
            variant: "destructive",
          });
          return;
        }

        if (!data.agreementStartDate || data.agreementStartDate.trim() === "") {
          toast({
            title: "Missing Agreement Start Date",
            description: "Please enter the agreement start date for rented properties.",
            variant: "destructive",
          });
          return;
        }

        if (!data.agreementEndDate || data.agreementEndDate.trim() === "") {
          toast({
            title: "Missing Agreement End Date",
            description: "Please enter the agreement end date for rented properties.",
            variant: "destructive",
          });
          return;
        }

        if (!data.paymentDueDate || data.paymentDueDate.trim() === "") {
          toast({
            title: "Missing Payment Due Date",
            description: "Please enter the payment due date for rented properties.",
            variant: "destructive",
          });
          return;
        }
      }

      // Get current user
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to add a property.",
          variant: "destructive",
        });
        return;
      }

      // Filter furnished checklist to only include checked items (saves DB space)
      const checkedFurnishedItems = furnishedChecklist.filter(item => item.checked);
      const buildingImages = data.images?.length ? data.images : uploadedImages;
      const interiorImages = data.internalImages?.length ? data.internalImages : uploadedInternalImages;

      // Prepare property data for backend API
      const propertyData = {
        ...data,
        // Explicitly map tenant names to ensure they are sent
        tenantFirstName: data.tenantFirstName,
        tenantLastName: data.tenantLastName,
        // Add legacy tenantName for compatibility
        tenantName: `${data.tenantFirstName} ${data.tenantLastName}`.trim(),

        isSold: data.saleStatus === "sold",
        buyerFirstName: data.buyerFirstName,
        buyerLastName: data.buyerLastName,
        buyerPhone: data.buyerPhone,

        images: buildingImages, // Ensure images from the latest form state are included
        internalImages: interiorImages,
        furnishedChecklist: checkedFurnishedItems, // Only include checked items
        ownerUID: currentUser.uid,
      };


      // Send to backend API
      const response = await apiFetch(`${API_BASE_URL}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(propertyData)
      });

      const result = await response.json();

      if (result.success) {
        const listingTypeText = data.listingType === "rent" ? "rental property" : "property for sale";

        // Invalidate property queries so they refetch the newly added property
        queryClient.invalidateQueries({ queryKey: ['userProperties'] });
        queryClient.invalidateQueries({ queryKey: ['allProperties'] });

        toast({
          title: `${data.propertyTitle} added successfully!`,
          description: result.property?.moderationStatus==='pending_review'?'Your listing was submitted for admin review and is not public yet.':`Your ${listingTypeText} has been saved.`,
        });
        navigate("/manage-property");
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to add property. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getConfigurationOptions = () => {
    switch (selectedPropertyType) {
      case "residential":
        return [
          { value: "bunglow", label: "Bunglow" },
          { value: "2 BHK Flat", label: "2 BHK" },
          { value: "3 BHK Flat", label: "3 BHK" },
          { value: "4 BHK Flat", label: "4 BHK" },
          { value: "5+ BHK Flat", label: "5+ BHK" },
        ];
      case "commercial":
        return [
          { value: "office", label: "Office" },
          { value: "shop", label: "Shop" },
        ];
      case "industrial":
        return [
          { value: "unit", label: "Unit" },
          { value: "shed", label: "Shed" },
          { value: "Plot/land", label: "Plot/land" },
          { value: "RCC", label: "RCC" },
        ];
      default:
        return [];
    }
  };

  const getUnitLabel = () => {
    switch (selectedPropertyType) {
      case "residential":
        return "Flat No.";
      case "commercial":
        return "Office / Shop No.";
      case "industrial":
        return "Unit/ Plot No.";
      default:
        return "Unit No.";
    }
  };

  return (
    <main className={styles.page}>
      <>
        <title>Add Property — Comprehensive Property Details</title>
        <meta name="description" content="Add comprehensive property details including rental terms, tenant information, and agreement details." />
        <link rel="canonical" href="/add-property" />
      </>

      <div className={styles.shell}>
        {/* Header */}
        <div className={styles.pageIntro}>
          <Button variant="ghost" onClick={() => navigate(`/select-property-type?role=${selectedRole}`)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Property Type Selection
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <div className={styles.introIcon}>
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className={styles.title}>List your property</h1>
              <p className="text-lg text-muted-foreground">
                Property details, thoughtfully organized
                {selectedPropertyType && (
                  <span className="ml-2 px-2 py-1 text-sm bg-primary/10 text-primary rounded-md">
                    {selectedPropertyType.charAt(0).toUpperCase() + selectedPropertyType.slice(1)}
                  </span>
                )}

              </p>
            </div>
          </div>
        </div>

        <Card className={styles.formPanel}>
          <CardHeader>
            <CardTitle>Tell us about the space</CardTitle>
            <CardDescription>
              Complete the details below. Your listing will be reviewed before it appears in public search.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                const invalidFields = Object.keys(errors);
                const firstError = errors[invalidFields[0] as keyof typeof errors];
                const firstMessage = firstError && typeof firstError === "object" && "message" in firstError
                  ? String(firstError.message || "") : "";
                toast({
                  title: "Please review the highlighted fields",
                  description: firstMessage || `${invalidFields.length} field(s) need attention before submission.`,
                  variant: "destructive",
                });
                // React Hook Form focuses the first registered invalid control when possible.
                // Keep the message useful even for conditional fields without a focusable input.
              })} className={`${styles.formBody} space-y-8`}>
                <ClientPropertyFields form={form}/>

                {/* Basic Property Information */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-4 border rounded-lg">
                  <div className="lg:col-span-4">
                    <h3 className="text-lg font-semibold mb-4">Property Details</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="propertyTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter property name here" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="configuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Configuration / (Structure)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select configuration" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getConfigurationOptions().map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="listingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Listing Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select listing type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="rent">For Rent</SelectItem>
                            <SelectItem value="sell">For Sale</SelectItem>
                            <SelectItem value="manage">To Manage</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Rental Status - Only show for rental properties */}
                  {form.watch("listingType") === "rent" && (
                    <FormField
                      control={form.control}
                      name="rentalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rental Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select rental status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="available">Available for Rent</SelectItem>
                              <SelectItem value="rented">Already Rented Out</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Sale Status - Only show for sale properties */}
                  {form.watch("listingType") === "sell" && (
                    <FormField
                      control={form.control}
                      name="saleStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || "available"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select sale status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="available">Available for Sale</SelectItem>
                              <SelectItem value="sold">Sold Out Already</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Unit Details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 border rounded-lg">
                  <div className="lg:col-span-3">
                    <h3 className="text-lg font-semibold ">Unit Details</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="unitNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{getUnitLabel()}</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter unit number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="floor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter floor" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-3">
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Where is your property located? (Enter full address)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Area Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border rounded-lg">
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold">Area (in sqft)</h3>
                  </div>
                  <FormField
                    control={form.control}
                    name="carpetArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carpet Area (Sqft)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Enter carpet area" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="constructedArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Built-up Area (Sqft)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="Enter built-up area" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {/* Plot Area - Only for Industrial properties */}
                  {selectedPropertyType === "industrial" && (
                    <FormField
                      control={form.control}
                      name="plotArea"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plot Area (Sqft)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter plot area" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Buyer Information - Only show when property is already sold */}
                {form.watch("listingType") === "sell" && form.watch("saleStatus") === "sold" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 border rounded-lg">
                    <div className="lg:col-span-3">
                      <h3 className="text-lg font-semibold mb-4">Buyer Information</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Since this property is already sold, please provide the buyer details.
                      </p>
                    </div>

                    <div className="md:col-span-1">
                      <FormField
                        control={form.control}
                        name="buyerFirstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Buyer First Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <FormField
                        control={form.control}
                        name="buyerLastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Buyer Last Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <FormField
                        control={form.control}
                        name="buyerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Buyer Phone Number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {/* Tenant Information - Only show when property is already rented */}
                {form.watch("listingType") === "rent" && form.watch("rentalStatus") === "rented" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 border rounded-lg">
                    <div className="lg:col-span-3">
                      <h3 className="text-lg font-semibold mb-4">Current Tenant Information</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Since this property is already rented out, please provide the current tenant details.
                      </p>
                    </div>

                    <div className="md:col-span-1">
                      <FormField
                        control={form.control}
                        name="tenantFirstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Tenant First Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <FormField
                        control={form.control}
                        name="tenantLastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl>
                              <Input placeholder="Tenant Last Name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="tenantEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tenant Email</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter tenant email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />



                    <FormField
                      control={form.control}
                      name="mobileNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile Number <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                placeholder="Enter mobile number"
                                {...field}
                                onChange={(e) => handlePhoneChange(e, field)}
                              />
                              {searchingUser && (
                                <div className="absolute right-3 top-2.5">
                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />

                          {/* User Found Card */}
                          {userInfo && (
                            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-3">
                              <div className="mt-0.5">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              </div>
                              <div className="text-sm">
                                <p className="font-medium text-green-800">User Found: {userInfo.name}</p>
                                <p className="text-green-700">{userInfo.email}</p>
                                <p className="text-green-600 text-xs mt-1">Details auto-filled</p>
                              </div>
                            </div>
                          )}

                          {/* User Not Found Message */}
                          {searchError && !searchingUser && field.value && field.value.length >= 10 && (
                            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
                              <div className="mt-0.5">
                                <XCircle className="h-5 w-5 text-red-600" />
                              </div>
                              <div className="text-sm">
                                <p className="font-medium text-red-800">User Not Found</p>
                                <p className="text-red-700">{searchError}</p>
                              </div>
                            </div>
                          )}
                        </FormItem>
                      )}
                    />

                    <FormField control={form.control} name="tenantEmergencyContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Emergency Contact</FormLabel>
                          <FormControl>
                            <Input placeholder="Name and Phone" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />



                    {/* Employment Details Section */}
                    <div className="lg:col-span-3 mt-6 pt-4 border-t">
                      <h4 className="text-md font-medium mb-4 text-gray-700 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Employment Details
                      </h4>
                    </div>

                    <FormField
                      control={form.control}
                      name="tenantEmploymentStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employment Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="employed">Employed</SelectItem>
                              <SelectItem value="self-employed">Self-Employed</SelectItem>
                              <SelectItem value="unemployed">Unemployed</SelectItem>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="retired">Retired</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField control={form.control} name="tenantEmployer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employer/Company</FormLabel>
                          <FormControl>
                            <Input placeholder="Company name" {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />


                    {/* Spouse Information Section */}
                    <div className="lg:col-span-3 mt-6 pt-4 border-t">
                      <FormField
                        control={form.control}
                        name="tenantIsMarried"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value ?? false}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Is the tenant married?</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Spouse Details - Only show when isMarried is true */}
                    {form.watch("tenantIsMarried") && (
                      <>
                        <div className="lg:col-span-3 p-4 bg-slate-50 rounded-lg border">
                          <h4 className="text-md font-medium mb-4 text-gray-700 flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Spouse Information
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="tenantSpouse.firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Spouse First Name <span className="text-red-500">*</span></FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter spouse first name" {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField control={form.control} name="tenantSpouse.lastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Spouse Last Name <span className="text-red-500">*</span></FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter spouse last name" {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField control={form.control} name="tenantSpouse.email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Spouse Email</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="spouse@example.com" {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField control={form.control} name="tenantSpouse.phone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Spouse Phone <span className="text-red-500">*</span></FormLabel>
                                  <FormControl>
                                    <Input placeholder="+9193 XXXXXX" {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="tenantSpouse.employmentStatus"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Spouse Employment Status</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value || ""}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="employed">Employed</SelectItem>
                                      <SelectItem value="self-employed">Self-Employed</SelectItem>
                                      <SelectItem value="unemployed">Unemployed</SelectItem>
                                      <SelectItem value="student">Student</SelectItem>
                                      <SelectItem value="retired">Retired</SelectItem>
                                      <SelectItem value="homemaker">Homemaker</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField control={form.control} name="tenantSpouse.employer"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Spouse Employer/Company</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Company name" {...field} value={field.value || ""} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <div className="md:col-span-2">
                              <FormField control={form.control} name="tenantSpouse.notes"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Spouse Additional Notes</FormLabel>
                                    <FormControl>
                                      <Textarea placeholder="Any additional notes about the spouse" rows={3} {...field} value={field.value || ""} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Agreement Details Section */}
                    <div className="lg:col-span-3 mt-6 pt-4 border-t">
                      <h4 className="text-md font-medium mb-4 text-gray-700">Agreement Details</h4>
                    </div>

                    <FormField
                      control={form.control}
                      name="paymentDueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Due Date (Day of Month) <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              placeholder="e.g., 5 (for 5th of each month)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agreementPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agreement Period (in months) <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 11" type="number" min="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agreementStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agreement Start Date <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <DatePicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="agreementEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agreement End Date <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <DatePicker value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}



                {/* Pricing Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border rounded-lg">
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">
                      Pricing Information
                      {form.watch("listingType") && (
                        <span className="ml-2 text-sm font-normal text-gray-600">
                          ({form.watch("listingType") === "rent" ? "Rental Details" : "Sale Details"})
                        </span>
                      )}
                    </h3>
                  </div>

                  {form.watch("listingType") === "rent" && (
                    <>
                      <FormField
                        control={form.control}
                        name="monthlyRent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Monthly Rent (₹) *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter monthly rent amount (e.g., 25000)"
                                type="number"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Dynamic Monthly Rent Schedule */}
                      {form.watch("rentalStatus") === "rented" && (
                        <div className="mt-6 space-y-4 pt-4 border-t col-span-1 lg:col-span-2">
                          <div className="flex items-center justify-between">
                            <FormLabel className="text-base font-semibold">Monthly Rent Schedule</FormLabel>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => appendRentSchedule({ year: `${rentScheduleFields.length + 1}${getOrdinalSuffix(rentScheduleFields.length + 1)} Year`, months: "11", amount: "", fromDate: "", toDate: "" })}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Year
                            </Button>
                          </div>

                          <div className="space-y-4">
                            {rentScheduleFields.map((field, index) => (
                              <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-lg bg-gray-50/50 items-end relative">
                                <div className="md:col-span-2">
                                  <FormLabel className="text-xs">Year</FormLabel>
                                  <Input
                                    {...form.register(`rentSchedule.${index}.year`)}
                                    className="bg-white"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <FormLabel className="text-xs">Months</FormLabel>
                                  <Input
                                    type="number"
                                    placeholder="11"
                                    {...form.register(`rentSchedule.${index}.months`)}
                                    onChange={(e) => {
                                      form.setValue(`rentSchedule.${index}.months`, e.target.value);
                                      const fromDateStr = form.getValues(`rentSchedule.${index}.fromDate`);
                                      if (fromDateStr && e.target.value) {
                                        try {
                                          const startDate = parseISO(fromDateStr);
                                          const months = parseInt(e.target.value, 10);
                                          if (!isNaN(months) && months > 0) {
                                            const endDate = subDays(addMonths(startDate, months), 1);
                                            form.setValue(`rentSchedule.${index}.toDate`, format(endDate, 'yyyy-MM-dd'));
                                          }
                                        } catch (err) { /* Preserve existing best-effort behavior. */ }
                                      }
                                    }}
                                    className="bg-white"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <FormLabel className="text-xs">Amount (₹)</FormLabel>
                                  <Input
                                    {...form.register(`rentSchedule.${index}.amount`)}
                                    placeholder="Amount"
                                    className="bg-white"
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <FormField
                                    control={form.control}
                                    name={`rentSchedule.${index}.fromDate`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">From</FormLabel>
                                        <FormControl>
                                          <DatePicker
                                            value={field.value}
                                            onChange={(val) => {
                                              field.onChange(val);
                                              const monthsStr = form.getValues(`rentSchedule.${index}.months`);
                                              if (val && monthsStr) {
                                                try {
                                                  const startDate = parseISO(val);
                                                  const months = parseInt(monthsStr, 10);
                                                  if (!isNaN(months) && months > 0) {
                                                    const endDate = subDays(addMonths(startDate, months), 1);
                                                    form.setValue(`rentSchedule.${index}.toDate`, format(endDate, 'yyyy-MM-dd'));
                                                  }
                                                } catch (err) { /* Preserve existing best-effort behavior. */ }
                                              }
                                            }}
                                            className="bg-white"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <FormField
                                    control={form.control}
                                    name={`rentSchedule.${index}.toDate`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs">To</FormLabel>
                                        <FormControl>
                                          <DatePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                            className="bg-white"
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                {rentScheduleFields.length > 1 && (
                                  <div className="md:col-span-1 flex justify-center pb-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeRentSchedule(index)}
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}

                            {rentScheduleFields.length === 0 && (
                              <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                                No rent schedule added. Click "Add Year" to define the rent structure.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {form.watch("listingType") === "sell" && (
                    <div className="space-y-6 lg:col-span-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="sellingPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Selling Price (₹) *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Enter selling price (e.g., 5000000)"
                                  type="number"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                      </div>
                    </div>
                  )}

                  {!form.watch("listingType") && (
                    <div className="lg:col-span-2 text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                      <p>Please select a listing type above to see pricing options</p>
                    </div>
                  )}
                </div>



                {/* Security & Agreement - Only for Rent */}
                {form.watch("listingType") === "rent" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border rounded-lg">
                    <div className="lg:col-span-2">
                      <h3 className="text-lg font-semibold mb-4">Security Deposit</h3>
                    </div>

                    <FormField
                      control={form.control}
                      name="securityDeposit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Security Deposit Amount (in ₹)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter security deposit amount" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}


                {/* Notice & Lock-in Period - Only for Rented properties */}
                {form.watch("listingType") === "rent" && form.watch("rentalStatus") === "rented" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border rounded-lg">
                    <div className="lg:col-span-2">
                      <h3 className="text-lg font-semibold mb-4">Notice and Lock-in Period</h3>
                    </div>

                    <FormField
                      control={form.control}
                      name="noticePeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notice Period / Early Termination Notice <span className="text-red-500">*</span></FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Notice Period" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1 Month">1 Month</SelectItem>
                              <SelectItem value="2 Months">2 Months</SelectItem>
                              <SelectItem value="3 Months">3 Months</SelectItem>
                              <SelectItem value="4 Months">4 Months</SelectItem>
                              <SelectItem value="5 Months">5 Months</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lockInPeriod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lock-in Period (in Months)</FormLabel>
                          <FormControl>
                            <Input placeholder="Specify lock-in period in months" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}


                {/* Unit Condition & Maintenance */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 border rounded-lg">
                  <div className="lg:col-span-3">
                    <h3 className="text-lg font-semibold mb-4">Unit Condition & Maintenance</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="unitCondition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Condition</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="semi-furnished">Semi Furnished</SelectItem>
                            <SelectItem value="furnished">Furnished</SelectItem>
                            <SelectItem value="unfurnished">Unfurnished</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Furnished Checklist Button - Aligned with Unit Condition */}
                  <FormField
                    control={form.control}
                    name="furnishedChecklist"
                    render={() => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Furnished Items Checklist</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowFurnishedModal(true)}
                          className="w-full"
                        >
                          <CheckSquare className="h-4 w-4 mr-2" />
                          Manage Furnished Items Checklist
                          {furnishedChecklist.filter(item => item.checked).length > 0 && (
                            <span className="ml-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                              {furnishedChecklist.filter(item => item.checked).length} items selected
                            </span>
                          )}
                        </Button>
                        <FormDescription className="text-xs text-muted-foreground">
                          Add items included with this property (available for all unit conditions)
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  {form.watch("listingType") !== "sell" && (
                    <FormField
                      control={form.control}
                      name="maintenanceToBePaidBy"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maintenance Payment By</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select who pays" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="tenant">Tenant</SelectItem>
                              <SelectItem value="shared">Shared</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("listingType") === "sell" && (
                    <FormField
                      control={form.control}
                      name="projectCondition"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Condition</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select project condition" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="New Project">New Project</SelectItem>
                              <SelectItem value="Ready Project">Ready Project</SelectItem>
                              <SelectItem value="Preleased">Preleased</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {((form.watch("listingType") === "rent" && form.watch("rentalStatus") === "available") || form.watch("listingType") === "sell") && (
                    <FormField
                      control={form.control}
                      name="possessionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Possession Date</FormLabel>
                          <FormControl>
                            <DatePicker placeholder="Select possession date" value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Images & Comments */}
                <div className="grid grid-cols-1 gap-6 p-4 border rounded-lg">
                  <h3 className="text-lg font-semibold">Additional Information</h3>

                  <FormField
                    control={form.control}
                    name="images"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Building Image (Exterior view only)</FormLabel>
                        <FormDescription className="text-xs text-muted-foreground">
                          Upload only the building exterior image. This image will be shown publicly.
                        </FormDescription>
                        <FormControl>
                          <div className="space-y-4">
                            {/* Upload Button */}
                            <div className="flex items-center gap-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadedImages.length >= 1 || isUploading}
                                className="flex items-center gap-2"
                              >
                                <Upload className="h-4 w-4" />
                                {isUploading ? 'Uploading...' : uploadedImages.length === 0 ? 'Upload Building Image' : 'Image Uploaded'}
                              </Button>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                              />
                            </div>

                            {/* Image Preview */}
                            {uploadedImages.length > 0 && (
                              <div className="max-w-xs">
                                <div className="relative group">
                                  <div className="aspect-video rounded-lg border-2 border-dashed border-gray-300 overflow-hidden">
                                    <img
                                      src={uploadedImages[0]}
                                      alt="Building exterior"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeImage(0)}
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Empty State */}
                            {uploadedImages.length === 0 && (
                              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center max-w-xs">
                                <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-500 mb-2">No image uploaded yet</p>
                                <p className="text-sm text-gray-400">
                                  Upload building exterior image only
                                </p>
                              </div>
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="internalImages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Images (Max 6)</FormLabel>
                        <FormDescription className="text-xs text-muted-foreground">
                          Upload internal photos of the property.
                        </FormDescription>
                        <FormControl>
                          <div className="space-y-4">
                            {/* Upload Button */}
                            <div className="flex items-center gap-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => internalFileInputRef.current?.click()}
                                disabled={uploadedInternalImages.length >= 6 || isInternalUploading}
                                className="flex items-center gap-2"
                              >
                                <Upload className="h-4 w-4" />
                                {isInternalUploading ? 'Uploading...' : `Upload Internal Images (${uploadedInternalImages.length}/6)`}
                              </Button>
                              <input
                                ref={internalFileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleInternalImageUpload}
                                className="hidden"
                              />
                            </div>

                            {/* Image Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {uploadedInternalImages.map((img, index) => (
                                <div key={index} className="relative group aspect-video rounded-lg border border-gray-200 overflow-hidden">
                                  <img src={img} alt={`Internal ${index + 1}`} className="w-full h-full object-cover" />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeInternalImage(index)}
                                    className={styles.imageRemoveButton} aria-label={`Remove interior photo ${index + 1}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specificComments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Comments</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any additional details or specific notes about the property..."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                {/* Form Actions */}
                <div className="flex justify-center gap-4 pt-6 pb-20">
                  <Button type="button" variant="outline" className="px-8"
                    onClick={() => navigate("/manage-property")}>
                    CANCEL
                  </Button>
                  <Button
                    type="submit"
                    className="px-8 bg-primary hover:bg-primary/90"
                    disabled={isUploading || isInternalUploading}
                  >
                    {isUploading || isInternalUploading ? 'UPLOADING...' : 'SUBMIT'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Furnished Checklist Modal */}
      <FurnishedChecklistModal
        isOpen={showFurnishedModal}
        onClose={() => setShowFurnishedModal(false)}
        onSave={(checklist) => {
          setFurnishedChecklist(checklist);
          form.setValue('furnishedChecklist', checklist);
        }}
        initialChecklist={furnishedChecklist}
        propertyType={selectedPropertyType as 'residential' | 'commercial' | 'industrial'}
      />
    </main>
  );
};

export default AddPropertyForm;
