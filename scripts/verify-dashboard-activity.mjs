import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseEnv } from "node:util";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { chromium } from "@playwright/test";
import { User, Activity } from "../backend/src/models/index.js";

// Read-only local verification. No passwords, audit writes or account changes.
const env = parseEnv(await fs.readFile("backend/.env", "utf8"));
assert.ok(["localhost", "127.0.0.1"].includes(new URL(env.MONGODB_URI).hostname));
let browser;
try {
  await mongoose.connect(env.MONGODB_URI, { autoIndex: false });
  const user = await User.findOne({ role: "admin" }).lean();
  assert.ok(user);
  const before = JSON.stringify(await Activity.find().sort({ _id: 1 }).lean());
  const total = await Activity.countDocuments();
  const latest = await Activity.find().sort({ createdAt: -1, _id: -1 }).limit(5).lean();
  const session = jwt.sign({ version: user.sessionVersion }, env.JWT_SECRET, {
    subject: String(user._id), expiresIn: "5m", issuer: "tech-solution-agency", audience: "admin", algorithm: "HS256",
  });
  browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await context.addCookies([{ name: "session", value: session, url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => { if (new URL(r.url()).pathname.startsWith("/api/v1/admin/")) console.log(JSON.stringify({ path: new URL(r.url()).pathname, status: r.status() })); });
  const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/admin/dashboard" && r.status() === 200, { timeout: 60000 });
  await page.goto("http://localhost:3000/admin");
  console.log(JSON.stringify({ pathname: new URL(page.url()).pathname, headings: await page.locator("h1").allTextContents() }));
  const response = await responsePromise;
  const body = await response.json();
  assert.equal(body.data.activity.length, Math.min(total, 5));
  assert.deepEqual(body.data.activity.map(r => r._id), latest.map(r => String(r._id)));
  const panel = page.locator(".admin-panel").filter({ has: page.getByRole("heading", { name: "Recent activity", exact: true }) });
  await panel.getByRole("link", { name: "View All Activity", exact: true }).waitFor();
  assert.equal(await panel.locator("tbody tr").count(), Math.min(total, 5));
  const rendered = await panel.locator("tbody tr").allTextContents();
  for (let i = 0; i < latest.length; i++) {
    if (latest[i].action === "login") assert.ok(rendered[i].includes("Admin Login"));
    if (latest[i].resource === "auth") assert.ok(rendered[i].includes("Authentication"));
  }
  await fs.mkdir(".test-data", { recursive: true });
  await page.screenshot({ path: ".test-data/dashboard-activity.png", fullPage: true });
  const firstResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/admin/activity" && r.status() === 200);
  await panel.getByRole("link", { name: "View All Activity", exact: true }).click();
  const first = await (await firstResponse).json();
  assert.equal(first.pagination.limit, 10);
  assert.equal(first.data.length, Math.min(total, 10));
  await page.waitForFunction(count => document.querySelectorAll("main tbody tr").length === count, Math.min(total, 10));
  let secondPage = null;
  if (total > 10) {
    const nextResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/admin/activity" && new URL(r.url()).searchParams.get("page") === "2" && r.status() === 200);
    await page.getByRole("button", { name: /Next/ }).click();
    const next = await (await nextResponse).json();
    assert.equal(next.pagination.page, 2);
    assert.equal(next.pagination.limit, 10);
    assert.ok(next.data.every(r => !first.data.some(a => a._id === r._id)));
    await page.waitForFunction(count => document.querySelectorAll("main tbody tr").length === count, Math.min(total - 10, 10));
    secondPage = { apiCount: next.data.length, visibleCount: await page.locator("main tbody tr").count() };
  }
  assert.equal(JSON.stringify(await Activity.find().sort({ _id: 1 }).lean()), before);
  assert.deepEqual(errors, []);
  const result = { url: "http://localhost:3000/admin", dashboardApiStatus: response.status(), dashboardApiCount: body.data.activity.length, dashboardVisibleCount: rendered.length, latestIdsMatchDatabase: true, uiLabelsVerified: true, viewAllLinkVerified: true, activityPage: { pagination: first.pagination, apiCount: first.data.length, visibleCount: Math.min(total, 10), secondPage }, auditRecordsUnchanged: true, browserErrors: errors, authentication: "temporary in-memory local verification session; no password or account changes" };
  await fs.writeFile(".test-data/dashboard-activity-verification.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  await page.goto("http://localhost:3000/admin");
} finally {
  await browser?.close();
  await mongoose.disconnect();
}
