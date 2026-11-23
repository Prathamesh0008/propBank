"use client";

import { ArrowUp, ArrowUpRight, BadgeCheck, FolderOpen, Mail, MessageCircle, ShieldCheck, Wrench } from "lucide-react";
import BrandLogo from "@/features/brand/BrandLogo";
import { Link } from "@/lib/navigation";
import styles from "./HomepageFooter.module.css";

const benefits = [
  { icon: BadgeCheck, title: "Reviewed public listings", description: "Public listings require administrator approval." },
  { icon: ShieldCheck, title: "Role-based access", description: "Property access follows your authorized relationship." },
  { icon: FolderOpen, title: "Connected property records", description: "Keep tenants, agreements and rent records together." },
  { icon: Wrench, title: "Trackable service requests", description: "Follow recorded updates on property care." },
] as const;
const exploreLinks = [
  ["/properties", "All properties"], ["/buy", "Buy a property"], ["/rent", "Rent a property"],
  ["/sell", "List a property"], ["/properties?projectCondition=New%20Project", "New projects"],
] as const;
const managementLinks = [
  ["/manage-property", "Manage your properties"], ["/manage-property", "Tenants & agreements"],
  ["/manage-property", "Rent & payment records"], ["/services", "Property services"], ["/visit-planner", "Visit planner"],
] as const;
const companyLinks = [
  ["/about", "About PropBank"], ["/blog", "Journal"], ["/faq", "FAQs"],
  ["/contact", "Contact us"], ["/support", "Support"],
] as const;

export default function HomepageFooter() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return <>
    <section id="homepage-trust" className={styles.trust} aria-labelledby="homepage-trust-heading">
      <h2 id="homepage-trust-heading" className={styles.srOnly}>Built around your property</h2>
      <ul className={styles.benefits}>
        {benefits.map(({ icon: Icon, title, description }) => <li key={title}>
          <Icon size={25} strokeWidth={1.4} aria-hidden="true" />
          <div><h3>{title}</h3><p>{description}</p></div>
        </li>)}
      </ul>
    </section>
    <footer id="homepage-footer" className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.directory}>
          <div className={styles.brandColumn}>
            <Link to="/" prefetch={false} className={styles.brand} aria-label="PropBank home"><BrandLogo /></Link>
            <p>Find your next property and keep tenancy, agreements and everyday property care in one place.</p>
            <div className={styles.contact}>
              <Link to="/contact" prefetch={false}><Mail size={15} aria-hidden="true" />Send an enquiry<ArrowUpRight size={14} aria-hidden="true" /></Link>
              <Link to="/support" prefetch={false}><MessageCircle size={15} aria-hidden="true" />Property support</Link>
            </div>
          </div>
          <nav aria-label="Explore properties"><h2 className={styles.heading}>Explore</h2><ul className={styles.list}>
            {exploreLinks.map(([to, label]) => <li key={to}><Link to={to} prefetch={false}>{label}</Link></li>)}
          </ul></nav>
          <nav aria-label="Property management services"><h2 className={styles.heading}>Property Management</h2><ul className={styles.list}>
            {managementLinks.map(([to, label]) => <li key={label}><Link to={to} prefetch={false} title={to === "/manage-property" ? "Choose a property in your authorized workspace" : undefined}>{label}</Link></li>)}
          </ul></nav>
          <nav className={styles.company} aria-label="Company and support"><h2 className={styles.heading}>Company &amp; Support</h2><ul className={styles.list}>
            {companyLinks.map(([to, label]) => <li key={to}><Link to={to} prefetch={false}>{label}</Link></li>)}
          </ul></nav>
        </div>
        <div className={styles.bottom}>
          <p>&copy; {new Date().getFullYear()} PropBank. All rights reserved.</p>
          <nav aria-label="Legal links"><Link to="/privacy" prefetch={false}>Privacy Policy</Link><Link to="/terms" prefetch={false}>Terms &amp; Conditions</Link></nav>
          <button type="button" onClick={scrollToTop} aria-label="Back to top"><ArrowUp size={17} strokeWidth={1.5} aria-hidden="true" /></button>
        </div>
      </div>
    </footer>
  </>;
}
