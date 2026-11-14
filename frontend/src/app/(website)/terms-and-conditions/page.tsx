import CustomSchema from "@/components/CustomSchema";
import { getContent } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
export const generateMetadata = () =>
  pageMetadata(
    "terms-and-conditions",
    "Terms & Conditions",
    "Website terms for Tech Solutions.",
    "/terms-and-conditions",
    true,
  );
export default async function Terms() {
  const { data } = await getContent("pages", "terms-and-conditions");
  return (
    <>
      <section className="page-hero container">
        <span className="eyebrow">WEBSITE INFORMATION</span>
        <h1>{data?.title || "Terms & Conditions"}</h1>
        <p>{data?.excerpt}</p>
      </section>
      <article className="container prose article-content">
        {data ? (
          <div dangerouslySetInnerHTML={{ __html: data.content }} />
        ) : (
          <p>
            Terms are temporarily unavailable. Email digitalmitra786@gmail.com with
            questions.
          </p>
        )}
      </article>
      <CustomSchema json={data?.schemaJson} />
    </>
  );
}
