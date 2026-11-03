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
}
