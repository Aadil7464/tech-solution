import Link from "next/link";
export default function Cta() {
  return (
    <section className="growth-banner" aria-labelledby="growth-title">
      <div className="growth-banner-inner">
        <div>
          <span className="growth-eyebrow">LET&apos;S GROW TOGETHER</span>
          <h2 id="growth-title">Ready to <span>Grow Your Business Online?</span></h2>
          <p>Get a free consultation and discover the right digital solution for your business.</p>
        </div>
        <Link href="/contact" className="growth-button">
          Get a Free Quote <span aria-hidden>↗</span>
        </Link>
      </div>
    </section>
  );
}
