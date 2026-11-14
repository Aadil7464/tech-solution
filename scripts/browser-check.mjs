/** @format */

import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { User, Lead, Blog, Activity } from "../backend/src/models/index.js";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const id = crypto.randomBytes(6).toString("hex");
const email = `browser-${id}@example.com`;
const password = crypto.randomBytes(20).toString("hex");
let browser, user;
try {
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tech_solution_agency",
  );
  user = await User.create({
    email,
    name: "Browser Test",
    role: "admin",
    passwordHash: await bcrypt.hash(password, 12),
  });
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fs.mkdir(".test-data", { recursive: true });
  let response = await page.goto(base);
  assert.equal(response.status(), 200);
  await page.getByRole("heading", { level: 1 }).waitFor();
  assert.ok(
    await page
      .getByRole("link", { name: "Website Development", exact: false })
      .count(),
  );
  await page.screenshot({
    path: ".test-data/home-desktop.png",
    fullPage: true,
  });
  assert.equal(
    new URL(await page.locator("link[rel=canonical]").getAttribute("href"))
      .href,
    new URL(base).href,
  );
  const timings = await page.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    return {
      ttfbMs: Math.round(n.responseStart),
      domReadyMs: Math.round(n.domContentLoadedEventEnd),
      transferKB: Math.round(n.transferSize / 1024),
    };
  });
  console.log("Local browser navigation:", JSON.stringify(timings));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "Menu" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "About", exact: true })
    .waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Close" }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: ".test-data/home-mobile.png", fullPage: true });
  await page.goto(base + "/contact");
  await page.getByRole("button", { name: "Send your enquiry" }).click();
  await page.getByText("Please enter your name", { exact: true }).waitFor();
  await page.getByLabel("Your name").fill("Browser Test");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Mobile number").fill("+91 98765 43210");
  await page.getByLabel("Project budget").selectOption("25000-50000");
  await page
    .getByLabel("Tell us about your project")
    .fill("Please help us plan our new business website.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Send your enquiry" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your enquiry has been received" })
    .waitFor();
  assert.ok(await Lead.exists({ email }));
  console.log(
    "PASS: mobile navigation, responsive overflow, validated contact submission and MongoDB persistence",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  response = await page.goto(base + "/admin");
  assert.ok(page.url().endsWith("/admin/login"));
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: false }).click();
  await page.waitForURL(base + "/admin");
  await page.getByRole("heading", { name: /dashboard/i }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: /dashboard/i }).waitFor();
  console.log(
    "PASS: admin login, server-side route protection, cookie session and refresh",
  );
  await page.getByRole("link", { name: "Blogs", exact: true }).click();
  await page.getByRole("button", { name: "Create new" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Browser verification article");
  await page.getByLabel("URL slug").fill("browser-check-" + id);
  await page
    .getByLabel("Short description")
    .fill("A temporary article created by the automated browser test.");
  await page
    .getByLabel("Content (safe HTML")
    .fill(
      "<h2>A test heading</h2><p>This temporary article verifies the publishing flow.</p>",
    );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
  await page.reload();
  await page
    .getByRole("row")
    .filter({ hasText: "Browser verification article" })
    .waitFor();
  let post = await Blog.findOne({ slug: "browser-check-" + id });
  assert.equal(post.status, "draft");
  response = await page.request.get(base + "/blog/browser-check-" + id);
  assert.equal(response.status(), 404);
  const row = page
    .getByRole("row")
    .filter({ hasText: "Browser verification article" });
  await row.getByRole("button", { name: "Open", exact: true }).click();
  await page.getByLabel("Publication status").selectOption("published");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
  response = await page.request.get(base + "/blog/browser-check-" + id);
  assert.equal(response.status(), 200);
  assert.ok(
    (await response.text()).includes("This temporary article verifies"),
  );
  console.log(
    "PASS: admin draft creation, refresh persistence, publishing and public detail page",
  );
  await page.getByRole("link", { name: "Leads", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: email })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page.getByRole("combobox").selectOption("In Progress");
  await page.getByLabel("Internal notes").fill("Browser test follow up");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
  assert.equal((await Lead.findOne({ email })).status, "In Progress");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(base + "/admin/login");
  await page.goto(base + "/admin");
  assert.ok(page.url().endsWith("/admin/login"));
  assert.deepEqual(errors, []);
  response = await page.request.get(base + "/not-a-real-page");
  assert.equal(response.status(), 404);
  response = await page.request.get(base + "/opengraph-image");
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /image\/png/);
  console.log(
    "PASS: lead updates, logout, 404 status, social image and no browser runtime errors",
  );
} finally {
  await browser?.close();
  if (mongoose.connection.readyState === 1) {
    await Lead.deleteMany({ email });
    await Blog.deleteMany({ slug: "browser-check-" + id });
    if (user) {
      await Activity.deleteMany({ actor: user._id });
      await User.deleteOne({ _id: user._id });
    }
  }
  await mongoose.disconnect();
}
