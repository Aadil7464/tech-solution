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
): Metadata => ({
  title: title.includes("Digital Mitra Agency") ? { absolute: title } : title,
  description,
  alternates: { canonical: canonical || siteUrl + path },
  robots: noindex
    ? { index: false, follow: false }
    : { index: true, follow: true },
  openGraph: {
    title: ogTitle || title,
    description,
    url: canonical || siteUrl + path,
    siteName: "Digital Mitra Agency",
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
    title: ogTitle || title,
    description,
    images: [ogImage || siteUrl + "/opengraph-image"],
  },
});
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
