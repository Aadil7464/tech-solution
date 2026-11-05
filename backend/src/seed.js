import { serviceCatalog } from "./services/service-catalog.js";
import { pageDefaults, homeSectionItems } from "./services/page-defaults.js";
import mongoose from "mongoose";
import { parseEnv } from "./config/env.js";
import { Service, Blog, Category, Settings, Page } from "./models/index.js";
const offerings = [
  [
    "Search Engine Optimization",
    "search-engine-optimization",
    "Be found when it matters.",
    "Build a search presence around the questions your customers actually ask.",
    "We start with technical accessibility, search intent and a clear view of your existing content. The result is a practical roadmap for making your website easier to discover and more useful to visitors.",
    "Technical and crawl audits|Search intent and keyword mapping|On-page content improvements|Measurement and ongoing iteration",
  ],
  [
    "Google Ads / PPC",
    "google-ads-ppc",
    "Make every click purposeful.",
    "Connect search demand with focused campaigns and relevant landing pages.",
    "Paid search works best when the offer, audience and destination fit together. We structure campaigns around business priorities, define conversion events and review search terms before expanding spend.",
    "Account and conversion audit|Campaign structure and creative|Landing page recommendations|Budget and search-term reviews",
  ],
  [
    "Meta Ads",
    "meta-ads",
    "Turn attention into opportunity.",
    "Bring your offer to the right audiences on Facebook and Instagram.",
    "We connect creative testing with a clear customer journey. Campaign planning includes audience hypotheses, several creative angles and a measurement plan that respects consent requirements.",
    "Audience and offer planning|Creative testing framework|Campaign setup and optimisation|Attribution review",
  ],
  [
    "Social Media Marketing",
    "social-media-marketing",
    "Build a presence with purpose.",
    "Give your brand a consistent voice and your audience a reason to return.",
    "A useful social presence starts with understanding what your audience needs. We develop content themes and a realistic publishing rhythm, then use responses and engagement to refine the approach.",
    "Channel and audience review|Editorial calendars|Creative direction|Community response guidelines",
  ],
  [
    "Website Design & Development",
    "website-design-development",
    "A better home for your business.",
    "Fast, accessible websites built around the actions your visitors need to take.",
    "We map the visitor journey before designing the interface. From content structure to responsive layouts and form validation, every decision supports a clear and maintainable website.",
    "Discovery and information architecture|Responsive interface design|Development and integrations|Accessibility and launch checks",
  ],
  [
    "Local SEO",
    "local-seo",
    "Show up close to home.",
    "Help nearby customers understand where you operate and what you offer.",
    "Local discovery depends on accurate business information and useful location context. We review eligible business profiles, website details and citation consistency without creating thin location pages.",
    "Business profile review|Citation consistency|Local service content|Review response guidance",
  ],
  [
    "Content Marketing",
    "content-marketing",
    "Be useful. Earn attention.",
    "Create content that answers real questions and supports informed decisions.",
    "We connect business expertise with audience research to develop an editorial plan. Each piece has a defined purpose, an accountable author and a plan for keeping information accurate over time.",
    "Content and audience audit|Editorial strategy|Research and production|Refresh and distribution planning",
  ],
];
export async function seed() {
  for (const item of serviceCatalog)
    await Service.updateOne(
      { slug: item.slug },
      { $setOnInsert: item },
      { upsert: true },
    );
  for (const item of serviceCatalog)
    await Service.updateOne(
      {
        slug: item.slug,
        $or: [{ faqs: { $exists: false } }, { faqs: { $size: 0 } }],
      },
      { $set: { faqs: item.faqs } },
    );
  for (const item of serviceCatalog)
    await Service.updateOne(
      {
        slug: item.slug,
        $or: [{ category: { $exists: false } }, { category: "" }],
      },
      { $set: { category: item.category } },
    );
  for (const item of pageDefaults)
    await Page.updateOne(
      { slug: item.slug },
      { $setOnInsert: item },
      { upsert: true },
    );
  for (const [
    title,
    slug,
    headline,
    excerpt,
    body,
    deliverables,
  ] of offerings) {
    await Service.updateOne(
      { slug },
      {
        $setOnInsert: {
          title,
          slug,
          excerpt,
          content: `<h2>${headline}</h2><p>${body}</p><h2>What we can work on together</h2><ul>${deliverables
            .split("|")
            .map((x) => `<li>${x}</li>`)
            .join(
              "",
            )}</ul><h2>A clear starting point</h2><p>Tell us about your goals, current setup and constraints. We will use that context to discuss a scope, timeline and measurement plan before work begins.</p>`,
          status: "published",
          order: offerings.findIndex((v) => v[1] === slug),
          seoTitle: title + " | Digital Mitra Agency",
          metaDescription: excerpt,
          cta: "Discuss your project",
        },
      },
      { upsert: true },
    );
  }
  const home = await Page.findOne({ slug: "home" }).lean();
  for (const [index, section] of (home?.sections || []).entries()) {
    const items = homeSectionItems[section.key];
    if (items && !section.items?.length) {
      const field = "sections." + index + ".items";
      await Page.updateOne(
        {
          _id: home._id,
          ["sections." + index + ".key"]: section.key,
          $or: [{ [field]: { $exists: false } }, { [field]: { $size: 0 } }],
        },
        { $set: { [field]: items } },
      );
    }
  }
  await Category.updateOne(
    { slug: "strategy" },
    {
      $setOnInsert: {
        title: "Strategy",
        slug: "strategy",
        description:
          "Practical thinking for a more intentional digital presence.",
      },
    },
    { upsert: true },
  );
  const posts = [
    [
      "Before you spend more on ads, check your landing page",
      "before-you-spend-more-on-ads",
      "A practical checklist for making the journey from ad click to enquiry clearer.",
      "<p>Advertising brings people to a page. What happens next depends on how clearly that page explains your offer and makes the next step available.</p><h2>Keep the promise consistent</h2><p>Read your ad and page headline together. They should describe the same offer in language a new visitor can understand. Avoid sending a specific campaign to a broad homepage when a focused page would answer the question more directly.</p><h2>Remove uncertainty</h2><p>Explain who the offer is for, what happens after an enquiry and which details you need. Use real, approved evidence where available. A clear process is more useful than unsupported claims.</p><h2>Check the experience on a phone</h2><p>Open the page on a small screen. Check text size, form labels, keyboard behavior and loading speed. Confirm that your conversion event fires only after a successful submission.</p>",
    ],
    [
      "A practical starting point for your SEO strategy",
      "a-practical-seo-starting-point",
      "Start with useful pages, a sound technical foundation and a measurement plan.",
      "<p>SEO planning begins with your audience and the decisions they need to make. A useful page answers a specific question and makes the next step clear.</p><h2>Understand your existing website</h2><p>Review which pages can be crawled and indexed, which queries bring visitors and which pages lead to useful actions. Separate technical problems from gaps in content before choosing priorities.</p><h2>Match pages to intent</h2><p>Group related customer questions and decide which deserve a dedicated page. A detailed service explanation often provides more value than many near-identical pages.</p><h2>Review and improve</h2><p>Choose meaningful indicators and review them consistently. Search visibility takes time and depends on many factors; avoid treating a single position as a complete measure of success.</p>",
    ],
    [
      "What to include in a useful marketing brief",
      "writing-a-useful-marketing-brief",
      "A better brief helps everyone agree on the problem before discussing the solution.",
      "<p>A useful brief makes decisions easier. You do not need a long document, but you do need a shared understanding of what the work should achieve.</p><h2>Describe the business context</h2><p>Explain your offer, audience and current marketing setup. Include what you have tried and the constraints the team should consider.</p><h2>Define the desired action</h2><p>Specify what you want a visitor or customer to do. An enquiry, a booking and a purchase involve different journeys and different ways of measuring progress.</p><h2>Agree on practical limits</h2><p>Share a budget range, timing, approval responsibilities and access requirements. These details help shape a realistic scope and avoid surprises during delivery.</p>",
    ],
  ];
  for (const [title, slug, excerpt, content] of posts)
    await Blog.updateOne(
      { slug },
      {
        $setOnInsert: {
          title,
          slug,
          excerpt,
          content,
          author: "Digital Mitra Agency",
          category: "strategy",
          status: "published",
          seoTitle: title,
          metaDescription: excerpt,
        },
      },
      { upsert: true },
    );
  await Settings.updateOne(
    { key: "site" },
    {
      $setOnInsert: {
        title: "Digital Mitra Agency",
        description:
          "Your partner in digital growth. Search, paid media, content and websites with a clear purpose.",
        email: "digitalmitra@gmail.com",
        phone: "",
        address: "",
        socialLinks: [],
      },
    },
    { upsert: true },
  );
}
if (process.argv[1]?.endsWith("seed.js")) {
  const env = parseEnv(process.env);
  try {
    await mongoose.connect(env.MONGODB_URI);
    await seed();
    console.log(
      "Missing services, pages and editorial content added. Existing content was preserved.",
    );
  } finally {
    await mongoose.disconnect();
  }
}
