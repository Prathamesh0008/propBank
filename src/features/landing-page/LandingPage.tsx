"use client";

import { AnnouncementBanner } from "@/features/landing-page/AnnouncementBanner";
import { HeroSection } from "@/features/landing-page/HeroSection";
import { HeroPropertySearch } from "./HeroPropertySearch";
import { QuickInquirySection } from "@/features/landing-page/QuickInquirySection";
import { SearchFilterSection } from "@/features/landing-page/SearchFilterSection";
import { PropertiesSection } from "@/features/landing-page/PropertiesSection";
import { PropertyManagementServices } from "./PropertyManagementServices";
import { PropertyManagementSections, PortfolioCallToAction } from "./PortfolioSections";

import { SlidersHorizontal } from "lucide-react";
import styles from "./LandingPage.module.css";

import { useLandingProperties } from "@/features/landing-page/useLandingProperties";

const LandingPage = () => {
  const {
    navigate,
    properties,
    loading,
    loadingMore,
    hasMore,coverageIncomplete,
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

      <HeroPropertySearch onSearch={selection => {
        setSearchType(selection.type);
        setSearchQuery(selection.location);
        setSelectedCategories(selection.category ? [selection.category] : []);
        setSelectedProjectCondition(selection.condition);
        setBudgetRange({ min: 0, max: selection.budget });
        // The existing landing search effect applies the new filters after this batch.
        document.getElementById("featured-properties")?.scrollIntoView({ block: "start" });
      }} />

      <details id="homepage-advanced-filters" className={styles.filters}>
        <summary><SlidersHorizontal size={15} strokeWidth={1.5} aria-hidden="true" />More filters</summary>
        <SearchFilterSection
          hideIntro advancedOnly
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
      </details>

      {coverageIncomplete&&<p role="status">Showing loaded property pages. Continue browsing for remaining listings; filters apply to loaded records. <button type="button" disabled={loadingMore} onClick={()=>void loadMoreProperties(true)}>Continue browsing server pages</button></p>}
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

      <PropertyManagementServices />

      <PropertyManagementSections />

      <QuickInquirySection />

      <PortfolioCallToAction />
    </>
  );
};

export default LandingPage;
