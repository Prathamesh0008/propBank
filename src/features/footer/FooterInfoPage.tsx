import Link from "next/link";
import styles from "./FooterInfoPage.module.css";

type FooterInfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: { title: string; body: string }[];
};

export default function FooterInfoPage({ title, description, sections }: FooterInfoPageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <div className={styles.container}>

          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
      </header>
      <section className={styles.sections} aria-label={`${title} information`}>
        <div className={styles.container}>
          {sections.map((section, index) => (
            <article className={styles.entry} key={`${section.title}-${index}`}>

              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
      <nav className={styles.next} aria-label="Helpful links">
        <div className={styles.container}>
          <div><h2>Find the right next step.</h2></div>
          <div className={styles.links}><Link href="/properties">Explore properties <span aria-hidden="true">↗</span></Link><Link href="/contact">Contact us <span aria-hidden="true">↗</span></Link></div>
        </div>
      </nav>
    </div>
  );
}
