"use client";

import Image from "next/image";
import GeneralInquiryForm from "@/features/landing-page/GeneralInquiryForm";
import styles from "./QuickInquirySection.module.css";

export const QuickInquirySection = () => (
  <section id="quick-inquiry" className={styles.section} aria-labelledby="quick-inquiry-title">
    <div className={styles.shell}>
      <div className={styles.story}>
        <Image className={styles.photo} src="/images/about-residences.webp" alt="Modern residences with illuminated windows at dusk" fill sizes="(max-width: 700px) 100vw, 45vw"/>
        <div className={styles.storyContent}>
          <span className={styles.eyebrow}>A PROPERTY CONVERSATION</span>
          <h2 id="quick-inquiry-title">Let's Find Your<br/><em>Next Property</em></h2>
          <p>Buying, renting or selling? Tell us what you have in mind. Our team will help you explore the next step.</p>
        </div>
      </div>
      <div className={styles.form}>
        <div className={styles.formHeading}><span>YOUR NEXT MOVE</span><h3>How can we help?</h3></div>
        <GeneralInquiryForm hideHeader disableDemoAutofill compact/>
      </div>
    </div>
  </section>
);
