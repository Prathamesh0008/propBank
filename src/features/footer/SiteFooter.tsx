"use client";
import {Mail,Phone,MapPin,ArrowUp} from 'lucide-react';
import {Link} from '@/lib/navigation';
import BrandLogo from '@/features/brand/BrandLogo';
import styles from './SiteFooter.module.css';
const information=[['/about','About Us'],['/properties','Properties'],['/buy','Buy Property'],['/rent','Rent Property'],['/sell','Sell Property'],['/contact','Contact Us']];
const helpful=[['/services','Services'],['/support','Support'],['/terms','Terms & Conditions'],['/privacy','Privacy Policy'],['/faq','FAQs'],['/blog','Blog']];
export default function SiteFooter(){
 const scrollToTop=()=>window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 return <footer className={styles.footer}><div className={styles.inner}>
  <div className={styles.opening}><div><Link to="/" className={styles.brand} aria-label="Propbank Home"><BrandLogo/></Link><h2 className={styles.statement}>Property is personal.<br/>So is our perspective.</h2><p className={styles.intro}>Your go-to hub for buying, selling, and renting properties. Discover verified properties and find the right space for you.</p></div>
   <div className={styles.contact}><p className={styles.eyebrow}>Let&apos;s find your place</p><a className={styles.contactLink} href="mailto:support@propbank.com"><Mail className={styles.icon} aria-hidden="true"/>support@propbank.com</a><a className={styles.contactLink} href="tel:+919999999999"><Phone className={styles.icon} aria-hidden="true"/>+91 99999 99999</a><p className={styles.location}><MapPin className={styles.icon} aria-hidden="true"/>Mumbai, Maharashtra, India</p></div>
  </div>
  <div className={styles.directory}><nav aria-label="Property and company"><h3 className={styles.heading}>Information</h3><ul className={styles.list}>{information.map(([to,label])=><li key={to}><Link to={to} className={styles.link}>{label}</Link></li>)}</ul></nav><nav aria-label="Help and resources"><h3 className={styles.heading}>Helpful Links</h3><ul className={styles.list}>{helpful.map(([to,label])=><li key={to}><Link to={to} className={styles.link}>{label}</Link></li>)}</ul></nav>
   <div className={styles.newsletter}><h3 className={styles.heading}>Stay Updated</h3><p className={styles.newsletterText}>Property updates and real-estate perspectives, in good time.</p><div className={styles.subscribeRow}><input className={styles.email} type="email" disabled aria-label="Newsletter email (subscriptions unavailable)" title="Newsletter subscriptions are not available yet." placeholder="Enter your email"/><button className={styles.subscribe} type="button" disabled title="Newsletter subscriptions are not available yet.">Subscribe</button></div><p className={styles.note}>Newsletter subscriptions are not available yet. Social channels are not configured.</p><div className={styles.social}>{['Facebook','Instagram','LinkedIn','X'].map(name=><a key={name} className={styles.socialLink} aria-label={name} aria-disabled="true" tabIndex={-1} title="Social link is not configured.">{name}</a>)}</div></div>
  </div>
  <div className={styles.bottom}><p className={styles.copyright}>&copy; {new Date().getFullYear()} PropBank. All rights reserved.</p><div className={styles.legal}><Link to="/privacy" className={styles.link}>Privacy Policy</Link><Link to="/terms" className={styles.link}>Terms & Conditions</Link><button type="button" className={styles.toTop} onClick={scrollToTop} aria-label="Scroll to top">Back to top<ArrowUp className={styles.icon} aria-hidden="true"/></button></div></div>
 </div></footer>;
}
