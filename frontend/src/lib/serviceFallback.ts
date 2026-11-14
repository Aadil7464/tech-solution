import type { Content } from "@/types";

const services: [string, string, string, string][] = [
  [
    "Website Development",
    "website-development",
    "development",
    "Responsive websites built around clear journeys, accessibility and maintainable content.",
  ],
  [
    "Web Application Development",
    "web-application-development",
    "development",
    "Purpose-built applications that make complex customer and operational workflows easier.",
  ],
  [
    "E-commerce Development",
    "e-commerce-development",
    "development",
    "Reliable online stores designed for product discovery, checkout and everyday operations.",
  ],
  [
    "Custom Software Development",
    "custom-software-development",
    "development",
    "Practical software shaped around your unique business processes and systems.",
  ],
  [
    "Mobile App Development",
    "mobile-app-development",
    "development",
    "Focused mobile experiences with reliable APIs and responsive small-screen interactions.",
  ],
  [
    "Website Maintenance",
    "website-maintenance",
    "development",
    "Planned updates, backups, monitoring and improvements for a dependable website.",
  ],
  [
    "Search Engine Optimization",
    "seo-services",
    "marketing",
    "Integrated organic search work connecting technical health, intent and useful content.",
  ],
  [
    "Local SEO",
    "local-seo",
    "marketing",
    "Accurate local information that helps nearby customers find and understand your business.",
  ],
  [
    "Technical SEO",
    "technical-seo",
    "marketing",
    "Technical improvements that reduce barriers to crawling, indexing and rendering.",
  ],
  [
    "On-Page SEO",
    "on-page-seo",
    "marketing",
    "Clear search intent, page structure, content and internal links for priority pages.",
  ],
  [
    "Off-Page SEO",
    "off-page-seo",
    "marketing",
    "Relevant authority signals through accurate references and ethical outreach.",
  ],
  [
    "Google Ads Management",
    "google-ads",
    "marketing",
    "Purposeful paid-search campaigns tied to relevant audiences and measurable actions.",
  ],
  [
    "Meta Ads",
    "meta-ads",
    "marketing",
    "Audience-focused campaigns and creative testing for Facebook and Instagram.",
  ],
  [
    "Social Media Marketing",
    "social-media-marketing",
    "marketing",
    "Consistent social content and community guidance built around real audience needs.",
  ],
  [
    "Content Marketing",
    "content-marketing",
    "marketing",
    "Useful editorial content that answers questions and supports informed decisions.",
  ],
  [
    "Lead Generation",
    "lead-generation",
    "marketing",
    "Connected campaign journeys that turn relevant attention into qualified enquiries.",
  ],
  [
    "Graphic Design",
    "graphic-design",
    "creative",
    "Clear, consistent visual communication for brands, campaigns and digital experiences.",
  ],
  ["Google Business Profile (GMB)", "google-business-profile", "marketing", "Accurate profile setup and improvements for eligible local businesses."],
  ["Branding", "branding", "creative", "Brand positioning, visual identity and guidelines for consistent communication."],
];

export const serviceFallback = services.map(
  ([title, slug, category, excerpt], index): Content => ({
    _id: `fallback-service-${index}`,
    title,
    slug,
    category,
    excerpt,
    content: `<h2>${title}</h2><p>${excerpt}</p><p>Contact our team to discuss your goals, current setup and the right scope for this service.</p>`,
    createdAt: "",
    updatedAt: "",
    status: "published",
    order: index,
  }),
);

export const getServiceFallback = (slug: string) =>
  serviceFallback.find((service) => service.slug === slug);
