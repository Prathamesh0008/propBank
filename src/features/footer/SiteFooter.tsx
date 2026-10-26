"use client";
import { ArrowUp, ArrowUpRight, Mail, MessageCircle } from 'lucide-react';
import { Link } from '@/lib/navigation';
import BrandLogo from '@/features/brand/BrandLogo';
import styles from './SiteFooter.module.css';

const properties = [['/buy', 'Buy Property'], ['/rent', 'Rent Property'], ['/sell', 'Sell Property']] as const;
const company = [['/about', 'About Us'], ['/services', 'Services'], ['/blog', 'Blog']] as const;
const secondary = [['/terms', 'Terms & Conditions'], ['/privacy', 'Privacy Policy'], ['/faq', 'FAQs']] as const;

export default function SiteFooter() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return <footer className={styles.footer}><div className={styles.inner}>
    <div className={styles.directory}>
      <div className={styles.brandColumn}>
        <Link to="/" className={styles.brand} aria-label="PropBank home"><BrandLogo /></Link>
        <div className={styles.contact}><h3 className={styles.heading}>Contact Us</h3><Link to="/contact" className={styles.contactLink}><Mail className={styles.icon} aria-hidden="true"/>Send an enquiry</Link><Link to="/support" className={styles.contactLink}><MessageCircle className={styles.icon} aria-hidden="true"/>Get property support</Link></div>
      </div>
      <nav aria-label="Property links"><h3 className={styles.heading}>Properties</h3><ul className={styles.list}>{properties.map(([to, label]) => <li key={to}><Link to={to} className={styles.link}>{label}</Link></li>)}</ul></nav>
      <nav aria-label="Company links"><h3 className={styles.heading}>Company</h3><ul className={styles.list}>{company.map(([to, label]) => <li key={to}><Link to={to} className={styles.link}>{label}</Link></li>)}</ul></nav>
      <div className={styles.footerMessage}><h3 className={styles.heading}>A better way to move.</h3><p>Find, list and manage property — all in one place.</p><Link to="/contact" className={styles.primaryAction}>Get in touch <ArrowUpRight className={styles.icon} aria-hidden="true"/></Link><Link to="/blog" className={styles.secondaryAction}>Explore our property notes <ArrowUpRight className={styles.icon} aria-hidden="true"/></Link></div>
    </div>
    <div className={styles.bottom}><p className={styles.copyright}>&copy; 2026 PropBank. All rights reserved.</p><nav className={styles.secondaryLinks} aria-label="Legal and help links">{secondary.map(([to,label])=><Link key={to} to={to} className={styles.secondaryLink}>{label}</Link>)}</nav>
      <button type="button" className={styles.toTop} onClick={scrollToTop} aria-label="Scroll to top"><ArrowUp className={styles.icon} aria-hidden="true" /></button>
    </div>
  </div></footer>;
}
