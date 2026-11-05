import type { NextConfig } from "next";
const config: NextConfig = {
  async redirects() {
    return [
      {
        source: "/services/search-engine-optimization",
        destination: "/services/seo-services",
        permanent: true,
      },
      {
        source: "/services/google-ads-ppc",
        destination: "/services/google-ads",
        permanent: true,
      },
      {
        source: "/services/website-design-development",
        destination: "/services/website-development",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000"}/api/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};
export default config;
