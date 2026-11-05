import Link from "next/link";
import type { PageSection } from "@/types";
export function SectionIntro({
  section,
  fallback,
}: {
  section?: PageSection;
  fallback: string;
}) {
  return (
    <>
      <h2>{section?.heading || fallback}</h2>
      {section?.body && <p>{section.body}</p>}
      {section?.image && (
        <img
          className="section-image"
          src={section.image}
          alt={section.imageAlt || ""}
          width={800}
          height={450}
          loading="lazy"
        />
      )}
      {section?.linkLabel && section.linkUrl && (
        <Link className="text-link" href={section.linkUrl}>
          {section.linkLabel} ↗
        </Link>
      )}
    </>
  );
}
export function Faqs({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <div className="faq-list">
      {items.map((f, i) => (
        <details key={i}>
          <summary>
            {f.question}
            <span aria-hidden>+</span>
          </summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
