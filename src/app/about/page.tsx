import Link from "next/link";
import styles from "./About.module.css";

const capabilities = [
  { number: "01", title: "Discover property", body: "Explore sale and rental listings with property information, photography, and search filters to help narrow your options." },
  { number: "02", title: "List with review", body: "Owners can submit property information, manage edits, and follow the listing approval process before a property becomes public." },
  { number: "03", title: "Stay organized", body: "Connected property records bring together tenancy, visit planning, documents, service requests, and agreement workflows." },
  { number: "04", title: "Follow up clearly", body: "Enquiries, broker assignment, offers, and owner decisions follow recorded workflows with clear next steps." },
];

export default function Page() {
  return <main className={styles.page}>
    <header className={styles.intro}>
      <div className={styles.wrap}>
        <p className={styles.label}>About PropBank</p>
        <h1>Property decisions, <em>made clearer.</em></h1>
        <p className={styles.lead}>PropBank brings property discovery and everyday property management into one place—so buyers, tenants, owners, and agents can take the next step with more clarity.</p>
        <div className={styles.actions}><Link href="/properties" className={styles.primary}>Explore properties <span aria-hidden="true">↗</span></Link><Link href="/contact" className={styles.secondary}>Get in touch <span aria-hidden="true">↗</span></Link></div>
      </div>
    </header>
    <section className={styles.statement} aria-labelledby="about-approach"><div className={styles.wrap}><p className={styles.label}>Our approach</p><h2 id="about-approach">More than a listing. <span>A clearer way to manage what happens next.</span></h2></div></section>
    <section className={styles.capabilities} aria-label="What you can do with PropBank"><div className={styles.wrap}>{capabilities.map((item)=><article className={styles.item} key={item.number}><span>{item.number}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></section>
    <section className={styles.closing}><div className={styles.wrap}><p className={styles.label}>Where to begin</p><h2>Find a property or manage yours.</h2><div className={styles.actions}><Link href="/search" className={styles.primary}>Search listings ↗</Link><Link href="/manage-property" className={styles.secondary}>Manage property ↗</Link></div></div></section>
  </main>;
}
