"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Building2, CalendarDays, ChevronRight, Clock3, Headset, MapPin, MessageCircle, Send, ShieldCheck } from "lucide-react";
import GeneralInquiryForm from "@/features/landing-page/GeneralInquiryForm";
import styles from "./ContactPage.module.css";

const highlights = [
  { icon: Headset, title: "Quick Support" },
  { icon: ShieldCheck, title: "Trusted Service" },
  { icon: Building2, title: "Real Estate Experts" },
];

function InformationCard({ title, icon: Icon, children }: { title: string; icon: typeof MapPin; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const update = () => setExpanded(desktop.matches);
    update(); desktop.addEventListener("change", update);
    return () => desktop.removeEventListener("change", update);
  }, []);
  return <details className={styles.infoCard} open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary><Icon size={21} strokeWidth={1.5} aria-hidden="true" /><span>{title}</span><ChevronRight className={styles.chevron} size={18} aria-hidden="true" /></summary>
    <div className={styles.cardBody}>{children}</div>
  </details>;
}

export default function ContactPage() {
  return <div className={styles.page}>
    <div className={styles.backdrop} aria-hidden="true">
      <Image src="/images/contact/apartment-dusk.webp" alt="" fill preload sizes="100vw" className={styles.photo} />
    </div>
    <header className={styles.intro}>
      <div className={styles.wrap}>
        <p className={styles.eyebrow}><span aria-hidden="true" />Get in touch</p>
        <h1>Contact Us</h1>
        <p className={styles.description}>We're here to help you buy, rent, sell or manage property. Reach out to the PropBank team for any queries, support or collaborations.</p>
        <ul className={styles.highlights}>{highlights.map(({ icon: Icon, title }) => <li key={title}><Icon size={27} strokeWidth={1.4} aria-hidden="true" /><span>{title}</span></li>)}</ul>
      </div>
    </header>
    <section className={styles.content} aria-label="Contact the PropBank team">
      <div className={styles.wrap}>
        <div className={styles.layout}>
          <section id="contact-enquiry" aria-labelledby="contact-form-heading" className={styles.formSide}>
            <h2 id="contact-form-heading">Send Us Your Requirement</h2>
            <p className={styles.helper}>Tell us what you're looking for and our team will get back to you shortly.</p>
            <div className={styles.form}><GeneralInquiryForm hideHeader compact disableDemoAutofill /></div>
          </section>
          <aside className={styles.aside} aria-label="Contact information and office details">
            <InformationCard title="Contact Information" icon={MessageCircle}>
              <Link href="#contact-enquiry" className={styles.contactLink}><Send size={19} aria-hidden="true" /><span>Send your requirement</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link href="/support" className={styles.contactLink}><Headset size={19} aria-hidden="true" /><span>Property and account support</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link href="/faq" className={styles.contactLink}><MessageCircle size={19} aria-hidden="true" /><span>Frequently asked questions</span><ArrowUpRight size={16} aria-hidden="true" /></Link>
            </InformationCard>
            <InformationCard title="Office Hours" icon={Clock3}>
              <p className={styles.availability}><CalendarDays size={21} strokeWidth={1.4} aria-hidden="true" /><span>Share a preferred visit or callback time in the form. Our team will confirm availability with you.</span></p>
            </InformationCard>
            <InformationCard title="Find Us on Map" icon={MapPin}>
              <div className={styles.mapPlaceholder} role="img" aria-label="Office map unavailable until a verified location is published"><MapPin size={32} strokeWidth={1.4} aria-hidden="true" /><span>Office location not published</span></div>
              <p className={styles.mapNote}>Please contact the team before planning an office visit.</p>
            </InformationCard>
          </aside>
        </div>
      </div>
    </section>
    <section className={styles.ctaSection} aria-label="Plan your next property step">
      <div className={styles.cta}>
        <Building2 className={styles.ctaBuilding} size={100} strokeWidth={.8} aria-hidden="true" />
        <div className={styles.ctaCopy}><h2>Prefer to connect with our team directly?</h2><p>Send your requirement or plan a property visit with PropBank.</p></div>
        <div className={styles.ctaActions}>
          <Link href="#contact-enquiry" className={styles.enquiryAction}><Send size={18} aria-hidden="true" />Send an enquiry</Link>
          <Link href="/visit-planner" className={styles.visitAction}><CalendarDays size={18} aria-hidden="true" />Visit Planner</Link>
        </div>
      </div>
    </section>
  </div>;
}
