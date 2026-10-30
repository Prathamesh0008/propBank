import { apiFetch } from '@/lib/api-client';
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@/lib/navigation";
import { propertyService, Property, SiteSettings } from "@/services/propertyService";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useSearch } from "@/contexts/SearchContext";
import { API_BASE_URL } from "@/utils/config";

import { filterProperties } from "./landingUtils";
import {useDataRefresh} from '@/lib/data-refresh';

const ITEMS_PER_PAGE = 12;

export const useLandingProperties = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedProjectCondition, setSelectedProjectCondition] = useState<string>("");
  const [budgetRange, setBudgetRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
  const observerTarget = useRef<HTMLDivElement>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const [userPhone, setUserPhone] = useState<string>("");
  const [sendingEnquiry, setSendingEnquiry] = useState<string | null>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    quote: "Manage your properties and plan visits with ease",
    heroTitle: "Your Smart Hub for Property Management",
    heroSubtitle: "Manage, list your properties and find your dream house— all in one platform",
    announcementText: "",
    isAnnouncementActive: false,
    bannerImages: [],
  });

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

  const hasLoadedRef = useRef(false);
  const loadGeneration=useRef(0);

  const loadAllProperties = useCallback(async () => {
    const generation=++loadGeneration.current;
    try {
      setLoading(true);
      const response = await propertyService.getAllPropertiesWithSettings();
      if(generation!==loadGeneration.current)return;
      const fetchedProperties = response.properties || [];

      const displayProperties = fetchedProperties.filter((property) => {
        const isInactive = property.status?.toLowerCase() === "inactive" || property.isActive === false;
        if (isInactive) return false;

        if (property.listingType === "rent") {
          return property.rentalStatus !== "rented" && !property.isRented;
        }
        if (property.listingType === "sell") {
          return !property.isSold;
        }
        return true;
      });

      setAllProperties(displayProperties);

      if (response.siteSettings) {
        setSiteSettings((prev) => ({
          ...prev,
          ...response.siteSettings,
        }));
      }

      setProperties(displayProperties.slice(0, ITEMS_PER_PAGE));
      setHasMore(displayProperties.length > ITEMS_PER_PAGE);
      setPage(1);
    } catch (error) {
      if(generation!==loadGeneration.current)return;
      toast({
        title: "Error",
        description: "Failed to load properties. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      if(generation===loadGeneration.current)setLoading(false);
    }
  },[toast]);
  useDataRefresh(['properties','settings'],()=>{void loadAllProperties();});

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

  const loadMoreProperties = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);

    setTimeout(() => {
      const startIndex = page * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const sourceProperties = isSearching ? getFilteredProperties() : allProperties;
      const newProperties = sourceProperties.slice(startIndex, endIndex);

      if (newProperties.length > 0) {
        setProperties((prev) => [...prev, ...newProperties]);
        setPage((prev) => prev + 1);
        setHasMore(endIndex < sourceProperties.length);
      } else {
        setHasMore(false);
      }
      setLoadingMore(false);
    }, 500);
  }, [page, hasMore, loadingMore, isSearching, allProperties, getFilteredProperties]);

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

    const filteredProperties = getFilteredProperties();
    setProperties(filteredProperties.slice(0, ITEMS_PER_PAGE));
    setPage(1);
    setHasMore(filteredProperties.length > ITEMS_PER_PAGE);

    if (filteredProperties.length === 0 && (searchQuery.trim() || selectedCategories.length > 0)) {
      toast({
        title: "No Results",
        description: "No properties found matching your search criteria.",
      });
    }
  }, [searchQuery, selectedCategories, getFilteredProperties, setIsSearching, toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const response = await apiFetch(`${API_BASE_URL}/users/${firebaseUser.uid}`);
          if (response.ok) {
            const data = await response.json();
            if (data.user && data.user.phoneNumber) {
              setUserPhone(data.user.phoneNumber);
            }
          }
        } catch (error) {
          // Silent error
        }
      } else {
        setUserPhone("");
      }
    });
    return () => unsubscribe();
  }, [loadAllProperties]);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadAllProperties();
    }
  }, []);

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
    setProperties(allProperties.slice(0, ITEMS_PER_PAGE));
    setHasMore(allProperties.length > ITEMS_PER_PAGE);
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
