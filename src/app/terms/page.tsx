import FooterInfoPage from "@/features/footer/FooterInfoPage";

export default function Page() {
  return (
    <FooterInfoPage
      compact
      eyebrow="Terms"
      title="Terms & Conditions"
      description="These terms outline the basic usage expectations for Propbank users and property-related submissions."
      sections={[
        {
          title: "Use Of Platform",
          body: "Users are expected to submit accurate property, tenant, contact, and service request information while using Propbank.",
        },
        {
          title: "Property Information",
          body: "Owners and tenants are responsible for the correctness of details they add, including rent, ownership, agreement, and document information.",
        },
        {
          title: "Service Requests",
          body: "Submitted requests are reviewed by the Propbank team or relevant property stakeholders before further action is taken.",
        },
        {
          title: "Updates",
          body: "Propbank may update these terms as the platform features and service workflows evolve.",
        },
      ]}
    />
  );
}
