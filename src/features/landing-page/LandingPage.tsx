"use client";

import { AnnouncementBanner } from "@/features/landing-page/AnnouncementBanner";
import { HeroSection } from "@/features/landing-page/HeroSection";
import { QuickInquirySection } from "@/features/landing-page/QuickInquirySection";
import { SearchFilterSection } from "@/features/landing-page/SearchFilterSection";
import { PropertiesSection } from "@/features/landing-page/PropertiesSection";
import { PropertyManagementSections, RealEstateIntroduction, PortfolioCallToAction } from "./PortfolioSections";

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

      <PropertyManagementSections />

      <RealEstateIntroduction />

      <SearchFilterSection
        hideIntro
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

      <QuickInquirySection />

      <PortfolioCallToAction />
    </>
  );
};

export default LandingPage;
