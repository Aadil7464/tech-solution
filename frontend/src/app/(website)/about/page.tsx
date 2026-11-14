import CustomSchema from "@/components/CustomSchema";
import { getContent } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
import TeamContacts from "@/components/TeamContacts";
import { SectionIntro, Faqs } from "@/components/PageContent";
export const generateMetadata = () =>
  pageMetadata(
    "about",
    "About Tech Solutions",
    "A practical partner for website development, mobile applications, SEO and digital marketing.",
    "/about",
  );
export default async function About() {
  const { data, unavailable } = await getContent("pages", "about");
  const fallback =
    "<h2>Your digital partner, from idea to impact.</h2><p>Tech Solutions connects strategy, technology, design and marketing to create practical digital experiences. We begin by understanding the business goal, the audience and the constraints that shape the work.</p><h2>Mission and vision</h2><p>Our mission is to make capable digital work understandable and useful for growing businesses. Our vision is a lasting partnership built on clear decisions, responsible delivery and measurable progress.</p><h2>What we do</h2><p>We plan and build websites, applications and e-commerce experiences. We also support search, paid campaigns, social content and brand communication through connected digital programmes.</p>";
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
          <span className="eyebrow">ABOUT TECH SOLUTIONS</span>
          <h1>
            {data?.title ||
              "Technology with purpose. A partnership with perspective."}
          </h1>
          <p>
            {data?.excerpt ||
              "Thoughtful design, dependable development and purposeful digital marketing."}
          </p>
        </div>
      </section>
      <article className="container section prose article-content">
        {unavailable ? (
          <p>Our story is temporarily unavailable. Please try again shortly.</p>
        ) : (
          <>
            <div
              dangerouslySetInnerHTML={{ __html: data?.content || fallback }}
            />
            {data?.image && (
              <img
                className="featured-image"
                src={data.image}
                alt={data.imageAlt || ""}
                width={1000}
                height={600}
              />
            )}
          </>
        )}
        <div className="about-values">
          <div>
            <span>01</span>
            <h2>Discover</h2>
            <p>
              Understand the audience, current context, opportunities and
              practical constraints.
            </p>
          </div>
          <div>
            <span>02</span>
            <h2>Plan</h2>
            <p>
              Set priorities, responsibilities, scope and a clear delivery
              pathway.
            </p>
          </div>
          <div>
            <span>03</span>
            <h2>Create</h2>
            <p>
              Design and build accessible, maintainable experiences with visible
              review points.
            </p>
          </div>
          <div>
            <span>04</span>
            <h2>Grow</h2>
            <p>
              Measure useful outcomes, improve the experience and plan the next
              sensible move.
            </p>
          </div>
        </div>
        {data?.sections?.map((s) => (
          <section key={s.key}>
            <SectionIntro section={s} fallback={s.key} />
          </section>
        ))}
        {data?.faqs?.length ? <Faqs items={data.faqs} /> : null}
      </article>
      <section className="container section">
        <h2>Meet the team</h2>
        <TeamContacts />
      </section>
      <CustomSchema json={data?.schemaJson} />
    </>
  );
}
