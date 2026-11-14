import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { User, Page, Activity } from "../backend/src/models/index.js";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const id = crypto.randomBytes(6).toString("hex");
const email = `cms-${id}@example.com`,
  password = crypto.randomBytes(20).toString("hex"),
  slug = "cms-check-" + id;
let browser, user;
try {
  await mongoose.connect(process.env.MONGODB_URI);
  user = await User.create({
    email,
    name: "CMS Browser Test",
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL(base + "/admin");
  await page.getByRole("link", { name: "Pages", exact: true }).click();
  await page.getByRole("button", { name: "Create new" }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("CMS browser verification");
  await page.getByLabel("URL slug").fill(slug);
  await page
    .getByLabel("Short description")
    .fill("A temporary page that verifies editable CMS content.");
  await page
    .getByLabel("Content (safe HTML")
    .fill("<h2>Editable content</h2><p>This page is stored in MongoDB.</p>");
  await page
    .getByText("Page sections", { exact: false })
    .filter({ has: page.locator("span") })
    .first()
    .click();
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByLabel("Section key", { exact: true }).fill("approach");
  await page.getByLabel("Section heading").fill("A real section from the CMS");
  await page
    .getByLabel("Section description")
    .fill("A section edited through the authenticated admin interface.");
  await page
    .getByText("Frequently asked questions", { exact: false })
    .filter({ has: page.locator("span") })
    .first()
    .click();
  await page.getByRole("button", { name: "Add question" }).click();
  await page
    .getByLabel("Question", { exact: true })
    .fill("Is this persistent content?");
  await page
    .getByLabel("Answer", { exact: true })
    .fill("Yes. It is persisted in the existing MongoDB database.");
  await page
    .getByText("Search engine settings", { exact: false })
    .filter({ has: page.locator("span") })
    .first()
    .click();
  await page.getByLabel("Open Graph title").fill("CMS social preview title");
  await page
    .getByLabel("Additional structured data")
    .fill(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "CMS browser verification",
      }),
    );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
  assert.equal((await page.request.get(base + "/" + slug)).status(), 404);
  await page
    .getByRole("row")
    .filter({ hasText: "CMS browser verification" })
    .getByRole("button", { name: "Open", exact: true })
    .click();
  await page.getByLabel("Publication status").selectOption("published");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
  await page.goto(base + "/" + slug);
  await page
    .getByRole("heading", { name: "A real section from the CMS" })
    .waitFor();
  await page.getByText("Is this persistent content?").click();
  await page
    .getByText("Yes. It is persisted in the existing MongoDB database.")
    .waitFor({ state: "visible" });
  assert.equal(
    await page.locator('meta[property="og:title"]').getAttribute("content"),
    "CMS social preview title",
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "A real section from the CMS" })
    .waitFor();
  await page.goto(base);
  await page.locator(".services-menu-trigger").hover();
  await page
    .getByRole("link", { name: "Mobile App Development", exact: true })
    .click();
  await page
    .getByRole("heading", { level: 1, name: "Mobile App Development" })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: ".test-data/service-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: page creation, section and FAQ editing, social SEO, draft protection, publishing, persistence, service dropdown and mobile service layout.",
  );
} finally {
  await browser?.close();
  if (mongoose.connection.readyState === 1) {
    await Page.deleteMany({ slug });
    if (user) {
      await Activity.deleteMany({ actor: user._id });
      await User.deleteOne({ _id: user._id });
    }
  }
  await mongoose.disconnect();
}
