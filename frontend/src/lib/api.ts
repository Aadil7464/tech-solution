import "server-only";
import { cache } from "react";
import type { Content, ListResult, SiteSettings } from "@/types";
import { serviceFallback } from "./serviceFallback";
const base = process.env.API_INTERNAL_URL || "http://127.0.0.1:4000";
export const getList = cache(
  async (kind: string, query = ""): Promise<ListResult<Content>> => {
    try {
      const r = await fetch(
        `${base}/api/v1/${kind}${query ? "?" + query : ""}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (!r.ok) throw new Error();
      return await r.json();
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
    try {
      const r = await fetch(
        `${base}/api/v1/${kind}/${encodeURIComponent(slug)}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (r.status === 404) return { data: null };
      if (!r.ok) throw new Error();
      return await r.json();
    } catch {
      return { data: null, unavailable: true };
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
      title: data?.title || "Digital Mitra Agency",
      email: data?.email || "digitalmitra@gmail.com",
    };
  } catch {
    return { title: "Digital Mitra Agency", email: "digitalmitra@gmail.com" };
  }
});
