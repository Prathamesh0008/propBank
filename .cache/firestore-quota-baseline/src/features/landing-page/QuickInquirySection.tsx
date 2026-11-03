"use client";

import Image from "next/image";
import { CalendarDays, MessageSquare } from "lucide-react";
import GeneralInquiryForm from "@/features/landing-page/GeneralInquiryForm";
import styles from "./QuickInquirySection.module.css";

export const QuickInquirySection = () => (
  <section id="quick-inquiry" className={styles.section} aria-labelledby="quick-inquiry-title">
    <div className={styles.shell}>
      <div className={styles.story}>
        <MessageSquare size={24} strokeWidth={1.4} aria-hidden="true" className={styles.icon}/>
        <h2 id="quick-inquiry-title">Let’s talk<br/><em>property.</em></h2>
        <p>Share what you’re looking for or request a visit. Our team will review your enquiry.</p>
        <figure className={styles.photo}><Image src="/images/portfolio/planning.jpg" alt="People reviewing plans and documents together at a table" width={1400} height={934} sizes="(max-width: 850px) 100vw, 40vw"/><figcaption><CalendarDays size={15} aria-hidden="true"/> A conversation is a good place to start.</figcaption></figure>
      </div>
      <div className={styles.form}><GeneralInquiryForm hideHeader/></div>
    </div>
  </section>
);
