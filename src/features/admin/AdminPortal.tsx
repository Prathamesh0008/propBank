"use client";


import {ServiceRequestHistory} from '@/features/services/ServiceRequestWorkflow';
import { apiFetch } from '@/lib/api-client';

import dynamic from "next/dynamic";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useAuth} from "@/contexts/AuthContext";
import {matchesAdminPropertySection,adminAvailability,confirmedAdminTenants,type AdminPropertySection} from "@/lib/admin-property-views";
import {adminPropertyDirectory} from "@/lib/admin-property-directory";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/lib/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, AlertCircle, Archive, Settings2, MessageSquareText, CalendarDays, Handshake, LayoutDashboard, Bell, ClipboardCheck, KeyRound, DoorOpen } from "lucide-react";
import styles from "./AdminPortal.module.css";
import { uploadBase64Image } from "@/services/uploadService";
import { useAllProperties } from "../../hooks/useProperties";
import { useAllUsers } from "../../hooks/useUsers";
import { propertyService, Property } from "@/services/propertyService";

import { API_BASE_URL } from "../../utils/config";

import { AdminNotification, Agent, SiteSettings } from "./AdminTypes";
import AdminArchiveTab from "./AdminArchiveTab";
import { AdminServiceRequestsTab } from "./AdminServiceRequestsTab";
import { AdminPropertiesTab } from "./AdminPropertiesTab";
import {useDataRefresh} from '@/lib/data-refresh';

const AdminRentedProperties=dynamic(()=>import('./AdminRentedProperties'));
const AdminNotificationFeed=dynamic(()=>import('./AdminNotificationFeed'));
const AdminVisits=dynamic(()=>import('./AdminVisits'));
const EnquiryInbox=dynamic(()=>import('@/features/enquiries/EnquiryInbox'));
const NegotiationPanel=dynamic(()=>import('@/features/negotiations/NegotiationPanel'));
const AdminPropertyDetailsDialog=dynamic(()=>import('@/features/admin/AdminPropertyDetailsDialog'));
const AdminUserDetailsDialog=dynamic(()=>import('@/features/admin/AdminUserDetailsDialog'));
const AdminAgentsTab=dynamic(()=>import('./AdminAgentsTab').then(module=>module.AdminAgentsTab));
const AdminSiteSettingsTab=dynamic(()=>import('./AdminSiteSettingsTab').then(module=>module.AdminSiteSettingsTab));
const AdminEmailDeliveries=dynamic(()=>import('./AdminEmailDeliveries'));
const propertySections:Record<string,AdminPropertySection>={properties:'all',approvals:'pending',available:'available',archived:'archived'};
const navigation=[{heading:'OVERVIEW',items:[['dashboard','Dashboard',LayoutDashboard],['notifications','Notifications',Bell],['approvals','Pending Approvals',ClipboardCheck]]},{heading:'PROPERTIES',items:[['properties','All Properties',Building2],['rented','Rented Properties',KeyRound],['available','Available Properties',DoorOpen],['archived','Archived Properties',Archive]]},{heading:'OPERATIONS',items:[['service-requests','Service Requests / Issues',AlertCircle],['agents','Agents & Users',Users],['offers','Offers & Enquiries',MessageSquareText],['visits','Property Visits',CalendarDays]]},{heading:'ADMINISTRATION',items:[['settings','Site Settings',Settings2]]}] as const;
const AdminPortal = () => {
  const cache=useQueryClient(),{user}=useAuth();
  const [activeTab,setActiveTab]=useState("dashboard");
  const [notificationView,setNotificationView]=useState('all'),[offerView,setOfferView]=useState('offers');
  const [unreadCount,setUnreadCount]=useState<number|undefined>();
  const notificationGeneration=useRef(0);
  const overview=useQuery<{openRequests:number;unreadNotifications:number}>({queryKey:['adminOverview',user?.uid],enabled:!!user&&activeTab==='dashboard',staleTime:120000,refetchOnWindowFocus:false,retry:false,queryFn:async()=>{const response=await apiFetch('/api/admin/overview');const data=await response.json();if(!response.ok)throw Error(data.message||'Could not load overview');return data;}});
  const notificationCount=useQuery<{unreadCount:number}>({queryKey:['adminNotificationCount',user?.uid],enabled:!!user&&(activeTab!=='notifications'||notificationView==='emails'),staleTime:60000,refetchInterval:60000,refetchOnWindowFocus:false,queryFn:async()=>{const response=await apiFetch('/api/admin/notifications/feed?countOnly=true');if(!response.ok)throw Error('Notification count unavailable');return response.json();}});
  useEffect(()=>{if(notificationCount.data)setUnreadCount(notificationCount.data.unreadCount);},[notificationCount.data]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const { data: propertiesData, isLoading: loadingProperties,error:propertiesError,hasNextPage:moreProperties,fetchNextPage:loadProperties,isFetchingNextPage:loadingPropertyPage } = useAllProperties(activeTab==='dashboard'||activeTab in propertySections);
  const allProperties = propertiesData || [];

  const { data: usersData, isLoading: loadingUsers,hasNextPage:moreUsers,fetchNextPage:loadUsers,isFetchingNextPage:loadingUserPage,error:usersError } = useAllUsers(activeTab==='agents'||activeTab==='offers'&&offerView==='enquiries',activeTab==='offers'?'agent':'');
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
  }, [activeTab,notificationView]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "service-requests" || activeTab === "visits") {
        await fetchNotifications();

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
    const requestedTab=params.get('tab');
    if(requestedTab&&['dashboard','notifications','approvals','properties','rented','available','archived','agents','archive','settings','offers','enquiries','visits','service-requests'].includes(requestedTab)) {
      setActiveTab(requestedTab==='archive'?'notifications':requestedTab==='enquiries'?'offers':requestedTab);if(requestedTab==='archive')setNotificationView('archive');if(requestedTab==='enquiries')setOfferView('enquiries');
      const id=params.get('propertyId');
      if(requestedTab==='properties'&&id)void handleViewPropertyDetails(id);
    }
  }, []);
  const loadNotifications=async(unread:boolean)=>{
    const generation=++notificationGeneration.current;
    try{const rows=await cache.fetchQuery<AdminNotification[]>({queryKey:['adminNotifications',user?.uid,unread],staleTime:120000,queryFn:async()=>{const response=await apiFetch(API_BASE_URL+'/admin/notifications?unread='+unread);if(!response.ok)throw Error('Could not load notifications');return response.json();}});if(generation!==notificationGeneration.current)return;setNotifications(rows);if(unread)setUnreadCount(rows.filter(row=>!row.isRead).length);}
    catch{toast({title:'Notifications unavailable',description:'Refresh this section to retry.',variant:'destructive'});}
  };
  const fetchNotifications=()=>loadNotifications(true);
  const fetchArchivedNotifications=()=>loadNotifications(false);

  const fetchSiteSettings = async () => {
    try {
      const response = await cache.fetchQuery({queryKey:['siteSettings',user?.uid],staleTime:300000,queryFn:async()=>{const value=await apiFetch(API_BASE_URL+'/admin/site-settings');if(!value.ok)throw Error('Could not load settings');return value.json();}}).then(data=>new Response(JSON.stringify(data),{status:200}));
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
  useDataRefresh(['notifications','settings','services'],()=>{
    void cache.invalidateQueries({queryKey:['adminNotifications'],refetchType:'none'});void cache.invalidateQueries({queryKey:['siteSettings'],refetchType:'none'});void cache.invalidateQueries({queryKey:['adminOverview']});void cache.invalidateQueries({queryKey:['adminNotificationCount']});
    void fetchData();
  });
  useDataRefresh(['properties'],()=>{
    if(isPropertyDialogOpen&&selectedProperty?.id)void handleViewPropertyDetails(selectedProperty.id);
  });

  const handleUpdateSiteSettings = async () => {
    setSavingSettings(true);
    try {
      let finalBannerImages = [...(siteSettings.bannerImages || [])];

      let failedBannerImages:string[]=[];
      if (pendingBannerImages.length > 0) {
        setUploadingBanner(true);
        const uploadedUrls: string[] = [];

        for (let i = 0; i < pendingBannerImages.length; i++) {
          try {const url = await uploadBase64Image(pendingBannerImages[i], 'banners', `banner-${Date.now()}-${i}`);uploadedUrls.push(url);}
          catch {failedBannerImages.push(pendingBannerImages[i]);}
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
        setPendingBannerImages(failedBannerImages);

        toast({
          title: "Settings Updated",
          description: failedBannerImages.length
            ? `Site settings were saved. ${failedBannerImages.length} banner image(s) could not be uploaded and remain pending.`
            : pendingBannerImages.length > 0
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

  const handleDeleteNotification=async(id:string)=>{
    if(!window.confirm('Permanently delete this notification? The related property and email history will remain.'))return;
    setUpdating(id);try{const response=await apiFetch(API_BASE_URL+'/admin/notifications/'+encodeURIComponent(id),{method:'DELETE'});if(!response.ok)throw Error('Could not delete notification');const unread=notifications.some(n=>n.id===id&&!n.isRead);setNotifications(rows=>rows.filter(n=>n.id!==id));if(unread)setUnreadCount(value=>value===undefined?undefined:Math.max(0,value-1));void cache.invalidateQueries({queryKey:['adminNotifications'],refetchType:'none'});void cache.invalidateQueries({queryKey:['adminOverview']});void cache.invalidateQueries({queryKey:['adminNotificationCount']});}catch(error){toast({title:'Notification not deleted',description:error instanceof Error?error.message:'Please retry.',variant:'destructive'});}finally{setUpdating(null);}
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
        void cache.invalidateQueries({queryKey:['adminNotifications'],refetchType:'none'});void cache.invalidateQueries({queryKey:['adminOverview']});void cache.invalidateQueries({queryKey:['adminNotificationCount']});setUnreadCount(value=>value===undefined?undefined:Math.max(0,value+(checked?-1:1)));
        toast({
          title: "Success",
          description: checked
            ? "Request marked as complete and moved to archive"
            : "Request unarchived and moved back to Active Service Requests"
        });

        if (activeTab === "notifications"&&notificationView==='archive') {
          setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } else {
          setNotifications(prev =>
            prev.map(n =>
              n.id === notificationId ? { ...n, isRead: checked } : n
            ).filter(n => {
              if (activeTab === "visits") return !n.isRead && n.type === "visit_update";
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
      <Tabs orientation="vertical" value={activeTab} onValueChange={setActiveTab} className={styles.panel}>
        <div className={styles.panelGrid}>
        <aside className={styles.sidebar} aria-label="Administration sections">
          <TabsList aria-label="Admin workspace" className={styles.navigation}>
            {navigation.map(group=><div key={group.heading} className={styles.navGroup}><p className={styles.sidebarLabel}>{group.heading}</p>{group.items.map(([value,label,Icon])=><TabsTrigger key={value} value={value} className={styles.navItem}><Icon size={16} aria-hidden="true"/><span>{label}</span>{value==='notifications'&&unreadCount!==undefined&&<span className={styles.navCount}>{unreadCount}</span>}{value==='approvals'&&propertiesData&&<span className={styles.navCount}>{allProperties.filter((p:Property)=>matchesAdminPropertySection(p,'pending')).length}</span>}</TabsTrigger>)}</div>)}
          </TabsList>
        </aside>
        <div className={styles.content}>

        <TabsContent value="dashboard"><section className={styles.overview}><header><p className={styles.sidebarLabel}>OVERVIEW</p><h1>Dashboard</h1></header>{(propertiesError||overview.error)&&<p role="alert">Some summary data could not be loaded. Open the relevant section to retry.</p>}<div className={styles.summary}>
        {[
          ['Total properties',propertiesData?adminPropertyDirectory(allProperties).all.length:undefined,'properties'],
          ['Pending property approvals',propertiesData?allProperties.filter((p:Property)=>matchesAdminPropertySection(p,'pending')).length:undefined,'approvals'],
          ['Rented properties','Open directory','rented'],
          ['Available properties',propertiesData?allProperties.filter((p:Property)=>adminAvailability(p)==='available').length:undefined,'available'],
          ['Open service requests / issues',overview.data?.openRequests,'service-requests'],
          ['Unread admin notifications',unreadCount,'notifications'],
          ['Pending connections (property records)',propertiesData?allProperties.filter((p:Property)=>p.isActive!==false&&p.status!=='inactive').reduce((n:number,p:Property)=>n+(p.createdAs==='tenant'&&!p.ownerUID&&p.ownershipVerification==='pending'?1:0)+(p.tenants||[]).filter(t=>t.isActive===true&&t.linkConfirmationRequired===true&&!t.userUID).length,0):undefined,'notifications'],
        ].map(([label,count,target])=><button type="button" key={String(label)} onClick={()=>setActiveTab(String(target))}><span>{label}</span><strong>{count===undefined?(propertiesError||overview.error?'Unavailable':'Loading'):count}</strong></button>)}
        </div>{moreProperties&&<p role="status">Property counts cover loaded pages, not the full directory. <button type="button" disabled={loadingPropertyPage} onClick={()=>void loadProperties()}>Load more property records</button></p>}<p className="text-sm text-muted-foreground">Available totals exclude unknown occupancy. Pending connections are derived from property records; review the property's relationship details before acting.</p></section></TabsContent>
        <TabsContent value="offers">{offerView==='enquiries'&&moreUsers&&<p>Agent choices cover loaded users. <button type="button" disabled={loadingUserPage} onClick={()=>void loadUsers()}>Load more agents</button></p>}<Tabs value={offerView} onValueChange={setOfferView}><TabsList aria-label="Offers and enquiries"><TabsTrigger value="offers">Offers</TabsTrigger><TabsTrigger value="enquiries">Enquiries</TabsTrigger></TabsList><TabsContent value="offers">{activeTab==='offers'&&offerView==='offers'&&<NegotiationPanel admin/>}</TabsContent><TabsContent value="enquiries">{activeTab==='offers'&&offerView==='enquiries'&&<EnquiryInbox admin agents={agents}/>}</TabsContent></Tabs></TabsContent>
        <TabsContent value="visits">{activeTab==='visits'&&<AdminVisits notifications={notifications.filter(n=>n.type==='visit_update'&&!n.isRead)} onMarkRead={handleMarkComplete}/>}</TabsContent>
        <TabsContent value="rented">{activeTab==='rented'&&<AdminRentedProperties onViewProperty={id=>void handleViewPropertyDetails(id)}/>}</TabsContent>
        <TabsContent value="notifications"><Tabs value={notificationView} onValueChange={setNotificationView}><TabsList aria-label="Notification history"><TabsTrigger value="all">All notifications</TabsTrigger><TabsTrigger value="unread">Unread</TabsTrigger><TabsTrigger value="archive">Read / Archived</TabsTrigger><TabsTrigger value="emails">Email delivery history</TabsTrigger></TabsList>{['all','unread','archive'].map(view=><TabsContent key={view} value={view}>{activeTab==='notifications'&&notificationView===view&&<AdminNotificationFeed state={view==='archive'?'read':view} onUnreadCount={setUnreadCount} onViewProperty={id=>void handleViewPropertyDetails(id)}/>}</TabsContent>)}<TabsContent value="emails">{activeTab==='notifications'&&notificationView==='emails'&&<AdminEmailDeliveries/>}</TabsContent></Tabs></TabsContent>
        <TabsContent value="service-requests">{activeTab==='service-requests'&&<><ServiceRequestHistory admin/><AdminServiceRequestsTab embedded loading={loading} notifications={notifications.filter(n=>!n.isRead&&['service_request','legal_service_request','other_service_request'].includes(n.type)&&!n.relatedId)} handleMarkComplete={handleMarkComplete} handleViewPropertyDetails={handleViewPropertyDetails} loadingProperty={loadingProperty} selectedProperty={selectedProperty} updating={updating} uploadingRemarkImage={uploadingRemarkImage} remarkImages={remarkImages} handleRemarkImageUpload={handleRemarkImageUpload} handleSaveRemarks={handleSaveRemarks}/></>}</TabsContent>
        {Object.entries(propertySections).map(([value,section])=><TabsContent key={value} value={value}>{propertiesError&&<p role="alert">Could not load properties. Reopen this section to retry.</p>}{moreProperties&&<p>Filters and counts cover loaded properties. <button type="button" disabled={loadingPropertyPage} onClick={()=>void loadProperties()}>Load more properties</button></p>}<AdminPropertiesTab key={section} section={section} loading={loadingProperties} properties={allProperties} handleViewPropertyDetails={handleViewPropertyDetails} loadingProperty={loadingProperty} selectedProperty={selectedProperty}/></TabsContent>)}
        <TabsContent value="agents">{usersError&&<p role="alert">Could not load users. Retry this directory.</p>}{moreUsers&&<p>Showing loaded users. <button type="button" disabled={loadingUserPage} onClick={()=>void loadUsers()}>Load more users</button></p>}{activeTab==='agents'&&<AdminAgentsTab loading={loadingUsers} agents={agents} handleViewUserDetails={handleViewUserDetails}/>}</TabsContent>

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

      {isPropertyDialogOpen&&<AdminPropertyDetailsDialog
        property={selectedProperty}
        onVerificationChange={async()=>{if(selectedProperty?.id)setSelectedProperty(await propertyService.getPropertyById(selectedProperty.id));}}
        isOpen={isPropertyDialogOpen}
        onOpenChange={setIsPropertyDialogOpen}
      />}
      {isUserDialogOpen&&<AdminUserDetailsDialog
        user={selectedUser}
        isOpen={isUserDialogOpen}
        onOpenChange={setIsUserDialogOpen}
      />}
    </main>
  );
};

export default AdminPortal;

