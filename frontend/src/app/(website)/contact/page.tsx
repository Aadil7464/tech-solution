import CustomSchema from "@/components/CustomSchema";
import { getList, getSettings, getContent } from "@/lib/api";
import ContactForm from "@/components/ContactForm";
import TeamContacts from "@/components/TeamContacts";
import { pageMetadata } from "@/lib/seo";
import { SectionIntro, Faqs } from "@/components/PageContent";
export const generateMetadata = () =>
  pageMetadata(
    "contact",
    "Contact Tech Solutions",
    "Discuss your website, mobile application or marketing project. Email digitalmitra786@gmail.com or send an enquiry.",
    "/contact",
  );
export default async function Contact() {
  const [services, s, { data: page }] = await Promise.all([
    getList("services", "limit=50"),
    getSettings(),
    getContent("pages", "contact"),
  ]);
  return (
    <>
      <section className="page-hero inner-video-hero">
        <video
          className="page-video"
          autoPlay
          muted
          loop
          playsInline
          poster="/media/team-collaboration.jpg"
          aria-hidden="true"
        >
          <source src="/media/digital-agency.mp4" type="video/mp4" />
        </video>
        <div className="hero-content">
          <span className="eyebrow">LET’S FIND YOUR NEXT MOVE</span>
          <h1>{page?.title || "Let’s build your next chapter."}</h1>
          <p>
            {page?.excerpt ||
              "Tell us what you are working towards. We’ll explore how we could help."}
          </p>
        </div>
      </section>
      <section className="section container contact-grid">
        <div>
          <div className="contact-details">
            <h2>Get in touch</h2>
            {s.email && <a href={"mailto:" + s.email}>{s.email}</a>}
            <TeamContacts compact />
            {s.phone && (
              <a href={"tel:" + s.phone.replace(/[^+\d]/g, "")}>{s.phone}</a>
            )}
            {s.address && <p>{s.address}</p>}
            {s.whatsapp && (
              <a
                className="button"
                href={"https://wa.me/" + s.whatsapp.replace(/\D/g, "")}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat on WhatsApp ↗
              </a>
            )}
          </div>
          <p className="small-copy">
            Our team will review your project enquiry and get in touch.
            <br />
            No mailing list sign-up is required.
          </p>
          {page?.image && (
            <img
              className="section-image"
              src={page.image}
              alt={page.imageAlt || ""}
              width={600}
              height={400}
            />
          )}
        </div>
        <div className="form-panel">
          <h2>Tell us about your project</h2>
          <ContactForm services={services.data} />
        </div>
      </section>
      {page?.content && (
        <article
          className="container prose article-content"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />
      )}
      {page?.sections?.map((block) => (
        <section className="container section" key={block.key}>
          <SectionIntro section={block} fallback={block.key} />
        </section>
      ))}
      {page?.faqs?.length ? (
        <section className="container section">
          <h2>Your questions</h2>
          <Faqs items={page.faqs} />
        </section>
      ) : null}
      <CustomSchema json={page?.schemaJson} />
    </>
  );
}
