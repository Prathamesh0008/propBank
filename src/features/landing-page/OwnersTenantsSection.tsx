import Image from "next/image";
import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "@/lib/navigation";
import styles from "./OwnersTenantsSection.module.css";

const stakeholders = [
  {
    id: "property-owners",
    title: "For Property Owners",
    image: "/images/portfolio/portfolio.jpg",
    imageAlt: "Modern home interior with an open staircase and warm timber finishes",
    benefits: [
      "List and update your properties",
      "Keep tenant details and rent terms together",
      "Organize agreements and renewal dates",
      "Request maintenance and track updates",
    ],
    destination: "/manage-property",
    action: "Manage Your Property",
  },
  {
    id: "tenants",
    title: "For Tenants",
    image: "/images/portfolio/living.jpg",
    imageAlt: "Sunlit living room with comfortable seating, indoor plants and warm neutral finishes",
    benefits: [
      "Discover available rental properties",
      "Schedule and manage property visits",
      "Access your linked property details",
      "Raise service requests for your tenancy",
    ],
    destination: "/rent",
    action: "Find a Home",
  },
] as const;

export function OwnersTenantsSection() {
  return (
    <section id="owners-and-tenants" className={styles.section} aria-labelledby="owners-tenants-heading">
      <div className={styles.shell}>
        <header className={styles.heading}>
          <p>BUILT FOR EVERY STAKEHOLDER</p>
          <h2 id="owners-tenants-heading">Value for Owners and Tenants</h2>
        </header>
        <div className={styles.cards}>
          {stakeholders.map(stakeholder => (
            <article key={stakeholder.id} className={styles.card} aria-labelledby={`${stakeholder.id}-heading`}>
              <div className={styles.photo}>
                {/* Allow enough source pixels for the tall desktop photograph crop. */}
                <Image src={stakeholder.image} alt={stakeholder.imageAlt} fill loading="lazy"
                  sizes="(max-width: 650px) calc(100vw - 40px), 500px" />
              </div>
              <div className={styles.content}>
                <h3 id={`${stakeholder.id}-heading`}>{stakeholder.title}</h3>
                <ul className="m-0 list-none p-0">
                  {stakeholder.benefits.map(benefit => <li key={benefit}><Check size={16} strokeWidth={1.7} aria-hidden="true" /><span>{benefit}</span></li>)}
                </ul>
                <Link to={stakeholder.destination} prefetch={false} className={styles.action}>
                  {stakeholder.action}<ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
