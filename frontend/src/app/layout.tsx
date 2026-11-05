import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "./admin-polish.css";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/api";
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default:
        settings.defaultSeoTitle ||
        settings.title + " — Your Partner in Digital Growth",
      template: "%s | " + settings.title,
    },
    description:
      settings.defaultSeoDescription ||
      settings.description ||
      "Purposeful digital marketing, search, paid media and website development.",
    icons: {
      icon: [
        { url: "/logo/favicon.svg", type: "image/svg+xml", sizes: "any" },
        { url: "/favicon.ico", sizes: "32x32" },
        { url: "/logo/icon-192.png", type: "image/png", sizes: "192x192" },
        { url: "/logo/icon-512.png", type: "image/png", sizes: "512x512" },
      ],
      shortcut: "/favicon.ico",
      apple: { url: "/logo/icon-180.png", sizes: "180x180", type: "image/png" },
    },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined },
  };
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ga = process.env.NEXT_PUBLIC_GA4_ID,
    gtm = process.env.NEXT_PUBLIC_GTM_ID;
  return (
    <html lang="en">
      <body id="top">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        {ga && /^G-[A-Z0-9]+$/.test(ga) && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
              strategy="afterInteractive"
            />
            <Script
              id="ga4"
              strategy="afterInteractive"
            >{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');`}</Script>
          </>
        )}
        {gtm && /^GTM-[A-Z0-9]+$/.test(gtm) && (
          <Script
            id="gtm"
            strategy="afterInteractive"
          >{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}</Script>
        )}
      </body>
    </html>
  );
}
