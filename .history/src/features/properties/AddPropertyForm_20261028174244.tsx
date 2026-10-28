"use client";
import { readPropertyResponse, PropertySubmissionError } from "./property-response";
import {PROPERTY_CONFIGURATIONS,structureUsesPlotArea,type PropertyCategory} from '@/lib/property-category';

import {indianMobile} from '@/lib/indian-phone';
import styles from "./PropertyForm.module.css";

import ClientPropertyFields, {clientPropertySchema} from './ClientPropertyFields';
import { apiFetch } from '@/lib/api-client';
import SessionMediaImage from '@/components/SessionMediaImage';
import AmountInWords from '@/components/AmountInWords';
import NextAgreementFields from '@/components/NextAgreementFields';
import {emptyNextAgreementDraft,validateNextAgreementDraft} from '@/lib/next-agreement-draft';

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/ui/form";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import { Textarea } from "@/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { ArrowLeft, Building2, Upload, X, Image as ImageIcon, CheckSquare } from "lucide-react";
import { useNavigate, useSearchParams } from "@/lib/navigation";
import { auth } from "../../firebase";
import { User as FirebaseUser } from "firebase/auth";
import { useState, useRef, useEffect } from "react";
import { API_BASE_URL } from "../../utils/config";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { FurnishedChecklistModal } from "./FurnishedChecklistModal";
import { uploadBase64Image } from "../../services/uploadService";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {calculateAgreementEndDate} from '@/lib/rent-schedule';

const formSchema = z.object({
  ...clientPropertySchema,
  // Property Basic Details
  propertyTitle: z.string().min(1, "Property title is required"),
  propertyType: z.string().min(1, "Property type is required"),
  configuration: z.string().optional(),
  listingType: z.string().min(1, "Listing type is required"),
  agentOwnerEmail: z.string().email("Enter the registered legal owner's email").optional().or(z.literal("")),

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

  // Pricing Details (conditional based on listing type)
  monthlyRent: z.string().optional(), // For rent
  securityDeposit: z.string().optional(),
  sellingPrice: z.string().optional(), // For sell

  // Payment Details
  paymentDueDate: z.string().optional(),
  agreementPeriod: z.string().optional(),
  agreementStartDate: z.string().optional(),
  agreementEndDate: z.string().optional(),
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

});

type FormData = z.infer<typeof formSchema>;

interface UserInfo {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  phoneNumber: string;
}

const AddPropertyForm = ({category}:{category:PropertyCategory}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPropertyType = category;
  const selectedRole = searchParams.get('as') || searchParams.get('role') || 'owner';
  const adminOwnerUID = searchParams.get('adminOwnerUID') || '';
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
  const [accountRole,setAccountRole]=useState('individual');
  const [addNextAgreementManually,setAddNextAgreementManually]=useState(false),[nextAgreementDraft,setNextAgreementDraft]=useState(emptyNextAgreementDraft);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [searchError, setSearchError] = useState<string | undefined>(undefined);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // A reported contact is not an account lookup or a tenancy authorization.
  const searchUserByPhone = async (phoneNumber: string) => {
    setUserInfo(null);
    setSearchingUser(false);
    setSearchError(phoneNumber && !indianMobile(phoneNumber) ? 'Enter a valid Indian mobile number.' : undefined);
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
      agentOwnerEmail: "",
      unitNumber: "",
      floor: "",
      location: "",
      carpetArea: "",
      plotArea: "",
      constructedArea: "",
      areaUnit: "sq ft",
      carpetAreaUnit: "sq ft",
      constructedAreaUnit: "sq ft",
      plotAreaUnit: "sq ft",
      // Tenant Information
      // Tenant Information
      tenantFirstName: "",
      tenantLastName: "",
      tenantEmail: "",
      mobileNumber: "",
      // Pricing
      monthlyRent: "",
      expectedRent: "",
      securityDeposit: "",
      sellingPrice: "",
      paymentDueDate: "",
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
    },
  });

  const agreementStartDate = form.watch('agreementStartDate');
  const agreementPeriod = form.watch('agreementPeriod');
  const selectedStructure = form.watch('structure');
  const listingType = form.watch('listingType');

  useEffect(() => {
    const user=auth.currentUser;setCurrentUser(user);
    if(user)void apiFetch(`${API_BASE_URL}/users/${user.uid}`).then(response=>response.json()).then(data=>setAccountRole(data.user?.role||'individual')).catch(()=>setAccountRole('individual'));
  },[]);

  useEffect(() => {
    const agreementEndDate=calculateAgreementEndDate(agreementStartDate||'',agreementPeriod||'');
    form.setValue('agreementEndDate',agreementEndDate);
  }, [agreementStartDate, agreementPeriod, form]);

  const onSubmit = async (data: FormData) => {
    try {
      if(!data.structure?.trim()){
        form.setError('structure',{type:'manual',message:'Select the property type.'});
        toast({title:'Missing property type',description:'Select the physical property type before continuing.',variant:'destructive'});
        return;
      }
      if(selectedPropertyType==='residential'&&!structureUsesPlotArea(data.structure)&&!data.configuration?.trim()){
        form.setError('configuration',{type:'manual',message:'Select the residential layout.'});
        toast({title:'Missing residential layout',description:'Select Studio or the applicable BHK layout.',variant:'destructive'});
        return;
      }
      if(addNextAgreementManually){const draftError=validateNextAgreementDraft(nextAgreementDraft,data.agreementEndDate||'');if(draftError){toast({title:'Check next agreement details',description:draftError,variant:'destructive'});return;}}
      // Validate pricing based on listing type
      const includesRent=['rent','sell_rent'].includes(data.listingType),includesSale=['sell','sell_rent'].includes(data.listingType);
      const occupiedRental=includesRent && data.rentalStatus === "rented";
      const rentValue=occupiedRental?data.monthlyRent:data.expectedRent;
      if (includesRent && (!rentValue || rentValue.trim() === "" || !Number.isFinite(Number(rentValue)) || Number(rentValue)<=0)) {
        const field=occupiedRental?'monthlyRent':'expectedRent';
        form.setError(field,{type:'manual',message:occupiedRental?'Enter the finalized monthly rent.':'Enter the asking monthly rent.'});
        toast({
          title: occupiedRental?"Missing Finalized Rent":"Missing Asking Rent",
          description: occupiedRental?"Enter the finalized rent for the current tenancy.":"Enter the asking rent for this available property.",
          variant: "destructive",
        });
        return;
      }
      if (includesRent && (!data.securityDeposit || data.securityDeposit.trim() === "" || !Number.isFinite(Number(data.securityDeposit)) || Number(data.securityDeposit)<0)) {
        form.setError('securityDeposit',{type:'manual',message:occupiedRental?'Enter the finalized security deposit.':'Enter the expected security deposit.'});
        toast({title:'Missing Security Deposit',description:occupiedRental?'Enter the deposit agreed for the current tenancy.':'Enter the expected deposit for this rental listing.',variant:'destructive'});
        return;
      }

      if (includesSale && (!data.sellingPrice || data.sellingPrice.trim() === "" || !Number.isFinite(Number(data.sellingPrice)) || Number(data.sellingPrice)<=0)) {
        form.setError('sellingPrice',{type:'manual',message:'Enter a valid expected selling price.'});
        toast({
          title: "Missing Selling Price",
          description: "Please enter the selling price for sale properties.",
          variant: "destructive",
        });
        return;
      }

      // Validate buyer details for sold properties
      if (includesSale && data.saleStatus === "sold") {
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
      if (includesRent && data.rentalStatus === "rented") {
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
        if (!data.tenantEmail || !/^\S+@\S+\.\S+$/.test(data.tenantEmail)) {
          form.setError('tenantEmail',{type:'manual',message:'Enter the tenant email used for the invitation.'});
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
        nextAgreementDraft:addNextAgreementManually?nextAgreementDraft:undefined,
        monthlyRent: data.rentalStatus==='rented'?data.monthlyRent:'',
        expectedRent: includesRent&&data.rentalStatus!=='rented'?data.expectedRent:'',
        sellingPrice: includesSale?data.sellingPrice:'',
        configuration: selectedPropertyType==='residential'&&!structureUsesPlotArea(data.structure)?data.configuration:'',
        // The measurement controls below are authoritative. Keep the legacy
        // aggregate unit aligned for older property readers.
        areaUnit: data.carpetAreaUnit || data.areaUnit || "sq ft",
        propertyType: selectedPropertyType,
        propertyCategory: selectedPropertyType,
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
        ownerUID: adminOwnerUID || currentUser.uid,
        ...(accountRole==='agent'?{agentOwnerEmail:data.agentOwnerEmail}:{}),
      };


      // Send to backend API
      const response = await apiFetch(`${API_BASE_URL}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(propertyData)
      });

      const result = await readPropertyResponse(response);

      if (result.success) {
        const listingTypeText = data.listingType === "rent" ? "rental property" : data.listingType==='sell_rent'?'sale and rental property':"property for sale";

        // Invalidate property queries so they refetch the newly added property
        queryClient.invalidateQueries({ queryKey: ['userProperties'] });
        queryClient.invalidateQueries({ queryKey: ['allProperties'] });
        queryClient.invalidateQueries({ queryKey: ['productHub'] });
        queryClient.invalidateQueries({ queryKey: ['relationshipLinks'] });

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
      if(error instanceof PropertySubmissionError&&error.fieldErrors.tenantEmail)form.setError('tenantEmail',{type:'server',message:error.fieldErrors.tenantEmail});
      toast({
        title: "Error",
        description: error instanceof Error?error.message:"Failed to connect to server. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getConfigurationOptions = () => {
    return PROPERTY_CONFIGURATIONS.map(value=>({value,label:value}));
  };

  const getUnitLabel = () => {
    switch (selectedPropertyType) {
      case "residential":
        return structureUsesPlotArea(selectedStructure) ? "Plot number" : "Flat / House number";
      case "commercial":
        return structureUsesPlotArea(selectedStructure) ? "Plot number" : "Office / Shop / Showroom number";
      case "industrial":
        return structureUsesPlotArea(selectedStructure) ? "Plot number" : "Warehouse / Factory / Shed number";
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
          <Button variant="ghost" onClick={() => navigate(`/select-property-type?as=${selectedRole}${adminOwnerUID?`&adminOwnerUID=${encodeURIComponent(adminOwnerUID)}`:''}`)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Property Type Selection
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <div className={styles.introIcon}>
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className={styles.title}>List your  property{selectedPropertyType && (
                  <p className="ml-2 px-2 py-1 text-sm bg-primary/10 text-primary rounded-md inline-block">
                    {selectedPropertyType.charAt(0).toUpperCase() + selectedPropertyType.slice(1)}
                 <>
                )}</h1>
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
              Complete the property details below. Sale and rental listings are reviewed before appearing in public search; private-management properties remain private.
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
                <ClientPropertyFields form={form} fixedCategory={selectedPropertyType} creation/>

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
                        <FormLabel>Property title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Lakeview 2 BHK" autoComplete="off" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {accountRole==='agent'&&<FormField control={form.control} name="agentOwnerEmail" render={({field})=><FormItem><FormLabel>Registered legal owner email</FormLabel><FormControl><Input type="email" placeholder="owner@example.com" {...field}/></FormControl><FormDescription>The owner remains legally separate and must have an active, verified PropBank account.</FormDescription><FormMessage/></FormItem>}/>}

                  {selectedPropertyType === 'residential' && !structureUsesPlotArea(selectedStructure) && <FormField
                    control={form.control}
                    name="configuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Residential layout</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Studio or BHK" />
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
                  />}

                  <FormField
                    control={form.control}
                    name="listingType"
                    render={({ field }) => (
                      <FormItem>
                          <FormLabel>Property purpose</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select listing type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="rent">For Rent</SelectItem>
                            <SelectItem value="sell">For Sale</SelectItem>
                            <SelectItem value="sell_rent">For Sale and Rent</SelectItem>
                            <SelectItem value="manage">Private Management</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Rental Status - Only show for rental properties */}
                  {['rent','sell_rent'].includes(listingType||'') && (
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
                  {['sell','sell_rent'].includes(listingType||'') && (
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

                {/* Keep asking prices beside the listing purpose so they remain
                    distinct from finalized agreement terms collected below. */}
                {['rent','sell','sell_rent'].includes(listingType||'') && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 border rounded-lg">
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold">Pricing</h3>
                    <p className="text-sm text-muted-foreground">{['rent','sell_rent'].includes(listingType||'')&&form.watch('rentalStatus')==='rented'?'Record the finalized rental amounts and the separate sale asking price.':'Enter the asking price shown with this listing.'}</p>
                  </div>
                  {['rent','sell_rent'].includes(listingType||'')&&<>
                    <FormField control={form.control} name={form.watch('rentalStatus')==='rented'?"monthlyRent":"expectedRent"} render={({field})=><FormItem><FormLabel>{form.watch('rentalStatus')==='rented'?'Finalized Monthly Rent':'Expected Monthly Rent'} (₹) *</FormLabel><FormControl><Input placeholder="e.g., 25000" type="number" min="0" step="0.01" {...field}/></FormControl><AmountInWords amount={field.value}/><FormMessage/></FormItem>}/>
                    <FormField control={form.control} name="securityDeposit" render={({field})=><FormItem><FormLabel>{form.watch('rentalStatus')==='rented'?'Finalized Security Deposit':'Expected Security Deposit'} (₹) *</FormLabel><FormControl><Input placeholder="e.g., 75000" type="number" min="0" step="0.01" {...field}/></FormControl><AmountInWords amount={field.value}/><FormMessage/></FormItem>}/>
                  </>}
                  {['sell','sell_rent'].includes(listingType||'')&&<FormField
                    control={form.control}
                    name="sellingPrice"
                    render={({field})=><FormItem><FormLabel>Expected Selling Price (₹) *</FormLabel><FormControl><Input placeholder="e.g., 5000000" type="number" min="0" step="0.01" {...field}/></FormControl><AmountInWords amount={field.value}/><FormMessage/></FormItem>}
                  />}
                </div>}

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

                  {!structureUsesPlotArea(selectedStructure) && <FormField
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
                  />}

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
                    <h3 className="text-lg font-semibold">Area measurements</h3>
                  </div>
                  {!structureUsesPlotArea(selectedStructure) && <FormField
                    control={form.control}
                    name="carpetArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carpet area</FormLabel>
                        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                          <FormControl><Input type="number" min="0" placeholder="Enter carpet area" {...field} /></FormControl>
                          <select aria-label="Carpet area unit" className="h-10 rounded-md border bg-background px-3" {...form.register('carpetAreaUnit')}>
                            {['sq ft','sq m','sq yd'].map(unit=><option key={unit} value={unit}>{unit}</option>)}
                          </select>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}
                  {!structureUsesPlotArea(selectedStructure) && <FormField
                    control={form.control}
                    name="constructedArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Built-up / Constructed area</FormLabel>
                        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                          <FormControl><Input type="number" min="0" placeholder="Enter built-up area" {...field} /></FormControl>
                          <select aria-label="Built-up / Constructed area unit" className="h-10 rounded-md border bg-background px-3" {...form.register('constructedAreaUnit')}>
                            {['sq ft','sq m','sq yd'].map(unit=><option key={unit} value={unit}>{unit}</option>)}
                          </select>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}
                  {structureUsesPlotArea(selectedStructure) && (
                    <FormField
                      control={form.control}
                      name="plotArea"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plot area</FormLabel>
                          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                            <FormControl><Input type="number" min="0" placeholder="Enter plot area" {...field} /></FormControl>
                            <select aria-label="Plot area unit" className="h-10 rounded-md border bg-background px-3" {...form.register('plotAreaUnit')}>
                              {['sq ft','sq m','sq yd','acre','hectare'].map(unit=><option key={unit} value={unit}>{unit}</option>)}
                            </select>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Buyer Information - Only show when property is already sold */}
                {['sell','sell_rent'].includes(listingType||'') && form.watch("saleStatus") === "sold" && (
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
                {['rent','sell_rent'].includes(listingType||'') && form.watch("rentalStatus") === "rented" && (
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

                    {/* Agreement Details Section */}
                    <div className="lg:col-span-3 mt-6 pt-4 border-t">
                      <h4 className="text-md font-medium mb-2 text-gray-700">Initial lease details</h4>
                      <p className="text-sm text-muted-foreground">Complete deposits, notices, rent schedules and tenant profile details later in Add Tenant.</p>
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
                    <FormField control={form.control} name="noticePeriod" render={({field})=><FormItem><FormLabel>Notice / Early Termination Period (months)</FormLabel><FormControl><Input type="number" min="0" max="120" {...field}/></FormControl><FormMessage/></FormItem>}/>
                    <FormField control={form.control} name="lockInPeriod" render={({field})=><FormItem><FormLabel>Lock-in Period (months)</FormLabel><FormControl><Input type="number" min="0" max="120" {...field}/></FormControl><FormMessage/></FormItem>}/>
                    <NextAgreementFields idPrefix="owner-next-agreement" enabled={addNextAgreementManually} currentAgreementEndDate={form.watch('agreementEndDate')||''} value={nextAgreementDraft} onEnabledChange={setAddNextAgreementManually} onChange={setNextAgreementDraft}/>
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

                  {listingType !== "sell" && (
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

                  {['sell','sell_rent'].includes(listingType||'') && (
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

                  {((['rent','sell_rent'].includes(listingType||'') && form.watch("rentalStatus") === "available") || ['sell','sell_rent'].includes(listingType||'')) && (
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
                          {listingType==='manage'?'Optional reference image for private property management.':'Upload the building exterior used for the reviewed public listing.'}
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
                                    <SessionMediaImage
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
                                  <SessionMediaImage src={img} alt={`Internal ${index + 1}`} className="w-full h-full object-cover" />
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
                    disabled={form.formState.isSubmitting || isUploading || isInternalUploading}
                  >
                    {form.formState.isSubmitting ? 'SAVING...' : isUploading || isInternalUploading ? 'UPLOADING...' : 'SUBMIT'}
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
