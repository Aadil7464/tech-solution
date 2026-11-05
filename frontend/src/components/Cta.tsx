import Link from "next/link";
import type { PageSection } from "@/types";
export default function Cta({ section }: { section?: PageSection }) {
  return (
    <section className="cta-section">
      <video
        className="cta-video"
        autoPlay
        muted
        loop
        playsInline
        poster="/media/team-collaboration.jpg"
        aria-hidden="true"
      >
        <source src="/media/digital-agency.mp4" type="video/mp4" />
      </video>
      <div className="cta-overlay" />
      <div className="container cta-inner">
        <div>
          <span className="eyebrow">LET’S MAKE SOMETHING MEANINGFUL</span>
          <h2>Let's Build Your Next Digital Success Story.</h2>
          <p>
            {section?.body ||
              "Tell us what you are building. Let’s find a practical place to start."}
          </p>
        </div>
        <Link href="/contact" className="button light">
          {section?.linkLabel || "Get a Free Quote"} <span aria-hidden>↗</span>
        </Link>
      </div>
    </section>
  );
}
