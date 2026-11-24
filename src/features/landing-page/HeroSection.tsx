"use client";

import React from "react";
import { ArrowRight, Play } from "lucide-react";
import { Link } from "@/lib/navigation";
import styles from "./HeroSection.module.css";
import HeroImageCarousel from "./HeroImageCarousel";

interface HeroSectionProps {
  heroTitle: string;
  heroSubtitle: string;
  quote: string;
  bannerImages?: string[];
  currentBannerIndex: number;
  setCurrentBannerIndex: (index: number) => void;
  onNavigate: (path: string) => void;
}

// Repair known legacy punctuation at the display boundary; stored copy stays untouched.
function readableCopy(value: string): string {
  return value.replace(/\u00e2\u20ac\u201d/g, "\u2014")
    .replace(/\u00e2\u20ac\u201c/g, "\u2013")
    .replace(/\u00e2\u20ac\u2122/g, "\u2019")
    .replace(/\u00c2\u00a0/g, " ").trim();
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  heroTitle,
  heroSubtitle,
  quote,
  bannerImages = [],
}) => {
  const title = typeof heroTitle === "string" ? heroTitle.trim() : "";
  const standardTitle = !title || title === "Your Smart Hub for Property Management"
    || title.replace(/\s+/g, " ") === "Find, Manage and Grow Your Property with PropBank";
  const subtitle = typeof heroSubtitle === "string" ? readableCopy(heroSubtitle) : "";
  const legacySubtitle = /^Manage, list your properties and find your dream house.{0,12}all in one platform$/.test(subtitle);
  const customSubtitle = subtitle && !legacySubtitle;
  const quoteText = typeof quote === "string" ? quote.trim() : "";
  const customQuote = quoteText && quoteText !== "Manage your properties and plan visits with ease";
  const description = customSubtitle ? subtitle : customQuote ? quoteText
    : "Discover exceptional properties and manage every stage of ownership, all in one place.";

  return (
    <section aria-label="Hero" aria-labelledby="homepage-hero-heading" className={styles.hero}>
      <HeroImageCarousel bannerImages={bannerImages} />
      <div className={styles.shell}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}><span aria-hidden="true" />A better way to own property</p>
          <h1 id="homepage-hero-heading" className={styles.heading}>
            {standardTitle ? <>
              <span className={styles.headlineLine}>Find, Manage and</span>{" "}
              <span className={styles.headlineLine}>Grow Your Property</span>{" "}
              <span className={styles.headlineLine}>with <span className={styles.brand}>PropBank</span></span>
            </> : title}
          </h1>
          <p className={styles.description}>{description}</p>
          <div className={styles.actions}>
            <Link to="/properties" className={styles.primary}>Explore Properties<ArrowRight size={18} strokeWidth={1.6} aria-hidden="true" /></Link>
            <Link to="#how-it-works-heading" className={styles.secondary}><Play size={15} strokeWidth={1.6} aria-hidden="true" />How It Works</Link>
          </div>
        </div>
      </div>

    </section>
  );
};
