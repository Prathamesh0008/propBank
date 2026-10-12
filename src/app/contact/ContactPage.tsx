"use client";

import {
  Building2,
  CalendarDays,
  Clock3,
  Mail,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

import GeneralInquiryForm from "@/features/landing-page/GeneralInquiryForm";

const ContactPage = () => {
  return (
    <main className="min-h-screen bg-white">
      {/* =========================================================
          HERO SECTION
      ========================================================== */}
      <section
        className="relative flex min-h-[260px] items-center justify-center bg-cover bg-center sm:min-h-[320px]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=85')",
        }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-slate-950/65" />

        {/* Slight blue overlay */}
        <div className="absolute inset-0 bg-blue-950/20" />

        <div className="relative z-10 px-4 text-center text-white">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
  Contact <span className="text-white">Propbank</span>
</h1>

          {/* <div className="mt-4 flex items-center justify-center gap-2 text-sm text-white/80">
            <span>Home</span>
            <span>/</span>
            <span className="text-white">Contact Us</span>
          </div> */}
        </div>
      </section>

      {/* =========================================================
          CONTACT SECTION
      ========================================================== */}
      <section className="bg-[#f8f9fb] py-14 sm:py-16 lg:py-20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            {/* =====================================================
                LEFT SIDE - FORM
            ====================================================== */}
            <div>
              <div className="mb-7">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  Send Your Inquiry
                </p>

                <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Tell us what you need
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Fill in your details and tell us whether you want to buy,
                  rent, or sell.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <GeneralInquiryForm hideHeader />
              </div>
            </div>

            {/* =====================================================
                RIGHT SIDE
            ====================================================== */}
            <div>
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  Get in touch
                </p>

                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  How can we help?
                </h2>

                <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
                  Tell us what you are looking for. You can submit a property
                  inquiry and also request a property visit from the same form.
                </p>
              </div>

              {/* Information Cards */}
              <div className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
                {/* Property Assistance */}
                <div className="group flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                    <Building2 className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Property Assistance
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Get help for residential, commercial, or industrial
                      property requirements.
                    </p>
                  </div>
                </div>

                {/* Property Visit */}
                <div className="group flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                    <CalendarDays className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Plan a Property Visit
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Select your preferred property visit date and time
                      directly from the inquiry form.
                    </p>
                  </div>
                </div>

                {/* Quick Response */}
                <div className="group flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                    <Clock3 className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Quick Response
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Our team aims to follow up on inquiries within 24
                      business hours.
                    </p>
                  </div>
                </div>

                {/* Property Support */}
                <div className="group flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Property Support
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Share your buying, renting, selling, or property
                      management requirements with our team.
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="my-8 border-t border-slate-200" />

              {/* Form notification */}
              <div className="flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900">
                    Send your requirement
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Submit the form and your inquiry will be sent to the
                    Propbank team.
                  </p>
                </div>
              </div>

              {/* Extra highlight */}
              <div className="mt-5 flex items-start gap-4 rounded-xl bg-primary p-5 text-primary-foreground shadow-sm">
                <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0" />

                <p className="text-sm leading-6">
                  Looking to buy, rent, sell, manage, or visit a property?
                  Send us your requirement and our team will help you with the
                  next step.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ContactPage;