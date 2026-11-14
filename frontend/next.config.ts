import type { NextConfig } from "next";
const config: NextConfig = {
  logging: {
    incomingRequests: { ignore: [/\/admin\/(reset-password|verify-email)/] },
    browserToTerminal: false,
  },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // These hostnames are only for dev assets/HMR; production API origins are separate.
  allowedDevOrigins: (process.env.NODE_ENV === "production" ? "" : process.env.DEV_ALLOWED_ORIGINS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
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
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};
export default config;
