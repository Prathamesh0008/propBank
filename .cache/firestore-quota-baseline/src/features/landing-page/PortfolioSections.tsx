import Image from "next/image";
import {
  ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays, FolderOpen,
  HousePlus, KeyRound, LayoutGrid, Search, Tag, Wallet, Wrench,
} from "lucide-react";
import { Link } from "@/lib/navigation";
import styles from "./PortfolioSections.module.css";

// Presentation data only. This preview never reads accounts or writes records.
const previewProperties = [
  { name: "The Courtyard", unit: "Flat A-204 · Residential", tenant: "Occupied", rent: "₹32,000", dates: "01 Nov 2026 – 31 Oct 2027", image: "residential" },
  { name: "Meridian House", unit: "Suite 402 · Commercial", tenant: "Occupied", rent: "₹68,000", dates: "01 Dec 2025 – 30 Nov 2026", image: "commercial" },
  { name: "Cedar Residences", unit: "Flat B-801 · Residential", tenant: "Vacant", rent: "₹28,000", dates: "No active agreement", image: "portfolio" },
];
const capabilities = [
  [Building2, "Your portfolio, at a glance", "A clear record of every space, from a single flat to a mixed portfolio."],
  [Wallet, "Tenants & rent", "Keep tenant details, rent terms and deposits with each property."],
  [FolderOpen, "Agreements & notices", "Keep agreements, notices and renewal dates with the right property."],
  [Wrench, "Maintenance & visits", "Keep service requests and scheduled visits in view."],
] as const;
const propertyTypes = [
  { name: "Residential", image: "residential", alt: "Contemporary white home with glass balconies and a pool", detail: "Homes. Apartments. Everyday living." },
  { name: "Commercial", image: "commercial", alt: "Glass office towers viewed from the street", detail: "Spaces built for business." },
  { name: "Industrial", image: "industrial", alt: "High-ceiling warehouse with organized storage aisles", detail: "Room for bigger operations." },
];
const steps = [
  [HousePlus, "Add your properties", "Register and enter your property details."],
  [LayoutGrid, "Organize & manage", "Keep tenants, rent terms, documents and requests together."],
  [Bell, "Stay informed", "Access property updates and relevant notifications."],
] as const;
const services = [
  { to: "/buy", label: "Buy", icon: Search },
  { to: "/sell", label: "Sell", icon: Tag },
  { to: "/rent", label: "Rent", icon: KeyRound },
];

function PortfolioPreview() {
  return (
    <figure className={styles.preview} aria-labelledby="preview-caption">
      <div className={styles.appBar}>
        <span className={styles.appBrand}>prop<span>bank</span><span className={styles.brandDot}>.</span></span>
        <span className={styles.demoLabel}>Illustrative workspace</span>
      </div>
      <div className={styles.appLayout}>
        <div className={styles.appSidebar} aria-hidden="true">
          <span className={styles.sidebarActive}><LayoutGrid size={17}/> Portfolio</span>
          <span><Building2 size={17}/> Properties</span>
          <span><FolderOpen size={17}/> Documents</span>
          <span><CalendarDays size={17}/> Visits</span>
        </div>
        <div className={styles.appMain}>
          <div className={styles.appHeading}><h3>Portfolio overview</h3><span className={styles.appCount}>3 properties</span></div>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Illustrative property portfolio; scroll for agreement details">
            <table className={styles.propertyTable}>
              <caption className={styles.srOnly}>Sample properties, tenant status, monthly rent and agreement dates</caption>
              <thead><tr><th scope="col">Property / unit</th><th scope="col">Tenant status</th><th scope="col">Monthly rent</th><th scope="col">Agreement</th></tr></thead>
              <tbody>
                {previewProperties.map(property => (
                  <tr key={property.name}>
                    <th scope="row"><div className={styles.propertyIdentity}>
                      <Image src={`/images/portfolio/${property.image}.jpg`} width={48} height={52} alt="" sizes="48px"/>
                      <span>{property.name}<small>{property.unit}</small></span>
                    </div></th>
                    <td><span className={property.tenant === "Occupied" ? styles.occupied : styles.vacant}>{property.tenant}</span></td>
                    <td className={styles.rent}>{property.rent}</td>
                    <td>{property.dates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.upcoming}>
            <div><CalendarDays size={14} aria-hidden="true"/><strong>Coming up</strong><span>November 2026</span></div>
            <p><span>05 Nov</span> Rent review <strong>The Courtyard · A-204</strong></p>
            <p><span>30 Nov</span> Agreement renewal <strong>Meridian House · 402</strong></p>
          </div>
        </div>
      </div>
      <figcaption id="preview-caption">Product preview · Fictional properties and sample amounts for illustration only.</figcaption>
    </figure>
  );
}

export function PropertyManagementSections() {
  return <>
    <section className={`${styles.section} ${styles.portfolio}`} aria-labelledby="portfolio-heading">
      <div className={styles.shell}>
        <div className={styles.showcaseHeading}>
          <h2 id="portfolio-heading">A place for<br/><em>every property.</em></h2>
          <div className={styles.showcaseCopy}>
            <p>See what’s occupied, what’s due and what needs your attention.</p>
            <Link to="/manage-property" className={styles.textLink}>Open your workspace <ArrowUpRight size={18} aria-hidden="true"/></Link>
          </div>
        </div>
        <PortfolioPreview/>
      </div>
    </section>
    <section className={`${styles.section} ${styles.capabilities}`} aria-labelledby="capabilities-heading">
      <div className={`${styles.shell} ${styles.editorialSplit}`}>
        <figure className={styles.editorialImage}>
          <Image src="/images/portfolio/portfolio.jpg" alt="Light-filled interior with an open staircase and warm timber finishes" width={1500} height={1000} sizes="(max-width: 760px) 100vw, 45vw"/>
        </figure>
        <div className={styles.capabilityCopy}>
          <h2 id="capabilities-heading">Ownership has details.<br/><em>Keep them in order.</em></h2>
          <div className={styles.capabilityList}>
            {capabilities.map(([Icon, title, copy]) => (
              <article key={title}><Icon size={21} strokeWidth={1.4} aria-hidden="true"/><div><h3>{title}</h3><p>{copy}</p></div></article>
            ))}
          </div>
          <Link to="/manage-property" className={styles.textLink}>Explore property management <ArrowRight size={17} aria-hidden="true"/></Link>
        </div>
      </div>
    </section>
    <section className={`${styles.section} ${styles.types}`} aria-labelledby="property-types-heading">
      <div className={styles.shell}>
        <div className={styles.sectionHeading}>
          <h2 id="property-types-heading">Different spaces.<br/><em>One portfolio.</em></h2>
          <p>From places people call home<br/>to spaces where business grows.</p>
        </div>
        <div className={styles.gallery}>
          {propertyTypes.map((type, index) => (
            <article className={styles.propertyType} key={type.image}>
              <div className={styles.typeImage}>
                <Image src={`/images/portfolio/${type.image}.jpg`} alt={type.alt} width={1200} height={1000} sizes={index === 0 ? "(max-width: 650px) 100vw, 58vw" : "(max-width: 650px) 100vw, 38vw"}/>
              </div>
              <div className={styles.typeCaption}><h3>{type.name}</h3><p>{type.detail}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
    <section className={`${styles.section} ${styles.process}`} aria-labelledby="how-it-works-heading">
      <div className={styles.shell}>
        <h2 id="how-it-works-heading">From setup to everyday care</h2>
        <ol className={styles.steps}>
          {steps.map(([Icon, title, copy]) => (
            <li key={title}><Icon className={styles.stepIcon} size={24} strokeWidth={1.4} aria-hidden="true"/><div><h3>{title}</h3><p>{copy}</p></div></li>
          ))}
        </ol>
      </div>
    </section>
  </>;
}

export function RealEstateIntroduction() {
  return (
    <section className={`${styles.section} ${styles.marketplace}`} aria-labelledby="real-estate-heading">
      <div className={`${styles.shell} ${styles.marketplaceLayout}`}>
        <h2 id="real-estate-heading">Looking for<br/><em>your next space?</em></h2>
        <div className={styles.marketplaceCopy}>
          <p>Buying, selling or renting? Find a property or connect with our team.</p>
          <nav className={styles.marketplaceActions} aria-label="Real estate services">
            {services.map(({ to, label, icon: Icon }) => (
              <Link to={to} key={to}><Icon size={18} strokeWidth={1.4} aria-hidden="true"/>{label}<ArrowUpRight size={20} aria-hidden="true"/></Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

export function PortfolioCallToAction() {
  return (
    <section className={`${styles.section} ${styles.finalCta}`} aria-labelledby="portfolio-cta-heading">
      <div className={`${styles.shell} ${styles.finalLayout}`}>
        <h2 id="portfolio-cta-heading">More Properties.<br/><em>Less Complexity.</em></h2>
        <Link to="/manage-property" className={styles.primary}>Manage my properties <ArrowUpRight size={19} aria-hidden="true"/></Link>
      </div>
    </section>
  );
}
