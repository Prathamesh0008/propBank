"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Link } from "@/lib/navigation";
import styles from "./HeroSection.module.css";

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
  currentBannerIndex,
  setCurrentBannerIndex,
}) => {
  const images = Array.isArray(bannerImages) ? bannerImages.filter(image => typeof image === "string" && image.trim()) : [];
  const [manualIndex, setManualIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failedBanner, setFailedBanner] = useState("");

  useEffect(() => {
    if (images.length < 2 || typeof window.matchMedia !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [images.length]);

  const requestedIndex = manualIndex ?? (reducedMotion ? 0 : currentBannerIndex);
  const index = Math.max(0, Math.min(images.length - 1, Number.isInteger(requestedIndex) ? requestedIndex : 0));
  const banner = images[index];
  const customBanner = banner && banner !== failedBanner;
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
      <div className={styles.scene}>
        {customBanner ? (
          <img src={banner} alt="Featured property architecture" width={1500} height={1000}
            loading="eager" fetchPriority="high" className={styles.image}
            onError={() => setFailedBanner(banner)} />
        ) : (
          <Image src="/images/portfolio/residential.jpg"
            alt="Modern white villa with glass balconies, sunlit terraces and a swimming pool"
            fill preload sizes="(max-width: 767px) 100vw, (min-width: 1775px) 1100px, 62vw" className={styles.image} />
        )}
      </div>
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
      {images.length > 1 ? (
        <div className={styles.carousel} role="group" aria-label="Hero photographs">
          {images.map((_, slide) => (
            <button key={slide} type="button" className={styles.slide}
              aria-label={`Show hero photograph ${slide + 1} of ${images.length}`} aria-pressed={index === slide}
              onClick={() => { setManualIndex(slide); setCurrentBannerIndex(slide); }}
            ><span aria-hidden="true" /></button>
          ))}
          {!reducedMotion ? <button type="button" className={styles.pause}
            aria-label={manualIndex === null ? "Pause hero slideshow" : "Resume hero slideshow"}
            onClick={() => setManualIndex(manualIndex === null ? index : null)}
          >{manualIndex === null ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}</button> : null}
        </div>
      ) : null}
    </section>
  );
};
