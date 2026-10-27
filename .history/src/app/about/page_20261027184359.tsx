<<<<<<< HEAD
﻿import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Building2, Check, KeyRound, ShieldCheck, Star } from "lucide-react";
import styles from "./About.module.css";

export const metadata: Metadata = {
  title: "About PropBank | Find, List & Manage Property",
  description: "Get to know PropBank: a clearer way for buyers, tenants, owners, and agents to discover, list, and manage property.",
};

const features = [
  { icon: Star, title: "Find your place", body: "Explore homes for sale and rent, with information to help you narrow your options.", detail: "Discover. Compare. Enquire.", href: "/properties" },
  { icon: Building2, title: "List with confidence", body: "Submit your property details, manage edits, and follow the listing review process.", detail: "Your property, thoughtfully presented.", href: "/sell" },
  { icon: KeyRound, title: "Keep life organized", body: "Bring tenancy, visits, documents, and service requests together in one workspace.", detail: "A little more clarity, every day.", href: "/manage-property" },
];

const collections = [
  { title: "A place to call your own", description: "Explore homes for your next chapter.", href: "/buy", src: "/images/about-residences.webp", alt: "Architectural illustration of contemporary apartments with warmly lit windows", position: "66% center", label: "Explore homes" },
  { title: "A new perspective", description: "Find a rental that fits the way you live.", href: "/rent", src: "/assets/hero-realestate.jpg", alt: "City skyline and residential neighbourhood at dusk", position: "center", label: "Find a rental" },
  { title: "Property, brought together", description: "Take care of what happens after move-in.", href: "/manage-property", src: "/images/about-residences.webp", alt: "Illustrative modern residential building surrounded by landscaped greenery", position: "right center", label: "Manage property" },
];

export default function Page() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="about-heading">
        <Image src="/images/about-residences.webp" alt="" fill preload sizes="100vw" className={styles.heroImage} />
        <div className={styles.heroShade} />
        <div className={styles.container}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Welcome to PropBank</p>
            <h1 id="about-heading">Your next chapter<br />starts here.</h1>
            <p>Discover a place to call your own.<br />And a clearer way to manage the journey.</p>
            <div className={styles.actions}>
              <Link href="/properties" className={styles.primary}>Explore properties <ArrowUpRight size={16} aria-hidden="true" /></Link>
              <Link href="/contact" className={styles.heroButton}>Get in touch <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.features}`} aria-label="What you can do with PropBank">
        {features.map(({ icon: Icon, title, body, detail, href }) => (
          <Link href={href} key={title} className={styles.feature}>
            <Icon size={30} strokeWidth={1.3} className={styles.featureIcon} aria-hidden="true" />
            <h2>{title}</h2>
            <p>{body}</p>
            <span className={styles.featureDetail}>{detail}<ArrowUpRight size={14} aria-hidden="true" /></span>
          </Link>
        ))}
      </section>

      <section className={`${styles.container} ${styles.story}`} aria-labelledby="story-heading">
        <div className={styles.storyCopy}>
          <p className={styles.eyebrow}>People. Property. Possibility.</p>
          <h2 id="story-heading">About PropBank</h2>
          <p className={styles.storyLead}>Property is personal. So is our perspective.</p>
          <p>PropBank brings property discovery and everyday management into one place, helping buyers, tenants, owners, and agents take their next step with more clarity.</p>
          <p>From exploring listings to arranging visits and keeping records organized, we connect the details that make a property journey easier to follow.</p>
          <Link href="/services" className={styles.primary}>Explore what we do <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <div className={styles.values}>
            <div><ShieldCheck size={20} strokeWidth={1.5} aria-hidden="true" /><div><h3>Clear information</h3><p>Property details and listing review, with next steps in view.</p></div></div>
            <div><Check size={20} strokeWidth={1.5} aria-hidden="true" /><div><h3>Connected workflows</h3><p>Enquiries, offers, and owner decisions in a recorded journey.</p></div></div>
          </div>
        </div>
        <figure className={styles.storyVisual}>
          <div className={styles.storyImage}>
            <Image src="/images/about-residences.webp" alt="Architectural illustration of a contemporary residential community at blue hour" fill sizes="(max-width: 760px) 100vw, 560px" />
          </div>
          <figcaption>Real estate, considered. Architectural illustration.</figcaption>
        </figure>
      </section>

      <section className={`${styles.container} ${styles.collections}`} aria-labelledby="collection-heading">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>Find your next step</p><h2 id="collection-heading">Spaces for your next chapter.</h2></div>
          <Link href="/properties" className={styles.outline}>View all properties <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className={styles.collectionGrid}>
          {collections.map(({ title, description, href, src, alt, position, label }) => (
            <Link href={href} key={title} className={styles.collection}>
              <div className={styles.collectionImage}>
                <Image src={src} alt={alt} fill sizes="(max-width: 760px) 100vw, (max-width: 1200px) 33vw, 370px" style={{ objectPosition: position }} />
                <span className={styles.collectionArrow}><ArrowUpRight size={18} aria-hidden="true" /></span>
              </div>
              <h3>{title}</h3><p>{description}</p><span className={styles.collectionLabel}>{label} <ArrowUpRight size={13} aria-hidden="true" /></span>
            </Link>
          ))}
        </div>
        <p className={styles.imageNote}>Images illustrate different ways to live. Explore live listings for property details and availability.</p>
      </section>
    </div>
  );
=======
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Building2, FolderOpen, KeyRound, MessagesSquare } from "lucide-react";
import styles from "./About.module.css";

const capabilities = [
  { icon: Building2, title: "Manage your portfolio", body: "Keep property details, tenants, rent terms and maintenance requests connected as your portfolio grows." },
  { icon: FolderOpen, title: "Keep a clear record", body: "Access agreements, notices, documents and visit records alongside the property they belong to." },
  { icon: KeyRound, title: "Find your next space", body: "Explore sale and rental listings with photography, property information and focused search filters." },
  { icon: MessagesSquare, title: "Move things forward", body: "Submit a listing for review, arrange a visit or follow up with the team on an enquiry." },
];

export default function Page() {
  return <div className={styles.page}>
    <header className={styles.intro}><div className={styles.wrap}>
      <h1>Property deserves<br/><em>a considered approach.</em></h1>
      <p className={styles.lead}>We bring the everyday details of ownership into focus, helping landlords and investors manage their properties and plan their next move.</p>
      <div className={styles.actions}><Link href="/manage-property" className={styles.primary}>Manage my properties <ArrowUpRight size={17} aria-hidden="true"/></Link><Link href="/contact" className={styles.secondary}>Get in touch <ArrowUpRight size={17} aria-hidden="true"/></Link></div>
    </div></header>
    <section className={styles.statement} aria-labelledby="about-approach"><div className={`${styles.wrap} ${styles.statementLayout}`}><Image src="/images/portfolio/portfolio.jpg" alt="Contemporary interior with natural materials and open living spaces" width={1500} height={1000} sizes="(max-width: 720px) 100vw, 50vw"/><h2 id="about-approach">Built around ownership.<br/><em>Ready for what’s next.</em></h2></div></section>
    <section className={styles.capabilities} aria-label="Our services"><div className={styles.wrap}>{capabilities.map(({ icon: Icon, title, body }) => <article className={styles.item} key={title}><Icon size={23} strokeWidth={1.4} aria-hidden="true"/><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className={styles.closing}><div className={styles.wrap}><h2>Your portfolio.<br/>Your next possibility.</h2><div className={styles.actions}><Link href="/manage-property" className={styles.primary}>Manage properties <ArrowUpRight size={17} aria-hidden="true"/></Link><Link href="/search" className={styles.secondary}>Explore listings <ArrowUpRight size={17} aria-hidden="true"/></Link></div></div></section>
  </div>;
>>>>>>> feature/property-management-improvements
}
