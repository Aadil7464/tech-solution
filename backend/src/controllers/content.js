import mongoose from "mongoose";
import {
  Activity,
  Blog,
  Service,
  Portfolio,
  Testimonial,
  Page,
  Settings,
} from "../models/index.js";
import { HttpError } from "../middleware/security.js";
import {
  visible,
  cleanContent,
  pageOptions,
  escaped,
} from "../services/content.js";
export const audit = (req, action, resource, id) =>
  Activity.create({
    actor: req.user._id,
    action,
    resource,
    resourceId: String(id),
  });
export const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id)
    ? next()
    : next(new HttpError(404, "Record not found"));
export function contentController(Model, kind) {
  return {
    list: async (req, res) => {
      const { page, limit } = pageOptions(req.query);
      const filter = req.isAdmin ? {} : visible(kind);
      if (kind === "services" && !req.isAdmin)
        filter.slug = {
          $nin: [
            "search-engine-optimization",
            "google-ads-ppc",
            "website-design-development",
          ],
        };
      if (typeof req.query.category === "string")
        filter.category = req.query.category;
      if (
        req.isAdmin &&
        ["draft", "scheduled", "published"].includes(req.query.status)
      )
        filter.status = req.query.status;
      if (typeof req.query.search === "string")
        filter.title = {
          $regex: escaped(req.query.search.slice(0, 100)),
          $options: "i",
        };
      const [data, total] = await Promise.all([
        Model.find(filter)
          .sort({ order: 1, createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        Model.countDocuments(filter),
      ]);
      res.json({
        data,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    },
    detail: async (req, res) => {
      const data = await Model.findOne({
        slug: req.params.slug,
        ...visible(kind),
      }).lean();
      if (!data) throw new HttpError(404, "Content not found");
      res.json({ data });
    },
    create: async (req, res) => {
      if (
        req.user.role !== "admin" &&
        ["portfolio", "testimonials"].includes(kind)
      )
        throw new HttpError(403, "Administrator approval is required");
      const data = await Model.create(
        kind === "categories" ? req.valid : cleanContent(req.valid),
      );
      await audit(req, "create", kind, data._id);
      res.status(201).json({ data });
    },
    update: async (req, res) => {
      if (
        req.user.role !== "admin" &&
        ["portfolio", "testimonials"].includes(kind)
      )
        throw new HttpError(403, "Administrator approval is required");
      if (kind === "categories") {
        const old = await Model.findById(req.params.id);
        if (
          old &&
          old.slug !== req.valid.slug &&
          (await Blog.exists({ category: old.slug }))
        )
          throw new HttpError(
            409,
            "Move posts before changing this category slug",
          );
      }
      const data = await Model.findByIdAndUpdate(
        req.params.id,
        kind === "categories" ? req.valid : cleanContent(req.valid),
        { new: true, runValidators: true },
      );
      if (!data) throw new HttpError(404, "Record not found");
      await audit(req, "update", kind, data._id);
      res.json({ data });
    },
    remove: async (req, res) => {
      const item = await Model.findById(req.params.id);
      if (!item) throw new HttpError(404, "Record not found");
      if (kind === "categories" && (await Blog.exists({ category: item.slug })))
        throw new HttpError(409, "Move posts before deleting this category");
      await item.deleteOne();
      await audit(req, "delete", kind, item._id);
      res.status(204).end();
    },
  };
}
export const mediaReferenced = async (url) =>
  (
    await Promise.all([
      ...[Blog, Service, Portfolio, Testimonial, Page].map((M) =>
        M.exists({
          $or: [{ image: url }, { ogImage: url }, { "sections.image": url }],
        }),
      ),
      Settings.exists({ $or: [{ logo: url }, { logoDark: url }] }),
    ])
  ).some(Boolean);
