import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import supertest from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../app.js";
import {
  User,
  Lead,
  Service,
  Media,
  Category,
  Page,
  Settings,
  Activity,
} from "../models/index.js";
import { seed } from "../seed.js";
import { serviceCatalog } from "../services/service-catalog.js";
import { csvCell } from "../services/content.js";
import sharp from "sharp";
import ExcelJS from "exceljs";
import { normalizeLeadStatus } from "../services/leads.js";
const origin = "http://localhost:3000";
const env = {
  NODE_ENV: "test",
  JWT_SECRET: crypto.randomBytes(48).toString("hex"),
  FRONTEND_URL: origin,
  PUBLIC_API_URL: "http://localhost:4000",
  UPLOAD_DIR: ".test-data/uploads",
};
let mongo, app, agent, csrf;
const password = crypto.randomBytes(24).toString("hex");
before(
  async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    await seed();
    await User.create({
      email: "admin@example.com",
      name: "Test Admin",
      role: "admin",
      passwordHash: await bcrypt.hash(password, 12),
    });
    app = createApp(env);
    agent = supertest.agent(app);
    csrf = (await agent.get("/api/v1/auth/csrf")).body.data.token;
  },
  { timeout: 300000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
const write = (method, url, body, client = agent) =>
  client[method](url)
    .set("Origin", origin)
    .set("x-csrf-token", csrf)
    .send(body);

test("page CMS persists sections, FAQ and SEO; drafts and unsafe URLs stay private", async () => {
  const client = supertest.agent(app);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  const save = (method, url, body) =>
    client[method](url)
      .set("Origin", origin)
      .set("x-csrf-token", token)
      .send(body);
  await save("post", "/api/v1/auth/login", {
    email: "admin@example.com",
    password,
  }).expect(200);
  const body = {
    title: "A real editable page",
    slug: "cms-integration-test",
    status: "draft",
    content: "<h2>Useful content</h2>",
    cta: "Discuss the brief",
    ctaUrl: "/contact",
    ogTitle: "A distinct social title",
    ogImage: "https://example.com/social.png",
    sections: [
      {
        key: "approach",
        heading: "Our approach",
        body: "An editable description.",
      },
    ],
    faqs: [
      {
        question: "Can we edit this?",
        answer: "Yes, the content is stored in MongoDB.",
      },
    ],
  };
  const created = await save("post", "/api/v1/admin/pages", body).expect(201);
  const id = created.body.data._id;
  await supertest(app).get("/api/v1/pages/cms-integration-test").expect(404);
  await save("put", "/api/v1/admin/pages/" + id, {
    ...body,
    status: "published",
    ctaUrl: "//evil.example",
  }).expect(422);
  await save("put", "/api/v1/admin/pages/" + id, {
    ...body,
    status: "published",
  }).expect(200);
  const published = await supertest(app)
    .get("/api/v1/pages/cms-integration-test")
    .expect(200);
  assert.equal(published.body.data.sections[0].heading, "Our approach");
  assert.equal(published.body.data.ogTitle, body.ogTitle);
  assert.equal((await Page.findById(id)).faqs[0].answer, body.faqs[0].answer);
  const image = await Media.create({
    url: "https://example.com/section.png",
    filename: "not-a-real-file.webp",
  });
  await Page.updateOne(
    { _id: id },
    { $set: { "sections.0.image": image.url } },
  );
  await save("delete", "/api/v1/admin/media/" + image._id, {}).expect(409);
  await Page.deleteOne({ _id: id });
  await Media.deleteOne({ _id: image._id });
  const settings = await Settings.findOne({ key: "site" }).lean();
  await save("put", "/api/v1/admin/settings", {
    title: "Tech Solutions",
    email: "digitalmitra@gmail.com",
    phone: "+91 90000 00000",
    whatsapp: "919000000000",
    logo: "/logo/digital-mitra-agency.svg",
    footerText: "A real editable footer.",
  }).expect(200);
  const publicSettings = await supertest(app)
    .get("/api/v1/settings")
    .expect(200);
  assert.equal(publicSettings.body.data.whatsapp, "919000000000");
  assert.equal(publicSettings.body.data.footerText, "A real editable footer.");
  await Settings.replaceOne({ key: "site" }, settings);
});

test("phone and budget are validated, persisted and exported without leaking to the public", async () => {
  const isolated = createApp(env);
  const data = {
    name: "Budget Test",
    email: "budget@example.com",
    phone: "+91 98765 43210",
    budget: "25000-50000",
    service: "Website Development",
    message: "We need a practical website for our business.",
  };
  await supertest(isolated)
    .post("/api/v1/leads")
    .set("Origin", origin)
    .send({ ...data, phone: "invalid" })
    .expect(422);
  await supertest(isolated)
    .post("/api/v1/leads")
    .set("Origin", origin)
    .send({ ...data, budget: "unknown" })
    .expect(422);
  const response = await supertest(isolated)
    .post("/api/v1/leads")
    .set("Origin", origin)
    .send(data)
    .expect(201);
  assert.equal(response.body.data.phone, undefined);
  const lead = await Lead.findById(response.body.data.id);
  assert.equal(lead.phone, data.phone);
  assert.equal(lead.budget, data.budget);
  assert.equal(lead.notificationStatus, "disabled");
  const client = supertest.agent(app);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com", password })
    .expect(200);
  const csv = await client
    .get("/api/v1/admin/leads/export?search=budget@example.com")
    .expect(200);
  assert.match(csv.text, /98765 43210/);
  assert.match(csv.text, /25000-50000/);
});

test("media replacement preserves its URL and referenced content while rejecting invalid bytes", async () => {
  const client = supertest.agent(app);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com", password })
    .expect(200);
  const blue = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#2563eb" },
  })
    .png()
    .toBuffer();
  const upload = await client
    .post("/api/v1/admin/media")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .field("alt", "Original image")
    .attach("image", blue, { filename: "blue.png", contentType: "image/png" })
    .expect(201);
  const { url, _id: id } = upload.body.data;
  const before = await supertest(app)
    .get("/uploads/" + upload.body.data.filename)
    .expect(200);
  await client
    .put("/api/v1/admin/media/" + id)
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .field("alt", "Broken image")
    .attach("image", Buffer.from("invalid"), {
      filename: "invalid.png",
      contentType: "image/png",
    })
    .expect(422);
  const cyan = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#06b6d4" },
  })
    .png()
    .toBuffer();
  const replaced = await client
    .put("/api/v1/admin/media/" + id)
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .field("alt", "Replacement image")
    .attach("image", cyan, { filename: "cyan.png", contentType: "image/png" })
    .expect(200);
  assert.equal(replaced.body.data.url, url);
  assert.equal(replaced.body.data.alt, "Replacement image");
  const afterImage = await supertest(app)
    .get("/uploads/" + upload.body.data.filename)
    .expect(200);
  assert.notDeepEqual(afterImage.body, before.body);
  assert.ok(!afterImage.headers["cache-control"].includes("immutable"));
  await client
    .delete("/api/v1/admin/media/" + id)
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .expect(204);
});
test("validation rejects malformed enquiries and stores valid ones without private fields", async () => {
  await supertest(app)
    .post("/api/v1/leads")
    .set("Origin", origin)
    .send({ name: "A", email: "bad", message: "short" })
    .expect(422);
  const r = await supertest(app)
    .post("/api/v1/leads")
    .set("Origin", origin)
    .send({
      name: "Visitor",
      email: "visitor@example.com",
      message: "I would like to discuss our marketing plans.",
      attribution: { source: "test" },
    })
    .expect(201);
  assert.ok(r.body.data.id);
  assert.equal(r.body.data.email, undefined);
  const saved = await Lead.findById(r.body.data.id);
  assert.equal(saved.attribution.source, "test");
  assert.match(saved.leadId, /^DMA-\d{4}-[0-9A-F]{8}$/);
});
test("Phase 1 lead IDs are unique and legacy statuses have explicit mappings", async () => {
  assert.equal(normalizeLeadStatus("Contacted"), "Pending");
  assert.equal(normalizeLeadStatus("Qualified"), "In Progress");
  assert.equal(normalizeLeadStatus("Converted"), "Completed");
  assert.equal(normalizeLeadStatus("Lost"), "Cancelled");
  const first = await Lead.create({
    name: "First Phase One Lead",
    email: "phase-one-1@example.com",
    message: "Phase one lead model test.",
  });
  const second = await Lead.create({
    name: "Second Phase One Lead",
    email: "phase-one-2@example.com",
    message: "Phase one lead model test.",
  });
  assert.ok(first.leadId);
  assert.ok(second.leadId);
  assert.notEqual(first.leadId, second.leadId);
});
test("private APIs, wrong origins and CSRF are denied", async () => {
  await supertest(app).get("/api/v1/admin/leads").expect(401);
  await agent
    .post("/api/v1/auth/login")
    .set("Origin", "https://evil.example")
    .send({})
    .expect(403);
  await agent
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .send({})
    .expect(403);
});
test("login, protected CRUD, publication, roles, notes, CSV and logout", async () => {
  await write("post", "/api/v1/auth/login", {
    email: "admin@example.com",
    password: "incorrect",
  }).expect(401);
  const login = await write("post", "/api/v1/auth/login", {
    email: "admin@example.com",
    password,
  }).expect(200);
  assert.match(login.headers["set-cookie"].join(";"), /HttpOnly/);
  assert.match(login.headers["set-cookie"].join(";"), /SameSite=Strict/);
  assert.equal(login.body.data.passwordHash, undefined);
  await agent.get("/api/v1/auth/me").expect(200);
  const draft = {
    title: "Draft article",
    slug: "draft-article",
    content:
      '<p>Safe</p><script>alert(1)</script><a href="javascript:alert(1)">bad link</a>',
    status: "draft",
  };
  let r = await write("post", "/api/v1/admin/blogs", draft).expect(201);
  const id = r.body.data._id;
  assert.ok(!r.body.data.content.includes("<script"));
  assert.ok(!r.body.data.content.includes("javascript:"));
  await supertest(app).get("/api/v1/blogs/draft-article").expect(404);
  await write("post", "/api/v1/admin/blogs", draft).expect(409);
  await write("put", "/api/v1/admin/blogs/" + id, {
    ...draft,
    status: "scheduled",
  }).expect(422);
  await write("put", "/api/v1/admin/blogs/" + id, {
    ...draft,
    status: "scheduled",
    publishAt: new Date(Date.now() + 3600000).toISOString(),
  }).expect(200);
  await supertest(app).get("/api/v1/blogs/draft-article").expect(404);
  await write("put", "/api/v1/admin/blogs/" + id, {
    ...draft,
    status: "scheduled",
    publishAt: new Date(Date.now() - 1000).toISOString(),
  }).expect(200);
  await supertest(app).get("/api/v1/blogs/draft-article").expect(200);
  await write("put", "/api/v1/admin/blogs/" + id, {
    ...draft,
    status: "draft",
  }).expect(200);
  await supertest(app).get("/api/v1/blogs/draft-article").expect(404);
  const lead = await Lead.findOne();
  const original = lead.createdAt.toISOString();
  await write("patch", "/api/v1/admin/leads/" + lead._id, {
    status: "Qualified",
    notes: "Private follow up",
  }).expect(200);
  const updatedLead = await Lead.findById(lead._id);
  assert.equal(updatedLead.status, "In Progress");
  assert.equal(updatedLead.createdAt.toISOString(), original);
  assert.equal(updatedLead.statusHistory.at(-1).to, "In Progress");
  await write("patch", "/api/v1/admin/leads/" + lead._id, {
    status: "Completed",
    company: "Updated Company",
  }).expect(200);
  const editedLead = await Lead.findById(lead._id);
  assert.equal(editedLead.status, "Completed");
  assert.equal(editedLead.company, "Updated Company");
  assert.ok(editedLead.customerFieldsEditedAt);
  await supertest(app).get("/api/v1/leads").expect(404);
  const csv = await agent.get("/api/v1/admin/leads/export").expect(200);
  assert.match(csv.text, /Private follow up/);
  const dashboard = await agent.get("/api/v1/admin/dashboard").expect(200);
  assert.equal(dashboard.body.data.trend.length, 30);
  assert.ok(dashboard.body.data.cancelled >= 0);
  assert.ok(dashboard.body.data.today >= 0);
  assert.ok(dashboard.body.data.thisMonth >= dashboard.body.data.today);
  for (const kind of ["services", "portfolio", "testimonials", "categories"]) {
    const body =
      kind === "categories"
        ? { title: "Test Category", slug: "test-category" }
        : { title: "Test Record", slug: "test-record", status: "published" };
    const item = await write("post", "/api/v1/admin/" + kind, body).expect(201);
    if (["portfolio", "testimonials"].includes(kind)) {
      await supertest(app)
        .get("/api/v1/" + kind + "/test-record")
        .expect(404);
      await write("put", "/api/v1/admin/" + kind + "/" + item.body.data._id, {
        ...body,
        approved: true,
        clientConsent: true,
      }).expect(200);
      await supertest(app)
        .get("/api/v1/" + kind + "/test-record")
        .expect(200);
    }
    await write(
      "delete",
      "/api/v1/admin/" + kind + "/" + item.body.data._id,
    ).expect(204);
  }
  await write("delete", "/api/v1/admin/blogs/" + id).expect(204);
  await write("put", "/api/v1/admin/settings", {
    title: "Tech Solutions",
    email: "hello@example.com",
  }).expect(200);
  assert.equal(
    (await supertest(app).get("/api/v1/settings")).body.data.email,
    "hello@example.com",
  );
  await write("post", "/api/v1/auth/logout").expect(204);
  await agent.get("/api/v1/admin/leads").expect(401);
});
test("CSV neutralizes spreadsheet formulas", () =>
  assert.equal(csvCell("=1+1"), '"\'=1+1"'));
test("lead filters, bulk status updates and XLSX exports work for administrators", async () => {
  const client = supertest.agent(app);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com", password })
    .expect(200);
  const first = await Lead.create({
    leadId: "LM-TEST-1",
    name: "=SUM(1,1)",
    email: "filter@example.com",
    phone: "+91 98765 12345",
    service: "Website Development",
    budget: "25000-50000",
    message: "Bulk export filter test enquiry.",
    status: "New",
    createdAt: new Date(Date.now() - 100 * 86400000),
  });
  const second = await Lead.create({
    leadId: "LM-TEST-2",
    name: "Selected Lead",
    email: "selected@example.com",
    phone: "+91 98765 54321",
    service: "SEO",
    budget: "under-25000",
    message: "Second bulk export filter test.",
    status: "Pending",
  });
  const list = await client
    .get(
      "/api/v1/admin/leads?search=98765+12345&service=Website+Development&budget=25000-50000&oldDays=30",
    )
    .expect(200);
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0]._id, String(first._id));
  await client
    .patch("/api/v1/admin/leads/status")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ ids: [String(first._id), String(second._id)], status: "Completed" })
    .expect(200);
  assert.equal(
    normalizeLeadStatus((await Lead.findById(first._id)).status),
    "Completed",
  );
  const binaryParser = (res, callback) => {
    res.setEncoding("binary");
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => callback(null, Buffer.from(data, "binary")));
  };
  const exported = await client
    .get(`/api/v1/admin/leads/export.xlsx?ids=${first._id},${second._id}`)
    .buffer(true)
    .parse(binaryParser)
    .expect(200);
  assert.equal(
    exported.headers["content-type"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exported.body);
  const sheet = workbook.getWorksheet("Enquiries");
  assert.equal(sheet.actualRowCount, 3);
  assert.ok(
    [...sheet.getRows(2, sheet.actualRowCount)]
      .flatMap((row) => [row.getCell(2).value])
      .includes("'=SUM(1,1)"),
  );
  await client
    .get("/api/v1/admin/leads/export.xlsx?status=Completed")
    .expect(200);
  await client
    .patch("/api/v1/admin/leads/status")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ ids: [String(first._id)], status: "Invalid" })
    .expect(422);
});
test("public services come from MongoDB and admin details stay private", async () => {
  const r = await supertest(app).get("/api/v1/services").expect(200);
  assert.equal(r.body.data.length, 12);
  assert.equal(r.body.pagination.total, serviceCatalog.length);
  assert.equal(await Service.countDocuments(), serviceCatalog.length + 3);
  const all = await supertest(app).get("/api/v1/services?limit=100").expect(200);
  assert.deepEqual(
    all.body.data.map((service) => service.slug).sort(),
    serviceCatalog.map((service) => service.slug).sort(),
  );
  assert.equal(r.body.data[0].passwordHash, undefined);
});
test("empty status filters show records and editors cannot perform admin-only actions", async () => {
  const editor = supertest.agent(app);
  const token = (await editor.get("/api/v1/auth/csrf")).body.data.token;
  await User.create({
    name: "Editor",
    email: "editor@example.com",
    role: "editor",
    passwordHash: await bcrypt.hash(password, 12),
  });
  const post = (method, url, body) =>
    editor[method](url)
      .set("Origin", origin)
      .set("x-csrf-token", token)
      .send(body);
  await post("post", "/api/v1/auth/login", {
    email: "editor@example.com",
    password,
  }).expect(200);
  const list = await editor
    .get("/api/v1/admin/services?status=&search=")
    .expect(200);
  assert.equal(list.body.data.length, 12);
  assert.equal(list.body.pagination.total, await Service.countDocuments());
  await editor.get("/api/v1/admin/settings").expect(403);
  await editor.get("/api/v1/admin/leads/export").expect(403);
  await post("post", "/api/v1/admin/testimonials", {
    title: "A quote",
    slug: "not-approved",
  }).expect(403);
  const service = await Service.findOne();
  await post("delete", "/api/v1/admin/services/" + service._id).expect(403);
  await post("put", "/api/v1/admin/services/" + service._id, {
    title: service.title,
    slug: service.slug,
    status: "published",
    excerpt: service.excerpt,
    content: service.content,
  }).expect(200);
  await editor
    .put("/api/v1/admin/services/" + service._id)
    .set("Origin", origin)
    .send({})
    .expect(403);
});
test("media validates decoded type, preserves metadata and prevents deleting referenced images", async () => {
  const client = supertest.agent(app);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com", password })
    .expect(200);
  await client
    .post("/api/v1/admin/media")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .field("alt", "Invalid file")
    .attach("image", Buffer.from("not an image"), {
      filename: "test.png",
      contentType: "image/png",
    })
    .expect(422);
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#1765ed" },
  })
    .png()
    .toBuffer();
  const r = await client
    .post("/api/v1/admin/media")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .field("alt", "Blue test square")
    .attach("image", png, { filename: "test.png", contentType: "image/png" })
    .expect(201);
  assert.equal(r.body.data.mime, "image/webp");
  const record = await Media.findById(r.body.data._id);
  assert.equal(record.alt, "Blue test square");
  await supertest(app)
    .get("/uploads/" + record.filename)
    .expect(200);
  const service = await Service.findOne();
  await Service.updateOne({ _id: service._id }, { image: record.url });
  await client
    .delete("/api/v1/admin/media/" + record._id)
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .expect(409);
  await Service.updateOne({ _id: service._id }, { image: "" });
  await client
    .delete("/api/v1/admin/media/" + record._id)
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .expect(204);
});
test("referenced categories cannot be removed or renamed", async () => {
  const client = supertest.agent(app);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com", password })
    .expect(200);
  const cat = await Category.findOne({ slug: "strategy" });
  await client
    .delete("/api/v1/admin/categories/" + cat._id)
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .expect(409);
  await client
    .put("/api/v1/admin/categories/" + cat._id)
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ title: "Strategy", slug: "renamed" })
    .expect(409);
});
test("login and public enquiries enforce rate limits", async () => {
  const isolated = createApp(env);
  const client = supertest.agent(isolated);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  for (let i = 0; i < 10; i++)
    await client
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .set("x-csrf-token", token)
      .send({ email: "no-user@example.com", password: "invalid" })
      .expect(401);
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "no-user@example.com", password: "invalid" })
    .expect(429);
  for (let i = 0; i < 5; i++)
    await client
      .post("/api/v1/leads")
      .set("Origin", origin)
      .send({})
      .expect(422);
  await client.post("/api/v1/leads").set("Origin", origin).send({}).expect(429);
});

test("admin password reset is generic, single-use, and invalidates sessions", async () => {
  let resetEmail;
  const resetEnv = {
    ...env,
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "admin@example.com",
  };
  const resetApp = createApp(resetEnv, {
    passwordResetTransport: {
      sendMail: async (message) => {
        resetEmail = message;
        return { accepted: [message.to], rejected: [] };
      },
    },
  });

  const client = supertest.agent(resetApp);
  let token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/forgot-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "missing@example.com" })
    .expect(200);
  await client
    .post("/api/v1/auth/forgot-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "  ADMIN@EXAMPLE.COM  " })
    .expect(200);
  const link = resetEmail.text.match(/https?:\/\/\S+token=([^\s]+)/)[0];
  const resetToken = new URL(link).searchParams.get("token");
  assert.ok(resetToken);
  const stored = await User.findOne({ email: "admin@example.com" }).select(
    "+passwordResetHash +passwordHash",
  );
  assert.equal(stored.email, "admin@example.com");
  assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
  assert.equal(await bcrypt.compare(password, stored.passwordHash), true);
  assert.equal(
    stored.passwordResetHash,
    crypto.createHash("sha256").update(resetToken).digest("hex"),
  );
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  for (let i = 0; i < 3; i++)
    await client
      .post("/api/v1/auth/forgot-password")
      .set("Origin", origin)
      .set("x-csrf-token", token)
      .send({ email: "admin@example.com" })
      .expect(200);
  await client
    .post("/api/v1/auth/forgot-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com" })
    .expect(429);
  const resetHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  await User.updateOne(
    { email: "admin@example.com" },
    {
      $set: {
        passwordResetHash: resetHash,
        passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    },
  );
  await client
    .post("/api/v1/auth/forgot-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com" })
    .expect(429);
  await User.updateOne(
    { email: "admin@example.com" },
    { $set: { passwordResetExpires: new Date(Date.now() - 1000) } },
  );
  await client
    .post("/api/v1/auth/reset-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({
      token: resetToken,
      password: "NewPassword123!",
      confirmPassword: "NewPassword123!",
    })
    .expect(400);
  await User.updateOne(
    { email: "admin@example.com" },
    { $set: { passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000) } },
  );
  await client
    .post("/api/v1/auth/reset-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({
      token: "0".repeat(64),
      password: "NewPassword123!",
      confirmPassword: "NewPassword123!",
    })
    .expect(400);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com", password })
    .expect(200);
  await client.get("/api/v1/admin/leads").expect(200);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/reset-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({
      token: resetToken,
      password: "NewPassword123!",
      confirmPassword: "NewPassword123!",
    })
    .expect(200);
  const resetUser = await User.findById(stored._id).select(
    "+passwordHash +passwordResetHash",
  );
  assert.equal(resetUser.email, stored.email);
  assert.equal(bcrypt.getRounds(resetUser.passwordHash), 12);
  assert.equal(await bcrypt.compare("NewPassword123!", resetUser.passwordHash), true);
  assert.equal(await bcrypt.compare(password, resetUser.passwordHash), false);
  assert.equal(resetUser.passwordResetHash, undefined);
  assert.equal(resetUser.passwordResetExpires, undefined);
  assert.equal(resetUser.sessionVersion, stored.sessionVersion + 1);
  assert.ok(resetUser.passwordChangedAt instanceof Date);
  await client.get("/api/v1/admin/leads").expect(401);
  await client
    .post("/api/v1/auth/reset-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({
      token: resetToken,
      password: "NewPassword456!",
      confirmPassword: "NewPassword456!",
    })
    .expect(400);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com", password })
    .expect(401);
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "  ADMIN@EXAMPLE.COM  ", password: "NewPassword123!" })
    .expect(200);
});

test("forgot password reports missing SMTP and provider failures without retaining undelivered tokens", async () => {
  const requestReset = async (target, email) => {
    const client = supertest.agent(target);
    const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
    return client.post("/api/v1/auth/forgot-password")
      .set("Origin", origin).set("x-csrf-token", token).send({ email });
  };
  const missing = createApp({ ...env, SMTP_HOST: "", SMTP_FROM: "" });
  for (const email of ["admin@example.com", "missing@example.com"]) {
    const response = await requestReset(missing, email);
    assert.equal(response.status, 503);
    assert.match(response.body.error.message, /configure SMTP/);
  }
  const failed = createApp({ ...env, SMTP_HOST: "smtp.example.test", SMTP_FROM: "admin@example.com" }, {
    passwordResetTransport: { sendMail: async () => { throw new Error("Provider unavailable"); } },
  });
  const response = await requestReset(failed, "admin@example.com");
  assert.equal(response.status, 503);
  assert.match(response.body.error.message, /could not be sent/);
  const user = await User.findOne({ email: "admin@example.com" }).select("+passwordResetHash");
  assert.equal(user.passwordResetHash, undefined);
  assert.equal(user.passwordResetExpires, undefined);
});

test("password reset links use the canonical frontend URL for localhost and LAN requests", async () => {
  const lan = "http://10.184.142.31:3000";
  const resetEmails = [];
  const resetEnv = {
    ...env,
    FRONTEND_URL: lan,
    FRONTEND_URLS: origin,
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "admin@example.com",
  };
  const resetApp = createApp(resetEnv, {
    passwordResetTransport: {
      sendMail: async (message) => {
        resetEmails.push(message);
        return { accepted: [message.to], rejected: [] };
      },
    },
  });
  const client = supertest.agent(resetApp);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/forgot-password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com" })
    .expect(200);
  await client
    .post("/api/v1/auth/forgot-password")
    .set("Origin", lan)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com" })
    .expect(200);
  assert.equal(resetEmails.length, 2);
  const links = resetEmails.map(
    (email) => email.text.match(/https?:\/\/\S+token=[^\s]+/)[0],
  );
  for (const link of links) {
    const url = new URL(link);
    assert.equal(url.origin, lan);
    assert.equal(url.pathname, "/admin/reset-password");
    assert.ok(url.searchParams.get("token"));
  }
});

test("admin account email and password changes require verification and invalidate sessions", async () => {
  await User.updateOne(
    { email: "admin@example.com" },
    {
      $set: {
        passwordHash: await bcrypt.hash("OldPassword123!", 12),
        sessionVersion: 0,
      },
      $unset: { pendingEmail: 1, pendingEmailHash: 1, pendingEmailExpires: 1 },
    },
  );
  let verificationEmail;
  const accountEnv = {
    ...env,
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: "",
    SMTP_PASS: "",
    SMTP_FROM: "admin@example.com",
  };
  const accountApp = createApp(accountEnv, {
    passwordResetTransport: {
      sendMail: async (message) => {
        verificationEmail = message;
      },
    },
  });
  const client = supertest.agent(accountApp);
  let token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "admin@example.com", password: "OldPassword123!" })
    .expect(200);
  await client.get("/api/v1/admin/leads").expect(200);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/admin/account/email")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "verified-admin@example.com", password: "OldPassword123!" })
    .expect(200);
  assert.ok(verificationEmail);
  const verificationToken = new URL(
    verificationEmail.text.match(/https?:\/\/\S+/)[0],
  ).searchParams.get("token");
  const pending = await User.findOne({ email: "admin@example.com" }).select(
    "+pendingEmailHash",
  );
  assert.equal(pending.pendingEmail, "verified-admin@example.com");
  assert.equal(
    pending.pendingEmailHash,
    crypto.createHash("sha256").update(verificationToken).digest("hex"),
  );
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/verify-email")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ token: verificationToken })
    .expect(200);
  await client.get("/api/v1/admin/leads").expect(401);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "verified-admin@example.com", password: "OldPassword123!" })
    .expect(200);
  await client.get("/api/v1/admin/leads").expect(200);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .put("/api/v1/admin/account/password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      confirmPassword: "NewPassword123!",
    })
    .expect(200);
  await client.get("/api/v1/admin/leads").expect(401);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "verified-admin@example.com", password: "OldPassword123!" })
    .expect(401);
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: "verified-admin@example.com", password: "NewPassword123!" })
    .expect(200);
});

test("email verification rejects expired tokens without changing the admin email", async () => {
  const token = "expired-verification-token";
  const user = await User.findOne({ role: "admin" });
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        pendingEmail: "expired-admin@example.com",
        pendingEmailHash: crypto
          .createHash("sha256")
          .update(token)
          .digest("hex"),
        pendingEmailExpires: new Date(Date.now() - 1000),
      },
    },
  );
  const client = supertest.agent(app);
  const csrfToken = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/verify-email")
    .set("Origin", origin)
    .set("x-csrf-token", csrfToken)
    .send({ token })
    .expect(400);
  const unchanged = await User.findById(user._id);
  assert.equal(unchanged.pendingEmail, "expired-admin@example.com");
  assert.equal(unchanged.email, user.email);
  await User.updateOne(
    { _id: user._id },
    {
      $unset: { pendingEmail: 1, pendingEmailHash: 1, pendingEmailExpires: 1 },
    },
  );
});

test("email verification fails safely when MongoDB does not update the admin", async () => {
  const user = await User.findOne({ role: "admin" });
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        pendingEmail: "unverified-admin@example.com",
        pendingEmailHash: hash,
        pendingEmailExpires: new Date(Date.now() + 15 * 60 * 1000),
      },
    },
  );
  const originalUpdateOne = User.updateOne;
  User.updateOne = async () => ({
    acknowledged: true,
    matchedCount: 1,
    modifiedCount: 0,
  });
  try {
    const client = supertest.agent(app);
    const csrfToken = (await client.get("/api/v1/auth/csrf")).body.data.token;
    await client
      .post("/api/v1/auth/verify-email")
      .set("Origin", origin)
      .set("x-csrf-token", csrfToken)
      .send({ token })
      .expect(500);
  } finally {
    User.updateOne = originalUpdateOne;
  }
  const unchanged = await User.findById(user._id);
  assert.equal(unchanged.email, user.email);
  assert.equal(unchanged.pendingEmail, "unverified-admin@example.com");
  await User.updateOne(
    { _id: user._id },
    {
      $unset: { pendingEmail: 1, pendingEmailHash: 1, pendingEmailExpires: 1 },
    },
  );
});

test("account password changes reject wrong and invalid passwords", async () => {
  const admin = await User.findOne({ role: "admin" });
  await User.updateOne(
    { _id: admin._id },
    {
      $set: {
        passwordHash: await bcrypt.hash(password, 12),
        sessionVersion: 0,
      },
      $unset: { pendingEmail: 1, pendingEmailHash: 1, pendingEmailExpires: 1 },
    },
  );
  const client = supertest.agent(createApp(env));
  const loginToken = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", loginToken)
    .send({ email: admin.email, password })
    .expect(200);
  let token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .put("/api/v1/admin/account/password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({
      currentPassword: "incorrect",
      newPassword: "NewPassword123!",
      confirmPassword: "NewPassword123!",
    })
    .expect(401);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .put("/api/v1/admin/account/password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({
      currentPassword: password,
      newPassword: "short",
      confirmPassword: "short",
    })
    .expect(422);
  token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .put("/api/v1/admin/account/password")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({
      currentPassword: password,
      newPassword: "NewPassword123!",
      confirmPassword: "DifferentPassword123!",
    })
    .expect(422);
});

test("account email changes reject duplicate admin email addresses", async () => {
  const admin = await User.findOne({ role: "admin" });
  await User.updateOne(
    { _id: admin._id },
    {
      $set: {
        passwordHash: await bcrypt.hash(password, 12),
        sessionVersion: 0,
      },
      $unset: { pendingEmail: 1, pendingEmailHash: 1, pendingEmailExpires: 1 },
    },
  );
  await User.updateOne(
    { email: "duplicate@example.com", role: "editor" },
    { $set: { email: "duplicate@example.com", role: "editor" } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  const client = supertest.agent(createApp(env));
  const loginToken = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .set("x-csrf-token", loginToken)
    .send({ email: admin.email, password })
    .expect(200);
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  await client
    .post("/api/v1/admin/account/email")
    .set("Origin", origin)
    .set("x-csrf-token", token)
    .send({ email: " duplicate@example.com ", password })
    .expect(409);
  await User.deleteOne({ email: "duplicate@example.com", role: "editor" });
});

test("password recovery never reports success for an unpersisted token or failed password update", async () => {
  const current = await User.findOne({ role: "admin" }).select("+passwordHash");
  let deliveries = 0;
  const target = createApp({ ...env, SMTP_HOST: "smtp.example.test", SMTP_FROM: "admin@example.com" }, {
    passwordResetTransport: { sendMail: async () => { deliveries++; } },
  });
  const client = supertest.agent(target);
  const csrfToken = (await client.get("/api/v1/auth/csrf")).body.data.token;
  const post = (path, body) => client.post(path).set("Origin", origin).set("x-csrf-token", csrfToken).send(body);
  const original = User.updateOne;
  User.updateOne = async () => ({ matchedCount: 0, modifiedCount: 0 });
  try {
    const response = await post("/api/v1/auth/forgot-password", { email: current.email }).expect(409);
    assert.equal(response.body.data, undefined);
    assert.equal(deliveries, 0);
  } finally { User.updateOne = original; }
  await post("/api/v1/auth/login", { email: { $ne: null }, password: { $ne: null } }).expect(422);
  const resetToken = crypto.randomBytes(32).toString("hex");
  await User.updateOne({ _id: current._id }, { $set: {
    passwordResetHash: crypto.createHash("sha256").update(resetToken).digest("hex"),
    passwordResetExpires: new Date(Date.now() + 60000),
  } });
  await post("/api/v1/auth/reset-password", { token: resetToken, password, confirmPassword: password }).expect(422);
  const fresh = crypto.randomBytes(24).toString("hex");
  User.updateOne = async () => ({ matchedCount: 1, modifiedCount: 0 });
  try {
    const response = await post("/api/v1/auth/reset-password", { token: resetToken, password: fresh, confirmPassword: fresh }).expect(400);
    assert.equal(response.body.data, undefined);
  } finally { User.updateOne = original; }
  const after = await User.findById(current._id).select("+passwordHash");
  assert.equal(after.passwordHash, current.passwordHash);
  await User.updateOne({ _id: current._id }, { $unset: { passwordResetHash: 1, passwordResetExpires: 1 } });
});

test("all content modules support validated CRUD, scheduling, search, pagination and immutable audit history", async () => {
  const current = await User.findOne({ role: "admin" });
  const client = supertest.agent(createApp(env));
  const token = (await client.get("/api/v1/auth/csrf")).body.data.token;
  const send = (method, path, body) => client[method](path).set("Origin", origin).set("x-csrf-token", token).send(body);
  await send("post", "/api/v1/auth/login", { email: current.email, password }).expect(200);
  const suffix = crypto.randomBytes(5).toString("hex");
  for (const kind of ["blogs", "services", "portfolio", "testimonials", "pages", "categories"]) {
    const slug = `module-${kind}-${suffix}`;
    const base = { title: `Module ${kind} ${suffix}`, slug };
    const body = kind === "categories" ? { ...base, description: "Module verification" } : {
      ...base, status: "draft", content: '<p>Safe content</p><script>alert(1)</script>',
      excerpt: "Verified module", approved: true, clientConsent: true,
      seoTitle: `Module ${kind}`, metaDescription: "Module metadata", image: "/media/web-development.jpg", imageAlt: "Development workspace",
    };
    await send("post", `/api/v1/admin/${kind}`, { ...body, slug: "bad slug" }).expect(422);
    const created = await send("post", `/api/v1/admin/${kind}`, body).expect(201);
    const id = created.body.data._id;
    await send("post", `/api/v1/admin/${kind}`, body).expect(409);
    const listed = await client.get(`/api/v1/admin/${kind}?search=${suffix}&limit=1&page=1`).expect(200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0]._id, id);
    assert.equal(listed.body.pagination.limit, 1);
    if (kind !== "categories") {
      assert.ok(!created.body.data.content.includes("<script"));
      await supertest(app).get(`/api/v1/${kind}/${slug}`).expect(404);
      await send("put", `/api/v1/admin/${kind}/${id}`, { ...body, status: "scheduled", publishAt: new Date(Date.now() + 3600000).toISOString() }).expect(200);
      await supertest(app).get(`/api/v1/${kind}/${slug}`).expect(404);
      await send("put", `/api/v1/admin/${kind}/${id}`, { ...body, status: "scheduled", publishAt: new Date(Date.now() - 1000).toISOString() }).expect(200);
      await supertest(app).get(`/api/v1/${kind}/${slug}`).expect(200);
    }
    await send("put", `/api/v1/admin/${kind}/${id}`, { ...body, title: `Updated ${base.title}`, ...(kind === "categories" ? {} : { status: "published", publishAt: null }) }).expect(200);
    await send("delete", `/api/v1/admin/${kind}/${id}`).expect(204);
    await send("put", `/api/v1/admin/${kind}/${id}`, body).expect(404);
    const history = await Activity.find({ resource: kind, resourceId: id }).lean();
    for (const action of ["create", "update", "delete"]) assert.ok(history.some((item) => item.action === action));
  }
  const dashboard = await client.get("/api/v1/admin/dashboard").expect(200);
  const latestActivity = await Activity.find().sort({ createdAt: -1, _id: -1 }).limit(5).lean();
  assert.deepEqual(dashboard.body.data.activity.map(row => row._id), latestActivity.map(row => String(row._id)));
  const activity = await client.get("/api/v1/admin/activity?limit=1&page=1").expect(200);
  assert.equal(activity.body.pagination.limit, 10);
  assert.equal(activity.body.data.length, 10);
  const nextActivity = await client.get("/api/v1/admin/activity?limit=100&page=2").expect(200);
  assert.equal(nextActivity.body.pagination.limit, 10);
  assert.equal(nextActivity.body.pagination.page, 2);
  assert.ok(nextActivity.body.data.every(row => !activity.body.data.some(first => first._id === row._id)));
  await send("post", "/api/v1/admin/activity", {}).expect(404);
  await send("delete", `/api/v1/admin/activity/${activity.body.data[0]._id}`).expect(404);
});
