import type { MetadataRoute } from "next";
import { getList } from "@/lib/api";
import { siteUrl } from "@/lib/seo";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const result: MetadataRoute.Sitemap = [
    "",
    "/about",
    "/contact",
    "/services",
    "/portfolio",
    "/blog",
  ].map((p) => ({ url: siteUrl + p }));
  for (const [kind, path] of [
    ["services", "services"],
    ["blogs", "blog"],
    ["portfolio", "portfolio"],
    ["categories", "blog/category"],
    ["pages", ""],
  ]) {
    let page = 1;
    while (true) {
      const list = await getList(kind, `page=${page}&limit=50`);
      if (list.unavailable)
        throw new Error(
          "Sitemap temporarily unavailable; database content could not be loaded",
        );
      for (const item of list.data) {
        const own =
          kind === "pages"
            ? siteUrl + (item.slug === "home" ? "" : "/" + item.slug)
            : siteUrl + "/" + path + "/" + item.slug;
        if (
          !item.noindex &&
          (!item.canonicalUrl || item.canonicalUrl === own)
        ) {
          const existing = result.find((row) => row.url === own);
          if (existing) existing.lastModified = new Date(item.updatedAt);
          else
            result.push({ url: own, lastModified: new Date(item.updatedAt) });
        }
      }
      if (page >= list.pagination.pages) break;
      page++;
    }
  }
  return result;
}
