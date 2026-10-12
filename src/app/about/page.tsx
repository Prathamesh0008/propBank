import Link from "next/link";
import { Building2, Check, Eye, Home, MapPinned, Star } from "lucide-react";

const highlights = [
  {
    title: "Luxury Residences",
    icon: Star,
    body: "Premium homes and apartments curated for comfort, location, and long-term value.",
    meta: "Residential",
  },
  {
    title: "Urban Living",
    icon: Building2,
    body: "Modern city properties with practical access to work, transport, and daily essentials.",
    meta: "Commercial",
  },
  {
    title: "Waterfront Homes",
    icon: MapPinned,
    body: "Distinctive lifestyle properties for buyers and tenants looking for something special.",
    meta: "Lifestyle",
  },
];

const projects = [
  {
    title: "Skyline Towers",
    subtitle: "Sophisticated urban living",
  },
  {
    title: "Midtown Lofts",
    subtitle: "Stylish apartment community",
  },
  {
    title: "The Shoreline",
    subtitle: "Waterside luxury lifestyle",
  },
];

export default function Page() {
  return (
    <main className="bg-[#f8fafc] text-slate-900">
      <section className="relative min-h-[620px] overflow-hidden bg-slate-950">
        <img
          src="/assets/hero-realestate.jpg"
          alt="Modern residential development"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-900/35 to-slate-950/10" />

        <div className="relative mx-auto flex min-h-[620px] max-w-7xl flex-col justify-center px-5 py-20 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.28em] text-white/70">
              Propbank
            </p>
            <h1 className="text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
              Modern Living Starts Here.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-white/85">
              Discover premium properties and practical management tools designed
              for owners, tenants, buyers, and agents.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/properties"
                className="inline-flex h-12 items-center justify-center rounded-md bg-[#d0a96f] px-8 text-sm font-bold text-white shadow-lg transition hover:bg-[#bd9457]"
              >
                View Properties
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/45 px-8 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Request Info
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-16 grid max-w-7xl gap-6 px-5 sm:px-8 md:grid-cols-3 lg:px-12">
        {highlights.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.title}
              className="rounded-lg bg-white px-8 py-9 text-center shadow-[0_20px_45px_rgba(15,23,42,0.12)]"
            >
              <Icon className="mx-auto h-10 w-10 text-[#caa66d]" strokeWidth={1.6} />
              <h2 className="mt-7 text-2xl font-bold">{item.title}</h2>
              <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-slate-500">
                {item.body}
              </p>
              <div className="mx-auto mt-6 h-px max-w-40 bg-slate-200" />
              <p className="mt-5 text-xs font-semibold tracking-wide text-slate-500">
                {item.meta}
              </p>
            </article>
          );
        })}
      </section>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:px-12">
        <div className="flex flex-col justify-center">
          <h2 className="text-4xl font-semibold tracking-tight text-slate-900">
            About Propbank
          </h2>
          <p className="mt-7 max-w-xl text-base leading-8 text-slate-600">
            Propbank creates a simpler real estate experience by bringing property
            listings, tenant records, visit planning, documents, and service
            requests into one modern platform.
          </p>
          <Link
            href="/contact"
            className="mt-9 inline-flex h-12 w-fit items-center rounded-md bg-[#d0a96f] px-8 text-sm font-bold text-white shadow-sm transition hover:bg-[#bd9457]"
          >
            Learn More About Us
          </Link>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            <div className="flex gap-4">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d0a96f] text-[#b98d4f]">
                <Eye className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-bold">Trusted Experience</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Clear property workflows for real owners, tenants, and buyers.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-700">
                <Check className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-bold">Practical Quality</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Organized records, enquiries, and property details in one place.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg shadow-sm">
          <img
            src="/assets/hero-realestate.jpg"
            alt="Featured Propbank development"
            className="h-[360px] w-full object-cover sm:h-[440px]"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <h2 className="text-4xl font-semibold tracking-tight text-slate-900">
            Featured Projects
          </h2>
          <Link
            href="/properties"
            className="inline-flex h-12 w-fit items-center justify-center rounded-md border border-slate-300 bg-white px-8 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            View All Developments
          </Link>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {projects.map((project) => (
            <article key={project.title}>
              <div className="overflow-hidden rounded-lg bg-slate-200 shadow-sm">
                <img
                  src="/assets/hero-realestate.jpg"
                  alt={project.title}
                  className="h-56 w-full object-cover transition duration-300 hover:scale-105"
                />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-slate-900">{project.title}</h3>
              <p className="mt-2 text-base text-slate-500">{project.subtitle}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-14 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Home className="h-8 w-8 text-[#d0a96f]" />
            <h2 className="mt-4 text-3xl font-semibold">Ready to find your next property?</h2>
          </div>
          <Link
            href="/contact"
            className="inline-flex h-12 w-fit items-center justify-center rounded-md bg-white px-8 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
          >
            Contact Sales
          </Link>
        </div>
      </section>
    </main>
  );
}
