"use client";
import { ArrowUp, ArrowUpRight } from 'lucide-react';
import { Link } from '@/lib/navigation';
import BrandLogo from '@/features/brand/BrandLogo';
import styles from './SiteFooter.module.css';

const information = [['/about', 'About Us'], ['/properties', 'Properties'], ['/buy', 'Buy Property'], ['/rent', 'Rent Property'], ['/sell', 'Sell Property'], ['/contact', 'Contact Us']] as const;
const helpful = [['/services', 'Services'], ['/support', 'Support'], ['/terms', 'Terms & Conditions'], ['/privacy', 'Privacy Policy'], ['/faq', 'FAQs'], ['/blog', 'Blog']] as const;

export default function SiteFooter() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return <footer className={styles.footer}><div className={styles.inner}>
    <div className={styles.opening}>
      <div>
        <Link to="/" className={styles.brand} aria-label="PropBank home"><BrandLogo /></Link>
        <h2 className={styles.statement}>Property is personal.<br />So is our perspective.</h2>
        <p className={styles.intro}>Explore spaces worth calling your own, and manage your property journey with clarity.</p>
      </div>
      <div className={styles.contact}>
        <p className={styles.eyebrow}>A conversation starts here</p>
        <h3 className={styles.contactHeading}>Tell us what you&apos;re looking for.</h3>
        <p className={styles.contactText}>Buying, selling or renting? Our contact page is the right place to begin.</p>
        <Link to="/contact" className={styles.contactAction}>Get in touch <ArrowUpRight className={styles.icon} aria-hidden="true" /></Link>
      </div>
    </div>
    <div className={styles.directory}>
      <nav aria-label="Property and company"><h3 className={styles.heading}>Explore PropBank</h3><ul className={styles.list}>{information.map(([to, label]) => <li key={to}><Link to={to} className={styles.link}>{label}</Link></li>)}</ul></nav>
      <nav aria-label="Help and resources"><h3 className={styles.heading}>Resources</h3><ul className={styles.list}>{helpful.map(([to, label]) => <li key={to}><Link to={to} className={styles.link}>{label}</Link></li>)}</ul></nav>
      <div className={styles.footerMessage}><h3 className={styles.heading}>A better way to move.</h3><p>Find, list and manage property in one place, with the details that matter always within reach.</p></div>
    </div>
    <div className={styles.bottom}><p className={styles.copyright}>&copy; {new Date().getFullYear()} PropBank. All rights reserved.</p>
      <div className={styles.legal}><Link to="/privacy" className={styles.link}>Privacy Policy</Link><Link to="/terms" className={styles.link}>Terms &amp; Conditions</Link><button type="button" className={styles.toTop} onClick={scrollToTop} aria-label="Scroll to top">Back to top <ArrowUp className={styles.icon} aria-hidden="true" /></button></div>
    </div>
  </div></footer>;
}
