"use client";

import React from "react";
import GradientSpotlight from "@/common components/GradientSpotlight";
import { LeftHeroSection } from "@/features/landing-page/LeftHeroSection";
import { RightHeroSection } from "@/features/landing-page/RightHeroSection";

interface HeroSectionProps {
  heroTitle: string;
  heroSubtitle: string;
  quote: string;
  bannerImages?: string[];
  currentBannerIndex: number;
  setCurrentBannerIndex: (index: number) => void;
  onNavigate: (path: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  heroTitle,
  heroSubtitle,
  quote,
  bannerImages = [],
  currentBannerIndex,
  setCurrentBannerIndex,
  onNavigate,
}) => {
  return (
    <section aria-label="Hero" className="relative">
      <GradientSpotlight className="">
        <div className="container mx-auto py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-start justify-center">
            <LeftHeroSection
              heroTitle={heroTitle}
              heroSubtitle={heroSubtitle}
              bannerImages={bannerImages}
              currentBannerIndex={currentBannerIndex}
              setCurrentBannerIndex={setCurrentBannerIndex}
            />
            <RightHeroSection
              quote={quote}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      </GradientSpotlight>
    </section>
  );
};
