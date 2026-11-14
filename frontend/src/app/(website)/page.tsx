import CustomSchema from "@/components/CustomSchema";
import Link from "next/link";
import { getContent, getList } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
import { Cards, Empty } from "@/components/Cards";
import { SectionIntro } from "@/components/PageContent";
import TeamContacts from "@/components/TeamContacts";
import { business } from "@/lib/business";
export const generateMetadata = () =>
  pageMetadata(
    "home",
    "Tech Solutions | Development & Digital Marketing",
    "Website development, mobile apps, SEO and performance marketing for your next chapter.",
    "/",
  );
const stages = [
  [
    "Discover",
    "Understand your audience, goals and the problem worth solving.",
  ],
  ["Plan", "Agree on priorities, a practical scope and a clear delivery plan."],
  ["Create", "Design, develop and review the work together at each milestone."],
  ["Grow", "Launch with care, learn from evidence and plan the next move."],
];
export default async function Home() {
  const [{ data: page }, services, portfolio, blogs] = await Promise.all([
    getContent("pages", "home"),
    getList("services", "limit=6"),
    getList("portfolio", "limit=3"),
    getList("blogs", "limit=3"),
  ]);
  const section = (key: string) => page?.sections?.find((s) => s.key === key);
  const reasons = section("why")?.items?.length
    ? section("why")!.items!.map((i) => [i.heading, i.body])
    : [
        [
          "Strategy before a stack",
          "Choose the tools and channels that fit your business, with clear reasons behind each decision.",
        ],
        [
          "Built for the long term",
          "Readable code, useful content and a handover that helps your team keep moving.",
        ],
        [
          "A transparent partnership",
          "Your questions are welcome. Scope, ownership and review milestones stay visible.",
        ],
      ];
  const processItems = section("process")?.items?.length
    ? section("process")!.items!.map((i) => [i.heading, i.body])
    : stages;
  return (
    <>
      <section className="mitra-hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="hero-pill">
              <span /> DIGITAL STRATEGY · CREATIVE · TECHNOLOGY
            </span>
            <h1>Transform Your Digital Presence Into Business Growth.</h1>
            <p>
              From powerful websites to performance-driven digital marketing, we
              help businesses attract customers, build stronger brands and grow
              with confidence.
            </p>
            <div className="hero-actions">
              <Link href="/contact" className="button">
                Get a Free Strategy Call <span aria-hidden>↗</span>
              </Link>
              <Link href="/services" className="button secondary">
                Explore Our Services <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
          <div className="hero-media">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={page?.image || "/media/team-collaboration.jpg"}
              aria-label="Digital agency team collaborating on digital projects"
            >
              <source src="/media/digital-agency.mp4" type="video/mp4" />
            </video>
            <div className="hero-media-overlay" />
            <div className="hero-media-label">
              <span>STRATEGY</span>
              <span>DESIGN</span>
              <span>BUILD</span>
              <span>GROWTH</span>
            </div>
          </div>
        </div>
      </section>
      <div className="expertise-band">
        <div className="container">
          <span>THINK BIG. BUILD WITH PURPOSE.</span>
          <p>
            Websites <i>✳</i> Applications <i>✳</i> Search <i>✳</i> Performance
            marketing
          </p>
        </div>
      </div>
      <section className="section services-home">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">02 / WHAT WE CAN BUILD TOGETHER</span>
              <SectionIntro
                section={section("services")}
                fallback="Built to connect. Designed to move you forward."
              />
            </div>
            <Link href="/services" className="text-link">
              All services ↗
            </Link>
          </div>
          {services.data.length ? (
            <Cards items={services.data} kind="services" />
          ) : (
            <Empty unavailable={services.unavailable} label="services" />
          )}
          <div className="service-disciplines">
            <Link href="/services?category=development">
              Development & technology ↗
            </Link>
            <Link href="/services?category=marketing">Digital marketing ↗</Link>
            <Link href="/services?category=creative">Brand & creative ↗</Link>
          </div>
        </div>
      </section>
      <section className="section container purpose-section">
        <div className="purpose-media">
          <img
            src="/media/team-collaboration.jpg"
            alt="Digital team working together on a purposeful project"
            width="900"
            height="620"
          />
        </div>
        <div className="purpose-copy">
          <span className="eyebrow">03 / ABOUT TECH SOLUTIONS</span>
          <h2>
            Work With Purpose.
            <br />
            Create Meaningful Growth.
          </h2>
          <p>
            Strategy, creativity and technology work best when they move in the
            same direction. We connect every decision to a clear business
            outcome.
          </p>
          <div className="purpose-benefits">
            <div>
              <span>01</span>
              <h3>Strategy Before Execution.</h3>
            </div>
            <div>
              <span>02</span>
              <h3>Creativity With Technology.</h3>
            </div>
            <div>
              <span>03</span>
              <h3>Growth That Matters.</h3>
            </div>
          </div>
          <Link href="/about" className="button">
            Discover our approach <span aria-hidden>↗</span>
          </Link>
        </div>
      </section>
      <section className="section container why-grid">
        <div className="partnership-art">
          <span className="eyebrow">GOOD WORK STARTS WITH GOOD PEOPLE</span>
          <div className="partner-symbol" aria-hidden>
            <span>D</span>
            <span>M</span>
          </div>
          <p>
            Your ambition.
            <br />
            Our thinking.
            <br />
            <strong>A shared direction.</strong>
          </p>
          <span className="art-footer">
            TECH SOLUTIONS <span>↗</span>
          </span>
        </div>
        <div>
          <span className="eyebrow">04 / WHY CHOOSE TECH SOLUTIONS</span>
          <SectionIntro
            section={section("why")}
            fallback="Good partnerships start with clarity."
          />
          {reasons.map(([title, body], i) => (
            <div className="reason" key={title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="section process-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">04 / THE WAY FORWARD</span>
              <SectionIntro
                section={section("process")}
                fallback="A clear path from ambition to action."
              />
            </div>
          </div>
          <div className="process-grid">
            {processItems.map(([title, body], i) => (
              <div key={title}>
                <span className="process-index">
                  0{i + 1}
                  <span aria-hidden>↗</span>
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section work-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">06 / FEATURED PROJECTS</span>
              <SectionIntro
                section={section("projects")}
                fallback="Work with a purpose."
              />
            </div>
            <Link href="/portfolio" className="text-link">
              View portfolio ↗
            </Link>
          </div>
          {portfolio.data.length ? (
            <Cards items={portfolio.data} kind="portfolio" />
          ) : (
            <div className="project-placeholder">
              <div className="project-wireframe" aria-hidden>
                <span />
                <span />
                <span />
                <span />
              </div>
              <div>
                <span className="eyebrow">SPACE FOR OUR NEXT STORY</span>
                <h3>Your project could be the next chapter.</h3>
                <p>
                  Case studies are shared here when the work and client
                  permissions are ready.
                </p>
                <Link href="/contact" className="text-link">
                  Tell us what you have in mind ↗
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
      {blogs.data.length ? (
        <section className="section blog-home">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="eyebrow">07 / FROM THE JOURNAL</span>
                <h2>Ideas for the next move.</h2>
              </div>
              <Link href="/blog" className="text-link">
                View all articles ↗
              </Link>
            </div>
            <Cards items={blogs.data} kind="blogs" />
          </div>
        </section>
      ) : null}
      <section className="container section">
        <h2>Talk to our team</h2>
        <p><a href={`mailto:${business.email}`}>{business.email}</a></p>
        <TeamContacts />
      </section>
      <CustomSchema json={page?.schemaJson} />
    </>
  );
}
