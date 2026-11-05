import CustomSchema from "@/components/CustomSchema";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getList, getContent } from "@/lib/api";
import { Cards, Empty } from "@/components/Cards";
import Cta from "@/components/Cta";
import { metadataFor, pageMetadata } from "@/lib/seo";
import { SectionIntro, Faqs } from "@/components/PageContent";
const sections: Record<
  string,
  { kind: string; title: string; desc: string; label: string }
> = {
  services: {
    kind: "services",
    title: "Digital Solutions Designed to Move Your Business Forward.",
    desc: "Explore our development, marketing and creative services designed to strengthen your digital presence.",
    label: "Digital solutions",
  },
  portfolio: {
    kind: "portfolio",
    title: "Work with a purpose.",
    desc: "Approved projects and the thinking behind them.",
    label: "Portfolio",
  },
  blog: {
    kind: "blogs",
    title: "Ideas for the next move.",
    desc: "Practical perspectives on technology, design and digital growth.",
    label: "Blog",
  },
};
type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ page?: string; category?: string }>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const { section } = await params;
  const s = sections[section];
  if (!s) {
    const { data } = await getContent("pages", section);
    return data
      ? metadataFor(
          data.seoTitle || data.title,
          data.metaDescription || data.excerpt,
          "/" + section,
          data.noindex,
          data.canonicalUrl,
          data.ogTitle,
          data.ogImage,
        )
      : { title: "Page not found", robots: { index: false, follow: false } };
  }
  const query = await searchParams;
  const page = Math.max(1, parseInt(query.page || "1") || 1);
  if (page > 1 || query.category)
    return metadataFor(
      s.label +
        (query.category ? " — " + query.category : "") +
        (page > 1 ? ` — Page ${page}` : ""),
      s.desc,
      "/" +
        section +
        (query.category
          ? "?category=" +
            encodeURIComponent(query.category) +
            (page > 1 ? "&page=" + page : "")
          : page > 1
            ? "?page=" + page
            : ""),
    );
  return pageMetadata(section, s.label, s.desc, "/" + section);
}
export default async function Listing({ params, searchParams }: Props) {
  const { section } = await params;
  const s = sections[section];
  if (!s) {
    const { data, unavailable } = await getContent("pages", section);
    if (unavailable) throw new Error("Page content is temporarily unavailable");
    if (!data || section === "home") notFound();
    return (
      <>
        <section className="page-hero container">
          <h1>{data.title}</h1>
          <p>{data.excerpt}</p>
        </section>
        <article className="container prose article-content">
          {data.image && (
            <img
              className="featured-image"
              src={data.image}
              alt={data.imageAlt || ""}
              width={1000}
              height={600}
            />
          )}
          <div dangerouslySetInnerHTML={{ __html: data.content }} />
          {data.sections?.map((block) => (
            <section key={block.key}>
              <SectionIntro section={block} fallback={block.key} />
            </section>
          ))}
          <Faqs items={data.faqs || []} />
        </article>
        <Cta />
        <CustomSchema json={data?.schemaJson} />
      </>
    );
  }
  const query = await searchParams;
  const page = Math.max(1, parseInt(query.page || "1") || 1);
  const category = query.category || "";
  const [result, categories, { data: cms }] = await Promise.all([
    getList(
      s.kind,
      `page=${page}&limit=${section === "services" ? 24 : 9}${category ? "&category=" + encodeURIComponent(category) : ""}`,
    ),
    section === "blog"
      ? getList("categories", "limit=50")
      : Promise.resolve(null),
    getContent("pages", section),
  ]);
  if (!result.unavailable && page > 1 && page > result.pagination.pages)
    notFound();
  const href = (p: number) =>
    `/${section}?page=${p}${category ? "&category=" + encodeURIComponent(category) : ""}`;
  return (
    <>
      <section
        className={`page-hero inner-video-hero${section === "services" ? " services-page-hero" : ""}`}
      >
        <video
          className="page-video"
          autoPlay
          muted
          loop
          playsInline
          poster={
            section === "portfolio"
              ? "/media/creative-design.jpg"
              : section === "blog"
                ? "/media/digital-marketing.jpg"
                : "/media/team-collaboration.jpg"
          }
          aria-hidden="true"
        >
          <source src="/media/digital-agency.mp4" type="video/mp4" />
        </video>
        <div className="hero-content">
          <span className="eyebrow">{s.label}</span>
          <h1>{section === "services" ? s.title : cms?.title || s.title}</h1>
          <p>{section === "services" ? s.desc : cms?.excerpt || s.desc}</p>
        </div>
      </section>
      <section className="container section listing-section">
        {section === "services" && (
          <nav className="category-nav" aria-label="Service disciplines">
            {[
              ["", "All Services"],
              ["development", "Development & Technology"],
              ["marketing", "Digital Marketing"],
              ["creative", "Brand & Creative"],
            ].map(([value, label]) => (
              <Link
                key={value}
                href={"/services" + (value ? "?category=" + value : "")}
                aria-current={category === value ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        {result.unavailable &&
          result.data.some((item) =>
            item._id.startsWith("fallback-service-"),
          ) && (
            <div className="api-fallback-notice" role="status">
              Live service data is temporarily unavailable. Showing the verified
              service catalogue below.
            </div>
          )}
        {categories && categories.data.length > 0 && (
          <nav className="category-nav" aria-label="Article categories">
            <Link href="/blog">All articles</Link>
            {categories.data.map((c) => (
              <Link key={c._id} href={"/blog/category/" + c.slug}>
                {c.title}
              </Link>
            ))}
          </nav>
        )}
        {cms?.content && (
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: cms.content }}
          />
        )}
        {result.data.length ? (
          <Cards items={result.data} kind={s.kind} />
        ) : (
          <Empty
            unavailable={result.unavailable}
            label={
              section === "portfolio"
                ? "approved case studies"
                : section === "blog"
                  ? "articles"
                  : "services"
            }
          />
        )}
        <div className="pagination">
          {page > 1 && (
            <Link className="button secondary" href={href(page - 1)}>
              ← Previous
            </Link>
          )}
          {result.pagination.pages > 1 && (
            <span>
              Page {page} of {result.pagination.pages}
            </span>
          )}
          {page < result.pagination.pages && (
            <Link className="button secondary" href={href(page + 1)}>
              Next →
            </Link>
          )}
        </div>
        {cms?.sections?.map((block) => (
          <section key={block.key}>
            <SectionIntro section={block} fallback={block.key} />
          </section>
        ))}
        {cms?.faqs?.length ? <Faqs items={cms.faqs} /> : null}
      </section>
      <Cta />
      <CustomSchema json={cms?.schemaJson} />
    </>
  );
}
