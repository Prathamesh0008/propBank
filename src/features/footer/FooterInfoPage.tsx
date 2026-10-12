type FooterInfoPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: {
    title: string;
    body: string;
  }[];
};

const FooterInfoPage = ({ eyebrow, title, description, sections }: FooterInfoPageProps) => {
  return (
    <main className="bg-background">
      <section className="border-b bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {description}
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {section.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default FooterInfoPage;
