import Link from "next/link";
import styles from "./FooterInfoPage.module.css";

type FooterInfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: { title: string; body: string }[];
};

export default function FooterInfoPage({ eyebrow, title, description, sections }: FooterInfoPageProps) {
  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>
      </header>
      <section className={styles.sections} aria-label={`${title} information`}>
        <div className={styles.container}>
          {sections.map((section, index) => (
            <article className={styles.entry} key={`${section.title}-${index}`}>
              <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
      <nav className={styles.next} aria-label="Helpful links">
        <div className={styles.container}>
          <div><p className={styles.eyebrow}>Continue exploring</p><h2>Find the right next step.</h2></div>
          <div className={styles.links}><Link href="/properties">Explore properties <span aria-hidden="true">↗</span></Link><Link href="/contact">Contact PropBank <span aria-hidden="true">↗</span></Link></div>
        </div>
      </nav>
    </main>
  );
}
