"use client";

import { ArrowUp, ArrowUpRight, Mail, MessageCircle } from "lucide-react";
import { Link } from "@/lib/navigation";
import BrandLogo from "@/features/brand/BrandLogo";
import styles from "./SiteFooter.module.css";

const propertyLinks = [["/manage-property", "Property management"], ["/buy", "Buy"], ["/sell", "Sell"], ["/rent", "Rent"]] as const;
const companyLinks = [["/about", "About"], ["/services", "Services"], ["/blog", "Journal"], ["/faq", "FAQs"]] as const;

export default function SiteFooter() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return <footer className={styles.footer}>
    <div className={styles.inner}>
      <div className={styles.directory}>
        <div className={styles.brandColumn}>
          <Link to="/" className={styles.brand} aria-label="PropBank home"><BrandLogo/></Link>
          <p>Property ownership,<br/>with everything in view.</p>
        </div>
        <nav aria-label="Property links"><h2 className={styles.heading}>Property</h2><ul className={styles.list}>{propertyLinks.map(([to, label]) => <li key={to}><Link to={to}>{label}</Link></li>)}</ul></nav>
        <nav aria-label="Company links"><h2 className={styles.heading}>Company</h2><ul className={styles.list}>{companyLinks.map(([to, label]) => <li key={to}><Link to={to}>{label}</Link></li>)}</ul></nav>
        <div className={styles.contact}><h2 className={styles.heading}>A direct conversation.</h2><Link to="/contact"><Mail size={15} aria-hidden="true"/> Send an enquiry <ArrowUpRight size={14} aria-hidden="true"/></Link><Link to="/support"><MessageCircle size={15} aria-hidden="true"/> Property support</Link></div>
      </div>
      <div className={styles.bottom}>
        <p>© {new Date().getFullYear()} PropBank</p>
        <nav aria-label="Legal links"><Link to="/terms">Terms & conditions</Link><Link to="/privacy">Privacy policy</Link></nav>
        <button type="button" onClick={scrollToTop} aria-label="Back to top"><ArrowUp size={17} aria-hidden="true"/></button>
      </div>
    </div>
  </footer>;
}
