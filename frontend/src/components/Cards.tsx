import Link from "next/link";
import type { Content } from "@/types";
export function Empty({
  unavailable,
  label = "content",
}: {
  unavailable?: boolean;
  label?: string;
}) {
  return (
    <div className="empty" role="status">
      <span className="eyebrow">
        {unavailable
          ? "Temporarily unavailable"
          : "A little space for what’s next"}
      </span>
      <p>
        {unavailable
          ? `We couldn’t load ${label}. Please try again shortly.`
          : `There are no published ${label} yet. Check back for updates.`}
      </p>
    </div>
  );
}
export function Cards({ items, kind }: { items: Content[]; kind: string }) {
  const serviceImage = (slug: string, category?: string) =>
    slug.includes("mobile") || slug.includes("app")
      ? "/media/digital-marketing.jpg"
      : slug.includes("design") || category === "creative"
        ? "/media/creative-design.jpg"
        : category === "marketing"
          ? "/media/digital-marketing.jpg"
          : "/media/web-development.jpg";
  const blogImage = (i: number) =>
    [
      "/media/digital-marketing.jpg",
      "/media/web-development.jpg",
      "/media/creative-design.jpg",
    ][i % 3];
  const serviceIcon = (slug: string) =>
    slug.includes("seo") || slug.includes("search")
      ? "↗"
      : slug.includes("app") || slug.includes("mobile")
        ? "▣"
        : slug.includes("ads") || slug.includes("lead")
          ? "◎"
          : slug.includes("design")
            ? "✦"
            : slug.includes("content") || slug.includes("social")
              ? "◫"
              : "⌘";
  const date = (value?: string) =>
    value
      ? new Date(value).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";
  return (
    <div className={"card-grid " + (kind === "blogs" ? "blog-grid" : "")}>
      {items.map((item, i) => (
        <Link
          className={
            "card " +
            (kind === "blogs" ? "article-card" : "") +
            (kind === "services" ? " service-card" : " portfolio-card")
          }
          href={
            kind === "portfolio" && item.projectUrl
              ? item.projectUrl
              : `/${kind === "blogs" ? "blog" : kind}/${item.slug}`
          }
          target={
            kind === "portfolio" && item.projectUrl ? "_blank" : undefined
          }
          rel={
            kind === "portfolio" && item.projectUrl
              ? "noopener noreferrer"
              : undefined
          }
          key={item._id}
        >
          {kind === "blogs" ? (
            <div className="article-art">
              <img
                src={item.image || blogImage(i)}
                alt={item.imageAlt || item.title}
                loading="lazy"
                width="600"
                height="360"
              />
            </div>
          ) : kind === "services" ? (
            <div className="service-visual">
              <img
                src={item.image || serviceImage(item.slug, item.category)}
                alt={item.title}
                loading="lazy"
                width="600"
                height="320"
              />
              <span className="service-icon" aria-hidden>
                {serviceIcon(item.slug)}
              </span>
            </div>
          ) : (
            <div className="portfolio-cover">
              <img
                src={
                  item.image ||
                  [
                    "/media/web-development.jpg",
                    "/media/digital-marketing.jpg",
                    "/media/creative-design.jpg",
                  ][i % 3]
                }
                alt={item.imageAlt || item.title}
                loading="lazy"
                width="800"
                height="520"
              />
              <span className="portfolio-arrow" aria-hidden>
                ↗
              </span>
            </div>
          )}
          <div className="card-body">
            {kind === "services" && (
              <span className="service-kicker">
                {item.category === "development"
                  ? "Development & technology"
                  : item.category === "marketing"
                    ? "Digital marketing"
                    : "Brand & creative"}
              </span>
            )}
            {kind === "blogs" && (
              <span className="article-meta">
                <span>{item.category || "Insights"}</span>
                {(item.publishAt || item.createdAt) && (
                  <time dateTime={item.publishAt || item.createdAt}>
                    {date(item.publishAt || item.createdAt)}
                  </time>
                )}
              </span>
            )}
            <h3>{item.title}</h3>
            <p>{item.excerpt}</p>
            {kind === "portfolio" && (
              <div className="portfolio-tags">
                {item.category && <span>{item.category}</span>}
                {item.tags?.slice(0, 3).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            )}
            {kind === "services" ? (
              <span className="text-link">
                Learn more <span aria-hidden>↗</span>
              </span>
            ) : (
              kind === "blogs" && (
                <span className="text-link">
                  Read the article <span aria-hidden>↗</span>
                </span>
              )
            )}
            {kind === "portfolio" && (
              <span className="text-link">
                View project <span aria-hidden>↗</span>
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
