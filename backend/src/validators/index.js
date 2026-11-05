import { z } from "zod";
const text = (max = 200) => z.string().trim().max(max);
const slug = text(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const url = z.union([
  z.literal(""),
  z.url().refine((v) => /^https?:\/\//.test(v), "Use an HTTP(S) URL"),
]);
export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(1).max(200),
  })
  .strict();
export const forgotPasswordSchema = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) })
  .strict();
export const accountEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(1).max(200),
  })
  .strict();
export const accountPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z
      .string()
      .min(8)
      .max(72)
      .refine(
        (v) => Buffer.byteLength(v, "utf8") <= 72,
        "Password must be at most 72 UTF-8 bytes",
      ),
    confirmPassword: z.string().min(8).max(72),
  })
  .strict()
  .refine((v) => v.newPassword === v.confirmPassword, "Passwords do not match");
export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(200),
    password: z
      .string()
      .min(8)
      .max(72)
      .refine(
        (v) => Buffer.byteLength(v, "utf8") <= 72,
        "Password must be at most 72 UTF-8 bytes",
      ),
    confirmPassword: z.string().min(1).max(72),
  })
  .strict()
  .refine((v) => v.password === v.confirmPassword, "Passwords do not match");
const phone = text(30).refine(
  (v) =>
    !v ||
    (/^[+\d() .-]+$/.test(v) &&
      v.replace(/\D/g, "").length >= 7 &&
      v.replace(/\D/g, "").length <= 15),
  "Enter a valid phone number",
);
const internalLink = text(500).refine(
  (v) => !v || (/^\/(?!\/)[^\s\\]*$/.test(v) && !/[<>]/.test(v)),
  "Use a site path beginning with /",
);
const imageUrl = z.union([url, internalLink]);
export const leadSchema = z
  .object({
    name: text(100).min(2),
    email: z.email().max(254),
    company: text().optional(),
    phone: phone.optional(),
    budget: z
      .enum([
        "",
        "under-25000",
        "25000-50000",
        "50000-100000",
        "100000-plus",
        "discuss",
      ])
      .optional(),
    service: text(120).optional(),
    message: text(5000).min(20),
    website: z.literal("").optional(),
    attribution: z
      .object({
        source: text(),
        medium: text(),
        campaign: text(),
        referrer: text(1000),
        landingPage: text(1000),
      })
      .partial()
      .optional(),
  })
  .strict();
export const leadUpdate = z
  .object({
    status: z
      .enum([
        "New",
        "Pending",
        "In Progress",
        "Completed",
        "Cancelled",
        "Contacted",
        "Qualified",
        "Converted",
        "Lost",
      ])
      .optional(),
    notes: text(10000).optional(),
    name: text(100).min(2).optional(),
    email: z.email().max(254).optional(),
    company: text(200).optional(),
    phone: phone.optional(),
    budget: z
      .enum([
        "",
        "under-25000",
        "25000-50000",
        "50000-100000",
        "100000-plus",
        "discuss",
      ])
      .optional(),
    service: text(120).optional(),
    message: text(5000).min(20).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const leadBulkStatus = z
  .object({
    ids: z
      .array(z.string().regex(/^[a-f\d]{24}$/i))
      .min(1)
      .max(500),
    status: z.enum(["New", "Pending", "In Progress", "Completed", "Cancelled"]),
  })
  .strict();
export const contentSchema = z
  .object({
    title: text(180).min(2),
    slug,
    excerpt: text(500).default(""),
    content: text(100000).default(""),
    author: text(100).default(""),
    category: slug.or(z.literal("")).default(""),
    tags: z.array(text(60)).max(20).default([]),
    image: url.default(""),
    imageAlt: text(200).default(""),
    status: z.enum(["draft", "scheduled", "published"]).default("draft"),
    publishAt: z.iso.datetime().nullable().optional(),
    order: z.number().int().min(0).max(10000).default(0),
    approved: z.boolean().default(false),
    clientConsent: z.boolean().default(false),
    projectUrl: url.default(""),
    cta: text().default(""),
    ctaUrl: internalLink.default(""),
    secondaryCta: text().default(""),
    secondaryCtaUrl: internalLink.default(""),
    sections: z
      .array(
        z
          .object({
            key: slug,
            heading: text(200),
            body: text(3000).default(""),
            items: z
              .array(
                z
                  .object({
                    heading: text(200).min(1),
                    body: text(1000).default(""),
                  })
                  .strict(),
              )
              .max(20)
              .default([]),
            linkLabel: text(100).default(""),
            linkUrl: internalLink.default(""),
            image: imageUrl.default(""),
            imageAlt: text(200).default(""),
          })
          .strict()
          .refine(
            (v) => !v.image || !!v.imageAlt,
            "Section images need alternative text",
          ),
      )
      .max(20)
      .default([])
      .refine(
        (v) => new Set(v.map((s) => s.key)).size === v.length,
        "Section keys must be unique",
      ),
    faqs: z
      .array(
        z
          .object({ question: text(300).min(3), answer: text(3000).min(3) })
          .strict(),
      )
      .max(20)
      .default([]),
    schemaJson: text(20000)
      .default("")
      .refine((v) => {
        if (!v) return true;
        try {
          const data = JSON.parse(v);
          return (
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            data["@context"] === "https://schema.org" &&
            typeof data["@type"] === "string"
          );
        } catch {
          return false;
        }
      }, "Use a valid JSON object with @context https://schema.org and a string @type"),
    ogTitle: text(100).default(""),
    ogImage: imageUrl.default(""),
    seoTitle: text(70).default(""),
    metaDescription: text(170).default(""),
    canonicalUrl: url.default(""),
    noindex: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.status === "scheduled" && !v.publishAt)
      c.addIssue({
        code: "custom",
        message: "A publication date is required",
        path: ["publishAt"],
      });
    if (v.image && !v.imageAlt)
      c.addIssue({
        code: "custom",
        message: "Image alt text is required",
        path: ["imageAlt"],
      });
  });
export const categorySchema = z
  .object({ title: text(100).min(2), slug, description: text(500).default("") })
  .strict();
export const settingsSchema = z
  .object({
    title: text(100).min(2),
    description: text(500).default(""),
    email: z.email().or(z.literal("")).default(""),
    phone: phone.default(""),
    whatsapp: text(20)
      .regex(/^\+?\d{7,15}$|^$/, "Use a country code and 7-15 digits")
      .default(""),
    logo: imageUrl.default(""),
    logoDark: imageUrl.default(""),
    footerText: text(500).default(""),
    address: text(500).default(""),
    socialLinks: z
      .array(z.url().refine((v) => v.startsWith("https://")))
      .max(10)
      .default([]),
    defaultSeoTitle: text(70).default(""),
    defaultSeoDescription: text(170).default(""),
  })
  .strict();
export const mediaSchema = z.object({ alt: text(200).min(3) }).strict();
