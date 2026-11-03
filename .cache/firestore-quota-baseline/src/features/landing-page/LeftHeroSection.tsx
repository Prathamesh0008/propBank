"use client";

import React from "react";
const heroImage = "/assets/hero-realestate.jpg";

interface LeftHeroSectionProps {
  heroTitle: string;
  heroSubtitle: string;
  bannerImages: string[];
  currentBannerIndex: number;
  setCurrentBannerIndex: (index: number) => void;
}

export const LeftHeroSection: React.FC<LeftHeroSectionProps> = ({
  heroTitle,
  heroSubtitle,
  bannerImages,
  currentBannerIndex,
  setCurrentBannerIndex,
}) => {
  return (
    <div className="space-y-8 flex flex-col items-center text-center lg:items-start lg:text-left">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold leading-tight md:text-2xl lg:text-3xl">
          {heroTitle || "Your Smart Hub for Property Management"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {heroSubtitle || "Manage, list your properties and find your dream house— all in one platform"}
        </p>
      </div>

      <div className="glass-panel shadow-elegant rounded-xl overflow-hidden relative w-full">
        {/* Banner Carousel or Fallback Hero Image */}
        {bannerImages && bannerImages.length > 0 ? (
          <div className="relative w-full h-[300px] md:h-[350px]">
            {bannerImages.map((bannerUrl, index) => (
              <img
                key={index}
                src={bannerUrl}
                alt={`Banner ${index + 1}`}
                loading={index === 0 ? "eager" : "lazy"}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                  index === currentBannerIndex ? "opacity-100" : "opacity-0"
                }`}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = heroImage;
                }}
              />
            ))}
            {/* Carousel Indicators */}
            {bannerImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                {bannerImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentBannerIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentBannerIndex ? "bg-white w-4" : "bg-white/50 hover:bg-white/75"
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <img
            src={heroImage}
            alt="Modern homes and city skyline for a real estate app hero"
            loading="eager"
            className="w-full h-[300px] md:h-[350px] object-cover"
          />
        )}
      </div>
    </div>
  );
};
