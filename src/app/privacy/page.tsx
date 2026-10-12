import FooterInfoPage from "@/features/footer/FooterInfoPage";

export default function Page() {
  return (
    <FooterInfoPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description="Learn how Propbank handles property, account, inquiry, tenant, and service request information."
      sections={[
        {
          title: "Information We Collect",
          body: "Propbank may collect account details, contact information, property details, tenant records, inquiries, and service request data.",
        },
        {
          title: "How We Use Data",
          body: "Information is used to manage property workflows, contact users, process inquiries, and support service requests.",
        },
        {
          title: "Access And Visibility",
          body: "Property, tenant, and service information may be visible to authorized owners, tenants, admins, or relevant support users.",
        },
        {
          title: "Contact",
          body: "For privacy-related questions, use the Contact Us page and include your registered account details.",
        },
      ]}
    />
  );
}
