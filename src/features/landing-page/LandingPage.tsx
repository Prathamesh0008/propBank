"use client";

import { AnnouncementBanner } from "@/features/landing-page/AnnouncementBanner";
import { HeroSection } from "@/features/landing-page/HeroSection";
import { QuickInquirySection } from "@/features/landing-page/QuickInquirySection";
import { SearchFilterSection } from "@/features/landing-page/SearchFilterSection";
import { PropertiesSection } from "@/features/landing-page/PropertiesSection";

import { useLandingProperties } from "@/features/landing-page/useLandingProperties";

const LandingPage = () => {
  const {
    navigate,
    properties,
    loading,
    loadingMore,
    hasMore,
    selectedProjectCondition,
    setSelectedProjectCondition,
    budgetRange,
    setBudgetRange,
    observerTarget,
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
    loadMoreProperties,
    handleSearch,
    clearFilters,
    handleCategoryToggle,
    handleEnquireProperty,
    getFilteredProperties,
  } = useLandingProperties();

  return (
    <>
      <>
        <title>Propbank — Buy, Sell & Rent Properties</title>
        <meta
          name="description"
          content="Buy, sell, or rent properties with Propbank. Modern PWA for real estate with buyer/tenant and seller/landlord profiles."
        />
        <link rel="canonical" href="/" />
      </>

      <AnnouncementBanner
        isAnnouncementActive={siteSettings.isAnnouncementActive}
        announcementText={siteSettings.announcementText}
      />

      <HeroSection
        heroTitle={siteSettings.heroTitle}
        heroSubtitle={siteSettings.heroSubtitle}
        quote={siteSettings.quote}
        bannerImages={siteSettings.bannerImages}
        currentBannerIndex={currentBannerIndex}
        setCurrentBannerIndex={setCurrentBannerIndex}
        onNavigate={navigate}
      />

      <QuickInquirySection />

      <SearchFilterSection
        searchType={searchType}
        setSearchType={setSearchType}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategories={selectedCategories}
        handleCategoryToggle={handleCategoryToggle}
        setSelectedCategories={setSelectedCategories}
        selectedProjectCondition={selectedProjectCondition}
        setSelectedProjectCondition={setSelectedProjectCondition}
        budgetRange={budgetRange}
        setBudgetRange={setBudgetRange}
        clearFilters={clearFilters}
        handleSearch={handleSearch}
      />

      <PropertiesSection
        properties={properties}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        loadMoreProperties={loadMoreProperties}
        isSearching={isSearching}
        selectedCategories={selectedCategories}
        searchQuery={searchQuery}
        searchType={searchType}
        selectedProjectCondition={selectedProjectCondition}
        budgetRange={budgetRange}
        filteredCount={getFilteredProperties().length}
        sendingEnquiry={sendingEnquiry}
        handleEnquireProperty={handleEnquireProperty}
        observerTargetRef={observerTarget}
      />
    </>
  );
};

export default LandingPage;
