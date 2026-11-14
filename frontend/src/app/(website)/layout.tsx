import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Cta from "@/components/Cta";
import "./shell.css";
import JsonLd from "@/components/JsonLd";
import { getSettings, getList } from "@/lib/api";
import { siteUrl } from "@/lib/seo";
import { business, telephone } from "@/lib/business";
export default async function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [s, services] = await Promise.all([
    getSettings(),
    getList("services", "limit=50"),
  ]);
  const logo = s.logo || "/logo/tech-solution-agency.svg";
  const whatsappMessage =
    "Hello Tech Solutions, I would like to know more about your services.";
  return (
    <>
      <Header logo={s.logo} services={services.data} />
      <main id="main">{children}</main>
      <Cta />
      <Footer />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": s.address ? "ProfessionalService" : "Organization",
          name: s.title,
          url: siteUrl,
          logo: new URL(logo, siteUrl).href,
          contactPoint: business.team.map((member) => ({
            "@type": "ContactPoint",
            name: member.name,
            telephone: telephone(member.phone).slice(4),
            contactType: "customer service",
            areaServed: member.location,
            email: business.email,
          })),
          ...(s.email ? { email: s.email } : {}),
          ...(s.phone ? { telephone: s.phone } : {}),
          ...(s.address ? { address: s.address } : {}),
          sameAs: s.socialLinks || [],
        }}
      />
      {s.whatsapp && (
        <a
          className="whatsapp-contact"
          href={`https://wa.me/${s.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMessage)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with Tech Solutions on WhatsApp"
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path
              fill="currentColor"
              d="M16 3A13 13 0 0 0 5.3 22.8L3 29l6.4-2.2A13 13 0 1 0 16 3Zm7.5 18.5c-.3.8-1.7 1.5-2.4 1.6-.6.1-1.4.2-2.3-.1-.5-.2-1.2-.4-2.1-.8-3.7-1.6-6.1-5.4-6.3-5.7-.2-.3-1.5-2-.1-3.8.3-.4.8-.7 1.1-.7h.8c.2 0 .5-.1.8.6.3.7 1 2.5 1.1 2.7.1.2.1.4 0 .6-.1.2-.2.4-.3.6l-.5.5c-.2.2-.4.4-.2.8.2.4 1 1.7 2.2 2.7 1.5 1.3 2.8 1.7 3.2 1.9.4.2.6.1.8-.1l1-1.2c.3-.4.7-.3 1.1-.2.4.2 2.5 1.2 2.9 1.4.4.2.7.3.8.4.1.2.1.8-.2 1.5Z"
            />
          </svg>
          <span className="whatsapp-tooltip">Chat with us</span>
        </a>
      )}
    </>
  );
}
