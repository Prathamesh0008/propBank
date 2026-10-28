"use client";

import styles from "./PropertyForm.module.css";

import ClientPropertyFields, {clientPropertySchema} from './ClientPropertyFields';
import { apiFetch } from '@/lib/api-client';
import AmountInWords from '@/components/AmountInWords';

import { useParams, useNavigate, useLocation } from "@/lib/navigation";
import { ArrowLeft, Building2, CheckCircle2, CheckSquare, Loader2, XCircle } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/ui/form";
import { Input } from "@/ui/input";
import { DatePicker } from "@/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Textarea } from "@/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState, useRef } from "react";
import { auth } from "../../firebase";
import { toast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { API_BASE_URL } from "../../utils/config";
import { FurnishedChecklistModal } from "./FurnishedChecklistModal";
import { uploadBase64Image } from "../../services/uploadService";
import { usePropertyDetails } from "../../hooks/useProperties";
import { useQueryClient } from "@tanstack/react-query";
import {PROPERTY_CONFIGURATIONS,propertyCategory,structureUsesPlotArea} from '@/lib/property-category';



const formSchema = z.object({
  ...clientPropertySchema,
  propertyTitle: z.string().min(1, "Property title is required"),
  propertyType: z.string().min(1, "Property type is required"),
  // Legacy commercial and industrial records may not have a residential BHK
  // layout. Preserve those records without forcing an unrelated value.
  configuration: z.string().optional(),
  listingType: z.string().min(1, "Listing type is required"),
  unitNumber: z.string().optional(),
  floor: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  carpetArea: z.string().optional(),
  plotArea: z.string().optional(),
  constructedArea: z.string().optional(),



  // Pricing Details
  monthlyRent: z.string().optional(),
  sellingPrice: z.string().optional(),
  paymentDueDate: z.string().optional(),
  escalationPercentage:z.string().optional(),
  escalationAmount:z.string().optional(),
  monthlyRent1stYear: z.string().optional(),
  monthlyRent2ndYear: z.string().optional(),
  monthlyRent3rdYear: z.string().optional(),
  monthlyRent4thYear: z.string().optional(),
  rentFromDate1: z.string().optional(),
  rentToDate1: z.string().optional(),
  rentFromDate2: z.string().optional(),
  rentToDate2: z.string().optional(),
  securityDeposit: z.string().optional(),
  agreementPeriod: z.string().optional(),
  agreementStartDate: z.string().optional(),
  agreementEndDate: z.string().optional(),
  noticePeriod: z.string().optional(),
  lockInPeriod: z.string().optional(),
  unitCondition: z.string().optional(),
  maintenanceToBePaidBy: z.string().optional(),
  rentalStatus: z.string().optional(),
  saleStatus: z.string().optional(),
  buyerFirstName: z.string().optional(),
  buyerLastName: z.string().optional(),
  buyerPhone: z.string().optional(),
  images: z.array(z.string()).optional(),
  specificComments: z.string().optional(),
  furnishedChecklist: z.array(z.object({
    id: z.string(),
    name: z.string(),
    checked: z.boolean(),
    quantity: z.number().min(1).default(1),
    category: z.enum(['basic', 'kitchen', 'bedroom', 'living', 'appliances', 'other', 'semifurnished', 'storage', 'office', 'infrastructure', 'safety', 'machinery', 'utilities'])
  })).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Property {
  userRole?:string;
  id: string;
  title: string;
  propertyType: string;
  configuration: string;
  listingType: string;
  unitNumber: string;
  floor: string;
  location: string;
  carpetArea: string;
  plotArea: string;
  constructedArea: string;

  // Tenant Information
  tenantName: string;
  personName: string;
  mobileNumber: string;
  primaryNo: string;
  ultNo: string;

  // Pricing Details
  monthlyRent: string;
  sellingPrice: string;
  monthlyRent1stYear: string;
  monthlyRent2ndYear: string;
  monthlyRent3rdYear: string;
  monthlyRent4thYear: string;
  rentFromDate1: string;
  rentToDate1: string;
  rentFromDate2: string;
  rentToDate2: string;
  securityDeposit: string;
  agreementPeriod: string;
  agreementStartDate: string;
  agreementEndDate: string;
  noticePeriod: string;
  lockInPeriod: string;
  unitCondition: string;
  maintenanceToBePaidBy: string;
  rentalStatus: string;
  images: string[];
  specificComments: string;
  furnishedChecklist: {
    id: string;
    name: string;
    checked: boolean;
    category: 'basic' | 'kitchen' | 'bedroom' | 'living' | 'appliances' | 'other' | 'semifurnished' | 'storage' | 'office' | 'infrastructure' | 'safety' | 'machinery' | 'utilities';
  }[];
  ownerUID: string;

  // Tenants array
  tenants?: any[];
  buyers?: any[];

  // Status and timestamps
  isActive: boolean;
  isRented: boolean;
  isSold: boolean;
  createdAt: string;
  updatedAt: string;
}

const EditProperty = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isRenewalMode = new URLSearchParams(location.search).get('mode') === 'renewal';
  const [property, setProperty] = useState<Property | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFurnishedModal, setShowFurnishedModal] = useState(false);
  const [furnishedChecklist, setFurnishedChecklist] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);



  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      propertyTitle: "",
      propertyType: "",
      configuration: "",
      listingType: "",
      unitNumber: "",
      floor: "",
      location: "",
      carpetArea: "",
      plotArea: "",
      constructedArea: "",




      // Pricing Details
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
      securityDeposit: "",
      agreementPeriod: "",
      agreementStartDate: "",
      agreementEndDate: "",
      noticePeriod: "",
      lockInPeriod: "",
      unitCondition: "",
      maintenanceToBePaidBy: "",
      rentalStatus: "",
      saleStatus: "available",
      buyerFirstName: "",
      buyerLastName: "",
      buyerPhone: "",
      images: [],
      specificComments: "",
      furnishedChecklist: [],
    },
  });

  const { data: propertyData, isLoading: loading } = usePropertyDetails(propertyId);

  useEffect(() => {
    if (propertyData) {
      setProperty(propertyData);
      setUploadedImages(propertyData.images || []);

      // Populate form with existing data
      let activeTenant = null;
      if (propertyData.tenants && propertyData.tenants.length > 0) {
        // Assuming the last tenant in the list is the active one
        activeTenant = [...propertyData.tenants].reverse().find(tenant=>tenant.isActive===true)||null;
      }

      const formData = {
        propertyTitle: propertyData.title || "",
        propertyType: propertyData.propertyType || "",
        ...Object.fromEntries(Object.keys(clientPropertySchema).map(key=>[key,propertyData[key]|| (key==="propertyCategory"?propertyData.propertyType:"")])),
        configuration: propertyData.configuration || "",
        listingType: propertyData.listingType || "",
        unitNumber: propertyData.unitNumber || "",
        floor: propertyData.floor || "",
        location: propertyData.location || propertyData.address || "",
        carpetArea: propertyData.carpetArea || "",
        plotArea: propertyData.plotArea || "",
        constructedArea: propertyData.constructedArea || "",



        // Pricing Details - Prefer active tenant data for lease details
        monthlyRent: activeTenant?.monthlyRent || propertyData.monthlyRent || "",
        escalationPercentage:propertyData.escalationPercentage||"",
        escalationAmount:propertyData.escalationAmount||"",
        sellingPrice: propertyData.sellingPrice || "",
        paymentDueDate: activeTenant?.paymentDueDate || propertyData.paymentDueDate || "",
        monthlyRent1stYear: propertyData.monthlyRent1stYear || "",
        monthlyRent2ndYear: propertyData.monthlyRent2ndYear || "",
        monthlyRent3rdYear: propertyData.monthlyRent3rdYear || "",
        monthlyRent4thYear: propertyData.monthlyRent4thYear || "",
        rentFromDate1: propertyData.rentFromDate1 || "",
        rentToDate1: propertyData.rentToDate1 || "",
        rentFromDate2: propertyData.rentFromDate2 || "",
        rentToDate2: propertyData.rentToDate2 || "",
        securityDeposit: activeTenant?.securityDeposit || propertyData.securityDeposit || "",
        agreementPeriod: propertyData.agreementPeriod || "",
        agreementStartDate: activeTenant?.leaseStartDate || propertyData.agreementStartDate || "",
        agreementEndDate: activeTenant?.leaseEndDate || propertyData.agreementEndDate || "",
        noticePeriod: activeTenant?.noticePeriod || propertyData.noticePeriod || "",
        lockInPeriod: propertyData.lockInPeriod || "",
        unitCondition: propertyData.unitCondition || "",
        maintenanceToBePaidBy: propertyData.maintenanceToBePaidBy || "",
        rentalStatus: propertyData.rentalStatus || "",
        saleStatus: propertyData.isSold ? "sold" : "available",
        buyerFirstName: propertyData.buyers && propertyData.buyers.length > 0 ? propertyData.buyers[propertyData.buyers.length - 1].firstName || "" : "",
        buyerLastName: propertyData.buyers && propertyData.buyers.length > 0 ? propertyData.buyers[propertyData.buyers.length - 1].lastName || "" : "",
        buyerPhone: propertyData.buyers && propertyData.buyers.length > 0 ? propertyData.buyers[propertyData.buyers.length - 1].phone || "" : "",
        images: propertyData.images || [],
        specificComments: propertyData.specificComments || "",
        furnishedChecklist: propertyData.furnishedChecklist || [],
      };

      setFurnishedChecklist(propertyData.furnishedChecklist || []);

      form.reset(formData);
    }
  }, [propertyData, form]);




  // Image handling functions
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const totalImages = uploadedImages.length + files.length;
    if (totalImages > 6) {
      toast({
        title: "Too many images",
        description: "You can upload maximum 6 images per property.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        try {
          // Convert file to base64
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
          });
          reader.readAsDataURL(file);
          const base64Image = await base64Promise;

          try {
            // Upload to Cloudflare R2
            const uploadedUrl = await uploadBase64Image(base64Image, 'properties', `edit-${propertyId}`);

            setUploadedImages(prev => {
              const newImages = [...prev, uploadedUrl];
              form.setValue('images', newImages);
              return newImages;
            });

            toast({
              title: "Image uploaded",
              description: "Image uploaded successfully to cloud storage.",
            });
          } catch (uploadError) {

            // Fallback to base64 if R2 upload fails
            setUploadedImages(prev => {
              const newImages = [...prev, base64Image];
              form.setValue('images', newImages);
              return newImages;
            });

            toast({
              title: "Image saved locally",
              description: "Cloud upload failed, image will be uploaded when saving.",
              variant: "destructive",
            });
          }
        } catch (error) {

          toast({
            title: "Upload failed",
            description: "Failed to read the image file.",
            variant: "destructive",
          });
        }
      }
    }

    setIsUploading(false);

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

  const getConfigurationOptions = () => {
    const current=form.watch('configuration');
    return [...(current&&!PROPERTY_CONFIGURATIONS.includes(current as typeof PROPERTY_CONFIGURATIONS[number])?[{value:current,label:current}]:[]),...PROPERTY_CONFIGURATIONS.map(value=>({value,label:value}))];
  };

  const editCategory=propertyCategory(form.watch('propertyCategory')||form.watch('propertyType'));
  const editPlotStructure=structureUsesPlotArea(form.watch('structure'));

  const getUnitLabel = () => {
    switch (form.watch("propertyType")) {
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

      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to update the property.",
          variant: "destructive",
        });
        return;
      }

      // Filter furnished checklist to only include checked items (saves DB space)
      const checkedFurnishedItems = furnishedChecklist.filter(item => item.checked);

      // Prepare update data - map propertyTitle to title for backend consistency
      const { propertyTitle, ...restData } = data;

      // Update the active tenant in the tenants array if it exists
      const updatedTenants = (property?.tenants || []).map(tenant=>tenant.isActive!==true?tenant:{...tenant,monthlyRent:data.monthlyRent,securityDeposit:data.securityDeposit,paymentDueDate:data.paymentDueDate,leaseStartDate:data.agreementStartDate,leaseEndDate:data.agreementEndDate,noticePeriod:data.noticePeriod,lockInPeriod:data.lockInPeriod,escalationPercentage:data.escalationPercentage,escalationAmount:data.escalationAmount});



      // Destructure out system/status fields that must NOT be overwritten on edit.
      // Sending isActive=false would cause the property to disappear from active listing queries.
      const {
        isActive: _isActive,
        isRented: _isRented,
        isSold: _isSold,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        tenants: _tenants,
        buyers: _buyers,
        ...safeRestData
      } = restData as any;

      let updatedBuyers = property?.buyers || [];

      if (data.listingType === "sell") {
        if (data.saleStatus === "sold") {
          if (updatedBuyers.length === 0) {
            const newBuyer = {
              id: Date.now().toString(),
              firstName: data.buyerFirstName || "",
              lastName: data.buyerLastName || "",
              phone: data.buyerPhone || "",
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            updatedBuyers = [newBuyer];
          } else {
            const lastIndex = updatedBuyers.length - 1;
            const activeBuyer = { ...updatedBuyers[lastIndex] };

            activeBuyer.firstName = data.buyerFirstName || activeBuyer.firstName;
            activeBuyer.lastName = data.buyerLastName || activeBuyer.lastName;
            activeBuyer.phone = data.buyerPhone || activeBuyer.phone;
            activeBuyer.updatedAt = new Date().toISOString();

            updatedBuyers[lastIndex] = activeBuyer;
          }
        }
      }

      const updateData = {
        ...Object.fromEntries(Object.entries(safeRestData).filter(([key])=>!["saleStatus","buyerFirstName","buyerLastName","buyerPhone"].includes(key))),
        title: propertyTitle,
        images: uploadedImages,
        furnishedChecklist: checkedFurnishedItems,
        ownerUID: property?.ownerUID || currentUser.uid,
        tenants: updatedTenants,
        isSold: data.listingType === "sell" && data.saleStatus === "sold",
        buyers: updatedBuyers,
      };

      const response = await apiFetch(`${API_BASE_URL}/properties/${propertyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Property Updated!",
          description: result.property?.moderationStatus==='pending_review'?'Changes saved and submitted for admin review.':`${data.propertyTitle} has been successfully updated.`,
        });

        // Refresh the property data to show updated values
        if (propertyId) {
          await queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
          await queryClient.invalidateQueries({ queryKey: ['userProperties'] });
          await queryClient.invalidateQueries({ queryKey: ['allProperties'] });
        }

        // Optional: navigate back or stay on the page
        // navigate("/manage-property");
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to update property. Please try again.",
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

  const isPropertyEditable = () => !!property && (property.ownerUID === auth.currentUser?.uid || property.userRole === 'admin');
  const getPropertyStatusMessage = () => 'Only the property owner or an administrator can edit these details.';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading property details...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <main className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Property Not Found</h1>
          <Button onClick={() => navigate("/manage-property")}>
            Back to Properties
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <>
        <title>{property.title.charAt(0).toUpperCase() + property.title.slice(1)}</title>
        <meta name="description" content={`Edit property details for ${property.title}`} />
      </>

      <div className={styles.shell}>
        {/* Header */}
        <div className={styles.pageIntro}>
          <Button variant="ghost" onClick={() => navigate("/manage-property")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Manage Properties
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <div className={styles.introIcon}>
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className={styles.title}>{isRenewalMode ? "Renew Agreement" : "Refine your listing"}</h1>
              <p className="text-lg text-muted-foreground">
                {property.title}
                <span className="ml-2 px-2 py-1 text-sm bg-primary/10 text-primary rounded-md capitalize">
                  {property.propertyType.charAt(0).toUpperCase() + property.propertyType.slice(1)}
                </span>
                {!isPropertyEditable() && (
                  <span className="ml-2 px-2 py-1 text-sm bg-orange-100 text-orange-800 rounded-md">
                    {property.isSold ? "🏷️ SOLD" : "🏠 RENTED"}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        <Card className={styles.formPanel}>
          <CardHeader>
            <CardTitle>Property Details</CardTitle>
            <CardDescription>
              {isPropertyEditable()
                ? "Update the form below to modify your property listing."
                : getPropertyStatusMessage()
              }
            </CardDescription>
            {property.updatedAt && (
              <div className="text-sm text-muted-foreground mt-2">
                <strong>Last Modified:</strong> {new Date(property.updatedAt).toLocaleString()}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
                const invalidFields = Object.keys(errors);
                const firstError = errors[invalidFields[0] as keyof typeof errors];
                const firstMessage = firstError && typeof firstError === "object" && "message" in firstError
                  ? String(firstError.message || "") : "";
                toast({ title: "Please review the highlighted fields", description: firstMessage || `${invalidFields.length} field(s) need attention.`, variant: "destructive" });
              })} className={`${styles.formBody} space-y-8`}>
                <ClientPropertyFields form={form} disabled={!isPropertyEditable()}/>
                <fieldset className="grid gap-4 sm:grid-cols-2">
                  <legend className="font-semibold mb-3">Unit and area details</legend>
                  <FormField control={form.control} name="unitNumber" render={({field})=><FormItem><FormLabel>{getUnitLabel()}</FormLabel><FormControl><Input disabled={!isPropertyEditable()} {...field} value={field.value||''}/></FormControl><FormMessage/></FormItem>}/>
                  {!editPlotStructure&&<FormField control={form.control} name="floor" render={({field})=><FormItem><FormLabel>Floor</FormLabel><FormControl><Input disabled={!isPropertyEditable()} {...field} value={field.value||''}/></FormControl><FormMessage/></FormItem>}/>}
                  {!editPlotStructure&&<FormField control={form.control} name="carpetArea" render={({field})=><FormItem><FormLabel>Carpet area</FormLabel><FormControl><Input type="number" min="0" disabled={!isPropertyEditable()} {...field} value={field.value||''}/></FormControl><FormMessage/></FormItem>}/>}
                  {!editPlotStructure&&<FormField control={form.control} name="constructedArea" render={({field})=><FormItem><FormLabel>Built-up / Constructed area</FormLabel><FormControl><Input type="number" min="0" disabled={!isPropertyEditable()} {...field} value={field.value||''}/></FormControl><FormMessage/></FormItem>}/>}
                  {editPlotStructure&&<FormField control={form.control} name="plotArea" render={({field})=><FormItem><FormLabel>Plot area</FormLabel><FormControl><Input type="number" min="0" disabled={!isPropertyEditable()} {...field} value={field.value||''}/></FormControl><FormMessage/></FormItem>}/>}
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">{(["escalationPercentage","escalationAmount"] as const).map(name=><FormField key={name} control={form.control} name={name} render={({field})=><FormItem><FormLabel>{name==="escalationPercentage"?"Rent escalation percentage":"Rent escalation fixed amount"}</FormLabel><FormControl><Input {...field} value={field.value||""}/></FormControl>{name==='escalationAmount'&&<AmountInWords amount={field.value}/>}<FormMessage/></FormItem>}/>)}</div>

                {/* Basic Property Information */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 border rounded-lg">
                  <div className="lg:col-span-4">
                    <h3 className="text-lg font-semibold mb-6">Property Details</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="propertyTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter property name here"
                            disabled={!isPropertyEditable()}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {editCategory==='residential'&&!editPlotStructure&&<FormField
                    control={form.control}
                    name="configuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Residential layout</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isPropertyEditable()}>
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
                  />}

                  <FormField
                    control={form.control}
                    name="listingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Listing Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isPropertyEditable()}>
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
                  {/* Sale Status - Only show for sale properties */}
                  {form.watch("listingType") === "sell" && (
                    <FormField
                      control={form.control}
                      name="saleStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!isPropertyEditable()}>
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

                {/* Buyer Information - Only show when property is already sold */}
                {form.watch("listingType") === "sell" && form.watch("saleStatus") === "sold" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 border rounded-lg">
                    <div className="lg:col-span-3">
                      <h3 className="text-lg font-semibold mb-4">Buyer Information</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Please provide the buyer details.
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
                              <Input placeholder="Buyer First Name" disabled={!isPropertyEditable()} {...field} />
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
                              <Input placeholder="Buyer Last Name" disabled={!isPropertyEditable()} {...field} />
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
                              <Input placeholder="Buyer Phone Number" disabled={!isPropertyEditable()} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}


                {/* Pricing & Lease Information */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 border rounded-lg">
                  <div className="lg:col-span-3">
                    <h3 className="text-lg font-semibold mb-6">
                      {form.watch("listingType") === "rent" ? "Lease & Pricing Details" : "Pricing Details"}
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
                                placeholder="e.g., 25000"
                                type="number"
                                disabled={!isPropertyEditable()}
                                {...field}
                              />
                            </FormControl>
                            <AmountInWords amount={field.value}/>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="securityDeposit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Security Deposit (₹)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 100000"
                                type="number"
                                disabled={!isPropertyEditable()}
                                {...field}
                              />
                            </FormControl>
                            <AmountInWords amount={field.value}/>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="paymentDueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Due Day</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!isPropertyEditable()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {[...Array(31)].map((_, i) => (
                                  <SelectItem key={i + 1} value={(i + 1).toString()}>
                                    {i + 1}
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
                        name="agreementStartDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lease Start Date</FormLabel>
                            <FormControl>
                              <DatePicker
                                disabled={!isPropertyEditable()}
                                value={field.value}
                                onChange={field.onChange}
                              />
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
                            <FormLabel>Lease End Date</FormLabel>
                            <FormControl>
                              <DatePicker
                                disabled={!isPropertyEditable()}
                                value={field.value}
                                onChange={field.onChange}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="noticePeriod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notice Period</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ""}
                              disabled={!isPropertyEditable()}
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
                            <FormLabel>Lock-in Period (Months)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., 6"
                                type="number"
                                disabled={!isPropertyEditable()}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {form.watch("listingType") === "sell" && (
                    <FormField
                      control={form.control}
                      name="sellingPrice"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-3">
                          <FormLabel>Selling Price (₹) *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter selling price (e.g., 5000000)"
                              type="number"
                              disabled={!isPropertyEditable()}
                              {...field}
                            />
                          </FormControl>
                          <AmountInWords amount={field.value}/>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Unit Condition & Maintenance */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 border rounded-lg">
                  <div className="lg:col-span-3">
                    <h3 className="text-lg font-semibold mb-2">Unit Condition & Maintenance</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="unitCondition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Condition</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isPropertyEditable()}>
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
                      <FormItem>
                        <FormLabel>Furnished Items Checklist</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowFurnishedModal(true)}
                          className="w-full"
                          disabled={!isPropertyEditable()}
                        >
                          <CheckSquare className="mr-2 h-4 w-4" />
                          Manage Furnished Items Checklist
                          {furnishedChecklist.filter((item: any) => item.checked).length > 0 && (
                            <span className="ml-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                              {furnishedChecklist.filter((item: any) => item.checked).length} items selected
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
                          <FormLabel>Maintenance To Be Paid By</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!isPropertyEditable()}>
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
                </div>

                {/* Images */}
                <div className="grid grid-cols-1 gap-6 p-6 border rounded-lg">
                  <div>
                    <h3 className="text-lg font-semibold mb-6">Property Images</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadedImages.length >= 6 || !isPropertyEditable() || isUploading}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : !isPropertyEditable()
                          ? 'Property cannot be edited'
                          : uploadedImages.length >= 6
                            ? 'Maximum 6 images uploaded'
                            : 'Upload Images (Max 6)'
                        }
                      </Button>
                    </div>

                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {uploadedImages.map((image, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={image}
                              alt={`Property ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border"
                            />
                            {isPropertyEditable() && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className={styles.imageRemoveButton} aria-label={`Remove property photo ${index + 1}`}
                                onClick={() => removeImage(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments */}
                <div className="grid grid-cols-1 gap-6 p-6 border rounded-lg">
                  <div>
                    <h3 className="text-lg font-semibold mb-6">Additional Comments</h3>
                  </div>

                  <FormField
                    control={form.control}
                    name="specificComments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specific Comments</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any specific comments or notes about the property..."
                            disabled={!isPropertyEditable()}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Status Alert */}
                {!isPropertyEditable() && (
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <span className="text-orange-600">⚠️</span>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-orange-800">
                          {getPropertyStatusMessage()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/manage-property")}
                  >
                    {isPropertyEditable() ? "Cancel" : "Back to Properties"}
                  </Button>
                  {isPropertyEditable() && (
                    <Button type="submit">
                      Update Property
                    </Button>
                  )}
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
          form.setValue("furnishedChecklist", checklist);
        }}
        initialChecklist={furnishedChecklist}
      />
    </main >
  );
};

export default EditProperty;
