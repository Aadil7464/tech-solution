// Interactive verification: the user enters all passwords in Chrome; this script never reads them.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseEnv } from "node:util";
import { networkInterfaces } from "node:os";
import mongoose from "mongoose";
import { chromium } from "@playwright/test";
import { User } from "../backend/src/models/index.js";

assert.equal(process.env.ALLOW_LOCAL_ACCOUNT_BROWSER, "1", "Explicit local-account verification opt-in is required");
const email = "digitalmitra786@gmail.com";
const raw = parseEnv(await fs.readFile("backend/.env", "utf8"));
assert.ok(["127.0.0.1", "localhost"].includes(new URL(raw.MONGODB_URI).hostname), "Only loopback MongoDB is allowed");
const lan = Object.values(networkInterfaces()).flat().find((item) => item.family === "IPv4" && !item.internal)?.address;
assert.ok(lan, "A LAN address is required for both-origin verification");
const origins = ["http://localhost:3000", `http://${lan}:3000`];
const allowed = new Set([...origins, "http://127.0.0.1:3000", "http://127.0.0.1:4000", "http://localhost:4000", `http://${lan}:4000`]);
const report = { database: "", email, stage: "preflight", verification: "actual local account; user-entered passwords", checks: {} };
const output = ".test-data/admin-account-real-verification.json";
let browser, context, page;
let instruction = "";
const deadline = 15 * 60 * 1000;
async function save(stage, checks = {}) {
  report.stage = stage;
  Object.assign(report.checks, checks);
  await fs.mkdir(".test-data", { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ stage, ...checks }));
}
async function instruct(text) {
  instruction = text;
  if (!page || page.isClosed()) return;
  await page.evaluate((message) => {
    let note = document.getElementById("local-account-verification-note");
    if (!note) {
      note = document.createElement("div");
      note.id = "local-account-verification-note";
      note.style.cssText = "position:fixed;bottom:12px;left:12px;right:12px;z-index:2147483647;background:#101828;color:white;padding:14px;border:2px solid #f97316;border-radius:8px;font:16px/1.5 Arial;box-shadow:0 4px 24px #0005";
      document.body.append(note);
    }
    note.textContent = message;
  }, text).catch(() => {});
}
const responseAt = async (pathname, status) => {
  const response = await context.waitForEvent("response", {
    predicate: (response) => new URL(response.url()).pathname === pathname && response.status() === status,
    timeout: deadline,
  });
  page = response.frame().page();
  return response;
};
async function dashboard() {
  await page.waitForURL((url) => url.pathname === "/admin", { timeout: deadline });
  await page.getByRole("heading", { level: 1, name: /dashboard/i }).waitFor();
  assert.equal(new URL(page.url()).search, "");
  const origin = new URL(page.url()).origin;
  const me = await page.request.get(origin + "/api/v1/auth/me");
  assert.equal(me.status(), 200);
  assert.equal((await me.json()).data.email, email);
  await page.reload();
  await page.getByRole("heading", { level: 1, name: /dashboard/i }).waitFor();
  return origin;
}
async function logout(origin) {
  await page.getByRole("button", { name: /Sign out/ }).click();
  await page.waitForURL(origin + "/admin/login");
  await page.goto(origin + "/admin");
  await page.waitForURL(origin + "/admin/login");
  assert.equal((await page.request.get(origin + "/api/v1/admin/dashboard")).status(), 401);
}
try {
  await mongoose.connect(raw.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  report.database = mongoose.connection.name;
  const users = await User.find({}).select("+passwordHash +passwordResetHash").lean();
  const matches = users.filter((user) => user.email?.trim().toLowerCase() === email);
  assert.equal(matches.length, 1, "Expected one official-email account");
  const before = matches[0];
  assert.equal(before.role, "admin");
  assert.equal(before.email, email);
  browser = await chromium.launch({ headless: false, executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  context = await browser.newContext();
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["http:", "https:"].includes(url.protocol) && !allowed.has(url.origin) ? route.abort() : route.continue();
  });
  page = await context.newPage();
  context.on("page", (opened) => {
    opened.on("domcontentloaded", () => { void instruct(instruction); });
  });
  page.setDefaultTimeout(20000);
  page.on("domcontentloaded", () => { void instruct(instruction); });
  await page.goto(origins[0] + "/admin/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  if (process.env.VERIFY_LOGIN_AFTER_OWNER_RESET === "1") {
    assert.ok(before.passwordChangedAt, "A persisted password change is required");
    assert.equal(before.passwordResetHash, undefined);
    assert.equal(before.passwordResetExpires, undefined);
    await save("awaiting_new_password_login", { ownerConfirmedReset: true, persistedPasswordChange: true, tokenConsumed: true, resetSuccessVisible: "owner confirmed; not observed by this browser" });
    await page.goto(origins[0] + "/admin/login");
    await instruct("Sign in using the NEW password you just chose. Enter it only in this browser. The test will refresh the dashboard and sign out automatically.");
  } else {
  if (process.env.USE_EXISTING_RESET !== "1") {
    const sent = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/auth/forgot-password", { timeout: 30000 });
    await page.getByRole("button", { name: /Send reset link/ }).click();
    const mailResponse = await sent;
    await save("mail_request_result", { mailRequestStatus: mailResponse.status() });
    assert.equal(mailResponse.status(), 200);
    await page.getByRole("status").filter({ hasText: "Password reset link sent successfully! Please check your inbox and spam folder." }).waitFor();
  }
  const issued = await User.findById(before._id).select("+passwordHash +passwordResetHash").lean();
  assert.equal(issued.passwordHash, before.passwordHash);
  assert.ok(issued.passwordResetHash);
  if (process.env.USE_EXISTING_RESET !== "1") assert.notEqual(issued.passwordResetHash, before.passwordResetHash);
  assert.ok(issued.passwordResetExpires > new Date());
  await save("awaiting_user_reset", { smtpAccepted: process.env.USE_EXISTING_RESET === "1" ? "see delivery evidence" : true, runningBackendDatabaseConfirmed: process.env.USE_EXISTING_RESET === "1" ? "pending actual reset" : true, accountIdPreserved: true, passwordUnchangedBeforeUserReset: true, tokenHashStored: true, tokenExpiryValid: true });
  await instruct("A reset email was sent. Open the NEW email link in THIS Chrome window, choose your new password and confirm it. Enter passwords only here, never in chat. Then use Go to Login and sign in with your NEW password.");
  const reset = await responseAt("/api/v1/auth/reset-password", 200);
  assert.equal((await reset.json()).data.message, "Password changed successfully! You can now log in using your new password.");
  await page.getByRole("status").filter({ hasText: "Password changed successfully! You can now log in using your new password." }).waitFor();
  const after = await User.findById(before._id).select("+passwordHash +passwordResetHash").lean();
  assert.equal(after.email, email);
  assert.equal(after.role, "admin");
  assert.notEqual(after.passwordHash, before.passwordHash);
  assert.ok(after.passwordChangedAt);
  assert.ok(after.sessionVersion > before.sessionVersion);
  assert.equal(after.passwordResetHash, undefined);
  assert.equal(after.passwordResetExpires, undefined);
  await save("awaiting_new_password_login", { realPasswordChanged: true, databaseUpdateVerified: true, runningBackendDatabaseConfirmed: true, tokenConsumed: true, sessionsInvalidated: true, resetSuccessVisible: true });
  await instruct("Password changed successfully. Click Go to Login and sign in with the NEW password you just chose. The test will refresh and sign out automatically.");
  }
  await responseAt("/api/v1/auth/login", 200);
  const firstOrigin = await dashboard();
  await save("awaiting_previous_password_test", { firstOrigin, firstLogin: true, firstDashboardRefresh: true });
  await logout(firstOrigin);
  await instruct("Now enter your PREVIOUS password once and click Sign in. It should be rejected. Do not enter the new password for this step. The test never reads password fields.");
  await responseAt("/api/v1/auth/login", 401);
  await page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }).waitFor();
  await save("awaiting_second_origin_login", { previousPasswordAttemptRejected: true, firstLogoutAndProtection: true });
  const secondOrigin = origins.find((origin) => origin !== firstOrigin);
  assert.ok(secondOrigin);
  await page.goto(secondOrigin + "/admin/login");
  await instruct("Final check: sign in on this other local origin using your NEW password. The test will refresh the dashboard and sign out, then finish.");
  await responseAt("/api/v1/auth/login", 200);
  await dashboard();
  await logout(secondOrigin);
  assert.equal(await User.countDocuments(), users.length);
  await save("complete", { secondOrigin, secondLogin: true, secondDashboardRefresh: true, secondLogoutAndProtection: true, userCountUnchanged: true, passwordsReadByTest: false });
  await instruct("Verification finished successfully on localhost and LAN. Your new password was not read or logged by the test. You are signed out.");
} catch (error) {
  await save("incomplete", { errorType: error.name, lastInstruction: instruction || "Preflight did not complete. No password was generated or read." });
  process.exitCode = 1;
} finally {
  await browser?.close();
  await mongoose.disconnect();
}
