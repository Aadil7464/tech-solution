import CustomSchema from "@/components/CustomSchema";
import { getContent } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
export const generateMetadata = () =>
  pageMetadata(
    "privacy-policy",
    "Privacy Policy",
    "How Digital Mitra Agency handles enquiries and website data.",
    "/privacy-policy",
    true,
  );
export default async function Privacy() {
  const { data } = await getContent("pages", "privacy-policy");
  return (
    <>
      <section className="page-hero container">
        <span className="eyebrow">WEBSITE INFORMATION</span>
        <h1>{data?.title || "Privacy Policy"}</h1>
        <p>{data?.excerpt}</p>
      </section>
      <article className="container prose article-content">
        {data ? (
          <div dangerouslySetInnerHTML={{ __html: data.content }} />
        ) : (
          <p>
            Policy content is temporarily unavailable. Email
            digitalmitra@gmail.com for privacy enquiries.
          </p>
        )}
      </article>
      <CustomSchema json={data?.schemaJson} />
    </>
  );
}
