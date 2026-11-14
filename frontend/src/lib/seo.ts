import type { Metadata } from "next";
import { getContent } from "./api";
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");
export const metadataFor = (
  title: string,
  description: string,
  path: string,
  noindex = false,
  canonical?: string,
  ogTitle?: string,
  ogImage?: string,
): Metadata => {
  const rebrand = (value: string) =>
    value.replaceAll("Digital Mitra Agency", "Tech Solutions");
  const brandedTitle = rebrand(title);
  const brandedDescription = rebrand(description);
  return {
    title: title.includes("Digital Mitra Agency")
      ? { absolute: brandedTitle }
      : brandedTitle,
    description: brandedDescription,
    alternates: { canonical: canonical || siteUrl + path },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: rebrand(ogTitle || title),
      description: brandedDescription,
      url: canonical || siteUrl + path,
      siteName: "Tech Solutions",
      type: "website",
      images: [
        {
          url: ogImage || siteUrl + "/opengraph-image",
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: rebrand(ogTitle || title),
      description: brandedDescription,
      images: [ogImage || siteUrl + "/opengraph-image"],
    },
  };
};
export async function pageMetadata(
  slug: string,
  title: string,
  description: string,
  path: string,
  noindex = false,
) {
  const { data } = await getContent("pages", slug);
  return metadataFor(
    data?.seoTitle || title,
    data?.metaDescription || data?.excerpt || description,
    path,
    data?.noindex ?? noindex,
    data?.canonicalUrl,
    data?.ogTitle,
    data?.ogImage,
  );
}
