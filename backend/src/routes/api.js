import {
  notifyLead,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "../services/notifications.js";
import { syncLeadToExcel } from "../services/microsoft-excel.js";
import { Router } from "express";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import sharp from "sharp";
import {
  User,
  Lead,
  Settings,
  Media,
  Activity,
  Blog,
  Service,
  Page,
  resources,
} from "../models/index.js";
import {
  auth,
  roles,
  csrf,
  cookieOptions,
  HttpError,
  validate,
} from "../middleware/security.js";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  accountEmailSchema,
  accountPasswordSchema,
  leadSchema,
  leadUpdate,
  contentSchema,
  categorySchema,
  settingsSchema,
  mediaSchema,
} from "../validators/index.js";
import {
  contentController,
  validId,
  audit,
  mediaReferenced,
} from "../controllers/content.js";
import { pageOptions, escaped, csvCell, visible } from "../services/content.js";
import { normalizeLeadStatus } from "../services/leads.js";
import ExcelJS from "exceljs";
import { leadBulkStatus } from "../validators/index.js";
export function apiRouter(env, passwordResetTransport) {
  const r = Router();
  r.use("/auth", (_, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const options = cookieOptions(env);
  const protect = auth(env);
  const admin = roles("admin");
  const limit = (max, windowMs) =>
    rateLimit({
      windowMs,
      limit: max,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: { message: "Too many attempts. Please try again later." },
      },
    });
  r.get("/auth/csrf", (req, res) => {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie("csrf", token, { ...options, maxAge: 3600000 });
    res.set("Cache-Control", "no-store").json({ data: { token } });
  });
  r.post(
    "/auth/login",
    limit(10, 15 * 60 * 1000),
    csrf,
    validate(loginSchema),
    async (req, res) => {
      const user = await User.findOne({
        email: req.valid.email.toLowerCase(),
      }).select("+passwordHash");
      const dummy =
        "$2b$12$7Zl5NzE9eLalAJxeS8xS3e8q4F6ZmptSbmjDWy7tJ4JYePzv1M8qK";
      const valid = await bcrypt.compare(
        req.valid.password,
        user?.passwordHash || dummy,
      );
      if (!user || !valid)
        throw new HttpError(401, "Email or password is incorrect");
      const token = jwt.sign({ version: user.sessionVersion }, env.JWT_SECRET, {
        subject: String(user._id),
        expiresIn: "8h",
        issuer: "tech-solution-agency",
        audience: "admin",
        algorithm: "HS256",
      });
      res.cookie("session", token, { ...options, maxAge: 8 * 3600000 });
      await audit({ ...req, user }, "login", "auth", user._id);
      res.json({
        data: { name: user.name, role: user.role, email: user.email },
      });
    },
  );
  r.post(
    "/auth/forgot-password",
    limit(5, 15 * 60 * 1000),
    csrf,
    validate(forgotPasswordSchema),
    async (req, res) => {
      const generic = {
        data: {
          message:
            "If an administrator account exists for that email, a reset link has been sent.",
        },
      };
      const user = await User.findOne({
        email: req.valid.email.toLowerCase(),
        role: "admin",
      });
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const hash = crypto.createHash("sha256").update(token).digest("hex");
        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              passwordResetHash: hash,
              passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
            },
          },
        );
        if (env.SMTP_HOST && env.SMTP_FROM) {
          try {
            await sendPasswordResetEmail(
              user.email,
              user.name,
              token,
              env,
              passwordResetTransport,
            );
          } catch (error) {
            req.log.warn(
              { errorType: error?.constructor?.name },
              "Admin password reset email delivery failed",
            );
          }
        }
      }
      res.json(generic);
    },
  );
  r.post(
    "/auth/reset-password",
    limit(5, 15 * 60 * 1000),
    csrf,
    validate(resetPasswordSchema),
    async (req, res) => {
      const hash = crypto
        .createHash("sha256")
        .update(req.valid.token)
        .digest("hex");
      const user = await User.findOne({
        role: "admin",
        passwordResetHash: hash,
        passwordResetExpires: { $gt: new Date() },
      }).select("+passwordResetHash");
      if (!user)
        throw new HttpError(400, "This reset link is invalid or has expired");
      const passwordHash = await bcrypt.hash(req.valid.password, 12);
      const updated = await User.updateOne(
        {
          _id: user._id,
          passwordResetHash: hash,
          passwordResetExpires: { $gt: new Date() },
        },
        {
          $set: { passwordHash },
          $unset: { passwordResetHash: 1, passwordResetExpires: 1 },
          $inc: { sessionVersion: 1 },
        },
      );
      if (updated.modifiedCount !== 1)
        throw new HttpError(400, "This reset link is invalid or has expired");
      res.clearCookie("session", options);
      res.json({ data: { message: "Password reset successfully." } });
    },
  );
  r.post(
    "/auth/verify-email",
    limit(5, 15 * 60 * 1000),
    csrf,
    async (req, res) => {
      const token = typeof req.body.token === "string" ? req.body.token : "";
      if (!token)
        return res
          .status(422)
          .json({ error: { message: "Verification token is required" } });
      const hash = crypto.createHash("sha256").update(token).digest("hex");
      const user = await User.findOne({
        pendingEmailHash: hash,
        pendingEmailExpires: { $gt: new Date() },
      }).select("+pendingEmailHash");
      if (!user)
        return res
          .status(400)
          .json({
            error: {
              message: "This verification link is invalid or has expired",
            },
          });
      const email = user.pendingEmail.toLowerCase();
      if (await User.exists({ email, _id: { $ne: user._id } }))
        return res
          .status(409)
          .json({ error: { message: "That email address is already in use" } });
      let updated;
      try {
        updated = await User.updateOne(
          {
            _id: user._id,
            role: "admin",
            pendingEmail: email,
            pendingEmailHash: hash,
            pendingEmailExpires: { $gt: new Date() },
          },
          {
            $set: { email },
            $unset: {
              pendingEmail: 1,
              pendingEmailHash: 1,
              pendingEmailExpires: 1,
            },
            $inc: { sessionVersion: 1 },
          },
        );
      } catch (error) {
        if (error?.code === 11000)
          throw new HttpError(409, "That email address is already in use");
        throw error;
      }
      if (updated.matchedCount === 0)
        return res
          .status(400)
          .json({
            error: {
              message: "This verification link is invalid or has expired",
            },
          });
      if (updated.matchedCount !== 1 || updated.modifiedCount !== 1)
        throw new HttpError(500, "Email address could not be verified");
      res.clearCookie("session", options);
      res.json({ data: { message: "Email address verified." } });
    },
  );
  r.get("/auth/me", protect, (req, res) =>
    res.json({
      data: { name: req.user.name, email: req.user.email, role: req.user.role },
    }),
  );
  r.post("/auth/logout", protect, csrf, async (req, res) => {
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { sessionVersion: 1 } },
    );
    res.clearCookie("session", options);
    res.status(204).end();
  });
  r.post(
    "/leads",
    limit(5, 15 * 60 * 1000),
    validate(leadSchema),
    async (req, res) => {
      const { website: _website, ...data } = req.valid;
      const lead = await Lead.create(data);
      try {
        lead.notificationStatus = await notifyLead(lead, env);
        await lead.save();
      } catch {
        await Lead.updateOne(
          { _id: lead._id },
          { $set: { notificationStatus: "failed" } },
        );
        req.log.warn(
          { leadId: String(lead._id) },
          "Enquiry saved; email notification failed",
        );
      }
      const excel = await syncLeadToExcel(lead, env);
      const excelSync = {
        status: excel.status,
        lastAttemptAt: new Date(),
        lastSyncedAt:
          excel.status === "synced" ? new Date() : lead.excelSync?.lastSyncedAt,
        lastError: excel.status === "failed" ? excel.errorCode : undefined,
      };
      await Lead.updateOne({ _id: lead._id }, { $set: { excelSync } });
      res
        .status(201)
        .json({
          data: {
            id: lead._id,
            leadId: lead.leadId,
            message: "Your enquiry has been received.",
          },
        });
    },
  );
  r.get("/settings", async (req, res) => {
    const data = await Settings.findOne({ key: "site" })
      .select("-_id -__v -key -createdAt -updatedAt")
      .lean();
    res.json({
      data: data || {
        title: "Digital Mitra Agency",
        email: "digitalmitra@gmail.com",
      },
    });
  });
  for (const [kind, Model] of Object.entries(resources)) {
    const c = contentController(Model, kind);
    r.get("/" + kind, c.list);
    r.get("/" + kind + "/:slug", c.detail);
  }
  r.use("/admin", protect, (req, res, next) => {
    res.set("Cache-Control", "no-store");
    req.isAdmin = true;
    if (!["GET", "HEAD"].includes(req.method)) return csrf(req, res, next);
    next();
  });
  r.post(
    "/admin/account/email",
    admin,
    limit(5, 15 * 60 * 1000),
    validate(accountEmailSchema),
    async (req, res) => {
      const user = await User.findById(req.user._id).select("+passwordHash");
      if (
        !user ||
        !(await bcrypt.compare(req.valid.password, user.passwordHash || ""))
      )
        throw new HttpError(401, "Current password is incorrect");
      const email = req.valid.email.toLowerCase();
      if (email === user.email)
        throw new HttpError(422, "Enter a different email address");
      if (await User.exists({ email, _id: { $ne: user._id } }))
        throw new HttpError(409, "That email address is already in use");
      const token = crypto.randomBytes(32).toString("hex");
      let pending;
      try {
        pending = await User.updateOne(
          { _id: user._id, role: "admin", passwordHash: { $exists: true } },
          {
            $set: {
              pendingEmail: email,
              pendingEmailHash: crypto
                .createHash("sha256")
                .update(token)
                .digest("hex"),
              pendingEmailExpires: new Date(Date.now() + 15 * 60 * 1000),
            },
          },
        );
      } catch (error) {
        if (error?.code === 11000)
          throw new HttpError(409, "That email address is already in use");
        throw error;
      }
      if (pending.matchedCount !== 1 || pending.modifiedCount !== 1)
        throw new HttpError(409, "The email change could not be saved");
      if (env.SMTP_HOST && env.SMTP_FROM) {
        try {
          await sendEmailVerification(
            email,
            user.name,
            token,
            env,
            passwordResetTransport,
          );
        } catch (error) {
          req.log.warn(
            { errorType: error?.constructor?.name },
            "Admin email verification delivery failed",
          );
        }
      }
      res.json({
        data: { message: "Verification link sent to the new email address." },
      });
    },
  );
  r.put(
    "/admin/account/password",
    admin,
    validate(accountPasswordSchema),
    async (req, res) => {
      const user = await User.findById(req.user._id).select("+passwordHash");
      if (
        !user ||
        !(await bcrypt.compare(
          req.valid.currentPassword,
          user.passwordHash || "",
        ))
      )
        throw new HttpError(401, "Current password is incorrect");
      if (await bcrypt.compare(req.valid.newPassword, user.passwordHash))
        throw new HttpError(
          422,
          "New password must be different from the current password",
        );
      const updated = await User.updateOne(
        { _id: user._id, role: "admin", passwordHash: user.passwordHash },
        {
          $set: { passwordHash: await bcrypt.hash(req.valid.newPassword, 12) },
          $inc: { sessionVersion: 1 },
        },
      );
      if (updated.matchedCount !== 1 || updated.modifiedCount !== 1)
        throw new HttpError(409, "Password could not be changed");
      res.clearCookie("session", options);
      res.json({
        data: { message: "Password changed. Please sign in again." },
      });
    },
  );
  r.get("/admin/dashboard", async (req, res) => {
    const startToday = new Date();
    startToday.setUTCHours(0, 0, 0, 0);
    const startMonth = new Date(
      Date.UTC(startToday.getUTCFullYear(), startToday.getUTCMonth(), 1),
    );
    const endToday = new Date(startToday);
    endToday.setUTCDate(endToday.getUTCDate() + 1);
    const startTrend = new Date(startToday);
    startTrend.setUTCDate(startTrend.getUTCDate() - 29);
    const endMonth = new Date(
      Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + 1, 1),
    );
    const [
      total,
      newLeads,
      pending,
      inProgress,
      completed,
      cancelled,
      today,
      thisMonth,
      blogs,
      services,
      pages,
      activity,
      statuses,
      trend,
    ] = await Promise.all([
      Lead.countDocuments({ archivedAt: { $exists: false } }),
      Lead.countDocuments({ archivedAt: { $exists: false }, status: "New" }),
      Lead.countDocuments({
        archivedAt: { $exists: false },
        status: { $in: ["Pending", "Contacted"] },
      }),
      Lead.countDocuments({
        archivedAt: { $exists: false },
        status: { $in: ["In Progress", "Qualified"] },
      }),
      Lead.countDocuments({
        archivedAt: { $exists: false },
        status: { $in: ["Completed", "Converted"] },
      }),
      Lead.countDocuments({
        archivedAt: { $exists: false },
        status: { $in: ["Cancelled", "Lost"] },
      }),
      Lead.countDocuments({
        archivedAt: { $exists: false },
        createdAt: { $gte: startToday, $lt: endToday },
      }),
      Lead.countDocuments({
        archivedAt: { $exists: false },
        createdAt: { $gte: startMonth, $lt: endMonth },
      }),
      Blog.countDocuments(visible("blogs")),
      Service.countDocuments(visible("services")),
      Page.countDocuments(visible("pages")),
      Activity.find()
        .sort({ createdAt: -1 })
        .limit(15)
        .populate("actor", "name")
        .lean(),
      Lead.aggregate([
        { $match: { archivedAt: { $exists: false } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Lead.aggregate([
        {
          $match: {
            archivedAt: { $exists: false },
            createdAt: { $gte: startTrend, $lt: endToday },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const trendData = [];
    for (let offset = 29; offset >= 0; offset--) {
      const date = new Date(startToday);
      date.setUTCDate(date.getUTCDate() - offset);
      const key = date.toISOString().slice(0, 10);
      trendData.push({
        date: key,
        count: Number(trend.find((item) => item._id === key)?.count || 0),
      });
    }
    res.json({
      data: {
        total,
        newLeads,
        pending,
        inProgress,
        completed,
        cancelled,
        today,
        thisMonth,
        blogs,
        services,
        pages,
        statuses,
        trend: trendData,
        activity,
      },
    });
  });
  for (const [kind, Model] of Object.entries(resources)) {
    const c = contentController(Model, kind);
    r.get("/admin/" + kind, c.list);
    r.post(
      "/admin/" + kind,
      validate(kind === "categories" ? categorySchema : contentSchema),
      c.create,
    );
    r.put(
      "/admin/" + kind + "/:id",
      validId,
      validate(kind === "categories" ? categorySchema : contentSchema),
      c.update,
    );
    r.delete("/admin/" + kind + "/:id", admin, validId, c.remove);
  }
  const legacyStatuses = {
    Pending: ["Pending", "Contacted"],
    "In Progress": ["In Progress", "Qualified"],
    Completed: ["Completed", "Converted"],
    Cancelled: ["Cancelled", "Lost"],
  };
  const leadFilter = (q) => {
    const f = { archivedAt: { $exists: false } };
    const status = normalizeLeadStatus(q.status);
    if (
      ["New", "Pending", "In Progress", "Completed", "Cancelled"].includes(
        status,
      )
    )
      f.status = {
        $in: [
          status,
          ...(legacyStatuses[status] || []).filter((v) => v !== status),
        ],
      };
    if (typeof q.search === "string" && q.search.trim()) {
      const re = {
        $regex: escaped(q.search.trim().slice(0, 100)),
        $options: "i",
      };
      f.$or = [{ name: re }, { email: re }, { leadId: re }, { phone: re }];
    }
    if (typeof q.service === "string" && q.service) f.service = q.service;
    if (typeof q.budget === "string" && q.budget) f.budget = q.budget;
    if (q.from || q.to) {
      f.createdAt = {};
      if (q.from) f.createdAt.$gte = new Date(q.from);
      if (q.to) {
        const end = new Date(q.to);
        end.setHours(23, 59, 59, 999);
        f.createdAt.$lte = end;
      }
    }
    if (q.oldDays) {
      const days = Number(q.oldDays);
      if (Number.isInteger(days) && days > 0)
        f.createdAt = {
          ...(f.createdAt || {}),
          $lt: new Date(Date.now() - days * 86400000),
        };
    }
    if (typeof q.ids === "string" && q.ids.trim())
      f._id = {
        $in: q.ids.split(",").filter((id) => mongoose.isValidObjectId(id)),
      };
    return f;
  };
  r.get("/admin/leads/export", admin, async (req, res) => {
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="enquiries.csv"',
    });
    res.write(
      "\uFEFF" +
        [
          "name",
          "email",
          "phone",
          "budget",
          "company",
          "service",
          "message",
          "status",
          "notes",
          "createdAt",
          "source",
          "medium",
          "campaign",
        ].join(",") +
        "\r\n",
    );
    for await (const l of Lead.find(leadFilter(req.query))
      .sort({ createdAt: -1 })
      .cursor()) {
      res.write(
        [
          l.name,
          l.email,
          l.phone,
          l.budget,
          l.company,
          l.service,
          l.message,
          l.status,
          l.notes,
          l.createdAt.toISOString(),
          l.attribution?.source,
          l.attribution?.medium,
          l.attribution?.campaign,
        ]
          .map(csvCell)
          .join(",") + "\r\n",
      );
    }
    res.end();
  });
  r.get("/admin/leads/export.xlsx", admin, async (req, res) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Enquiries");
    sheet.columns = [
      { header: "Lead ID", key: "leadId", width: 18 },
      { header: "Name", key: "name", width: 24 },
      { header: "Email", key: "email", width: 28 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Company", key: "company", width: 24 },
      { header: "Service", key: "service", width: 24 },
      { header: "Budget", key: "budget", width: 18 },
      { header: "Message", key: "message", width: 50 },
      { header: "Status", key: "status", width: 16 },
      { header: "Notes", key: "notes", width: 40 },
      { header: "Created At", key: "createdAt", width: 22 },
      { header: "Source", key: "source", width: 18 },
      { header: "Medium", key: "medium", width: 18 },
      { header: "Campaign", key: "campaign", width: 22 },
    ];
    const protect = (value) => {
      const text = String(value ?? "");
      return /^[=+\-@\t\r]/.test(text) || /^[\s]*[=+\-@]/.test(text)
        ? "'" + text
        : text;
    };
    for await (const lead of Lead.find(leadFilter(req.query))
      .sort({ createdAt: -1 })
      .cursor()) {
      sheet.addRow({
        leadId: protect(lead.leadId),
        name: protect(lead.name),
        email: protect(lead.email),
        phone: protect(lead.phone),
        company: protect(lead.company),
        service: protect(lead.service),
        budget: protect(lead.budget),
        message: protect(lead.message),
        status: protect(normalizeLeadStatus(lead.status)),
        notes: protect(lead.notes),
        createdAt: lead.createdAt,
        source: protect(lead.attribution?.source),
        medium: protect(lead.attribution?.medium),
        campaign: protect(lead.attribution?.campaign),
      });
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="enquiries.xlsx"',
    });
    await workbook.xlsx.write(res);
    res.end();
  });
  r.patch(
    "/admin/leads/status",
    admin,
    validate(leadBulkStatus),
    async (req, res) => {
      const ids = req.valid.ids.map((id) => new mongoose.Types.ObjectId(id));
      const leads = await Lead.find({ _id: { $in: ids } });
      const changed = leads.filter(
        (lead) => normalizeLeadStatus(lead.status) !== req.valid.status,
      );
      await Promise.all(
        changed.map(async (lead) => {
          lead.statusHistory.push({
            from: normalizeLeadStatus(lead.status),
            to: req.valid.status,
            changedAt: new Date(),
            changedBy: req.user._id,
          });
          lead.status = req.valid.status;
          await lead.save();
        }),
      );
      await audit(req, "bulk-status-update", "leads", req.valid.status);
      res.json({
        data: {
          matched: leads.length,
          updated: changed.length,
          status: req.valid.status,
        },
      });
    },
  );
  r.get("/admin/leads", async (req, res) => {
    const { page, limit } = pageOptions(req.query);
    const f = leadFilter(req.query);
    const [data, total] = await Promise.all([
      Lead.find(f)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Lead.countDocuments(f),
    ]);
    res.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });
  r.get("/admin/leads/:id", validId, async (req, res) => {
    const data = await Lead.findById(req.params.id);
    if (!data) throw new HttpError(404, "Enquiry not found");
    res.json({ data });
  });
  r.post("/admin/leads/:id/excel-sync", admin, validId, async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) throw new HttpError(404, "Enquiry not found");
    const excel = await syncLeadToExcel(lead, env);
    const excelSync = {
      status: excel.status,
      lastAttemptAt: new Date(),
      lastSyncedAt:
        excel.status === "synced" ? new Date() : lead.excelSync?.lastSyncedAt,
      lastError: excel.status === "failed" ? excel.errorCode : undefined,
    };
    await Lead.updateOne({ _id: lead._id }, { $set: { excelSync } });
    await audit(req, "retry", "lead-excel", lead._id);
    res.json({
      data: {
        status:
          excel.status === "synced"
            ? "Synced"
            : excel.status === "failed"
              ? "Failed"
              : "Pending",
      },
    });
  });
  r.patch(
    "/admin/leads/:id",
    validId,
    validate(leadUpdate),
    async (req, res) => {
      const lead = await Lead.findById(req.params.id);
      if (!lead) throw new HttpError(404, "Enquiry not found");
      const updates = { ...req.valid };
      const customerFields = [
        "name",
        "email",
        "company",
        "phone",
        "budget",
        "service",
        "message",
      ];
      if (
        customerFields.some((key) =>
          Object.prototype.hasOwnProperty.call(updates, key),
        )
      )
        updates.customerFieldsEditedAt = new Date();
      if (updates.status) {
        updates.status = normalizeLeadStatus(updates.status);
        const previousStatus = normalizeLeadStatus(lead.status);
        if (previousStatus !== updates.status) {
          lead.statusHistory.push({
            from: previousStatus,
            to: updates.status,
            changedAt: new Date(),
            changedBy: req.user._id,
          });
        }
      }
      Object.assign(lead, updates);
      await lead.save();
      await audit(req, "update", "leads", lead._id);
      res.json({ data: lead });
    },
  );
  r.get("/admin/settings", admin, async (req, res) =>
    res.json({
      data: (await Settings.findOne({ key: "site" }).lean()) || {
        title: "Digital Mitra Agency",
        email: "digitalmitra@gmail.com",
      },
    }),
  );
  r.put(
    "/admin/settings",
    admin,
    validate(settingsSchema),
    async (req, res) => {
      const data = await Settings.findOneAndUpdate({ key: "site" }, req.valid, {
        upsert: true,
        new: true,
        runValidators: true,
      });
      await audit(req, "update", "settings", data._id);
      res.json({ data });
    },
  );
  r.get("/admin/activity", admin, async (req, res) => {
    const { page, limit } = pageOptions(req.query);
    const [data, total] = await Promise.all([
      Activity.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("actor", "name")
        .lean(),
      Activity.countDocuments(),
    ]);
    res.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) =>
      cb(
        null,
        ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
      ),
  });
  r.get("/admin/media", async (req, res) => {
    const { page, limit } = pageOptions(req.query);
    const [data, total] = await Promise.all([
      Media.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Media.countDocuments(),
    ]);
    res.json({
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  });
  r.post(
    "/admin/media",
    upload.single("image"),
    validate(mediaSchema),
    async (req, res) => {
      if (!req.file)
        throw new HttpError(422, "Upload a JPEG, PNG or WebP image under 5 MB");
      let buffer;
      try {
        const metadata = await sharp(req.file.buffer, {
          limitInputPixels: 40000000,
        }).metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format))
          throw new Error("Unsupported image format");
        buffer = await sharp(req.file.buffer, { limitInputPixels: 40000000 })
          .rotate()
          .resize({
            width: 2000,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw new HttpError(422, "The uploaded file is not a valid image");
      }
      await fs.mkdir(env.UPLOAD_DIR, { recursive: true });
      const filename = crypto.randomUUID() + ".webp";
      await fs.writeFile(path.join(env.UPLOAD_DIR, filename), buffer);
      const data = await Media.create({
        filename,
        url: env.PUBLIC_API_URL + "/uploads/" + filename,
        alt: req.valid.alt,
        mime: "image/webp",
        size: buffer.length,
        uploadedBy: req.user._id,
      });
      await audit(req, "upload", "media", data._id);
      res.status(201).json({ data });
    },
  );
  r.put(
    "/admin/media/:id",
    admin,
    validId,
    upload.single("image"),
    validate(mediaSchema),
    async (req, res) => {
      const item = await Media.findById(req.params.id);
      if (!item) throw new HttpError(404, "Media not found");
      if (!req.file)
        throw new HttpError(422, "Choose a replacement JPEG, PNG or WebP");
      let buffer;
      try {
        const meta = await sharp(req.file.buffer, {
          limitInputPixels: 40000000,
        }).metadata();
        if (!["jpeg", "png", "webp"].includes(meta.format)) throw new Error();
        buffer = await sharp(req.file.buffer, { limitInputPixels: 40000000 })
          .rotate()
          .resize({
            width: 2000,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw new HttpError(422, "The uploaded file is not a valid image");
      }
      const target = path.join(env.UPLOAD_DIR, path.basename(item.filename));
      const temporary = target + "." + crypto.randomUUID() + ".tmp";
      try {
        await fs.writeFile(temporary, buffer);
        await fs.rename(temporary, target);
      } finally {
        await fs.unlink(temporary).catch(() => {});
      }
      item.alt = req.valid.alt;
      item.size = buffer.length;
      await item.save();
      await audit(req, "replace", "media", item._id);
      res.json({ data: item });
    },
  );
  r.patch(
    "/admin/media/:id",
    validId,
    validate(mediaSchema),
    async (req, res) => {
      const data = await Media.findByIdAndUpdate(req.params.id, req.valid, {
        new: true,
      });
      if (!data) throw new HttpError(404, "Media not found");
      await audit(req, "update", "media", data._id);
      res.json({ data });
    },
  );
  r.delete("/admin/media/:id", admin, validId, async (req, res) => {
    const data = await Media.findById(req.params.id);
    if (!data) throw new HttpError(404, "Media not found");
    if (await mediaReferenced(data.url))
      throw new HttpError(
        409,
        "Remove references to this image before deleting it",
      );
    await fs
      .unlink(path.join(env.UPLOAD_DIR, path.basename(data.filename)))
      .catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    await data.deleteOne();
    await audit(req, "delete", "media", data._id);
    res.status(204).end();
  });
  return r;
}
