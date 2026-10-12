import FooterInfoPage from "@/features/footer/FooterInfoPage";

export default function Page() {
  return (
    <FooterInfoPage
      eyebrow="Services"
      title="Property Services"
      description="Explore Propbank services for managing, renting, selling, and maintaining property records."
      sections={[
        {
          title: "Property Management",
          body: "Manage property details, tenants, documents, inspection reports, and service requests from one place.",
        },
        {
          title: "Rental Support",
          body: "Track tenant information, rent schedules, agreement renewals, and termination requests with a structured workflow.",
        },
        {
          title: "Owner Assistance",
          body: "Add and maintain listings for residential, commercial, and industrial properties with complete ownership details.",
        },
        {
          title: "Tenant Assistance",
          body: "Submit tenant property details, request services, plan visits, and connect with the Propbank team.",
        },
      ]}
    />
  );
}
