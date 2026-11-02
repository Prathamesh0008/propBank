import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@/lib/navigation";
import { propertyService, Property, SiteSettings } from "@/services/propertyService";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/firebase";
import {useAuth} from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { API_BASE_URL } from "@/utils/config";

import { filterProperties } from "./landingUtils";
import {useDataRefresh} from '@/lib/data-refresh';
import {useQuery} from '@tanstack/react-query';

const ITEMS_PER_PAGE = 12;

export const useLandingProperties = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {data, isPending: loading, error: listingError, refetch} = useQuery({
    queryKey: ['publicProperties', 'home'],
    queryFn: () => propertyService.getAllPropertiesWithSettings(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const allProperties = data?.properties || [];
  const loadingMore = false;
  const error = listingError ? 'Could not load properties. Please try again.' : '';
  const [page, setPage] = useState(1);
  const [selectedProjectCondition, setSelectedProjectCondition] = useState<string>("");
  const [budgetRange, setBudgetRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const {user,profile}=useAuth();
  const userPhone=profile?.phoneNumber||"";
  const [sendingEnquiry, setSendingEnquiry] = useState<string | null>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const siteSettings: SiteSettings = {
    quote: "Manage your properties and plan visits with ease",
    heroTitle: "Your Smart Hub for Property Management",
    heroSubtitle: "Manage, list your properties and find your dream house— all in one platform",
    announcementText: "",
    isAnnouncementActive: false,
    bannerImages: [],
    ...data?.siteSettings,
  };

  const {
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
    selectedCategories,
    setSelectedCategories,
    selectedListingTypes,
    setSelectedListingTypes,
    isSearching,
    setIsSearching,
    setOnSearchTrigger,
  } = useSearch();

  const loadAllProperties = useCallback(async () => {
    await refetch();
  }, [refetch]);
  // Property mutations invalidate the publicProperties query through AuthContext.
  useDataRefresh(['settings'],()=>{void loadAllProperties();});
  useEffect(() => {setPage(1);}, [data]);

  const getFilteredProperties = useCallback(() => {
    return filterProperties(
      allProperties,
      searchQuery,
      searchType,
      selectedListingTypes,
      selectedCategories,
      selectedProjectCondition,
      budgetRange
    );
  }, [allProperties, searchQuery, searchType, selectedListingTypes, selectedCategories, selectedProjectCondition, budgetRange]);

  // Cards, pagination and counts share one filtered snapshot after every refresh.
  const filteredProperties = getFilteredProperties();
  const properties = filteredProperties.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = properties.length < filteredProperties.length;
  const loadMoreProperties = useCallback(() => {
    if (hasMore && !loading) setPage(current => current + 1);
  }, [hasMore, loading]);

  const handleSearch = useCallback(() => {
    const hasActiveFilters =
      searchQuery.trim() !== "" ||
      searchType !== "all" ||
      selectedCategories.length > 0 ||
      selectedListingTypes.length > 0 ||
      selectedProjectCondition !== "" ||
      budgetRange.min > 0 ||
      budgetRange.max > 0;

    setIsSearching(hasActiveFilters);

    setPage(1);
  }, [searchQuery, searchType, selectedCategories, selectedListingTypes, selectedProjectCondition, budgetRange, setIsSearching]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreProperties();
        }
      },
      { threshold: 1.0 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [hasMore, loading, loadingMore, loadMoreProperties]);

  useEffect(() => {
    const bannerImages = siteSettings.bannerImages || [];
    if (bannerImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % bannerImages.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [siteSettings.bannerImages]);

  useEffect(() => {
    handleSearch();
  }, [searchQuery, searchType, selectedCategories, selectedProjectCondition, budgetRange, handleSearch]);

  useEffect(() => {
    setOnSearchTrigger(() => handleSearch);
    return () => setOnSearchTrigger(null);
  }, [handleSearch, setOnSearchTrigger]);

  const clearFilters = () => {
    setSearchQuery("");
    setSearchType("all");
    setSelectedCategories([]);
    setSelectedListingTypes([]);
    setSelectedProjectCondition("");
    setBudgetRange({ min: 0, max: 0 });
    setIsSearching(false);
    setPage(1);
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId];
    setSelectedCategories(newCategories);
  };

  const handleEnquireProperty = async (property: Property) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({
        title: "Login Required",
        description: "Please login to enquire about properties.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setSendingEnquiry(property.id);
    try {
      let enquiryUserPhone = userPhone || currentUser.phoneNumber || "";
      if (!enquiryUserPhone && currentUser.uid) {
        try {
          const userResponse = await apiFetch(`${API_BASE_URL}/users/${currentUser.uid}`);
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.user && userData.user.phoneNumber) {
              enquiryUserPhone = userData.user.phoneNumber;
            }
          }
        } catch (error) {
          // Continue
        }
      }

      let ownerPhoneNumber = "";
      let ownerEmail = property.ownerEmail || "";
      if (property.ownerUID) {
        try {
          const ownerResponse = await apiFetch(`${API_BASE_URL}/users/${property.ownerUID}`);
          if (ownerResponse.ok) {
            const ownerData = await ownerResponse.json();
            if (ownerData.user) {
              if (ownerData.user.phoneNumber) ownerPhoneNumber = ownerData.user.phoneNumber;
              if (ownerData.user.email && !ownerEmail) ownerEmail = ownerData.user.email;
            }
          }
        } catch (error) {
          // Continue
        }
      }

      const notificationPayload = {
        type: "property_enquiry",
        title: "Property Enquiry Request",
        message: `User ${currentUser.displayName || currentUser.email || "Unknown User"} is interested in property: ${
          property.title || property.id
        }`,
        propertyId: property.id || "",
        ownerId: property.ownerUID || "",
        ownerName: property.ownerName || "Unknown Owner",
        ownerPhone: ownerPhoneNumber || "",
        ownerEmail: ownerEmail || "",
        userId: currentUser.uid || "",
        userName: currentUser.displayName || currentUser.email || "Unknown User",
        userEmail: currentUser.email || "",
        userPhone: enquiryUserPhone || "",
        propertyTitle: property.title || "",
        propertyAddress: property.address || property.city || "Not specified",
        propertyListingType: property.listingType || "rent",
        timestamp: new Date().toISOString(),
        isRead: false,
        priority: "high",
      };

      const notificationResponse = await apiFetch(`${API_BASE_URL}/admin/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPayload),
      });

      const notificationData = await notificationResponse.json();

      if (notificationData.success) {
        toast({
          title: "Enquiry submitted",
          description: "Our team will review it.",
        });
      } else {
        throw new Error(notificationData.message || "Failed to send enquiry");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send enquiry. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSendingEnquiry(null);
    }
  };

  return {
    navigate,
    properties,
    allProperties,
    loading,
    loadingMore,
    error,
    retry: loadAllProperties,
    hasMore,
    selectedProjectCondition,
    setSelectedProjectCondition,
    budgetRange,
    setBudgetRange,
    observerTarget,
    user,
    sendingEnquiry,
    siteSettings,
    currentBannerIndex,
    setCurrentBannerIndex,
    searchQuery,
    setSearchQuery,
    searchType,
    setSearchType,
    selectedCategories,
    setSelectedCategories,
    isSearching,
    setIsSearching,
    loadMoreProperties,
    handleSearch,
    clearFilters,
    handleCategoryToggle,
    handleEnquireProperty,
    getFilteredProperties,
  };
};
