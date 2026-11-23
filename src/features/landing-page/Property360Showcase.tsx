import { ArrowUpRight, Building2, Check, ChevronRight, FileText, LayoutGrid, Wallet, Wrench } from "lucide-react";
import BrandLogo from "@/features/brand/BrandLogo";
import { Link } from "@/lib/navigation";
import styles from "./Property360Showcase.module.css";

const features = [
  "Property and tenancy overview",
  "Rent records and payment tracking",
  "Agreements and renewal management",
  "Maintenance and service requests",
] as const;

// Static interface illustration only: never mount authenticated dashboard components here.
function WorkspaceIllustration() {
  return (
    <figure className={styles.visual} aria-labelledby="property360-preview-caption">
      <div className={styles.laptop} aria-hidden="true">
        <div className={styles.display}>
          <span className={styles.camera} />
          <div className={styles.screen}>
            <div className={styles.screenBar}><span className={styles.screenBrand}><BrandLogo compact />PropBank</span><span>Property workspace</span><span className={styles.avatar}><Building2 size={12} /></span></div>
            <div className={styles.workspace}>
              <div className={styles.sidebar}>
                <span className={styles.navTitle}>PROPERTY 360</span>
                <span className={styles.selected}><LayoutGrid />Overview</span>
                <span><Building2 />Relationships</span>
                <span><Wallet />Rent ledger</span>
                <span><FileText />Agreement</span>
                <span><FileText />Documents</span>
                <span><Wrench />Maintenance</span>
              </div>
              <div className={styles.workspaceMain}>
                <div className={styles.breadcrumb}>Your properties <ChevronRight /> Property 360</div>
                <div className={styles.workspaceHeading}><strong>Property overview</strong><span>Private workspace</span></div>
                <p className={styles.workspaceDescription}>Select a property to view its records.</p>
                <div className={styles.recordHeadings}><span>Property / Unit</span><span>Tenancy</span><span>Agreement</span></div>
                <div className={styles.blankRecords}><span /><span /><span /></div>
                <div className={styles.ledgerHeading}><Wallet /><strong>Rent ledger</strong><span>Recorded payments</span></div>
                <table className={styles.ledger}>
                  <thead><tr><th>Billing period</th><th>Rent</th><th>Payment status</th></tr></thead>
                  <tbody>{["first", "second"].map(row => <tr key={row}><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>)}</tbody>
                </table>
                <div className={styles.workspaceTools}><span><FileText />Agreements</span><span><Wrench />Service requests</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.base}><span /></div>
      </div>
      <figcaption id="property360-preview-caption">Illustrative Property 360 workspace. No account or payment data shown.</figcaption>
    </figure>
  );
}

export function Property360Showcase() {
  return (
    <section id="property-360-showcase" className={styles.section} aria-labelledby="property360-heading">
      <div className={styles.shell}>
        <WorkspaceIllustration />
        <div className={styles.copy}>
          <p className={styles.eyebrow}>PROPERTY 360</p>
          <h2 id="property360-heading">Manage Your Entire<br className="hidden sm:block" /> Property Portfolio</h2>
          <p className={styles.description}>A unified workspace to manage properties, tenants, agreements, payments and property-related services.</p>
          <ul className="m-0 list-none p-0">
            {features.map(feature => <li key={feature}><Check size={17} strokeWidth={1.7} aria-hidden="true" /><span>{feature}</span></li>)}
          </ul>
          <Link to="/manage-property" prefetch={false} className={styles.action}>Explore Property 360<ArrowUpRight size={17} strokeWidth={1.5} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
