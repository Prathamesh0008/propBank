"use client";

import { ArrowUpRight } from "lucide-react";
import GeneralInquiryForm from "@/features/landing-page/GeneralInquiryForm";
import styles from "./QuickInquirySection.module.css";

export const QuickInquirySection: React.FC = () => (
  <section id="quick-inquiry" className={styles.section} aria-labelledby="quick-inquiry-title">
    <div className={styles.shell}>
      <div className={styles.story}>
        <span className={styles.eyebrow}>A conversation starts here</span>
        <h2 id="quick-inquiry-title">The right property begins with the <em>right questions.</em></h2>
        <p>Looking to buy, rent or sell? Tell us what matters to you. Your enquiry reaches the PropBank team so the conversation can begin.</p>
        <div className={styles.notes}>
          <div><span>01</span><p>Tell us what you are looking for.</p></div>
          <div><span>02</span><p>Share your preferred contact details.</p></div>
          <div><span>03</span><p>Request a visit if you already have a date in mind.</p></div>
        </div>
        <span className={styles.arrow} aria-hidden="true"><ArrowUpRight size={30}/></span>
      </div>
      <div className={styles.form}><GeneralInquiryForm hideHeader={true}/></div>
    </div>
  </section>
);
