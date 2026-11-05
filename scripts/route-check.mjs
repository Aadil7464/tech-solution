import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const api = base + "/api/v1";
const paths = [
  "/",
  "/about",
  "/services",
  "/portfolio",
  "/blog",
  "/contact",
  "/privacy-policy",
  "/terms-and-conditions",
];
for (const [kind, prefix] of [
  ["services", "services"],
  ["blogs", "blog"],
  ["categories", "blog/category"],
  ["pages", ""],
]) {
  let page = 1;
  while (true) {
    const response = await fetch(`${api}/${kind}?limit=50&page=${page}`);
    assert.equal(response.status, 200);
    const list = await response.json();
    for (const item of list.data) {
      const path =
        kind === "pages"
          ? item.slug === "home"
            ? "/"
            : "/" + item.slug
          : `/${prefix}/${item.slug}`;
      if (!paths.includes(path)) paths.push(path);
    }
    if (page >= list.pagination.pages) break;
    page++;
  }
}
const titles = new Set();
for (const path of paths) {
  const r = await fetch(base + path, {
    headers: { "User-Agent": "Googlebot" },
  });
  assert.equal(r.status, 200, path);
  const html = await r.text();
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${path}: one H1`);
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  assert.ok(title, `${path}: title`);
  assert.ok(!titles.has(title), `${path}: unique title`);
  titles.add(title);
  assert.match(
    html,
    /<meta name="description" content="[^"]+"/,
    `${path}: description`,
  );
  assert.match(
    html,
    /<link rel="canonical" href="[^"]+"/,
    `${path}: canonical`,
  );
  assert.match(html, /<meta property="og:title"/, `${path}: social title`);
  assert.match(html, /application\/ld\+json/, `${path}: structured data`);
  console.log("PASS " + path);
}
for (const path of [
  "/not-a-real-page",
  "/services/not-a-real-service",
  "/blog/not-a-real-article",
])
  assert.equal((await fetch(base + path)).status, 404, path);
for (const [from, to] of [
  ["search-engine-optimization", "seo-services"],
  ["google-ads-ppc", "google-ads"],
  ["website-design-development", "website-development"],
]) {
  const r = await fetch(base + "/services/" + from, { redirect: "manual" });
  assert.equal(r.status, 308);
  assert.equal(r.headers.get("location"), "/services/" + to);
}
const sitemap = await fetch(base + "/sitemap.xml");
assert.equal(sitemap.status, 200);
const xml = await sitemap.text();
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
assert.equal(urls.length, new Set(urls).size);
assert.ok(urls.some((u) => u.endsWith("/services/mobile-app-development")));
assert.ok(!urls.some((u) => u.includes("privacy-policy")));
assert.equal((await fetch(base + "/robots.txt")).status, 200);
assert.equal((await fetch(base + "/opengraph-image")).status, 200);
assert.match(
  (await fetch(base + "/admin", { redirect: "manual" })).headers.get(
    "location",
  ),
  /\/admin\/login$/,
);
console.log(
  `PASS: ${paths.length} public routes, unique titles, canonicals, schema, sitemap, redirects, 404 and admin protection.`,
);
