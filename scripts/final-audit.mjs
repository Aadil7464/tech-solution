import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import { chromium } from "@playwright/test";
import { createApp } from "../backend/src/app.js";
import { seed } from "../backend/src/seed.js";
import { User } from "../backend/src/models/index.js";

// All writes, account creation and password resets are confined to this disposable DB.
const base = "http://localhost:3100";
const lan = Object.values(networkInterfaces()).flat().find((n) => n.family === "IPv4" && !n.internal)?.address;
const mongo = await MongoMemoryServer.create();
const savedGeneratedFiles = await Promise.all(["frontend/next-env.d.ts", "frontend/tsconfig.json"].map(async (path) => ({ path, content: await fs.readFile(path, "utf8") })));
const password = crypto.randomBytes(24).toString("hex");
const replacement = crypto.randomBytes(24).toString("hex");
let server, web, production, browser, resetMessage;
const children = [];
const env = {
  NODE_ENV: "test", JWT_SECRET: crypto.randomBytes(48).toString("hex"),
  FRONTEND_URL: base, FRONTEND_URLS: lan ? `http://${lan}:3100` : "",
  PUBLIC_API_URL: "http://localhost:4100", UPLOAD_DIR: ".test-data/audit-uploads",
  SMTP_HOST: "smtp.example.test", SMTP_FROM: "website@example.com",
};
const run = (file, extra = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [file], {
    stdio: "inherit", env: { ...process.env, MONGODB_URI: mongo.getUri(), TEST_BASE_URL: base, ...extra },
  });
  children.push(child);
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${file} exited ${code}`)));
});
try {
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  await seed();
  await User.create({ email: "digitalmitra786@gmail.com", name: "Isolated audit", role: "admin", passwordHash: await bcrypt.hash(password, 12) });
  server = createApp(env, { passwordResetTransport: { sendMail: async (message) => { resetMessage = message; return { accepted: [message.to], rejected: [] }; } } }).listen(4100, "0.0.0.0");
  await new Promise((resolve) => server.once("listening", resolve));
  let webLog = "";
  web = spawn(process.execPath, ["../node_modules/next/dist/bin/next", "dev", "--hostname", "0.0.0.0", "--port", "3100"], {
    cwd: "frontend", env: { ...process.env, API_INTERNAL_URL: "http://127.0.0.1:4100", NEXT_PUBLIC_SITE_URL: base, NEXT_DIST_DIR: ".next-audit", DEV_ALLOWED_ORIGINS: lan || "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  web.stdout.on("data", (data) => { webLog = (webLog + data).slice(-10000); });
  web.stderr.on("data", (data) => { webLog = (webLog + data).slice(-10000); });
  for (let attempt = 0; attempt < 90; attempt++) {
    if (web.exitCode !== null) throw new Error(`Audit frontend failed: ${webLog}`);
    try { if ((await fetch(base, { signal: AbortSignal.timeout(2000) })).ok) break; } catch {}
    if (attempt === 89) throw new Error("Audit frontend readiness timed out");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  const runtimeErrors = [];
  page.on("pageerror", (e) => runtimeErrors.push(e.message));
  await fs.mkdir(".test-data", { recursive: true });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
    assert.ok(await page.locator(".mitra-hero").evaluate((hero) => {
      const bounds = hero.getBoundingClientRect();
      return [...hero.querySelectorAll(".hero-actions a")].every((link) => link.getBoundingClientRect().bottom <= bounds.bottom);
    }), `hero buttons must not be clipped at ${width}`);
    for (const name of ["Mohammad Aadil", "Shadab Sheikh", "Mohd. Suleman"]) assert.ok(await page.getByText(name, { exact: true }).count());
    const logos = await page.locator(".brand-logo img").evaluateAll((images) => images.map((img) => ({ width: img.clientWidth, height: img.clientHeight, natural: img.naturalWidth / img.naturalHeight })));
    for (const logo of logos) assert.ok(Math.abs(logo.width / logo.height - logo.natural) < 0.15, `logo ratio at ${width}`);
    await page.screenshot({ path: `.test-data/final-home-${width}.png`, fullPage: true });
  }
  console.log("PASS: team contacts, logo proportions and responsive layout at 320/390/768/1440px");
  for (const origin of [base, ...(lan ? [`http://${lan}:3100`] : [])]) {
    const context = await browser.newContext();
    const tab = await context.newPage();
    let hmrConnected = false;
    tab.on("websocket", (socket) => { socket.on("framereceived", () => { hmrConnected = true; }); });
    await tab.goto(origin + "/admin/login");
    await tab.getByLabel("Email", { exact: true }).fill("digitalmitra786@gmail.com");
    await tab.getByLabel("Password", { exact: true }).fill(password);
    await tab.getByRole("button", { name: /Sign in/ }).click();
    await tab.waitForURL(origin + "/admin");
    await tab.getByRole("heading", { name: /dashboard/i }).waitFor();
    await tab.reload();
    await tab.getByRole("heading", { name: /dashboard/i }).waitFor();
    assert.ok(hmrConnected, `${origin}: HMR websocket frames`);
    assert.equal(new URL(tab.url()).search, "");
    console.log(`PASS: ${origin === base ? "localhost" : "LAN"} login, dashboard refresh and HMR websocket`);
    await context.close();
  }
  await page.goto(base + "/admin/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("digitalmitra786@gmail.com");
  await page.getByRole("button", { name: /Send reset link/ }).click();
  await page.getByRole("status").filter({ hasText: "Password reset link sent successfully! Please check your inbox and spam folder." }).waitFor();
  assert.ok(resetMessage);
  assert.equal(resetMessage.subject, "Reset Your Tech Solutions Admin Password");
  const resetUrl = resetMessage.text.match(/https?:\/\/\S+/)[0];
  await page.goto(resetUrl);
  await page.getByLabel("New password", { exact: true }).fill(replacement);
  await page.getByLabel("Confirm new password", { exact: true }).fill(replacement);
  await page.getByRole("button", { name: /Reset password/ }).click();
  await page.getByRole("status").filter({ hasText: "Password changed successfully! You can now log in using your new password." }).waitFor();
  await page.getByRole("link", { name: "Go to Login", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("digitalmitra786@gmail.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.getByRole("alert").filter({ hasText: "Email or password is incorrect" }).waitFor();
  await page.getByLabel("Password", { exact: true }).fill(replacement);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL(base + "/admin");
  await page.getByRole("heading", { name: /dashboard/i }).waitFor();
  await page.getByRole("status").filter({ hasText: "Login successful! Welcome to Tech Solutions." }).waitFor();
  assert.deepEqual(runtimeErrors, []);
  console.log("PASS: browser forgot/reset flow with captured test mail, old password rejected, new password opens dashboard");
  await browser.close(); browser = null;
  // Reuse the existing project checks against the same isolated database.
  const failures = [];
  try {
    await run("scripts/admin-modules-browser-check.mjs", {
      TEST_ISOLATED_DATABASE: "1", TEST_ADMIN_EMAIL: "digitalmitra786@gmail.com", TEST_ADMIN_PASSWORD: replacement,
    });
  } catch (error) { failures.push(error.message); }
  if (process.env.AUDIT_CHECKS !== "modules") {
  for (const file of ["scripts/route-check.mjs", "scripts/browser-check.mjs", "scripts/cms-browser-check.mjs"]) {
    try { await run(file); } catch (error) { failures.push(error.message); }
  }
  const productionEnv = { ...process.env, API_INTERNAL_URL: "http://127.0.0.1:4100", NEXT_PUBLIC_SITE_URL: "http://localhost:3101", NEXT_DIST_DIR: ".next-audit/production" };
  await new Promise((resolve, reject) => {
    const build = spawn(process.execPath, ["../node_modules/next/dist/bin/next", "build"], { cwd: "frontend", env: productionEnv, stdio: "inherit" });
    children.push(build);
    build.once("error", reject);
    build.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Audit production build failed")));
  });
  production = spawn(process.execPath, ["../node_modules/next/dist/bin/next", "start", "--port", "3101"], { cwd: "frontend", env: productionEnv, stdio: "inherit" });
  for (let attempt = 0; attempt < 30; attempt++) {
    try { if ((await fetch("http://localhost:3101")).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  try { await run("scripts/performance-check.mjs", { TEST_BASE_URL: "http://localhost:3101" }); } catch (error) { failures.push(error.message); }
  }
  assert.deepEqual(failures, [], "Existing project audit checks");
} finally {
  await browser?.close();
  for (const child of children) if (child.exitCode === null) child.kill();
  if (production && production.exitCode === null) {
    production.kill();
    await new Promise((resolve) => production.once("exit", resolve));
  }
  if (web && web.exitCode === null) {
    web.kill();
    await new Promise((resolve) => web.once("exit", resolve));
  }
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const file of savedGeneratedFiles) await fs.writeFile(file.path, file.content);
  await mongoose.disconnect();
  await mongo.stop();
}
