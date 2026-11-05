export interface PageSection {
  key: string;
  heading: string;
  body: string;
  items?: { heading: string; body: string }[];
  linkLabel?: string;
  linkUrl?: string;
  image?: string;
  imageAlt?: string;
}
export interface Content {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author?: string;
  category?: string;
  tags?: string[];
  image?: string;
  imageAlt?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  status?: string;
  publishAt?: string;
  createdAt: string;
  updatedAt: string;
  order?: number;
  approved?: boolean;
  clientConsent?: boolean;
  projectUrl?: string;
  cta?: string;
  ctaUrl?: string;
  secondaryCta?: string;
  secondaryCtaUrl?: string;
  sections?: PageSection[];
  faqs?: { question: string; answer: string }[];
  schemaJson?: string;
  ogTitle?: string;
  ogImage?: string;
}
export interface SiteSettings {
  title: string;
  description?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  logo?: string;
  logoDark?: string;
  footerText?: string;
  address?: string;
  socialLinks?: string[];
  defaultSeoTitle?: string;
  defaultSeoDescription?: string;
}
export interface ListResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
  unavailable?: boolean;
}
