import FooterInfoPage from "@/features/footer/FooterInfoPage";

export default function Page() {
  return (
    <FooterInfoPage
      compact
      eyebrow="Support"
      title="How Can We Help?"
      description="Get help with your Propbank account, property listings, tenant records, service requests, and visit planning."
      sections={[
        {
          title: "Account Help",
          body: "If you have trouble signing in or updating your profile, contact the Propbank team with your registered email or phone number.",
        },
        {
          title: "Property Help",
          body: "For property listing, tenant, agreement, or document issues, share the property name or ID when you contact support.",
        },
        {
          title: "Service Requests",
          body: "Use the request services flow from a property page to raise maintenance, legal, document, or related property support requests.",
        },
        {
          title: "Contact Support",
          body: "For direct assistance, use the Contact Us page and send your requirement to the Propbank team.",
        },
      ]}
    />
  );
}
