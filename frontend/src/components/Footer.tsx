import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { getSettings, getList } from "@/lib/api";
export default async function Footer() {
  const s = await getSettings();
  const services = await getList("services", "limit=100");
  const featured = [
    "website-development",
    "seo-services",
    "google-ads",
    "social-media-marketing",
    "mobile-app-development",
    "graphic-design",
  ];
  const featuredServices = featured
    .map((slug) => services.data.find((service) => service.slug === slug))
    .filter(Boolean);
  return (
    <footer className="footer">
      <div className="container">
        {s.email && (
          <div className="footer-topline">
            <span>LET’S BUILD YOUR NEXT CHAPTER.</span>
            <a href={"mailto:" + s.email}>Say hello ↗</a>
          </div>
        )}
        <div className="footer-main">
          <div>
            <Link className="footer-brand" href="/">
              <BrandLogo dark src={s.logoDark} className="footer-logo" />
            </Link>
            <p>
              {s.footerText ||
                "Your partner in digital growth. Clear thinking. Purposeful work."}
            </p>
          </div>
          <div>
            <h3>Quick links</h3>
            <Link href="/">Home</Link>
            <Link href="/about">About us</Link>
            <Link href="/services">Services</Link>
            <Link href="/portfolio">Portfolio</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div className="footer-services">
            <h3>Our services</h3>
            {featuredServices.map((service) => (
              <Link key={service!._id} href={"/services/" + service!.slug}>
                {service!.title}
              </Link>
            ))}
            <Link href="/services">View all services ↗</Link>
          </div>
          <div>
            <h3>Contact us</h3>
            {s.email && <a href={"mailto:" + s.email}>{s.email}</a>}
            {s.phone && (
              <a href={"tel:" + s.phone.replace(/[^+\d]/g, "")}>{s.phone}</a>
            )}
            {s.whatsapp && (
              <a
                href={"https://wa.me/" + s.whatsapp.replace(/\D/g, "")}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp ↗
              </a>
            )}
            {s.address && <span>{s.address}</span>}
            {s.socialLinks
              ?.filter((url) => {
                try {
                  const parsed = new URL(url);
                  return ["http:", "https:"].includes(parsed.protocol);
                } catch {
                  return false;
                }
              })
              .map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {new URL(url).hostname.replace("www.", "")} ↗
                </a>
              ))}
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {s.title}. All rights reserved.
          </span>
          <div>
            <Link href="/privacy-policy">Privacy policy</Link>
            <Link href="/terms-and-conditions">Terms & conditions</Link>
          </div>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
