"use client";
import AdminVisits from './AdminVisits';
import EnquiryInbox from '@/features/enquiries/EnquiryInbox';
import {ProductDashboard} from '@/features/properties/PropertyHub';


import NegotiationPanel from '@/features/negotiations/NegotiationPanel';
import {ServiceRequestHistory} from '@/features/services/ServiceRequestWorkflow';
import { apiFetch } from '@/lib/api-client';

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, AlertCircle, Archive, Settings2, MessageSquareText, CalendarDays, Handshake } from "lucide-react";
import styles from "./AdminPortal.module.css";
import { uploadBase64Image } from "@/services/uploadService";
import AdminPropertyDetailsDialog from "@/features/admin/AdminPropertyDetailsDialog";
import AdminUserDetailsDialog from "@/features/admin/AdminUserDetailsDialog";
import { useAllProperties } from "../../hooks/useProperties";
import { useAllUsers } from "../../hooks/useUsers";
import { propertyService, Property } from "@/services/propertyService";

import { API_BASE_URL } from "../../utils/config";

import { AdminNotification, Agent, SiteSettings } from "./AdminTypes";
import AdminArchiveTab from "./AdminArchiveTab";
import { AdminServiceRequestsTab } from "./AdminServiceRequestsTab";
import { AdminPropertiesTab } from "./AdminPropertiesTab";
import { AdminAgentsTab } from "./AdminAgentsTab";
import { AdminSiteSettingsTab } from "./AdminSiteSettingsTab";

const AdminPortal = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("properties");
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const { data: propertiesData, isLoading: loadingProperties,error:propertiesError } = useAllProperties(activeTab==='properties');
  const allProperties = propertiesData || [];

  const { data: usersData, isLoading: loadingUsers,refetch:refetchUsers } = useAllUsers();
  const agents = usersData || [];

  const [loading, setLoading] = useState(true);

  // Site settings state
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    quote: "Manage your properties and plan visits with ease",
    heroTitle: "Your Smart Hub for Property Management",
    heroSubtitle: "Manage, list your properties and find your dream house— all in one platform",
    bannerImages: [],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [remarkImages, setRemarkImages] = useState<Record<string, string>>({});
  const [uploadingRemarkImage, setUploadingRemarkImage] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  // Store pending banner images as base64 strings (not yet uploaded)
  const [pendingBannerImages, setPendingBannerImages] = useState<string[]>([]);

  // Full Property Details Dialog State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isPropertyDialogOpen, setIsPropertyDialogOpen] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(false);

  // User Details Dialog State
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);

  const handleViewUserDetails = (user: any) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "service-requests") {
        await fetchNotifications();
      } else if (activeTab === "agents") {
        await refetchUsers();
      } else if (activeTab === "archive") {
        await fetchArchivedNotifications();
      } else if (activeTab === "settings") {
        await fetchSiteSettings();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleViewPropertyDetails = async (propertyId: string) => {
    if (!propertyId) return;
    setLoadingProperty(true);
    setSelectedProperty({ id: propertyId } as any); // temporary set for loading spinner
    try {
      const prop = await propertyService.getPropertyById(propertyId);
      setSelectedProperty(prop);
      setIsPropertyDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch property details",
        variant: "destructive"
      });
    } finally {
      setLoadingProperty(false);
    }
  };
  useEffect(() => {
    const params=new URLSearchParams(window.location.search);
    if(params.get('tab')==='properties') {
      setActiveTab('properties');
      const id=params.get('propertyId');
      if(id)void handleViewPropertyDetails(id);
    }
  }, []);
  const fetchNotifications = async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/notifications?unread=true`);
      if (response.ok) {
        const data = await response.json();
        // Filter for all notification types that are unread (isRead: false)
        // Double-check isRead is false as a safety measure
        const serviceRequests = Array.isArray(data)
          ? data.filter((n: AdminNotification) =>
            (n.type === "document_upload" || n.type === "review" || n.type === "want_to_sell" || n.type === "want_to_sell_cancelled" || n.type === "property_enquiry" || n.type === "service_request" || n.type === "legal_service_request" || n.type === "other_service_request" || n.type === "inspection_report" || n.type === "agreement_renewal" || n.type === "agreement_termination" || n.type === "general_inquiry" || n.type === "property_added" || n.type === "rent_due" || n.type === "agreement_expiry" || n.type === "visit_update" || n.type === "negotiation_update") && n.isRead === false
          )
          : [];

        setNotifications(serviceRequests);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      setNotifications([]);
    }
  };

  const fetchArchivedNotifications = async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/notifications`);
      if (response.ok) {
        const data = await response.json();
        const archived = Array.isArray(data)
          ? data.filter((n: AdminNotification) => n.isRead && (n.type === "document_upload" || n.type === "want_to_sell" || n.type === "want_to_sell_cancelled" || n.type === "property_enquiry" || n.type === "service_request" || n.type === "review" || n.type === "legal_service_request" || n.type === "other_service_request" || n.type === "inspection_report" || n.type === "agreement_renewal" || n.type === "agreement_termination" || n.type === "general_inquiry" || n.type === "property_added"))
          : [];
        archived.sort((a: AdminNotification, b: AdminNotification) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setNotifications(archived);
      }
    } catch (error) { /* Preserve existing best-effort behavior. */ }
  };

  const fetchSiteSettings = async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/site-settings`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          setSiteSettings({
            quote: data.settings.quote || "Manage your properties and plan visits with ease",
            quoteAuthor: data.settings.quoteAuthor || "",
            heroTitle: data.settings.heroTitle || "Your Smart Hub for Property Management",
            heroSubtitle: data.settings.heroSubtitle || "Manage, list your properties and find your dream house— all in one platform",
            announcementText: data.settings.announcementText || "",
            isAnnouncementActive: data.settings.isAnnouncementActive || false,
            bannerImages: data.settings.bannerImages || [],
          });
        }
      }
    } catch (error) { /* Preserve existing best-effort behavior. */ }
  };

  const handleUpdateSiteSettings = async () => {
    setSavingSettings(true);
    try {
      let finalBannerImages = [...(siteSettings.bannerImages || [])];

      if (pendingBannerImages.length > 0) {
        setUploadingBanner(true);
        const uploadedUrls: string[] = [];

        for (let i = 0; i < pendingBannerImages.length; i++) {
          const url = await uploadBase64Image(pendingBannerImages[i], 'banners', `banner-${Date.now()}-${i}`);
          uploadedUrls.push(url);
        }

        finalBannerImages = [...finalBannerImages, ...uploadedUrls];
        setUploadingBanner(false);
      }

      const settingsToSave = {
        ...siteSettings,
        bannerImages: finalBannerImages,
      };

      const response = await apiFetch(`${API_BASE_URL}/admin/site-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsToSave),
      });

      if (response.ok) {
        setSiteSettings(settingsToSave);
        setPendingBannerImages([]);

        toast({
          title: "Settings Updated",
          description: pendingBannerImages.length > 0
            ? `Site settings updated. ${pendingBannerImages.length} banner image(s) uploaded.`
            : "Site settings have been updated successfully.",
        });
      } else {
        throw new Error("Failed to update settings");
      }
    } catch (error) {
      setUploadingBanner(false);
      toast({
        title: "Error",
        description: "Failed to update site settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newBase64Images: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newBase64Images.push(base64);
      }

      setPendingBannerImages(prev => [...prev, ...newBase64Images]);

      toast({
        title: "Images Added",
        description: `${newBase64Images.length} image(s) added. Click Save Settings to upload and apply.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to read image files. Please try again.",
        variant: "destructive",
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveBannerImage = (indexToRemove: number, isPending: boolean) => {
    if (isPending) {
      setPendingBannerImages(prev => prev.filter((_, index) => index !== indexToRemove));
    } else {
      setSiteSettings(prev => ({
        ...prev,
        bannerImages: (prev.bannerImages || []).filter((_, index) => index !== indexToRemove)
      }));
    }
    toast({
      title: "Image Removed",
      description: isPending ? "Pending image removed." : "Banner image removed. Click Save Settings to apply changes.",
    });
  };

  const handleMarkComplete = async (notificationId: string, checked: boolean) => {
    setUpdating(notificationId);
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: checked ? "archive" : "unarchive" }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: checked
            ? "Request marked as complete and moved to archive"
            : "Request unarchived and moved back to Active Service Requests"
        });

        if (activeTab === "archive") {
          setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } else {
          setNotifications(prev =>
            prev.map(n =>
              n.id === notificationId ? { ...n, isRead: checked } : n
            ).filter(n => {
              if (activeTab === "service-requests") {
                return !n.isRead && (n.type === "want_to_sell" || n.type === "want_to_sell_cancelled" || n.type === "property_enquiry" || n.type === "service_request" || n.type === "review" || n.type === "legal_service_request" || n.type === "other_service_request" || n.type === "inspection_report" || n.type === "agreement_renewal" || n.type === "agreement_termination" || n.type === "property_added");
              }
              return true;
            })
          );
        }
      } else {
        throw new Error("Failed to update status");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: checked
          ? "Failed to mark request as complete. Please try again."
          : "Failed to unarchive request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleSaveRemarks = async (notificationId: string, remarks: string, adminImage?: string) => {
    if(uploadingRemarkImage===notificationId||remarkImages[notificationId]?.startsWith('data:')&&!remarkImages[`url-${notificationId}`]) {
      toast({title:'Image upload incomplete',description:'Retry the selected image upload before saving remarks.',variant:'destructive'});
      return;
    }
    setUpdating(notificationId);
    try {
      const response = await apiFetch(`${API_BASE_URL}/admin/notifications/${notificationId}/remarks`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks, adminImage }),
      });

      if (response.ok) {
        toast({ title: "Success", description: "Admin remarks updated successfully" });
        setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, adminRemarks: remarks, adminImage: adminImage } : n));
      } else {
        throw new Error("Failed to update remarks");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update remarks. Please try again.", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleRemarkImageUpload = async (notificationId: string, file: File) => {
    setUploadingRemarkImage(notificationId);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        setRemarkImages(prev => ({ ...prev, [notificationId]: base64, [`url-${notificationId}`]: '' }));
        try {
          const imageUrl = await uploadBase64Image(base64);
          setRemarkImages(prev => ({ ...prev, [`url-${notificationId}`]: imageUrl }));
          toast({ title: "Success", description: "Image uploaded to Cloudflare successfully. Click Save Remarks to finalize." });
        } catch (error) {
          toast({ title: "Error", description: "Failed to upload image to Cloudflare. Please try again.", variant: "destructive" });
        } finally {
          setUploadingRemarkImage(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploadingRemarkImage(null);
    }
  };

  return (
    <main className={styles.workspace}>
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Operations / PropBank</span>
          <h1>Administration</h1>
          <p>Listings, people and requests — organized in one place.</p>
        </div>
        <span className={styles.workspaceLabel}>Management workspace</span>
      </header>
      <div className={styles.dashboardSummary}><ProductDashboard admin/></div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className={styles.panel}>
        <div className={styles.panelGrid}>
        <aside className={styles.sidebar} aria-label="Administration sections">
          <p className={styles.sidebarLabel}>WORKSPACE</p>
          <TabsList className={styles.navigation}>
          <TabsTrigger value="service-requests" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Active Service Requests</span>
            <span className="sm:hidden">Requests</span>
          </TabsTrigger>
          <TabsTrigger value="properties" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Properties</span>
          </TabsTrigger>
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Agents</span>
          </TabsTrigger>
          <TabsTrigger value="archive" className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            <span>Archive</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Site Settings</span>
            <span className="sm:hidden">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="offers" className="flex items-center gap-2"><Handshake className="h-4 w-4"/>Offers</TabsTrigger>
          <TabsTrigger value="enquiries" className="flex items-center gap-2"><MessageSquareText className="h-4 w-4"/>Enquiries</TabsTrigger>
          <TabsTrigger value="visits" className="flex items-center gap-2"><CalendarDays className="h-4 w-4"/>Visits</TabsTrigger>
        </TabsList>
        </aside>
        <div className={styles.content}>

        <TabsContent value="offers"><NegotiationPanel admin/></TabsContent>
        <TabsContent value="enquiries"><EnquiryInbox admin agents={agents}/></TabsContent>
        <TabsContent value="visits"><AdminVisits/></TabsContent>
        <TabsContent value="service-requests" className="mt-6">
          <ServiceRequestHistory admin/>
          <AdminServiceRequestsTab
            loading={loading}
            notifications={notifications.filter(n=>!(n.type==="service_request" && n.relatedId))}
            handleMarkComplete={handleMarkComplete}
            handleViewPropertyDetails={handleViewPropertyDetails}
            loadingProperty={loadingProperty}
            selectedProperty={selectedProperty}
            updating={updating}
            uploadingRemarkImage={uploadingRemarkImage}
            remarkImages={remarkImages}
            handleRemarkImageUpload={handleRemarkImageUpload}
            handleSaveRemarks={handleSaveRemarks}
          />
        </TabsContent>

        <TabsContent value="properties" className="mt-6">
          {propertiesError&&<p role="alert" className="text-destructive mb-4">Could not load properties. Please refresh to retry.</p>}
          <AdminPropertiesTab
            loading={loading||loadingProperties}
            properties={allProperties}
            handleViewPropertyDetails={handleViewPropertyDetails}
            loadingProperty={loadingProperty}
            selectedProperty={selectedProperty}
          />
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <AdminAgentsTab
            loading={loading}
            agents={agents}
            handleViewUserDetails={handleViewUserDetails}
          />
        </TabsContent>

        <AdminArchiveTab
          loading={loading}
          notifications={notifications.filter((n) => n.resolvedAt)}
          updating={updating}
          handleMarkComplete={handleMarkComplete}
          handleViewPropertyDetails={handleViewPropertyDetails}
          loadingProperty={loadingProperty}
          selectedProperty={selectedProperty}
        />

        <TabsContent value="settings" className="mt-6">
          <AdminSiteSettingsTab
            loading={loading}
            siteSettings={siteSettings}
            setSiteSettings={setSiteSettings}
            savingSettings={savingSettings}
            uploadingBanner={uploadingBanner}
            pendingBannerImages={pendingBannerImages}
            handleUpdateSiteSettings={handleUpdateSiteSettings}
            handleBannerImageUpload={handleBannerImageUpload}
            handleRemoveBannerImage={handleRemoveBannerImage}
          />
        </TabsContent>
      </div>
      </div>
      </Tabs>

      <AdminPropertyDetailsDialog
        property={selectedProperty}
        onVerificationChange={async()=>{if(selectedProperty?.id)setSelectedProperty(await propertyService.getPropertyById(selectedProperty.id));}}
        isOpen={isPropertyDialogOpen}
        onOpenChange={setIsPropertyDialogOpen}
      />
      <AdminUserDetailsDialog
        user={selectedUser}
        isOpen={isUserDialogOpen}
        onOpenChange={setIsUserDialogOpen}
      />
    </main>
  );
};

export default AdminPortal;

