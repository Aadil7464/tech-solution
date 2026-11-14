import assert from "node:assert/strict";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import sharp from "sharp";

// The owning audit supplies an isolated fixture account; no real account is used.
assert.equal(process.env.TEST_ISOLATED_DATABASE, "1");
const base = process.env.TEST_BASE_URL;
assert.equal(new URL(base).hostname, "localhost");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.TEST_ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(process.env.TEST_ADMIN_PASSWORD);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL(base + "/admin");
  await page.getByRole("status").filter({ hasText: "Login successful! Welcome to Tech Solutions." }).waitFor();
  const suffix = crypto.randomBytes(5).toString("hex");
  for (const kind of ["blogs", "services", "portfolio", "testimonials", "pages", "categories"]) {
    await page.getByRole("link", { name: kind === "blogs" ? "Blogs" : kind[0].toUpperCase() + kind.slice(1), exact: true }).click();
    await page.waitForURL(base + `/admin/${kind}`);
    await page.getByRole("heading", { level: 1, name: kind === "blogs" ? "Blog posts" : kind, exact: true }).waitFor();
    await page.getByRole("button", { name: "Create new" }).click();
    const title = `UI ${kind} ${suffix}`;
    await page.getByLabel("Title", { exact: true }).fill(title);
    await page.getByLabel("URL slug", { exact: false }).fill(`ui-${kind}-${suffix}`);
    if (kind === "categories") await page.getByLabel("Description", { exact: true }).fill("Isolated category");
    else {
      await page.getByLabel("Short description", { exact: false }).fill("Isolated CMS browser verification");
      await page.getByLabel("Content (safe HTML", { exact: false }).fill("<h2>Verified content</h2><p>Isolated fixture only.</p>");
      await page.getByLabel("Image URL from Media", { exact: true }).fill("/media/web-development.jpg");
      await page.getByLabel("Descriptive image alt text", { exact: true }).fill("Development workspace");
    }
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
    await page.getByRole("textbox", { name: "Search records" }).fill(suffix);
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "GET" && response.url().includes(`/admin/${kind}?`) && new URL(response.url()).searchParams.get("search") === suffix),
      page.getByRole("button", { name: "Search", exact: true }).click(),
    ]);
    let row = page.getByRole("row").filter({ hasText: title });
    await row.waitFor();
    await page.waitForFunction(() => document.querySelectorAll(".admin-content tbody tr").length === 1);
    assert.equal(await page.getByRole("row").count(), 2);
    await row.getByRole("button", { name: "Open", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(`Updated ${title}`);
    if (kind !== "categories") {
      await page.getByLabel("Publication status").selectOption("published");
      if (["portfolio", "testimonials"].includes(kind)) {
        await page.getByLabel("I have reviewed and approved", { exact: false }).check();
        await page.getByLabel("The client has given permission", { exact: false }).check();
      }
    }
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Changes saved" }).waitFor();
    await page.reload();
    row = page.getByRole("row").filter({ hasText: `Updated ${title}` });
    await row.waitFor();
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "Record deleted" }).waitFor();
    console.log(`PASS: ${kind} UI create/edit/search/refresh/delete and relative image persistence`);
  }
  await page.getByRole("link", { name: "Media", exact: true }).click();
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#f97316" } }).png().toBuffer();
  const file = { name: "isolated.png", mimeType: "image/png", buffer: png };
  await page.getByLabel("Image file", { exact: true }).setInputFiles(file);
  await page.getByLabel("Descriptive alternative text", { exact: true }).fill(`Media ${suffix}`);
  await page.getByRole("button", { name: /^Upload/ }).click();
  await page.getByRole("status").filter({ hasText: "Image uploaded" }).waitFor();
  const media = page.locator(".media-item").filter({ hasText: `Media ${suffix}` });
  const originalUrl = await media.getByLabel("Public image URL").inputValue();
  await media.getByLabel("Edit alternative text").fill(`Updated media ${suffix}`);
  await media.getByRole("button", { name: "Save alt text" }).click();
  await page.getByRole("status").filter({ hasText: "Alternative text saved" }).waitFor();
  const updatedMedia = page.locator(".media-item").filter({ hasText: `Updated media ${suffix}` });
  await updatedMedia.getByLabel("Replacement image").setInputFiles(file);
  await updatedMedia.getByRole("button", { name: "Replace image" }).click();
  await page.getByRole("status").filter({ hasText: "Image replaced" }).waitFor();
  assert.equal(await updatedMedia.getByLabel("Public image URL").inputValue(), originalUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await updatedMedia.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Record deleted" }).waitFor();
  console.log("PASS: Media UI upload, alternative-text edit, stable-URL replacement and deletion");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Business email", { exact: true }).fill("digitalmitra786@gmail.com");
  await page.getByLabel("Light background logo URL", { exact: true }).fill("/logo/digital-mitra-agency.svg");
  await page.getByLabel("Dark background logo URL", { exact: true }).fill("/logo/digital-mitra-agency-dark.svg");
  await page.getByRole("button", { name: "Save settings", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Website settings saved" }).waitFor();
  await page.reload();
  assert.equal(await page.getByLabel("Business email", { exact: true }).inputValue(), "digitalmitra786@gmail.com");
  const hydratedPasswordForms = await page.locator("form").evaluateAll((forms) => forms.filter((form) => form.querySelector('input[type="password"]')).map((form) => form.method));
  assert.deepEqual(hydratedPasswordForms, ["post", "post"]);
  const coldContext = await browser.newContext({ javaScriptEnabled: false });
  await coldContext.addCookies(await page.context().cookies());
  const coldSettings = await coldContext.newPage();
  await coldSettings.goto(base + "/admin/settings");
  const passwordForms = await coldSettings.locator("form").evaluateAll((forms) => forms.filter((form) => form.querySelector('input[type="password"]')).map((form) => ({ method: form.method, disabled: [...form.querySelectorAll('input[type="password"]')].every((input) => input.disabled) })));
  // Admin settings are data-loaded after hydration: without JS no password form is exposed.
  assert.equal(passwordForms.length, 0);
  await coldSettings.getByRole("status").filter({ hasText: "Loading" }).waitFor();
  await coldContext.close();
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await page.getByRole("table").waitFor();
  assert.ok(await page.getByRole("row").count() > 1);
  assert.deepEqual(errors, []);
  console.log("PASS: Settings save/refresh and read-only Activity UI; no browser runtime errors");
} finally { await browser.close(); }
