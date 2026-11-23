import { ArrowUpRight, Building2, UsersRound, Wallet, Wrench } from "lucide-react";
import { Link } from "@/lib/navigation";
import styles from "./PropertyManagementServices.module.css";

// Property-specific actions are selected inside the existing authorized workspace.
const services = [
  { title: "Tenant Management", description: "Keep tenant details, agreements and renewal dates together.", icon: UsersRound },
  { title: "Rent & Payments", description: "Review rent schedules and recorded payments for each property.", icon: Wallet },
  { title: "Property Maintenance", description: "Raise service requests and follow updates on property care.", icon: Wrench },
  { title: "Portfolio Insights", description: "Review your property records and tenancy status in one place.", icon: Building2 },
] as const;

export function PropertyManagementServices() {
  return (
    <section id="property-management-services" aria-labelledby="management-services-heading" className={styles.section}>
      <div className={styles.shell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>PROPERTY MANAGEMENT</p>
          <h2 id="management-services-heading">More Than a<br className="hidden sm:block" /> Listing Platform</h2>
          <p className={styles.description}>Keep tenants, rent records and property care together in one workspace.</p>
          <Link to="/services" prefetch={false} className={styles.explore}>Explore Services <ArrowUpRight size={17} strokeWidth={1.5} aria-hidden="true" /></Link>
        </div>
        <ul className={styles.services} aria-label="Property management services">
          {services.map(({ title, description, icon: Icon }) => (
            <li key={title} className={styles.service}>
              <Link to="/manage-property" prefetch={false} className="flex h-full min-w-0 flex-col items-start" aria-label={`${title}: open your property workspace`}>
                <Icon className={styles.icon} size={32} strokeWidth={1.3} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
