import Link from "next/link";
import { notFound } from "next/navigation";
import { getContent, getList } from "@/lib/api";
import { metadataFor } from "@/lib/seo";
import { Cards, Empty } from "@/components/Cards";
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const page = Math.max(1, parseInt(query.page || "1") || 1);
  const { data } = await getContent("categories", slug);
  return data
    ? metadataFor(
        data.title + (page > 1 ? ` — Page ${page}` : ""),
        data.excerpt ||
          `Articles about ${data.title} from Tech Solutions.`,
        `/blog/category/${slug}` + (page > 1 ? `?page=${page}` : ""),
      )
    : { robots: { index: false } };
}
export default async function Category({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const page = Math.max(1, parseInt((await searchParams).page || "1") || 1);
  const { data, unavailable } = await getContent("categories", slug);
  if (unavailable) throw new Error("Categories are temporarily unavailable");
  if (!data) notFound();
  const posts = await getList(
    "blogs",
    `category=${encodeURIComponent(slug)}&page=${page}&limit=9`,
  );
  if (!posts.unavailable && page > 1 && page > posts.pagination.pages)
    notFound();
  return (
    <>
      <section className="page-hero container">
        <Link className="text-link" href="/blog">
          ← All insights
        </Link>
        <h1>{data.title}</h1>
        <p>Perspectives and practical ideas from our journal.</p>
      </section>
      <section className="section container">
        {posts.data.length ? (
          <Cards items={posts.data} kind="blogs" />
        ) : (
          <Empty
            unavailable={posts.unavailable}
            label="articles in this category"
          />
        )}
        <nav className="pagination" aria-label="Pagination">
          {page > 1 && <Link href={`?page=${page - 1}`}>← Previous</Link>}
          {page < posts.pagination.pages && (
            <Link href={`?page=${page + 1}`}>Next →</Link>
          )}
        </nav>
      </section>
    </>
  );
}
