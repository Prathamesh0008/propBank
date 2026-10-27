"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight, Building2, CalendarDays, Pause, Play } from "lucide-react";
import { Link } from "@/lib/navigation";
import styles from "./HeroSection.module.css";

interface HeroSectionProps {
  heroTitle: string;
  heroSubtitle: string;
  quote: string;
  bannerImages?: string[];
  currentBannerIndex: number;
  setCurrentBannerIndex: (index: number) => void;
}

export const HeroSection = ({ heroTitle, heroSubtitle, quote, bannerImages = [], currentBannerIndex, setCurrentBannerIndex }: HeroSectionProps) => {
  const [pausedIndex, setPausedIndex] = useState<number | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const respectMotion = () => { if (media.matches) setPausedIndex(0); };
    respectMotion();
    media.addEventListener("change", respectMotion);
    return () => media.removeEventListener("change", respectMotion);
  }, []);

  const isDefaultTitle = !heroTitle || heroTitle === "Your Smart Hub for Property Management";
  const isDefaultSubtitle = !heroSubtitle || heroSubtitle.startsWith("Manage, list your properties");
  const activeIndex = ((pausedIndex ?? currentBannerIndex) % Math.max(bannerImages.length, 1) + bannerImages.length) % Math.max(bannerImages.length, 1);
  const imageCaption = quote && quote !== "Manage your properties and plan visits with ease" ? quote : "Spaces worth looking after.";

  return <section className={styles.hero} aria-labelledby="home-heading">
    <div className={styles.shell}>
      <div className={styles.copy}>
        <p className={styles.intro}><span/> Property ownership, considered.</p>
        <h1 id="home-heading">{isDefaultTitle ? <>Your properties.<br/><em>A clearer perspective.</em></> : heroTitle}</h1>
        <p className={styles.description}>{isDefaultSubtitle ? "Manage multiple properties with confidence. Keep tenants, rent, agreements and documents together, with maintenance and visits in view." : heroSubtitle}</p>
        <div className={styles.actions}><Link to="/manage-property" className={styles.primary}>Manage my properties <ArrowUpRight size={18} aria-hidden="true"/></Link><a href="#find-property" className={styles.secondary}>Find a property <ArrowDown size={16} aria-hidden="true"/></a></div>
        <p className={styles.secondaryNote}>For landlords, investors and portfolio owners.</p>
      </div>
      <figure className={styles.visual}>
        <div className={styles.imageFrame}>
          {bannerImages.length ? <img key={bannerImages[activeIndex]} src={bannerImages[activeIndex]} alt="Featured property architecture" className={styles.heroImage} width={1000} height={1100} fetchPriority="high" onError={event => { if (event.currentTarget.getAttribute("src") !== "/images/portfolio/living.jpg") event.currentTarget.src = "/images/portfolio/living.jpg"; }}/> : <Image src="/images/portfolio/living.jpg" alt="Sunlit apartment living room with warm natural finishes and generous windows" fill sizes="(max-width: 760px) 100vw, 53vw" preload className={styles.heroImage}/>}
        </div>
        <figcaption><span>{imageCaption}</span>{bannerImages.length > 1 && <div className={styles.carousel} role="group" aria-label="Featured property images">{bannerImages.map((_, index) => <button type="button" key={index} aria-label={`Show image ${index + 1}`} aria-pressed={index === activeIndex} onClick={() => { setCurrentBannerIndex(index); if (pausedIndex !== null) setPausedIndex(index); }} className={index === activeIndex ? styles.activeSlide : styles.slide}/>)}<button type="button" className={styles.pause} aria-label={pausedIndex === null ? "Pause image rotation" : "Resume image rotation"} onClick={() => setPausedIndex(pausedIndex === null ? activeIndex : null)}>{pausedIndex === null ? <Pause size={14} aria-hidden="true"/> : <Play size={14} aria-hidden="true"/>}</button></div>}</figcaption>
      </figure>
      <div className={styles.serviceStrip}><div><Building2 size={21} strokeWidth={1.4} aria-hidden="true"/><p><strong>Every property, connected.</strong><span>One workspace for the details that matter.</span></p></div><Link to="/visit-planner"><CalendarDays size={18} strokeWidth={1.5} aria-hidden="true"/> Plan a visit <ArrowUpRight size={16} aria-hidden="true"/></Link><nav aria-label="Explore real estate"><span>Also here for your next move</span><Link to="/buy">Buy</Link><Link to="/sell">Sell</Link><Link to="/rent">Rent</Link></nav></div>
    </div>
  </section>;
};
