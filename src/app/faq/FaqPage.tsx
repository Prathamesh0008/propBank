"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";

const faqs = [
  {
    question: "How do I add a property?",
    answer:
      "Go to Manage Property, choose Add Property, select whether you are adding as an owner or tenant, then select the property type and complete the details.",
  },
  {
    question: "How do tenants appear in my account?",
    answer:
      "Tenant properties appear when a tenant is added to an active property record with matching tenant details.",
  },
  {
    question: "Can I request a property visit?",
    answer:
      "Yes. Use Visit Planner or the property enquiry option to share your preferred visit details with the Propbank team.",
  },
  {
    question: "Where do service requests go?",
    answer:
      "Service requests are sent into the admin and property management workflow for review and follow-up.",
  },
  {
    question: "Can I browse buy and rent properties separately?",
    answer:
      "Yes. Use the buy and rent filters on the property search page to narrow the listings to your requirement.",
  },
  {
    question: "How do I contact Propbank support?",
    answer:
      "Use the Contact Us page or the contact section on the home page to share your requirement with the team.",
  },
];

export default function FaqPage() {
  const [openItem, setOpenItem] = useState("faq-1");

  return (
    <main className="bg-[#b8bcc2] px-4 py-10 sm:py-14">
      <section className="mx-auto max-w-5xl bg-white px-5 py-10 shadow-sm sm:px-10 md:px-16 lg:px-24">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Frequently Asked <span className="text-[#0B6FF0]">Questions</span>
        </h1>

        <div className="mx-auto mt-8 max-w-3xl space-y-4">
          {faqs.map((faq, index) => {
            const id = `faq-${index}`;
            const isOpen = openItem === id;

            return (
              <div
                key={faq.question}
                className="rounded-lg border border-slate-100 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
              >
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`${id}-answer`}
                  onClick={() => setOpenItem(isOpen ? "" : id)}
                >
                  <span className="text-sm font-semibold text-slate-950">
                    {faq.question}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0B6FF0] text-white shadow-sm">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                    />
                  </span>
                </button>

                <div
                  id={`${id}-answer`}
                  className={cn(
                    "grid overflow-hidden transition-all duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="min-h-0">
                    <p className="px-4 pb-4 text-xs leading-5 text-slate-500 sm:text-sm">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-9 flex justify-center">
          <Button className="h-10 rounded-full bg-[#0B6FF0] px-7 text-xs font-semibold text-white shadow-md hover:bg-[#095DCA]">
            Learn More
          </Button>
        </div>
      </section>
    </main>
  );
}
