import FooterInfoPage from "@/features/footer/FooterInfoPage";

export default function Page() {
  return (
    <FooterInfoPage
      eyebrow="Blog"
      title="Property journal"
      description="Practical notes on rental records, property visits and everyday ownership."
      sections={[
        {
          title: "Managing Rental Records",
          body: "Keep rent schedules, tenant details, documents, and service requests updated so property operations stay organized.",
        },
        {
          title: "Planning Property Visits",
          body: "Use visit planning tools to coordinate inspections, reminders, and follow-ups with prospective buyers or tenants.",
        },
        {
          title: "Owner Checklist",
          body: "Before listing a property, prepare photos, unit details, pricing, furnishing information, and contact records.",
        },
        {
          title: "Tenant Checklist",
          body: "Tenants should keep contact details, agreement dates, emergency details, and service request records accurate.",
        },
      ]}
    />
  );
}
