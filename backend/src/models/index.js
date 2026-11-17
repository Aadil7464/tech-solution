/** @format */

import mongoose from "mongoose";
import crypto from "node:crypto";
const { Schema } = mongoose;
const opts = { timestamps: true, strict: "throw" };
export const User = mongoose.model(
  "User",
  new Schema(
    {
      email: { type: String, unique: true, required: true, lowercase: true, trim: true },
      name: String,
      passwordHash: { type: String, select: false },
      passwordChangedAt: Date,
      passwordResetHash: { type: String, select: false },
      passwordResetExpires: Date,
      pendingEmail: String,
      pendingEmailHash: { type: String, select: false },
      pendingEmailExpires: Date,
      role: { type: String, enum: ["admin", "editor"], default: "editor" },
      sessionVersion: { type: Number, default: 0 },
    },
    opts,
  ),
);
const content = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true, required: true },
    excerpt: String,
    content: String,
    author: String,
    category: String,
    tags: [String],
    image: String,
    imageAlt: String,
    status: {
      type: String,
      enum: ["draft", "scheduled", "published"],
      default: "draft",
      index: true,
    },
    publishAt: { type: Date, index: true },
    order: { type: Number, default: 0 },
    approved: { type: Boolean, default: false },
    clientConsent: { type: Boolean, default: false },
    projectUrl: String,
    cta: String,
    ctaUrl: String,
    secondaryCta: String,
    secondaryCtaUrl: String,
    sections: [
      {
        _id: false,
        key: String,
        heading: String,
        body: String,
        items: [{ _id: false, heading: String, body: String }],
        linkLabel: String,
        linkUrl: String,
        image: String,
        imageAlt: String,
      },
    ],
    faqs: [{ _id: false, question: String, answer: String }],
    schemaJson: String,
    ogTitle: String,
    ogImage: String,
    seoTitle: String,
    metaDescription: String,
    canonicalUrl: String,
    noindex: { type: Boolean, default: false },
  },
  opts,
);
content.index({ status: 1, publishAt: 1 });
export const Blog = mongoose.model("Blog", content.clone());
export const Service = mongoose.model("Service", content.clone());
export const Portfolio = mongoose.model("Portfolio", content.clone());
export const Testimonial = mongoose.model("Testimonial", content.clone());
export const Page = mongoose.model("Page", content.clone());
export const Category = mongoose.model(
  "Category",
  new Schema(
    {
      title: { type: String, required: true },
      slug: { type: String, unique: true, required: true },
      description: String,
    },
    opts,
  ),
);
const leadStatuses = [
  "New",
  "Pending",
  "In Progress",
  "Completed",
  "Cancelled",
];
const legacyLeadStatuses = ["Contacted", "Qualified", "Converted", "Lost"];
const leadSchema = new Schema(
  {
    leadId: { type: String, unique: true, sparse: true, index: true },
    name: String,
    email: String,
    company: String,
    phone: String,
    budget: String,
    notificationStatus: {
      type: String,
      enum: ["pending", "sent", "failed", "disabled"],
      default: "pending",
    },
    service: String,
    message: String,
    status: {
      type: String,
      enum: [...leadStatuses, ...legacyLeadStatuses],
      default: "New",
      index: true,
    },
    notes: { type: String, default: "" },
    statusHistory: [
      {
        _id: false,
        from: String,
        to: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
    archivedAt: Date,
    archivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    customerFieldsEditedAt: Date,
    excelSync: {
      status: {
        type: String,
        enum: ["pending", "synced", "failed", "disabled"],
        default: "pending",
      },
      lastAttemptAt: Date,
      lastSyncedAt: Date,
      lastError: String,
    },
    attribution: {
      source: String,
      medium: String,
      campaign: String,
      referrer: String,
      landingPage: String,
    },
  },
  opts,
);
leadSchema.pre("validate", function generateLeadId(next) {
  if (!this.leadId) {
    const year = new Date().getUTCFullYear();
    this.leadId = `DMA-${year}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }
  next();
});
leadSchema.index({ archivedAt: 1, status: 1, createdAt: -1 });
export const Lead = mongoose.model("Lead", leadSchema);
export const Settings = mongoose.model(
  "Settings",
  new Schema(
    {
      key: { type: String, unique: true, default: "site" },
      title: { type: String, default: "Tech Solutions" },
      description: String,
      email: { type: String, default: "techsolutions286@gmail.com" },
      phone: String,
      whatsapp: String,
      logo: String,
      logoDark: String,
      footerText: String,
      address: String,
      socialLinks: [String],
      defaultSeoTitle: String,
      defaultSeoDescription: String,
    },
    opts,
  ),
);
export const Media = mongoose.model(
  "Media",
  new Schema(
    {
      filename: String,
      url: String,
      alt: String,
      mime: String,
      size: Number,
      uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    opts,
  ),
);
export const Activity = mongoose.model(
  "Activity",
  new Schema(
    {
      actor: { type: Schema.Types.ObjectId, ref: "User" },
      action: String,
      resource: String,
      resourceId: String,
    },
    opts,
  ),
);
export const resources = {
  blogs: Blog,
  services: Service,
  portfolio: Portfolio,
  testimonials: Testimonial,
  categories: Category,
  pages: Page,
};
