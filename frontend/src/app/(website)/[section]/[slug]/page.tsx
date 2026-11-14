import CustomSchema from "@/components/CustomSchema";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContent, getList } from "@/lib/api";
import { metadataFor, siteUrl } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { Faqs, SectionIntro } from "@/components/PageContent";
import { Cards } from "@/components/Cards";
const kinds: Record<string, string> = {
  services: "services",
  blog: "blogs",
  portfolio: "portfolio",
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string; slug: string }>;
}) {
  const { section, slug } = await params;
  if (!kinds[section]) return {};
  const { data } = await getContent(kinds[section], slug);
  if (!data)
    return {
      title: "Content unavailable",
      robots: { index: false, follow: false },
    };
  const meta = metadataFor(
    data.seoTitle || data.title,
    data.metaDescription || data.excerpt,
    `/${section}/${slug}`,
    data.noindex,
    data.canonicalUrl,
    data.ogTitle,
    data.ogImage,
  );
  return section === "blog"
    ? {
        ...meta,
        openGraph: {
          ...meta.openGraph,
          type: "article" as const,
          publishedTime: data.publishAt || data.createdAt,
          modifiedTime: data.updatedAt,
        },
      }
    : meta;
}
export default async function Detail({
  params,
}: {
  params: Promise<{ section: string; slug: string }>;
}) {
  const { section, slug } = await params;
  if (!kinds[section]) notFound();
  const { data, unavailable } = await getContent(kinds[section], slug);
  if (unavailable && !data)
    throw new Error("Content is temporarily unavailable");
  if (!data) notFound();
  const related =
    section === "services"
      ? await getList(
          "services",
          `limit=50${data.category ? "&category=" + encodeURIComponent(data.category) : ""}`,
        )
      : null;
  const url = siteUrl + `/${section}/${slug}`;
  return (
    <>
      <section className="page-hero container detail-hero">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href={"/" + section}>
            {section === "blog" ? "Blog" : section}
          </Link>
          <span>/</span>
          <span>{data.title}</span>
        </nav>
        <span className="eyebrow">
          {section === "blog"
            ? data.category || "Insights"
            : section === "portfolio"
              ? "Case study"
              : (data.category || "Our expertise") + " / SERVICES"}
        </span>
        <h1>{data.title}</h1>
        <p>{data.excerpt}</p>
        {section === "services" && (
          <div className="hero-actions">
            <Link href="/contact" className="button">
              Get a Free Quote ↗
            </Link>
            <Link href="#service-content" className="text-link">
              Explore the service ↓
            </Link>
          </div>
        )}
        {section === "blog" && (
          <div className="article-meta">
            {data.author && <span>By {data.author}</span>}
            <time dateTime={data.publishAt || data.createdAt}>
              {new Date(data.publishAt || data.createdAt).toLocaleDateString(
                "en-GB",
                { day: "numeric", month: "long", year: "numeric" },
              )}
            </time>
            <span>
              Updated {new Date(data.updatedAt).toLocaleDateString("en-GB")}
            </span>
          </div>
        )}
      </section>
      <div
        className={
          "container " + (section === "services" ? "detail-layout" : "")
        }
      >
        <article id="service-content" className="prose article-content">
          {unavailable && section === "services" && (
            <p className="api-fallback-notice" role="status">
              Live service details are temporarily unavailable. Showing the
              verified service information below.
            </p>
          )}
          {data.image && (
            <img
              className="featured-image"
              src={data.image}
              alt={data.imageAlt || ""}
              width="1000"
              height="600"
            />
          )}
          <div dangerouslySetInnerHTML={{ __html: data.content }} />
          {data.sections?.map((block) => (
            <section key={block.key}>
              <SectionIntro section={block} fallback={block.key} />
            </section>
          ))}
          {data.faqs?.length ? (
            <section>
              <h2>Questions about {data.title.toLowerCase()}</h2>
              <Faqs items={data.faqs} />
            </section>
          ) : null}
          {data.tags && data.tags.length > 0 && (
            <p className="tags">
              {data.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </p>
          )}
          {data.projectUrl && (
            <a
              href={data.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Visit project ↗
            </a>
          )}
          <Link href={data.ctaUrl || "/contact"} className="button">
            {data.cta || "Discuss your next move"} ↗
          </Link>
        </article>
        {section === "services" && (
          <aside className="service-aside">
            <span className="eyebrow">LET’S FIND THE RIGHT SCOPE</span>
            <h2>What are you working towards?</h2>
            <p>
              Share your goals, current setup and questions. We’ll explore how
              this service fits.
            </p>
            <Link className="button" href="/contact">
              Discuss your project ↗
            </Link>
            <p className="small-copy">
              Clear scope. Agreed milestones. A practical handover.
            </p>
          </aside>
        )}
      </div>
      {related && related.data.length > 1 && (
        <section className="container section related-services">
          <h2>Explore connected services</h2>
          <Cards
            items={related.data
              .filter((item) => item.slug !== slug)
              .slice(0, 3)}
            kind="services"
          />
        </section>
      )}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          ...(section === "blog"
            ? {
                "@type": "Article",
                headline: data.title,
                description: data.excerpt,
                datePublished: data.publishAt || data.createdAt,
                dateModified: data.updatedAt,
                author: {
                  "@type": "Organization",
                  name: data.author || "Tech Solutions",
                },
                publisher: {
                  "@type": "Organization",
                  name: "Tech Solutions",
                },
                mainEntityOfPage: url,
                ...(data.image ? { image: data.image } : {}),
              }
            : section === "services"
              ? {
                  "@type": "Service",
                  name: data.title,
                  description: data.excerpt,
                  url,
                  serviceType: data.title,
                  provider: {
                    "@type": "Organization",
                    name: "Tech Solutions",
                    url: siteUrl,
                  },
                }
              : {
                  "@type": "CreativeWork",
                  name: data.title,
                  description: data.excerpt,
                  url,
                }),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
            {
              "@type": "ListItem",
              position: 2,
              name: section,
              item: siteUrl + "/" + section,
            },
            { "@type": "ListItem", position: 3, name: data.title, item: url },
          ],
        }}
      />
      <CustomSchema json={data?.schemaJson} />
    </>
  );
}
