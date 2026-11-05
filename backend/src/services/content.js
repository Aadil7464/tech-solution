import sanitizeHtml from "sanitize-html";
export const visible = (kind) => ({
  ...(["blogs", "services", "portfolio", "testimonials", "pages"].includes(kind)
    ? {
        $or: [
          { status: "published", publishAt: null },
          {
            status: { $in: ["published", "scheduled"] },
            publishAt: { $lte: new Date() },
          },
        ],
      }
    : {}),
  ...(["portfolio", "testimonials"].includes(kind)
    ? { approved: true, clientConsent: true }
    : {}),
});
export const cleanContent = (data) => ({
  ...data,
  content: sanitizeHtml(data.content || "", {
    allowedTags: [
      "p",
      "br",
      "h2",
      "h3",
      "strong",
      "em",
      "ul",
      "ol",
      "li",
      "a",
      "blockquote",
    ],
    allowedAttributes: { a: ["href", "title"] },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  }),
});
export const pageOptions = (q) => ({
  page: Math.max(1, Math.min(100000, Number.parseInt(q.page) || 1)),
  limit: Math.max(1, Math.min(50, Number.parseInt(q.limit) || 12)),
});
export const escaped = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const csvCell = (v) =>
  '"' +
  String(v ?? "")
    .replace(/^[=+@\-\t\r]/, "'$&")
    .replaceAll('"', '""') +
  '"';
