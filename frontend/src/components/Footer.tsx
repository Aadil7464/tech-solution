import Link from "next/link";
import BrandLogo from "./BrandLogo";
import { getSettings, getList } from "@/lib/api";
import { business, telephone } from "@/lib/business";
export default async function Footer() {
  const [settings, services] = await Promise.all([getSettings(), getList("services", "limit=100")]);
  const featured = [
    ["website-development", "Website Development"], ["seo-services", "Search Engine Optimization"],
    ["google-ads", "Google Ads Management"], ["social-media-marketing", "Social Media Marketing"],
    ["mobile-app-development", "Mobile App Development"], ["graphic-design", "Graphic Design"],
  ].filter(([slug]) => services.data.some(service => service.slug === slug));
  return <footer className="agency-footer"><div className="container">
    <div className="agency-footer-grid">
      <div><Link href="/" aria-label="Tech Solutions homepage"><BrandLogo src={settings.logo} className="agency-footer-logo" /></Link>
        <p>We help brands grow online with result-driven digital marketing, website development and custom digital solutions.</p></div>
      <div><h3>Quick Links</h3><nav aria-label="Footer quick links">{[["/", "Home"], ["/about", "About Us"], ["/services", "Services"], ["/portfolio", "Portfolio"], ["/blog", "Blog"], ["/contact", "Contact"]].map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</nav></div>
      <div><h3>Our Services</h3><nav aria-label="Footer services">{featured.map(([slug, label]) => <Link href={"/services/" + slug} key={slug}><span className="footer-icon" aria-hidden>↗</span>{label}</Link>)}<Link href="/services" className="footer-all-services">View All Services <span aria-hidden>↗</span></Link></nav></div>
      <div><h3>Contact Us</h3>
        <a className="footer-contact-line" href={"mailto:" + business.email}><span className="footer-icon" aria-hidden>✉</span>{business.email}</a>
        <div className="footer-people">{business.team.map(member => <a className="footer-contact-line" href={telephone(member.phone)} key={member.name}><svg className="footer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="m5 3 4 4-2 3c2 4 3 5 7 7l3-2 4 4c-2 5-7 3-12-2S2 5 5 3Z" /></svg><span>{member.name}<strong>{member.phone}</strong></span></a>)}</div>
        <div className="footer-contact-line"><span className="footer-icon" aria-hidden>⌖</span><span>Noida, Uttar Pradesh<br />Delhi<br />Bengaluru, Karnataka</span></div>
      </div>
    </div>
    <div className="agency-footer-bottom"><span>© {new Date().getFullYear()} Tech Solutions. All rights reserved.</span><nav aria-label="Legal links"><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms-and-conditions">Terms &amp; Conditions</Link><a href="/sitemap.xml">Sitemap</a></nav></div>
  </div></footer>;
}

