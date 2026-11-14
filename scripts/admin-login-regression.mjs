import assert from "node:assert/strict";
import { networkInterfaces } from "node:os";
import { chromium } from "@playwright/test";

const lan = Object.values(networkInterfaces()).flat().find((item) => item.family === "IPv4" && !item.internal)?.address;
const origins = process.env.LOGIN_TEST_ORIGINS?.split(",") || ["http://localhost:3000", ...(lan ? [`http://${lan}:3000`] : [])];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  for (const origin of origins) {
    const page = await browser.newPage();
    const runtimeErrors = [], socketErrors = [], posts = [];
    let frames = 0;
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("websocket", (socket) => {
      socket.on("framereceived", () => frames++);
      socket.on("socketerror", (error) => socketErrors.push(String(error).split("?")[0]));
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      assert.equal(url.searchParams.has("password"), false);
      if (url.pathname === "/api/v1/auth/login") {
        assert.equal(request.method(), "POST");
        assert.match(request.headers()["content-type"], /application\/json/);
        posts.push(request);
      }
    });
    await page.goto(origin + "/admin/login?legacy=discarded#legacy");
    await page.getByLabel("Password", { exact: true }).fill("deliberately-invalid-login-regression");
    assert.equal(new URL(page.url()).search, "");
    const response = page.waitForResponse((item) => new URL(item.url()).pathname === "/api/v1/auth/login");
    await page.getByRole("button", { name: /Sign in/ }).click();
    assert.equal((await response).status(), 401);
    await page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }).waitFor();
    assert.equal(posts.length, 1);
    assert.ok(frames > 0, "development HMR must receive frames");
    assert.deepEqual(socketErrors, []);
    assert.deepEqual(runtimeErrors, []);

    await page.route("**/api/v1/auth/login", (route) => route.abort("connectionfailed"));
    await page.getByRole("button", { name: /Sign in/ }).click();
    await page.getByRole("alert").filter({ hasText: "Unable to connect to the server. Please try again." }).waitFor();
    await page.unroute("**/api/v1/auth/login");
    let duplicateCount = 0;
    await page.route("**/api/v1/auth/login", async (route) => {
      duplicateCount++;
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "Email or password is incorrect" } }) });
    });
    await page.getByRole("button", { name: /Sign in/ }).click();
    await page.getByRole("button", { name: /Signing in/ }).waitFor();
    assert.equal(await page.getByLabel("Password", { exact: true }).isDisabled(), true);
    await page.locator("form").evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
    await page.getByRole("button", { name: /Sign in/ }).waitFor();
    assert.equal(duplicateCount, 1);
    assert.equal(new URL(page.url()).search, "");
    await page.reload();
    assert.equal(await page.getByLabel("Email", { exact: true }).inputValue(), "digitalmitra786@gmail.com");
    assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
    console.log(`PASS: ${new URL(origin).hostname} actual API POST/401, visible error, network failure, loading/duplicate guard, clean URL and HMR`);
    await page.close();

    for (const javascriptEnabled of [false, true]) {
      const context = await browser.newContext({ javaScriptEnabled: javascriptEnabled });
      const cold = await context.newPage();
      if (javascriptEnabled) await cold.route("**/_next/static/**", (route) => route.abort());
      await cold.goto(origin + "/admin/login");
      assert.equal(await cold.locator("form").getAttribute("method"), "post");
      assert.equal(await cold.getByLabel("Password", { exact: true }).isDisabled(), true);
      assert.equal(await cold.getByRole("button", { name: /Sign in/ }).isDisabled(), true);
      await context.close();
    }
    console.log(`PASS: ${new URL(origin).hostname} JS-disabled and failed-hydration forms cannot leak credentials via native GET`);
  }
} finally { await browser.close(); }
