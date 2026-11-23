import Image from "next/image";
import { ArrowUpRight, Bell, HousePlus, KeyRound, LayoutGrid, Search, Tag } from "lucide-react";
import { OwnersTenantsSection } from "./OwnersTenantsSection";
import { Property360Showcase } from "./Property360Showcase";
import { Link } from "@/lib/navigation";
import styles from "./PortfolioSections.module.css";

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

export function PropertyManagementSections() {
  return <>
    <OwnersTenantsSection />
    <Property360Showcase />
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
