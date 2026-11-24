"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import styles from "./HeroSection.module.css";

export const HERO_PHOTOGRAPHS = [
  { src: "/images/hero/villa-pool-wide.webp", alt: "Luxury modern villa and swimming pool at sunset", desktop: "62% 0%", mobile: "64% 18%" },
  { src: "/images/hero/residential-towers-wide.webp", alt: "Contemporary residential towers against a bright skyline", desktop: "48% 20%", mobile: "43% 18%" },
  { src: "/images/hero/urban-residences.webp", alt: "Contemporary urban residential buildings with glass balconies", desktop: "50% 0%", mobile: "52% 35%" },
  { src: "/images/hero/luxury-residence.webp", alt: "Luxury hillside residence with glass terraces and an infinity pool", desktop: "45% 0%", mobile: "42% 12%" },
] as const;

/** Timing is isolated from the hero copy and the homepage's search/data state. */
export default function HeroImageCarousel({ bannerImages = [] }: { bannerImages?: string[] }) {
  const configured = Array.isArray(bannerImages) ? bannerImages.filter(src => typeof src === "string" && src.trim()) : [];
  const photographs = configured.length ? configured.map(src => ({ src, alt: "Featured property architecture", desktop: "50% 50%", mobile: "50% 50%" })) : HERO_PHOTOGRAPHS;
  const signature = photographs.map(photo => photo.src).join("|");
  const [selected, setSelected] = useState(0);
  const [loaded, setLoaded] = useState<string[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  // Start paused until the browser's accessibility preference has been read.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hidden, setHidden] = useState(false);
  const index = selected % photographs.length;
  const next = (index + 1) % photographs.length;
  const source = (slide: number) => failed.includes(photographs[slide].src)
    ? HERO_PHOTOGRAPHS[slide % HERO_PHOTOGRAPHS.length].src : photographs[slide].src;
  const nextReady = loaded.includes(source(next));

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    const visibility = () => setHidden(document.hidden);
    update(); visibility();
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (photographs.length < 2 || reducedMotion || hidden || !nextReady) return;
    const timer = window.setInterval(() => setSelected(value => (value + 1) % photographs.length), 3000);
    return () => window.clearInterval(timer);
  }, [signature, photographs.length, index, nextReady, reducedMotion, hidden]);

  return <div className={styles.scene} role="region" aria-roledescription="carousel" aria-label="Property architecture photographs">
    {photographs.map((photo, slide) => <div key={`${slide}-${photo.src}`}
      className={`${styles.frame} ${slide === index ? styles.activeFrame : ""}`} aria-hidden={slide !== index}
      style={{
        "--hero-focal-desktop": (failed.includes(photo.src) ? HERO_PHOTOGRAPHS[slide % HERO_PHOTOGRAPHS.length] : photo).desktop,
        "--hero-focal-mobile": (failed.includes(photo.src) ? HERO_PHOTOGRAPHS[slide % HERO_PHOTOGRAPHS.length] : photo).mobile,
      } as CSSProperties}>
      <Image src={source(slide)} alt={photo.alt} fill preload={slide === 0}
        loading={slide === 0 ? undefined : "eager"} unoptimized={/^https?:\/\//.test(source(slide))}
        sizes="100vw" className={styles.image}
        onLoad={() => setLoaded(previous => previous.includes(source(slide)) ? previous : [...previous, source(slide)])}
        onError={() => setFailed(previous => previous.includes(photo.src) ? previous : [...previous, photo.src])} />
    </div>)}
  </div>;
}
