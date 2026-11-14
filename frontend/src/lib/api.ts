import "server-only";
import { cache } from "react";
import type { Content, ListResult, SiteSettings } from "@/types";
import { getServiceFallback, serviceFallback } from "./serviceFallback";
const base = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
const rebrand = (value: string | undefined) =>
  (value || "").replaceAll("Digital Mitra Agency", "Tech Solutions");
function rebrandContent(content: Content): Content {
  return {
    ...content,
    title: rebrand(content.title),
    excerpt: rebrand(content.excerpt),
    content: rebrand(content.content),
    author: content.author ? rebrand(content.author) : undefined,
    tags: content.tags?.map(rebrand),
    seoTitle: content.seoTitle ? rebrand(content.seoTitle) : undefined,
    metaDescription: content.metaDescription
      ? rebrand(content.metaDescription)
      : undefined,
    cta: content.cta ? rebrand(content.cta) : undefined,
    secondaryCta: content.secondaryCta
      ? rebrand(content.secondaryCta)
      : undefined,
    ogTitle: content.ogTitle ? rebrand(content.ogTitle) : undefined,
    schemaJson: content.schemaJson ? rebrand(content.schemaJson) : undefined,
    sections: content.sections?.map((section) => ({
      ...section,
      heading: rebrand(section.heading),
      body: rebrand(section.body),
      linkLabel: section.linkLabel ? rebrand(section.linkLabel) : undefined,
      items: section.items?.map((item) => ({
        ...item,
        heading: rebrand(item.heading),
        body: rebrand(item.body),
      })),
    })),
    faqs: content.faqs?.map((faq) => ({
      question: rebrand(faq.question),
      answer: rebrand(faq.answer),
    })),
  };
}
export const getList = cache(
  async (kind: string, query = ""): Promise<ListResult<Content>> => {
    try {
      const r = await fetch(
        `${base}/api/v1/${kind}${query ? "?" + query : ""}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (!r.ok) throw new Error();
      const result: ListResult<Content> = await r.json();
      return { ...result, data: result.data.map(rebrandContent) };
    } catch {
      if (kind === "services")
        return {
          data: serviceFallback,
          pagination: {
            page: 1,
            limit: 100,
            total: serviceFallback.length,
            pages: 1,
          },
          unavailable: true,
        };
      return {
        data: [],
        pagination: { page: 1, limit: 12, total: 0, pages: 0 },
        unavailable: true,
      };
    }
  },
);
export const getContent = cache(
  async (
    kind: string,
    slug: string,
  ): Promise<{ data: Content | null; unavailable?: boolean }> => {
    const fallback = kind === "services" ? getServiceFallback(slug) : undefined;
    try {
      const r = await fetch(
        `${base}/api/v1/${kind}/${encodeURIComponent(slug)}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (r.status === 404)
        return { data: fallback || null, unavailable: Boolean(fallback) };
      if (!r.ok) throw new Error();
      const result: { data: Content } = await r.json();
      return { data: rebrandContent(result.data) };
    } catch {
      return { data: fallback || null, unavailable: true };
    }
  },
);
export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const r = await fetch(`${base}/api/v1/settings`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) throw new Error();
    const data = (await r.json()).data;
    return {
      ...data,
      title: "Tech Solutions",
      logo:
        data?.logo && !data.logo.toLowerCase().includes("digital-mitra")
          ? data.logo
          : "/logo/tech-solution-agency.svg",
      email: data?.email || "digitalmitra786@gmail.com",
    };
  } catch {
    return {
      title: "Tech Solutions",
      logo: "/logo/tech-solution-agency.svg",
      email: "digitalmitra786@gmail.com",
    };
  }
});
